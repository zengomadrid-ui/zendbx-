"""
OAuth Authentication Endpoints
Supports Google and GitHub login with PKCE and CSRF protection
"""
from fastapi import APIRouter, HTTPException, Request, status, Depends
from fastapi.responses import RedirectResponse
from pydantic import BaseModel
from app.models.schemas import Token, UserResponse
from app.core.security import create_access_token, get_current_user
from app.core.database import execute_on_main_db
from app.core.config import settings
from app.services.oauth_service import (
    get_oauth_client, 
    normalize_oauth_user,
    generate_pkce,
    generate_state_token,
    store_oauth_state,
    validate_and_consume_state,
    log_oauth_action,
    link_oauth_to_user,
    unlink_oauth_from_user,
    get_user_oauth_providers
)
from uuid import UUID
from typing import Optional
import json

router = APIRouter()


# ============================================
# SCHEMAS
# ============================================

class OAuthLinkRequest(BaseModel):
    provider: str

class OAuthUnlinkRequest(BaseModel):
    provider: str

class OAuthProvidersResponse(BaseModel):
    providers: list


# ============================================
# OAUTH LOGIN FLOW
# ============================================

@router.get("/oauth/{provider}/login")
async def oauth_login(
    provider: str, 
    request: Request,
    redirect_to: Optional[str] = None,
    use_pkce: bool = True
):
    """
    Initiate OAuth login flow with PKCE and CSRF protection
    
    Query params:
    - redirect_to: URL to redirect after successful login
    - use_pkce: Enable PKCE flow (recommended for SPAs and mobile)
    """
    try:
        # Generate state token for CSRF protection
        state = generate_state_token()
        
        # Generate PKCE if enabled
        code_verifier = None
        code_challenge = None
        if use_pkce:
            code_verifier, code_challenge = generate_pkce()
        
        # Store state in database
        await store_oauth_state(
            state_token=state,
            provider=provider,
            code_verifier=code_verifier,
            redirect_to=redirect_to
        )
        
        # Get OAuth client
        client = get_oauth_client(provider)
        
        # Build redirect URI
        redirect_uri = request.url_for('oauth_callback', provider=provider)
        
        # Build authorization params
        auth_params = {'state': state}
        if use_pkce and code_challenge:
            auth_params['code_challenge'] = code_challenge
            auth_params['code_challenge_method'] = 'S256'
        
        # Redirect to OAuth provider
        return await client.authorize_redirect(
            request, 
            redirect_uri,
            **auth_params
        )
        
    except ValueError as e:
        # Provider not configured
        frontend_url = f"{settings.FRONTEND_URL}/login?error=provider_not_configured&message={str(e)}"
        return RedirectResponse(url=frontend_url)
    except Exception as e:
        print(f"❌ OAuth login error: {str(e)}")
        frontend_url = f"{settings.FRONTEND_URL}/login?error=oauth_init_failed&message={str(e)}"
        return RedirectResponse(url=frontend_url)


