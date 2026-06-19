"""
OAuth Login URL Generator & Callback Handler
Implements RFC 6749 Authorization Code Flow.

Two modes of operation:
  1. ZendBX-native login (no client_id param) — user logs into a project app.
     Callback redirects to the project's redirect_uri with ?token=...&email=...
     (original behaviour, unchanged).

  2. External OAuth client (client_id + redirect_uri params) — ZendBX acts as
     an Authorization Server.  Callback redirects to the client's redirect_uri
     with ?code=<one-time-auth-code>&state=<original-state>.
     The client then exchanges the code via POST /oauth/token.
"""
from fastapi import APIRouter, HTTPException, Request, Query
from fastapi.responses import RedirectResponse, JSONResponse
from pydantic import BaseModel
from typing import Optional
import uuid
import secrets
from datetime import datetime, timedelta, timezone
from urllib.parse import urlencode
import httpx
import logging

from ..core.database import get_main_db_pool
from ..core.security import (
    generate_oauth_state,
    decrypt_client_secret,
    validate_redirect_url,
    create_access_token
)
from ..core.config import settings

logger = logging.getLogger(__name__)

router = APIRouter(tags=["OAuth Login"])

# ── Provider configurations ───────────────────────────────────────────────────
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

# Authorization codes are valid for 10 minutes (RFC 6749 recommendation: ≤10 min)
AUTH_CODE_TTL_MINUTES = 10


# ─────────────────────────────────────────────────────────────────────────────
# STEP 1 — INITIATE LOGIN
# ─────────────────────────────────────────────────────────────────────────────

@router.get("/oauth/{provider}/{project_ref}")
async def oauth_login(
    provider: str,
    project_ref: str,
    request: Request,
    # ZendBX-native params
    redirect_url: Optional[str] = Query(None, description="Post-auth redirect URL"),
    # External OAuth client params (RFC 6749)
    client_id: Optional[str] = Query(None, description="OAuth client_id (external clients only)"),
    redirect_uri: Optional[str] = Query(None, description="Client redirect_uri (external clients only)"),
    state: Optional[str] = Query(None, description="Client-provided state (external clients only)"),
    response_type: Optional[str] = Query(None, description="Must be 'code' for external clients"),
    scope: Optional[str] = Query(None, description="Requested scopes"),
):
    """
    Initiate OAuth flow.

    External OAuth clients must supply:
      client_id, redirect_uri, state, response_type=code

    ZendBX-native callers may supply redirect_url (optional).
    """
    if provider not in OAUTH_CONFIGS:
        raise HTTPException(status_code=400, detail="Invalid provider. Must be 'google' or 'github'")

    # Determine mode
    is_external_client = bool(client_id and redirect_uri)

    if is_external_client and response_type != 'code':
        raise HTTPException(
            status_code=400,
            detail="response_type must be 'code' for Authorization Code Flow"
        )

    pool = await get_main_db_pool()
    async with pool.acquire() as conn:
        # Resolve project
        project = await conn.fetchrow(
            "SELECT id, slug FROM projects WHERE slug = $1",
            project_ref
        )
        if not project:
            raise HTTPException(status_code=404, detail="Project not found")

        project_id = project["id"]

        # Load provider config
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

        # ── External client — validate redirect_uri against whitelist ─────────
        if is_external_client:
            allowed_urls = await conn.fetch(
                "SELECT redirect_url FROM oauth_redirect_urls WHERE project_id = $1 AND active = true",
                project_id
            )
            allowed_list = [row["redirect_url"] for row in allowed_urls]
            if not validate_redirect_url(redirect_uri, allowed_list):
                raise HTTPException(
                    status_code=400,
                    detail="redirect_uri is not whitelisted. Add it in Authentication → Redirect URLs"
                )
            logger.info(
                f"[OAuth] External client flow | project={project_id} "
                f"client_id={client_id} redirect_uri={redirect_uri}"
            )
        else:
            # ZendBX-native — resolve redirect_url
            if redirect_url:
                allowed_urls = await conn.fetch(
                    "SELECT redirect_url FROM oauth_redirect_urls WHERE project_id = $1 AND active = true",
                    project_id
                )
                allowed_list = [row["redirect_url"] for row in allowed_urls]
                if not validate_redirect_url(redirect_url, allowed_list):
                    raise HTTPException(
                        status_code=400,
                        detail="Redirect URL is not whitelisted. Add it in Authentication → Redirect URLs"
                    )
            else:
                default = await conn.fetchrow(
                    """
                    SELECT redirect_url FROM oauth_redirect_urls
                    WHERE project_id = $1 AND active = true
                    ORDER BY created_at LIMIT 1
                    """,
                    project_id
                )
                if default:
                    redirect_url = default["redirect_url"]

        # Generate CSRF state token
        state_token = generate_oauth_state()
        expires_at = datetime.now(timezone.utc) + timedelta(minutes=10)

        # Store state session — include external client context when present
        await conn.execute(
            """
            INSERT INTO oauth_state_sessions
              (state_token, project_id, provider, redirect_url, expires_at,
               external_client_id, external_redirect_uri, external_state)
            VALUES ($1, $2, $3, $4, $5, $6, $7, $8)
            """,
            state_token, project_id, provider,
            redirect_url if not is_external_client else None,
            expires_at,
            client_id if is_external_client else None,
            redirect_uri if is_external_client else None,
            state if is_external_client else None,
        )

        # Build Google/GitHub authorization URL
        oauth_config = OAUTH_CONFIGS[provider]
        callback_url = f"{settings.BACKEND_URL}/api/auth/oauth/{provider}/callback/project"

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

        try:
            await conn.execute(
                """
                INSERT INTO oauth_audit_logs
                  (project_id, provider, action, ip_address, user_agent, success)
                VALUES ($1, $2, $3, $4, $5, $6)
                """,
                project_id, provider, 'oauth_initiated',
                request.client.host if request.client else None,
                request.headers.get('user-agent'),
                True
            )
        except Exception as log_err:
            logger.warning(f"Audit log failed (non-fatal): {log_err}")

        return RedirectResponse(url=auth_url)


