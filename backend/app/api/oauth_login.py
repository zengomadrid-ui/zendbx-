"""
OAuth Login URL Generator & Callback Handler
Public endpoints for OAuth authentication flow
"""
from fastapi import APIRouter, HTTPException, Request, Query
from fastapi.responses import RedirectResponse
from typing import Optional
import uuid
from datetime import datetime, timedelta, timezone
from urllib.parse import urlencode
import httpx

from ..core.database import get_main_db_pool
from ..core.security import (
    generate_oauth_state,
    decrypt_client_secret,
    validate_redirect_url,
    create_access_token
)
from ..core.config import settings

router = APIRouter(tags=["OAuth Login"])

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

# ============================================
# OAUTH LOGIN ENDPOINT
# ============================================

@router.get("/oauth/{provider}/{project_ref}")
async def oauth_login(
    provider: str,
    project_ref: str,
    request: Request,
    redirect_url: Optional[str] = Query(None, description="Optional redirect URL after authentication")
):
    """
    OAuth Login URL - Initiates OAuth flow
    Example: https://auth.zendbx.in/oauth/google/proj_xxxxx
    """
    # Validate provider
    if provider not in ['google', 'github']:
        raise HTTPException(status_code=400, detail="Invalid provider. Must be 'google' or 'github'")
    
    pool = await get_main_db_pool()
    async with pool.acquire() as conn:
        # Find project by slug (not project_ref)
        project = await conn.fetchrow(
            "SELECT id, slug FROM projects WHERE slug = $1",
            project_ref
        )
        
        if not project:
            raise HTTPException(status_code=404, detail="Project not found")
        
        project_id = project["id"]
        
        # Load OAuth provider settings
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
                detail=f"{provider.title()} OAuth is not configured for this project"
            )
        
        if not provider_config["enabled"]:
            raise HTTPException(
                status_code=403,
                detail=f"{provider.title()} OAuth is disabled for this project"
            )
        
        # Validate redirect URL if provided
        if redirect_url:
            allowed_urls = await conn.fetch(
                "SELECT redirect_url FROM oauth_redirect_urls WHERE project_id = $1 AND active = true",
                project_id
            )
            allowed_list = [row["redirect_url"] for row in allowed_urls]
            
            if not validate_redirect_url(redirect_url, allowed_list):
                raise HTTPException(
                    status_code=400,
                    detail="Redirect URL is not whitelisted. Please add it in Authentication → Redirect URLs"
                )
        else:
            # Get first active redirect URL as default
            default_redirect = await conn.fetchrow(
                "SELECT redirect_url FROM oauth_redirect_urls WHERE project_id = $1 AND active = true ORDER BY created_at LIMIT 1",
                project_id
            )
            if default_redirect:
                redirect_url = default_redirect["redirect_url"]
        
        # Generate state token for CSRF protection
        state_token = generate_oauth_state()
        expires_at = datetime.now(timezone.utc) + timedelta(minutes=10)
        
        # Store state session
        await conn.execute(
            """
            INSERT INTO oauth_state_sessions (state_token, project_id, provider, redirect_url, expires_at)
            VALUES ($1, $2, $3, $4, $5)
            """,
            state_token, project_id, provider, redirect_url, expires_at
        )
        
        # Build OAuth authorization URL
        oauth_config = OAUTH_CONFIGS[provider]
        callback_url = f"{settings.BACKEND_URL}/api/auth/oauth/{provider}/callback"
        
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
        
        # Log OAuth initiation (non-fatal)
        try:
            await conn.execute(
                """
                INSERT INTO oauth_audit_logs (project_id, provider, action, ip_address, user_agent, success)
                VALUES ($1, $2, $3, $4, $5, $6)
                """,
                project_id, provider, 'oauth_initiated',
                request.client.host if request.client else None,
                request.headers.get('user-agent'),
                True
            )
        except Exception as log_err:
            print(f"⚠️ Audit log failed (non-fatal): {log_err}")
        
        # Redirect to OAuth provider
        return RedirectResponse(url=auth_url)

# ============================================
# OAUTH CALLBACK ENDPOINT
# ============================================