@router.get("/oauth/{provider}/callback")
async def oauth_callback(provider: str, request: Request):
    """
    Handle OAuth callback with state validation and PKCE
    """
    client_ip = request.client.host if request.client else None
    user_agent = request.headers.get('user-agent')
    
    try:
        # Check for OAuth errors from provider
        error = request.query_params.get('error')
        if error:
            error_description = request.query_params.get('error_description', error)
            await log_oauth_action(
                user_id=None,
                provider=provider,
                action='login',
                success=False,
                error_message=f"{error}: {error_description}",
                ip_address=client_ip,
                user_agent=user_agent
            )
            frontend_url = f"{settings.FRONTEND_URL}/login?error={error}&message={error_description}"
            return RedirectResponse(url=frontend_url)
        
        # Validate state token
        state_from_request = request.query_params.get('state')
        if not state_from_request:
            await log_oauth_action(
                user_id=None,
                provider=provider,
                action='login',
                success=False,
                error_message="Missing state parameter",
                ip_address=client_ip,
                user_agent=user_agent
            )
            frontend_url = f"{settings.FRONTEND_URL}/login?error=missing_state"
            return RedirectResponse(url=frontend_url)
        
        # Validate and consume state from database
        state_data = await validate_and_consume_state(state_from_request, provider)
        if not state_data:
            await log_oauth_action(
                user_id=None,
                provider=provider,
                action='login',
                success=False,
                error_message="Invalid or expired state token",
                ip_address=client_ip,
                user_agent=user_agent
            )
            frontend_url = f"{settings.FRONTEND_URL}/login?error=invalid_state"
            return RedirectResponse(url=frontend_url)
        
        # Get OAuth client
        client = get_oauth_client(provider)
        
        # Exchange code for token (with PKCE if available)
        token_params = {}
        if state_data.get('code_verifier'):
            token_params['code_verifier'] = state_data['code_verifier']
        
        token = await client.authorize_access_token(request, **token_params)
        
        # Get user info from provider
        if provider == 'google':
            user_info = token.get('userinfo')
            if not user_info:
                raise HTTPException(status_code=400, detail="Failed to get user info from Google")
        elif provider == 'github':
            resp = await client.get('user', token=token)
            user_info = resp.json()
            
            # GitHub may not return email in user endpoint if private
            if not user_info.get('email'):
                emails_resp = await client.get('user/emails', token=token)
                emails = emails_resp.json()
                primary_email = next((e['email'] for e in emails if e['primary']), None)
                if primary_email:
                    user_info['email'] = primary_email
        else:
            raise HTTPException(status_code=400, detail="Unsupported provider")
        
        # Normalize user data
        normalized = normalize_oauth_user(provider, user_info)
        
        if not normalized.get('email'):
            await log_oauth_action(
                user_id=None,
                provider=provider,
                action='login',
                success=False,
                error_message="Email not provided by OAuth provider",
                ip_address=client_ip,
                user_agent=user_agent
            )
            frontend_url = f"{settings.FRONTEND_URL}/login?error=no_email&message=Email not provided by OAuth provider"
            return RedirectResponse(url=frontend_url)
        
        # Check if user exists
        existing_user = await execute_on_main_db(
            "SELECT * FROM users WHERE email = $1",
            normalized['email']
        )
        
        if existing_user:
            user = dict(existing_user[0])
            user_id = str(user['id'])
            
            # Link OAuth connection
            await link_oauth_to_user(
                user_id=user_id,
                provider=provider,
                provider_user_id=normalized['provider_user_id'],
                access_token=token.get('access_token'),
                refresh_token=token.get('refresh_token'),
                profile_data=user_info,
                is_primary=False
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
            user_id = str(user['id'])
            
            # Create OAuth connection
            await link_oauth_to_user(
                user_id=user_id,
                provider=provider,
                provider_user_id=normalized['provider_user_id'],
                access_token=token.get('access_token'),
                refresh_token=token.get('refresh_token'),
                profile_data=user_info,
                is_primary=True
            )
        
        # Log successful login
        await log_oauth_action(
            user_id=user_id,
            provider=provider,
            action='login',
            success=True,
            ip_address=client_ip,
            user_agent=user_agent
        )
        
        # Create JWT token
        access_token = create_access_token(user_id)
        
        # Redirect to custom URL or default callback
        redirect_url = state_data.get('redirect_to') or f"{settings.FRONTEND_URL}/callback"
        frontend_url = f"{redirect_url}?token={access_token}"
        return RedirectResponse(url=frontend_url)
        
    except HTTPException:
        raise
    except Exception as e:
        print(f"❌ OAuth callback error: {str(e)}")
        await log_oauth_action(
            user_id=None,
            provider=provider,
            action='login',
            success=False,
            error_message=str(e),
            ip_address=client_ip,
            user_agent=user_agent
        )
        frontend_url = f"{settings.FRONTEND_URL}/login?error=oauth_failed&message={str(e)}"
        return RedirectResponse(url=frontend_url)


# ============================================
# ACCOUNT LINKING
# ============================================

@router.get("/oauth/providers")
async def get_linked_providers(current_user: dict = Depends(get_current_user)):
    """Get all OAuth providers linked to current user"""
    try:
        user_id = current_user.get('sub') if isinstance(current_user, dict) else str(current_user.id)
        providers = await get_user_oauth_providers(user_id)
        
        return {
            "providers": providers,
            "count": len(providers)
        }
    except Exception as e:
        raise HTTPException(
            status_code=500,
            detail=f"Failed to get OAuth providers: {str(e)}"
        )


@router.post("/oauth/{provider}/link")
async def link_oauth_account(
    provider: str,
    request: Request,
    current_user: dict = Depends(get_current_user)
):
    """
    Link OAuth provider to existing logged-in user account
    """
    try:
        user_id = current_user.get('sub') if isinstance(current_user, dict) else str(current_user.id)
        
        # Generate state token
        state = generate_state_token()
        
        # Store state with user_id
        await store_oauth_state(
            state_token=state,
            provider=provider,
            user_id=user_id,
            redirect_to=f"{settings.FRONTEND_URL}/dashboard/profile?linked=true"
        )
        
        # Get OAuth client
        client = get_oauth_client(provider)
        
        # Build redirect URI
        redirect_uri = request.url_for('oauth_callback', provider=provider)
        
        # Redirect to OAuth provider
        return await client.authorize_redirect(request, redirect_uri, state=state)
        
    except ValueError as e:
        raise HTTPException(status_code=400, detail=str(e))
    except Exception as e:
        raise HTTPException(
            status_code=500,
            detail=f"Failed to link OAuth account: {str(e)}"
        )


@router.delete("/oauth/{provider}/unlink")
async def unlink_oauth_account(
    provider: str,
    current_user: dict = Depends(get_current_user)
):
    """Unlink OAuth provider from user account"""
    try:
        user_id = current_user.get('sub') if isinstance(current_user, dict) else str(current_user.id)
        
        success = await unlink_oauth_from_user(user_id, provider)
        
        if not success:
            raise HTTPException(
                status_code=404,
                detail=f"Provider '{provider}' not linked to your account"
            )
        
        # Log action
        await log_oauth_action(
            user_id=user_id,
            provider=provider,
            action='unlink',
            success=True
        )
        
        return {
            "success": True,
            "message": f"Successfully unlinked {provider} from your account"
        }
        
    except ValueError as e:
        raise HTTPException(status_code=400, detail=str(e))
    except Exception as e:
        raise HTTPException(
            status_code=500,
            detail=f"Failed to unlink OAuth account: {str(e)}"
        )

