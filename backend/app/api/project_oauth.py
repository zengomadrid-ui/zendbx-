"""
Project-Level OAuth Authentication
Public endpoints for end-user authentication in client applications

Unlike platform OAuth (/oauth/...), these endpoints are for authenticating
end users into their own applications, similar to Supabase Auth.

Flow:
1. Developer's app → GET /p/{project}/auth/{provider}
2. User authenticates with Google/GitHub
3. Callback → GET /p/{project}/auth/{provider}/callback
4. Redirect to developer's app with JWT token
"""
from fastapi import APIRouter, HTTPException, Request, Query
from fastapi.responses import RedirectResponse
from typing import Optional
import httpx
import secrets
from datetime import datetime, timedelta, timezone
from urllib.parse import urlencode
import logging

from ..core.database import get_main_db_pool, get_project_db_pool
from ..core.security import (
    generate_oauth_state,
    decrypt_client_secret,
    validate_redirect_url,
    create_access_token
)
from ..core.config import settings

logger = logging.getLogger(__name__)

router = APIRouter(tags=["Project OAuth"])

# OAuth provider configurations
OAUTH_CONFIGS = {
    'google': {
        'auth_url': 'https://accounts.google.com/o/oauth2/v2/auth',
        'token_url': 'https://oauth2.googleapis.com/token',
        'userinfo_url': 'https://www.googleapis.com/oauth2/v2/userinfo',
        'scopes': 'openid email profile'
    },
    'github': {
        'auth_url': 'https://github.com/login/oauth/authorize',
        'token_url': 'https://github.com/login/oauth/access_token',
        'userinfo_url': 'https://api.github.com/user',
        'scopes': 'user:email'
    }
}


@router.get("/p/{project_slug}/auth/{provider}")
async def project_oauth_initiate(
    project_slug: str,
    provider: str,
    request: Request,
    redirect_to: Optional[str] = Query(None, description="URL to redirect after successful authentication")
):
    """
    PUBLIC ENDPOINT - No authentication required
    
    Initiate OAuth flow for end users logging into a project's application.
    This is used by developers' client apps, not the ZenDBX dashboard.
    
    Example:
    GET /p/my-project/auth/google?redirect_to=https://myapp.com/auth/callback
    """
    if provider not in OAUTH_CONFIGS:
        raise HTTPException(status_code=400, detail=f"Invalid provider. Must be 'google' or 'github'")

    pool = await get_main_db_pool()
    async with pool.acquire() as conn:
        # Resolve project
        project = await conn.fetchrow(
            """
            SELECT id, slug, database_name FROM projects 
            WHERE slug = $1 OR legacy_slug = $1
            ORDER BY CASE WHEN slug = $1 THEN 1 ELSE 2 END
            LIMIT 1
            """,
            project_slug
        )
        
        if not project:
            raise HTTPException(status_code=404, detail=f"Project '{project_slug}' not found")

        project_id = project["id"]

        # Load OAuth provider configuration
        provider_config = await conn.fetchrow(
            """
            SELECT client_id, client_secret_encrypted, enabled
            FROM oauth_provider_settings
            WHERE project_id = $1 AND provider = $2
            """,
            project_id, provider
        )
        
        if not provider_config:
            raise HTTPException(
                status_code=404,
                detail=f"{provider.title()} OAuth is not configured for this project. "
                       f"Configure it in the ZenDBX dashboard."
            )
        
        if not provider_config["enabled"]:
            raise HTTPException(
                status_code=403,
                detail=f"{provider.title()} OAuth is disabled for this project"
            )

        # Validate redirect_to URL against whitelist
        if redirect_to:
            allowed_urls = await conn.fetch(
                "SELECT redirect_url FROM oauth_redirect_urls WHERE project_id = $1 AND active = true",
                project_id
            )
            allowed_list = [row["redirect_url"] for row in allowed_urls]
            
            if not validate_redirect_url(redirect_to, allowed_list):
                raise HTTPException(
                    status_code=400,
                    detail=f"redirect_to URL '{redirect_to}' is not whitelisted. "
                           f"Add it in Authentication → Redirect URLs"
                )
        else:
            # Use first redirect URL as default
            default = await conn.fetchrow(
                """
                SELECT redirect_url FROM oauth_redirect_urls
                WHERE project_id = $1 AND active = true
                ORDER BY created_at LIMIT 1
                """,
                project_id
            )
            if default:
                redirect_to = default["redirect_url"]
            else:
                raise HTTPException(
                    status_code=400,
                    detail="No redirect URL configured. Add one in Authentication → Redirect URLs"
                )

        # Generate CSRF state token
        state_token = generate_oauth_state()
        expires_at = datetime.now(timezone.utc) + timedelta(minutes=10)

        # Store state session
        await conn.execute(
            """
            INSERT INTO oauth_state_sessions
              (state_token, project_id, provider, redirect_url, expires_at)
            VALUES ($1, $2, $3, $4, $5)
            """,
            state_token, project_id, provider, redirect_to, expires_at
        )

        # Build OAuth provider authorization URL
        oauth_config = OAUTH_CONFIGS[provider]
        callback_url = f"{settings.BACKEND_URL}/p/{project_slug}/auth/{provider}/callback"

        params = {
            'client_id': provider_config["client_id"],
            'redirect_uri': callback_url,
            'response_type': 'code',
            'scope': oauth_config['scopes'],
            'state': state_token
        }
        
        if provider == 'google':
            params['access_type'] = 'offline'
            params['prompt'] = 'consent'

        auth_url = f"{oauth_config['auth_url']}?{urlencode(params)}"

        logger.info(
            f"[Project OAuth] Initiated | project={project_slug} provider={provider} "
            f"redirect_to={redirect_to}"
        )

        return RedirectResponse(url=auth_url)


