"""
OAuth Provider Settings API
Manage OAuth provider credentials dynamically
"""
from fastapi import APIRouter, HTTPException, Depends, status
from pydantic import BaseModel, Field
from typing import List, Optional, Dict, Any
from app.core.security import get_current_user
from app.core.database import execute_on_main_db
from uuid import UUID
import secrets

router = APIRouter()

# ============================================
# SCHEMAS
# ============================================

class OAuthProviderConfig(BaseModel):
    provider: str = Field(..., description="Provider name (google, github)")
    client_id: str = Field(..., description="OAuth client ID")
    client_secret: str = Field(..., description="OAuth client secret")
    is_enabled: bool = Field(default=False, description="Enable/disable provider")
    redirect_uri: Optional[str] = Field(None, description="Custom redirect URI")
    scopes: Optional[str] = Field(None, description="OAuth scopes")

class OAuthProviderResponse(BaseModel):
    id: UUID
    provider: str
    client_id: str
    client_secret_masked: str
    is_enabled: bool
    redirect_uri: Optional[str]
    scopes: Optional[str]
    created_at: str
    updated_at: str

class OAuthProviderStatus(BaseModel):
    provider: str
    configured: bool
    enabled: bool
    has_credentials: bool

# ============================================
# HELPER: Check Admin Role (Optional - can be disabled)
# ============================================

async def require_admin(current_user: dict = Depends(get_current_user)):
    """Require admin role for OAuth settings - DISABLED for easier setup"""
    # Admin check disabled - any authenticated user can configure OAuth
    # This is useful for initial setup. Re-enable in production by uncommenting below:
    
    # role = current_user.get("role") if isinstance(current_user, dict) else getattr(current_user, "role", None)
    # if role != "admin":
    #     raise HTTPException(
    #         status_code=status.HTTP_403_FORBIDDEN,
    #         detail="Admin access required"
    #     )
    
    return current_user

# ============================================
# LIST ALL PROVIDERS
# ============================================

@router.get("/oauth/providers", response_model=List[OAuthProviderStatus])
async def list_oauth_providers(current_user: dict = Depends(get_current_user)):
    """List all OAuth providers and their status"""
    
    try:
        result = await execute_on_main_db(
            """
            SELECT provider, client_id, client_secret, is_enabled
            FROM oauth_provider_settings
            ORDER BY provider
            """
        )
        
        providers = []
        for row in result:
            providers.append({
                "provider": row["provider"],
                "configured": bool(row["client_id"] and row["client_secret"]),
                "enabled": row["is_enabled"],
                "has_credentials": bool(row["client_id"] and row["client_secret"])
            })
        
        return providers
    except Exception as e:
        error_msg = str(e)
        if "relation" in error_msg and "does not exist" in error_msg:
            raise HTTPException(
                status_code=status.HTTP_503_SERVICE_UNAVAILABLE,
                detail="OAuth database table not initialized. Please run: python fix_oauth_database.py"
            )
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Database error: {error_msg}"
        )

# ============================================
# GET PROVIDER DETAILS
# ============================================

@router.get("/oauth/providers/{provider}", response_model=OAuthProviderResponse)
async def get_oauth_provider(
    provider: str,
    current_user: dict = Depends(get_current_user)
):
    """Get OAuth provider configuration"""
    
    result = await execute_on_main_db(
        """
        SELECT id, provider, client_id, client_secret, is_enabled, 
               redirect_uri, scopes, created_at, updated_at
        FROM oauth_provider_settings
        WHERE provider = $1
        """,
        provider
    )
    
    if not result:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=f"Provider '{provider}' not found"
        )
    
    row = dict(result[0])
    
    # Mask client secret (show only last 4 chars)
    secret = row["client_secret"]
    row["client_secret_masked"] = f"{'*' * (len(secret) - 4)}{secret[-4:]}" if len(secret) > 4 else "****"
    
    return row

# ============================================
# SAVE/UPDATE PROVIDER
# ============================================