# ─────────────────────────────────────────────────────────────────────────────
# STEP 2 — GOOGLE/GITHUB CALLBACK
# ─────────────────────────────────────────────────────────────────────────────

@router.get("/api/auth/oauth/{provider}/callback/project")
async def project_oauth_callback(
    provider: str,
    request: Request,
    code: str = Query(...),
    state: str = Query(...),
    error: Optional[str] = Query(None),
):
    """
    Google/GitHub redirects here after user authenticates.
    Determines whether to continue as external OAuth client or ZendBX-native.
    """
    if error:
        raise HTTPException(status_code=400, detail=f"OAuth error: {error}")

    pool = await get_main_db_pool()
    async with pool.acquire() as conn:
        # Validate & load state session
        session = await conn.fetchrow(
            """
            SELECT project_id, provider, redirect_url, expires_at,
                   external_client_id, external_redirect_uri, external_state
            FROM oauth_state_sessions
            WHERE state_token = $1
            """,
            state
        )
        if not session:
            raise HTTPException(status_code=400, detail="Invalid or expired state token")

        expires_at = session["expires_at"]
        now = datetime.now(timezone.utc)
        if expires_at.tzinfo is None:
            expires_at = expires_at.replace(tzinfo=timezone.utc)
        if expires_at < now:
            await conn.execute("DELETE FROM oauth_state_sessions WHERE state_token = $1", state)
            raise HTTPException(status_code=400, detail="State token expired")

        if session["provider"] != provider:
            raise HTTPException(status_code=400, detail="Provider mismatch")

        project_id = session["project_id"]
        is_external_client = bool(session["external_client_id"])

        # Delete used state (one-time)
        await conn.execute("DELETE FROM oauth_state_sessions WHERE state_token = $1", state)

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
        callback_url = f"{settings.BACKEND_URL}/api/auth/oauth/{provider}/callback/project"

        # Exchange code → provider access token
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

        # Get project database info
        project = await conn.fetchrow(
            "SELECT database_name, slug FROM projects WHERE id = $1",
            project_id
        )

        # Create / update user in project database
        from ..core.database import get_project_db_pool
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
                user_id = await pconn.fetchval(
                    """
                    INSERT INTO users
                      (email, full_name, avatar_url, email_verified, auth_provider, provider_user_id)
                    VALUES ($1, $2, $3, $4, $5, $6)
                    RETURNING id
                    """,
                    email, name, avatar, True, provider, provider_user_id
                )

        logger.info(
            f"[OAuth] callback | project={project_id} provider={provider} "
            f"email={email} user_id={user_id} "
            f"external_client={is_external_client}"
        )

        # ── Log success ───────────────────────────────────────────────────────
        try:
            await conn.execute(
                """
                INSERT INTO oauth_audit_logs
                  (project_id, provider, action, user_id, ip_address, user_agent, success)
                VALUES ($1, $2, $3, $4, $5, $6, $7)
                """,
                project_id, provider, 'oauth_success', user_id,
                request.client.host if request.client else None,
                request.headers.get('user-agent'),
                True
            )
        except Exception as log_err:
            logger.warning(f"Audit log failed (non-fatal): {log_err}")

        # ─────────────────────────────────────────────────────────────────────
        # EXTERNAL CLIENT — RFC 6749 Authorization Code Grant
        # Generate a one-time authorization code and redirect to client's URI
        # ─────────────────────────────────────────────────────────────────────
        if is_external_client:
            client_redirect_uri = session["external_redirect_uri"]
            original_state = session["external_state"]
            client_id_val = session["external_client_id"]

            # Generate a cryptographically random, single-use authorization code
            auth_code = secrets.token_urlsafe(32)
            auth_code_expires = datetime.now(timezone.utc) + timedelta(minutes=AUTH_CODE_TTL_MINUTES)

            # Persist the authorization code so /oauth/token can exchange it
            await conn.execute(
                """
                INSERT INTO oauth_authorization_codes
                  (code, project_id, provider, user_id, email, client_id,
                   redirect_uri, expires_at, used)
                VALUES ($1, $2, $3, $4, $5, $6, $7, $8, false)
                """,
                auth_code, project_id, provider, str(user_id), email,
                client_id_val, client_redirect_uri, auth_code_expires
            )

            redirect_params: dict = {'code': auth_code}
            if original_state:
                redirect_params['state'] = original_state

            final_url = f"{client_redirect_uri}?{urlencode(redirect_params)}"

            logger.info(
                f"[OAuth] External client redirect | "
                f"client_id={client_id_val} redirect_uri={client_redirect_uri} "
                f"state={original_state} code={auth_code[:8]}..."
            )
            return RedirectResponse(url=final_url)

        # ─────────────────────────────────────────────────────────────────────
        # ZENDBX-NATIVE — redirect with JWT tokens directly
        # ─────────────────────────────────────────────────────────────────────
        jwt_payload = {
            "sub": str(user_id),
            "email": email,
            "project_id": str(project_id),
            "project_slug": project["slug"]
        }
        jwt_token = create_access_token(jwt_payload, expires_delta=timedelta(days=7))
        refresh_token = create_access_token(jwt_payload, expires_delta=timedelta(days=30))

        redirect_url = session["redirect_url"]
        if redirect_url:
            final_url = f"{redirect_url}?{urlencode({'token': jwt_token, 'refresh_token': refresh_token, 'user_id': str(user_id), 'email': email})}"
        else:
            frontend_url = getattr(settings, 'FRONTEND_URL', 'http://localhost:3000')
            final_url = f"{frontend_url}/callback?{urlencode({'token': jwt_token, 'refresh_token': refresh_token, 'user_id': str(user_id), 'email': email})}"

        return RedirectResponse(url=final_url)


