"""
Platform OAuth - Google Authentication for ZenDBX Main Website
Handles OAuth login for zendbx.in (not project-level, not devapp)
"""
from fastapi import APIRouter, HTTPException, Request, Query
from fastapi.responses import RedirectResponse
from typing import Optional
import secrets
from datetime import datetime, timedelta, timezone
from urllib.parse import urlencode
import httpx
import logging

from ..core.database import get_main_db_pool
from ..core.security import create_access_token
from ..core.config import settings

logger = logging.getLogger(__name__)

router = APIRouter(tags=["Platform OAuth"])

# OAuth configuration for platform (from environment variables)
GOOGLE_CLIENT_ID = settings.GOOGLE_CLIENT_ID if hasattr(settings, 'GOOGLE_CLIENT_ID') else None
GOOGLE_CLIENT_SECRET = settings.GOOGLE_CLIENT_SECRET if hasattr(settings, 'GOOGLE_CLIENT_SECRET') else None

OAUTH_CONFIG = {
    'auth_url': 'https://accounts.google.com/o/oauth2/v2/auth',
    'token_url': 'https://oauth2.googleapis.com/token',
    'userinfo_url': 'https://www.googleapis.com/oauth2/v2/userinfo',
    'scopes': 'openid email profile'
}

# Store state tokens temporarily (in production, use Redis)
_state_sessions = {}


@router.get("/api/platform/auth/google")
async def platform_google_login(
    request: Request,
    redirect_url: Optional[str] = Query(None, description="URL to redirect after login")
):
    """
    Initiate Google OAuth for ZenDBX platform (main website)
    No project required - this is for platform users logging into zendbx.in
    """
    if not GOOGLE_CLIENT_ID or not GOOGLE_CLIENT_SECRET:
        raise HTTPException(
            status_code=500,
            detail="Platform Google OAuth not configured. Set GOOGLE_CLIENT_ID and GOOGLE_CLIENT_SECRET in environment."
        )
    
    # Generate CSRF state token
    state_token = secrets.token_urlsafe(32)
    expires_at = datetime.now(timezone.utc) + timedelta(minutes=10)
    
    # Store state session (in memory for now, use Redis in production)
    _state_sessions[state_token] = {
        'redirect_url': redirect_url or 'https://zendbx.in',
        'expires_at': expires_at
    }
    
    # Build Google authorization URL
    callback_url = f"{settings.BACKEND_URL}/api/platform/auth/google/callback"
    
    params = {
        'client_id': GOOGLE_CLIENT_ID,
        'redirect_uri': callback_url,
        'response_type': 'code',
        'scope': OAUTH_CONFIG['scopes'],
        'state': state_token,
        'access_type': 'offline',
        'prompt': 'consent'
    }
    
    auth_url = f"{OAUTH_CONFIG['auth_url']}?{urlencode(params)}"
    
    logger.info(f"[Platform OAuth] Initiating Google login, redirect_url={redirect_url}")
    
    return RedirectResponse(url=auth_url)