@router.get("/api/auth/oauth/{provider}/callback")
async def oauth_callback(
    provider: str,
    request: Request,
    code: str = Query(..., description="Authorization code from provider"),
    state: str = Query(..., description="State token for CSRF protection"),
    error: Optional[str] = Query(None, description="Error from provider")
):
    """
    OAuth Callback - Handles OAuth provider callback
    """
    # Handle OAuth errors
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
        
        # Compare expiry — handle both timezone-aware and naive datetimes from DB
        expires_at = session["expires_at"]
        now = datetime.now(timezone.utc)
        if expires_at.tzinfo is None:
            # naive datetime from DB — treat as UTC
            from datetime import timezone as _tz
            expires_at = expires_at.replace(tzinfo=_tz.utc)
        if expires_at < now:
            await conn.execute("DELETE FROM oauth_state_sessions WHERE state_token = $1", state)
            raise HTTPException(status_code=400, detail="State token expired")
        
        if session["provider"] != provider:
            raise HTTPException(status_code=400, detail="Provider mismatch")
        
        project_id = session["project_id"]
        redirect_url = session["redirect_url"]
        
        # Delete used state token (one-time use)
        await conn.execute("DELETE FROM oauth_state_sessions WHERE state_token = $1", state)
        
        # Load OAuth provider settings
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
        
        # Decrypt client secret
        client_secret = decrypt_client_secret(provider_config["client_secret_encrypted"])
        
        # Exchange code for access token
        oauth_config = OAUTH_CONFIGS[provider]
        callback_url = f"{settings.BACKEND_URL}/api/auth/oauth/{provider}/callback"
        
        try:
            async with httpx.AsyncClient() as client:
                token_response = await client.post(
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
                
                if token_response.status_code != 200:
                    raise HTTPException(status_code=400, detail="Failed to exchange code for token")
                
                token_data = token_response.json()
                access_token = token_data.get('access_token')
                
                if not access_token:
                    raise HTTPException(status_code=400, detail="No access token received")
                
                # Fetch user profile
                headers = {'Authorization': f'Bearer {access_token}'}
                if provider == 'github':
                    headers['Accept'] = 'application/vnd.github.v3+json'
                
                user_response = await client.get(
                    oauth_config['userinfo_url'],
                    headers=headers
                )
                
                if user_response.status_code != 200:
                    raise HTTPException(status_code=400, detail="Failed to fetch user profile")
                
                user_data = user_response.json()
                
        except httpx.HTTPError as e:
            try:
                await conn.execute(
                    """
                    INSERT INTO oauth_audit_logs (project_id, provider, action, success, error_message)
                    VALUES ($1, $2, $3, $4, $5)
                    """,
                    project_id, provider, 'token_exchange_failed', False, str(e)
                )
            except Exception as log_err:
                print(f"⚠️ Audit log failed (non-fatal): {log_err}")
            raise HTTPException(status_code=500, detail=f"OAuth provider error: {str(e)}")
        
        # Extract user info based on provider
        if provider == 'google':
            email = user_data.get('email')
            name = user_data.get('name')
            avatar = user_data.get('picture')
            provider_user_id = user_data.get('id')
        else:  # github
            email = user_data.get('email')
            if not email:
                # Fetch email separately for GitHub
                async with httpx.AsyncClient() as client:
                    email_response = await client.get(
                        'https://api.github.com/user/emails',
                        headers={'Authorization': f'Bearer {access_token}'}
                    )
                    if email_response.status_code == 200:
                        emails = email_response.json()
                        primary_email = next((e for e in emails if e.get('primary')), None)
                        email = primary_email['email'] if primary_email else emails[0]['email']
            
            name = user_data.get('name') or user_data.get('login')
            avatar = user_data.get('avatar_url')
            provider_user_id = str(user_data.get('id'))
        
        if not email:
            raise HTTPException(status_code=400, detail="Email not provided by OAuth provider")
        
        # Get project database name and slug
        project = await conn.fetchrow(
            "SELECT database_name, slug FROM projects WHERE id = $1",
            project_id
        )
        
        # Create or update user in project database
        from ..core.database import get_project_db_pool
        project_pool = await get_project_db_pool(project["database_name"])
        
        async with project_pool.acquire() as project_conn:
            # Check if user exists
            existing_user = await project_conn.fetchrow(
                "SELECT id FROM users WHERE email = $1",
                email
            )
            
            if existing_user:
                user_id = existing_user["id"]
                # Update user info
                await project_conn.execute(
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
                # Create new user
                user_id = await project_conn.fetchval(
                    """
                    INSERT INTO users (email, full_name, avatar_url, email_verified, auth_provider, provider_user_id)
                    VALUES ($1, $2, $3, $4, $5, $6)
                    RETURNING id
                    """,
                    email, name, avatar, True, provider, provider_user_id
                )
        
        # Generate JWT token for the user
        jwt_payload = {
            "sub": str(user_id),
            "email": email,
            "project_id": str(project_id),
            "project_slug": project["slug"]
        }
        
        jwt_token = create_access_token(jwt_payload, expires_delta=timedelta(days=7))
        refresh_token = create_access_token(jwt_payload, expires_delta=timedelta(days=30))
        
        # Log successful authentication (non-fatal)
        try:
            await conn.execute(
                """
                INSERT INTO oauth_audit_logs (project_id, provider, action, user_id, ip_address, user_agent, success)
                VALUES ($1, $2, $3, $4, $5, $6, $7)
                """,
                project_id, provider, 'oauth_success', user_id,
                request.client.host if request.client else None,
                request.headers.get('user-agent'),
                True
            )
        except Exception as log_err:
            print(f"⚠️ Audit log failed (non-fatal): {log_err}")
        
        # Redirect back to application with tokens
        if redirect_url:
            params = {
                'token': jwt_token,
                'refresh_token': refresh_token,
                'user_id': str(user_id),
                'email': email
            }
            final_url = f"{redirect_url}?{urlencode(params)}"
            return RedirectResponse(url=final_url)
        else:
            # No redirect URL configured — fall back to frontend callback
            frontend_url = settings.FRONTEND_URL if hasattr(settings, 'FRONTEND_URL') else "http://localhost:3000"
            params = {
                'token': jwt_token,
                'refresh_token': refresh_token,
                'user_id': str(user_id),
                'email': email
            }
            final_url = f"{frontend_url}/callback?{urlencode(params)}"
            return RedirectResponse(url=final_url)