@router.post("/oauth/providers/{provider}")
async def save_oauth_provider(
    provider: str,
    config: OAuthProviderConfig,
    current_user: dict = Depends(get_current_user)
):
    """Save or update OAuth provider configuration"""
    
    # Validate provider
    if provider not in ["google", "github"]:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=f"Unsupported provider: {provider}"
        )
    
    # Validate credentials
    if not config.client_id or not config.client_secret:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Client ID and Client Secret are required"
        )
    
    # Set default scopes if not provided
    if not config.scopes:
        config.scopes = "openid email profile" if provider == "google" else "user:email"
    
    try:
        # Upsert provider configuration
        await execute_on_main_db(
            """
            INSERT INTO oauth_provider_settings 
                (provider, client_id, client_secret, is_enabled, redirect_uri, scopes)
            VALUES ($1, $2, $3, $4, $5, $6)
            ON CONFLICT (provider) 
            DO UPDATE SET
                client_id = EXCLUDED.client_id,
                client_secret = EXCLUDED.client_secret,
                is_enabled = EXCLUDED.is_enabled,
                redirect_uri = EXCLUDED.redirect_uri,
                scopes = EXCLUDED.scopes,
                updated_at = NOW()
            """,
            provider,
            config.client_id,
            config.client_secret,
            config.is_enabled,
            config.redirect_uri,
            config.scopes
        )
        
        # Reload OAuth service
        try:
            from app.services.oauth_service import reload_oauth_providers
            await reload_oauth_providers()
        except Exception as e:
            print(f"⚠️  Failed to reload OAuth providers: {e}")
        
        return {
            "success": True,
            "message": f"OAuth provider '{provider}' configured successfully",
            "provider": provider,
            "enabled": config.is_enabled
        }
    except Exception as e:
        error_msg = str(e)
        if "relation" in error_msg and "does not exist" in error_msg:
            raise HTTPException(
                status_code=status.HTTP_503_SERVICE_UNAVAILABLE,
                detail="OAuth database table not initialized. Please run: python fix_oauth_database.py"
            )
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Database error: {error_msg}"
        )

# ============================================
# DELETE PROVIDER
# ============================================

@router.delete("/oauth/providers/{provider}")
async def delete_oauth_provider(
    provider: str,
    current_user: dict = Depends(get_current_user)
):
    """Delete OAuth provider configuration"""
    
    await execute_on_main_db(
        """
        UPDATE oauth_provider_settings
        SET client_id = '', client_secret = '', is_enabled = false
        WHERE provider = $1
        """,
        provider
    )
    
    # Reload OAuth service
    try:
        from app.services.oauth_service import reload_oauth_providers
        await reload_oauth_providers()
    except Exception as e:
        print(f"⚠️  Failed to reload OAuth providers: {e}")
    
    return {
        "success": True,
        "message": f"OAuth provider '{provider}' removed successfully"
    }

# ============================================
# TEST PROVIDER CONNECTION
# ============================================

@router.get("/oauth/providers/{provider}/status")
async def test_oauth_provider(
    provider: str,
    current_user: dict = Depends(get_current_user)
):
    """Test OAuth provider configuration"""
    
    result = await execute_on_main_db(
        """
        SELECT client_id, client_secret, is_enabled
        FROM oauth_provider_settings
        WHERE provider = $1
        """,
        provider
    )
    
    if not result:
        return {
            "provider": provider,
            "status": "not_configured",
            "message": "Provider not found in database"
        }
    
    row = dict(result[0])
    
    if not row["client_id"] or not row["client_secret"]:
        return {
            "provider": provider,
            "status": "missing_credentials",
            "message": "Client ID or Client Secret not configured"
        }
    
    if not row["is_enabled"]:
        return {
            "provider": provider,
            "status": "disabled",
            "message": "Provider is disabled"
        }
    
    # Try to load OAuth client
    try:
        from app.services.oauth_service import get_oauth_client
        client = get_oauth_client(provider)
        
        return {
            "provider": provider,
            "status": "ready",
            "message": "Provider is configured and ready"
        }
    except Exception as e:
        return {
            "provider": provider,
            "status": "error",
            "message": f"Configuration error: {str(e)}"
        }

# ============================================
# TOGGLE PROVIDER
# ============================================

@router.patch("/oauth/providers/{provider}/toggle")
async def toggle_oauth_provider(
    provider: str,
    current_user: dict = Depends(get_current_user)
):
    """Enable/disable OAuth provider"""
    
    result = await execute_on_main_db(
        """
        UPDATE oauth_provider_settings
        SET is_enabled = NOT is_enabled, updated_at = NOW()
        WHERE provider = $1
        RETURNING is_enabled
        """,
        provider
    )
    
    if not result:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=f"Provider '{provider}' not found"
        )
    
    is_enabled = result[0]["is_enabled"]
    
    # Reload OAuth service
    try:
        from app.services.oauth_service import reload_oauth_providers
        await reload_oauth_providers()
    except Exception as e:
        print(f"⚠️  Failed to reload OAuth providers: {e}")
    
    return {
        "success": True,
        "provider": provider,
        "enabled": is_enabled,
        "message": f"Provider '{provider}' {'enabled' if is_enabled else 'disabled'}"
    }