@router.get("/p/{project_slug}/auth/{provider}/callback")
async def project_oauth_callback(
    project_slug: str,
    provider: str,
    request: Request,
    code: str = Query(...),
    state: str = Query(...),
    error: Optional[str] = Query(None),
):
    """
    PUBLIC ENDPOINT - No authentication required
    
    OAuth callback endpoint for project-level authentication.
    Called by Google/GitHub after user authenticates.
    """
    if error:
        raise HTTPException(status_code=400, detail=f"OAuth error: {error}")

    pool = await get_main_db_pool()
    async with pool.acquire() as conn:
        # Validate state token
        session = await conn.fetchrow(
            """
            SELECT project_id, provider, redirect_url, expires_at
            FROM oauth_state_sessions
            WHERE state_token = $1
            """,
            state
        )
        
        if not session:
            raise HTTPException(status_code=400, detail="Invalid or expired state token")

        expires_at = session["expires_at"]
        if expires_at.tzinfo is None:
            expires_at = expires_at.replace(tzinfo=timezone.utc)
        if expires_at < datetime.now(timezone.utc):
            await conn.execute("DELETE FROM oauth_state_sessions WHERE state_token = $1", state)
            raise HTTPException(status_code=400, detail="State token expired")

        if session["provider"] != provider:
            raise HTTPException(status_code=400, detail="Provider mismatch")

        project_id = session["project_id"]
        redirect_url = session["redirect_url"]

        # Delete used state token
        await conn.execute("DELETE FROM oauth_state_sessions WHERE state_token = $1", state)

        # Get project info
        project = await conn.fetchrow(
            "SELECT database_name, slug FROM projects WHERE id = $1",
            project_id
        )

        # Load provider config
        provider_config = await conn.fetchrow(
            """
            SELECT client_id, client_secret_encrypted
            FROM oauth_provider_settings
            WHERE project_id = $1 AND provider = $2
            """,
            project_id, provider
        )
        
        if not provider_config:
            raise HTTPException(status_code=404, detail="Provider configuration not found")

        client_secret = decrypt_client_secret(provider_config["client_secret_encrypted"])
        oauth_config = OAUTH_CONFIGS[provider]
        callback_url = f"{settings.BACKEND_URL}/p/{project_slug}/auth/{provider}/callback"

        # Exchange code for access token
        try:
            async with httpx.AsyncClient() as http:
                token_resp = await http.post(
                    oauth_config['token_url'],
                    data={
                        'client_id': provider_config["client_id"],
                        'client_secret': client_secret,
                        'code': code,
                        'redirect_uri': callback_url,
                        'grant_type': 'authorization_code'
                    },
                    headers={'Accept': 'application/json'}
                )
                
                if token_resp.status_code != 200:
                    raise HTTPException(status_code=400, detail="Failed to exchange code for token")

                token_data = token_resp.json()
                access_token = token_data.get('access_token')
                
                if not access_token:
                    raise HTTPException(status_code=400, detail="No access token received")

                # Fetch user profile
                headers = {'Authorization': f'Bearer {access_token}'}
                if provider == 'github':
                    headers['Accept'] = 'application/vnd.github.v3+json'

                user_resp = await http.get(oauth_config['userinfo_url'], headers=headers)
                if user_resp.status_code != 200:
                    raise HTTPException(status_code=400, detail="Failed to fetch user profile")

                user_data = user_resp.json()

                # GitHub: fetch primary email if not in profile
                if provider == 'github' and not user_data.get('email'):
                    email_resp = await http.get(
                        'https://api.github.com/user/emails',
                        headers={'Authorization': f'Bearer {access_token}'}
                    )
                    if email_resp.status_code == 200:
                        emails = email_resp.json()
                        primary = next((e for e in emails if e.get('primary')), None)
                        user_data['email'] = (primary or emails[0])['email']

        except httpx.HTTPError as e:
            logger.error(f"OAuth provider HTTP error: {e}")
            raise HTTPException(status_code=500, detail=f"OAuth provider error: {str(e)}")

        # Parse user info
        if provider == 'google':
            email = user_data.get('email')
            name = user_data.get('name')
            avatar = user_data.get('picture')
            provider_user_id = str(user_data.get('id', ''))
        else:
            email = user_data.get('email')
            name = user_data.get('name') or user_data.get('login')
            avatar = user_data.get('avatar_url')
            provider_user_id = str(user_data.get('id', ''))

        if not email:
            raise HTTPException(status_code=400, detail="Email not provided by OAuth provider")

        # Create/update user in project database ONLY (not platform)
        project_pool = await get_project_db_pool(project["database_name"])
        
        async with project_pool.acquire() as pconn:
            existing = await pconn.fetchrow("SELECT id FROM users WHERE email = $1", email)
            
            if existing:
                user_id = existing["id"]
                await pconn.execute(
                    """
                    UPDATE users
                    SET full_name = COALESCE($1, full_name),
                        avatar_url = COALESCE($2, avatar_url),
                        updated_at = NOW()
                    WHERE id = $3
                    """,
                    name, avatar, user_id
                )
            else:
                # Try with OAuth columns first, fall back if they don't exist
                try:
                    user_id = await pconn.fetchval(
                        """
                        INSERT INTO users
                          (email, full_name, avatar_url, email_verified, auth_provider, provider_user_id)
                        VALUES ($1, $2, $3, $4, $5, $6)
                        RETURNING id
                        """,
                        email, name, avatar, True, provider, provider_user_id
                    )
                except Exception as e:
                    if 'email_verified' in str(e) or 'auth_provider' in str(e):
                        # Fallback for basic users table
                        user_id = await pconn.fetchval(
                            """
                            INSERT INTO users (email, full_name, avatar_url)
                            VALUES ($1, $2, $3)
                            RETURNING id
                            """,
                            email, name, avatar
                        )
                    else:
                        raise

        logger.info(
            f"[Project OAuth] Success | project={project_slug} provider={provider} "
            f"user={email} user_id={user_id}"
        )

        # Generate JWT token for project access
        jwt_payload = {
            "sub": str(user_id),
            "email": email,
            "project_id": str(project_id),
            "project_slug": project["slug"]
        }
        jwt_token = create_access_token(jwt_payload, expires_delta=timedelta(days=7))
        refresh_token = create_access_token(jwt_payload, expires_delta=timedelta(days=30))

        # Redirect to client application with tokens
        final_url = f"{redirect_url}?{urlencode({
            'access_token': jwt_token,
            'refresh_token': refresh_token,
            'token_type': 'bearer',
            'expires_in': 604800,  # 7 days in seconds
            'user_id': str(user_id),
            'email': email
        })}"

        return RedirectResponse(url=final_url)