@router.get("/api/platform/auth/google/callback")
async def platform_google_callback(
    request: Request,
    code: str = Query(...),
    state: str = Query(...),
    error: Optional[str] = Query(None),
):
    """
    Google redirects here after user authenticates
    Creates/updates user in platform database and returns JWT
    """
    if error:
        logger.error(f"[Platform OAuth] Error from Google: {error}")
        return RedirectResponse(url=f"https://zendbx.in?error=oauth_failed&message={error}")
    
    if not GOOGLE_CLIENT_ID or not GOOGLE_CLIENT_SECRET:
        raise HTTPException(status_code=500, detail="Platform OAuth not configured")
    
    # Validate state token
    session = _state_sessions.get(state)
    if not session:
        raise HTTPException(status_code=400, detail="Invalid or expired state token")
    
    if session['expires_at'] < datetime.now(timezone.utc):
        del _state_sessions[state]
        raise HTTPException(status_code=400, detail="State token expired")
    
    redirect_url = session['redirect_url']
    del _state_sessions[state]
    
    callback_url = f"{settings.BACKEND_URL}/api/platform/auth/google/callback"
    
    # Exchange code for access token
    try:
        async with httpx.AsyncClient() as http:
            token_resp = await http.post(
                OAUTH_CONFIG['token_url'],
                data={
                    'client_id': GOOGLE_CLIENT_ID,
                    'client_secret': GOOGLE_CLIENT_SECRET,
                    'code': code,
                    'redirect_uri': callback_url,
                    'grant_type': 'authorization_code'
                },
                headers={'Accept': 'application/json'}
            )
            
            if token_resp.status_code != 200:
                logger.error(f"[Platform OAuth] Token exchange failed: {token_resp.text}")
                raise HTTPException(status_code=400, detail="Failed to exchange code for token")
            
            token_data = token_resp.json()
            access_token = token_data.get('access_token')
            
            if not access_token:
                raise HTTPException(status_code=400, detail="No access token received from Google")
            
            # Fetch user profile from Google
            user_resp = await http.get(
                OAUTH_CONFIG['userinfo_url'],
                headers={'Authorization': f'Bearer {access_token}'}
            )
            
            if user_resp.status_code != 200:
                logger.error(f"[Platform OAuth] Failed to fetch user profile: {user_resp.text}")
                raise HTTPException(status_code=400, detail="Failed to fetch user profile from Google")
            
            user_data = user_resp.json()
            
    except httpx.HTTPError as e:
        logger.error(f"[Platform OAuth] HTTP error: {e}")
        raise HTTPException(status_code=500, detail=f"OAuth provider error: {str(e)}")
    
    # Extract user info
    email = user_data.get('email')
    name = user_data.get('name')
    avatar = user_data.get('picture')
    google_id = str(user_data.get('id', ''))
    
    if not email:
        raise HTTPException(status_code=400, detail="Email not provided by Google")
    
    # Create or update user in platform database
    pool = await get_main_db_pool()
    async with pool.acquire() as conn:
        existing_user = await conn.fetchrow(
            "SELECT id, email FROM users WHERE email = $1",
            email
        )
        
        if existing_user:
            # Update existing user
            user_id = existing_user["id"]
            await conn.execute(
                """
                UPDATE users
                SET full_name = COALESCE($1, full_name),
                    avatar_url = COALESCE($2, avatar_url),
                    is_verified = true,
                    updated_at = NOW()
                WHERE id = $3
                """,
                name, avatar, user_id
            )
            logger.info(f"[Platform OAuth] Updated existing user: {user_id} ({email})")
        else:
            # Create new user
            # Generate a placeholder password hash for OAuth users
            password_hash = 'oauth:' + secrets.token_hex(16)
            
            user_id = await conn.fetchval(
                """
                INSERT INTO users
                  (email, full_name, avatar_url, password_hash, is_verified, is_active, plan, role)
                VALUES ($1, $2, $3, $4, true, true, 'free', 'user')
                RETURNING id
                """,
                email, name, avatar, password_hash
            )
            logger.info(f"[Platform OAuth] Created new user: {user_id} ({email})")
    
    # Generate JWT token
    jwt_payload = {
        "sub": str(user_id),
        "email": email,
    }
    jwt_token = create_access_token(jwt_payload, expires_delta=timedelta(days=7))
    refresh_token_val = create_access_token(jwt_payload, expires_delta=timedelta(days=30))
    
    # Redirect to zendbx.in with tokens
    final_url = f"{redirect_url}?{urlencode({'token': jwt_token, 'refresh_token': refresh_token_val, 'user_id': str(user_id), 'email': email})}"
    
    logger.info(f"[Platform OAuth] Success! Redirecting to {redirect_url}")
    
    return RedirectResponse(url=final_url)