# ─────────────────────────────────────────────────────────────────────────────
# STEP 3 — TOKEN EXCHANGE (external clients only)
# POST /oauth/token
# RFC 6749 §4.1.3 — exchange authorization code for access token
# ─────────────────────────────────────────────────────────────────────────────

class TokenRequest(BaseModel):
    grant_type: str
    code: str
    redirect_uri: str
    client_id: str
    client_secret: Optional[str] = None  # optional; for confidential clients


@router.post("/oauth/token")
async def token_exchange(request: Request):
    """
    Exchange an authorization code for an access token (RFC 6749 §4.1.3).

    Accepts application/x-www-form-urlencoded (standard) or application/json.

    Returns:
        {
          "access_token": "...",
          "token_type": "bearer",
          "expires_in": 604800,
          "refresh_token": "...",
          "user_id": "...",
          "email": "..."
        }
    """
    content_type = request.headers.get('content-type', '')

    if 'application/json' in content_type:
        body = await request.json()
    else:
        # application/x-www-form-urlencoded (default for OAuth)
        form = await request.form()
        body = dict(form)

    grant_type = body.get('grant_type')
    code = body.get('code')
    redirect_uri = body.get('redirect_uri')
    client_id = body.get('client_id')

    logger.info(
        f"[OAuth /token] grant_type={grant_type} client_id={client_id} "
        f"redirect_uri={redirect_uri} code={str(code)[:8] if code else None}..."
    )

    if grant_type != 'authorization_code':
        return JSONResponse(
            status_code=400,
            content={"error": "unsupported_grant_type",
                     "error_description": "Only authorization_code grant is supported"}
        )

    if not all([code, redirect_uri, client_id]):
        return JSONResponse(
            status_code=400,
            content={"error": "invalid_request",
                     "error_description": "code, redirect_uri and client_id are required"}
        )

    pool = await get_main_db_pool()
    async with pool.acquire() as conn:
        # Look up authorization code
        record = await conn.fetchrow(
            """
            SELECT code, project_id, provider, user_id, email, client_id,
                   redirect_uri, expires_at, used
            FROM oauth_authorization_codes
            WHERE code = $1
            """,
            code
        )

        if not record:
            logger.warning(f"[OAuth /token] Unknown code: {str(code)[:8]}...")
            return JSONResponse(
                status_code=400,
                content={"error": "invalid_grant",
                         "error_description": "Authorization code not found or already used"}
            )

        if record["used"]:
            logger.warning(f"[OAuth /token] Code already used: {str(code)[:8]}...")
            return JSONResponse(
                status_code=400,
                content={"error": "invalid_grant",
                         "error_description": "Authorization code has already been used"}
            )

        # Validate expiry
        expires_at = record["expires_at"]
        if expires_at.tzinfo is None:
            expires_at = expires_at.replace(tzinfo=timezone.utc)
        if expires_at < datetime.now(timezone.utc):
            return JSONResponse(
                status_code=400,
                content={"error": "invalid_grant",
                         "error_description": "Authorization code has expired"}
            )

        # Validate client_id and redirect_uri
        if record["client_id"] != client_id:
            logger.warning(f"[OAuth /token] client_id mismatch")
            return JSONResponse(
                status_code=400,
                content={"error": "invalid_client",
                         "error_description": "client_id does not match"}
            )

        if record["redirect_uri"] != redirect_uri:
            logger.warning(f"[OAuth /token] redirect_uri mismatch: {redirect_uri}")
            return JSONResponse(
                status_code=400,
                content={"error": "invalid_grant",
                         "error_description": "redirect_uri does not match"}
            )

        # Mark code as used (one-time)
        await conn.execute(
            "UPDATE oauth_authorization_codes SET used = true WHERE code = $1",
            code
        )

        # Fetch project slug for JWT
        project = await conn.fetchrow(
            "SELECT slug FROM projects WHERE id = $1",
            record["project_id"]
        )

        user_id = record["user_id"]
        email = record["email"]
        project_id = record["project_id"]

        logger.info(
            f"[OAuth /token] Code exchanged | project={project_id} "
            f"client_id={client_id} user={email}"
        )

    # Generate JWT tokens
    jwt_payload = {
        "sub": str(user_id),
        "email": email,
        "project_id": str(project_id),
        "project_slug": project["slug"] if project else ""
    }
    access_token = create_access_token(jwt_payload, expires_delta=timedelta(days=7))
    refresh_token = create_access_token(jwt_payload, expires_delta=timedelta(days=30))

    return JSONResponse(content={
        "access_token": access_token,
        "token_type": "bearer",
        "expires_in": 7 * 24 * 3600,  # 7 days in seconds
        "refresh_token": refresh_token,
        "user_id": str(user_id),
        "email": email
    })
