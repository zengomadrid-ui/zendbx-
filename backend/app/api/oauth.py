"""
OAuth Authentication Endpoints
Supports Google and GitHub login
"""
from fastapi import APIRouter, HTTPException, Request, status
from fastapi.responses import RedirectResponse
from app.models.schemas import Token, UserResponse
from app.core.security import create_access_token
from app.core.database import execute_on_main_db
from app.services.oauth_service import get_oauth_client, normalize_oauth_user
from uuid import UUID
import json

router = APIRouter()


@router.get("/oauth/{provider}/login")
async def oauth_login(provider: str, request: Request):
    """Initiate OAuth login flow"""
    try:
        client = get_oauth_client(provider)
        redirect_uri = request.url_for('oauth_callback', provider=provider)
        return await client.authorize_redirect(request, redirect_uri)
    except ValueError as e:
        raise HTTPException(status_code=400, detail=str(e))


@router.get("/oauth/{provider}/callback")
async def oauth_callback(provider: str, request: Request):
    """Handle OAuth callback"""
    try:
        client = get_oauth_client(provider)
        token = await client.authorize_access_token(request)
        
        # Get user info from provider
        if provider == 'google':
            user_info = token.get('userinfo')
        elif provider == 'github':
            resp = await client.get('user', token=token)
            user_info = resp.json()
        else:
            raise HTTPException(status_code=400, detail="Unsupported provider")
        
        # Normalize user data
        normalized = normalize_oauth_user(provider, user_info)
        
        if not normalized.get('email'):
            raise HTTPException(
                status_code=400,
                detail="Email not provided by OAuth provider"
            )
        
        # Check if user exists
        existing_user = await execute_on_main_db(
            "SELECT * FROM users WHERE email = $1",
            normalized['email']
        )
        
        if existing_user:
            user = dict(existing_user[0])
            user_id = user['id']
            
            # Update OAuth connection
            await execute_on_main_db(
                """
                INSERT INTO oauth_connections (user_id, provider, provider_user_id, access_token, profile_data)
                VALUES ($1, $2, $3, $4, $5)
                ON CONFLICT (provider, provider_user_id) 
                DO UPDATE SET 
                    access_token = EXCLUDED.access_token,
                    profile_data = EXCLUDED.profile_data,
                    updated_at = NOW()
                """,
                user_id,
                provider,
                normalized['provider_user_id'],
                token.get('access_token'),
                json.dumps(user_info)
            )
        else:
            # Create new user
            result = await execute_on_main_db(
                """
                INSERT INTO users (email, password_hash, full_name, avatar_url, is_verified, oauth_provider, oauth_id)
                VALUES ($1, $2, $3, $4, $5, $6, $7)
                RETURNING id, email, full_name, avatar_url, is_active, is_verified, plan, created_at
                """,
                normalized['email'],
                '',  # No password for OAuth users
                normalized['full_name'],
                normalized['avatar_url'],
                normalized['is_verified'],
                provider,
                normalized['provider_user_id']
            )
            
            user = dict(result[0])
            user_id = user['id']
            
            # Create OAuth connection
            await execute_on_main_db(
                """
                INSERT INTO oauth_connections (user_id, provider, provider_user_id, access_token, profile_data)
                VALUES ($1, $2, $3, $4, $5)
                """,
                user_id,
                provider,
                normalized['provider_user_id'],
                token.get('access_token'),
                json.dumps(user_info)
            )
        
        # Create JWT token
        access_token = create_access_token(str(user_id))
        
        # Redirect to frontend with token
        frontend_url = f"http://localhost:3000/auth/callback?token={access_token}"
        return RedirectResponse(url=frontend_url)
        
    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(
            status_code=500,
            detail=f"OAuth authentication failed: {str(e)}"
        )


@router.post("/oauth/{provider}/link")
async def link_oauth_account(provider: str, request: Request):
    """Link OAuth account to existing user"""
    # This would be used to link an OAuth account to an already logged-in user
    # Implementation depends on your requirements
    pass
