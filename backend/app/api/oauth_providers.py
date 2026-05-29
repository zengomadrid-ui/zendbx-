"""
OAuth Provider Configuration API
Manage OAuth provider credentials per project for URL generator system
"""
from fastapi import APIRouter, HTTPException, Depends, Query, status
from pydantic import BaseModel
from typing import List, Optional
from datetime import datetime
import uuid
import httpx

from ..core.database import get_main_db_pool
from ..core.security import get_current_user, encrypt_client_secret, decrypt_client_secret
from ..models.schemas import UserResponse

router = APIRouter(prefix="/api/oauth/providers", tags=["OAuth Providers"])

# ============================================
# SCHEMAS
# ============================================

class ProviderCreate(BaseModel):
    provider: str  # 'google' or 'github'
    client_id: str
    client_secret: str
    enabled: bool = True

class ProviderUpdate(BaseModel):
    client_id: Optional[str] = None
    client_secret: Optional[str] = None
    enabled: Optional[bool] = None

class ProviderResponse(BaseModel):
    id: str
    project_id: str
    provider: str
    client_id: str
    client_secret_masked: str
    enabled: bool
    created_at: datetime
    updated_at: datetime

class ProviderStatusResponse(BaseModel):
    provider: str
    configured: bool
    enabled: bool
    status: str
    message: str
    oauth_url: Optional[str] = None

# ============================================
# ENDPOINTS
# ============================================

@router.post("", response_model=ProviderResponse, status_code=status.HTTP_201_CREATED)
async def create_or_update_provider(
    data: ProviderCreate,
    project_id: str = Query(..., description="Project ID"),
    current_user: UserResponse = Depends(get_current_user)
):
    """
    Create or update OAuth provider configuration for a project
    """
    # Validate provider
    if data.provider not in ['google', 'github']:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Provider must be 'google' or 'github'"
        )
    
    pool = await get_main_db_pool()
    async with pool.acquire() as conn:
        # Verify user has access to project
        # Convert to UUID only if it's a string
        project_uuid = uuid.UUID(project_id) if isinstance(project_id, str) else project_id
        user_uuid = uuid.UUID(current_user.id) if isinstance(current_user.id, str) else current_user.id
        
        project = await conn.fetchrow(
            "SELECT id FROM projects WHERE id = $1 AND user_id = $2",
            project_uuid, user_uuid
        )
        
        if not project:
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND,
                detail="Project not found or access denied"
            )
        
        # Encrypt client secret
        encrypted_secret = encrypt_client_secret(data.client_secret)
        
        # Upsert provider configuration
        provider = await conn.fetchrow(
            """
            INSERT INTO oauth_provider_settings 
                (project_id, provider, client_id, client_secret_encrypted, enabled)
            VALUES ($1, $2, $3, $4, $5)
            ON CONFLICT (project_id, provider)
            DO UPDATE SET
                client_id = EXCLUDED.client_id,
                client_secret_encrypted = EXCLUDED.client_secret_encrypted,
                enabled = EXCLUDED.enabled,
                updated_at = NOW()
            RETURNING id, project_id, provider, client_id, client_secret_encrypted, enabled, created_at, updated_at
            """,
            project_uuid, data.provider, data.client_id, encrypted_secret, data.enabled
        )
        
        # Mask secret for response
        masked_secret = f"{'*' * 20}{data.client_secret[-4:]}" if len(data.client_secret) > 4 else "****"
        
        return ProviderResponse(
            id=str(provider["id"]),
            project_id=str(provider["project_id"]),
            provider=provider["provider"],
            client_id=provider["client_id"],
            client_secret_masked=masked_secret,
            enabled=provider["enabled"],
            created_at=provider["created_at"],
            updated_at=provider["updated_at"]
        )

@router.get("", response_model=List[ProviderResponse])
async def list_providers(
    project_id: str = Query(..., description="Project ID"),
    current_user: UserResponse = Depends(get_current_user)
):
    """
    List all OAuth providers configured for a project
    """
    pool = await get_main_db_pool()
    async with pool.acquire() as conn:
        # Verify user has access to project
        # Convert to UUID only if it's a string
        project_uuid = uuid.UUID(project_id) if isinstance(project_id, str) else project_id
        user_uuid = uuid.UUID(current_user.id) if isinstance(current_user.id, str) else current_user.id
        
        project = await conn.fetchrow(
            "SELECT id FROM projects WHERE id = $1 AND user_id = $2",
            project_uuid, user_uuid
        )
        
        if not project:
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND,
                detail="Project not found or access denied"
            )
        
        # Get all providers
        providers = await conn.fetch(
            """
            SELECT id, project_id, provider, client_id, client_secret_encrypted, enabled, created_at, updated_at
            FROM oauth_provider_settings
            WHERE project_id = $1
            ORDER BY provider
            """,
            project_uuid
        )
        
        result = []
        for p in providers:
            # Decrypt and mask secret
            try:
                decrypted = decrypt_client_secret(p["client_secret_encrypted"])
                masked = f"{'*' * 20}{decrypted[-4:]}" if len(decrypted) > 4 else "****"
            except:
                masked = "****"
            
            result.append(ProviderResponse(
                id=str(p["id"]),
                project_id=str(p["project_id"]),
                provider=p["provider"],
                client_id=p["client_id"],
                client_secret_masked=masked,
                enabled=p["enabled"],
                created_at=p["created_at"],
                updated_at=p["updated_at"]
            ))
        
        return result

@router.get("/{provider}/status", response_model=ProviderStatusResponse)
async def get_provider_status(
    provider: str,
    project_id: str = Query(..., description="Project ID"),
    current_user: UserResponse = Depends(get_current_user)
):
    """
    Test OAuth provider configuration
    """
    if provider not in ['google', 'github']:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Provider must be 'google' or 'github'"
        )
    
    pool = await get_main_db_pool()
    async with pool.acquire() as conn:
        # Verify user has access to project and get slug
        # Convert to UUID only if it's a string
        project_uuid = uuid.UUID(project_id) if isinstance(project_id, str) else project_id
        user_uuid = uuid.UUID(current_user.id) if isinstance(current_user.id, str) else current_user.id
        
        project = await conn.fetchrow(
            "SELECT id, slug FROM projects WHERE id = $1 AND user_id = $2",
            project_uuid, user_uuid
        )
        
        if not project:
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND,
                detail="Project not found or access denied"
            )
        
        # Get provider config
        config = await conn.fetchrow(
            """
            SELECT client_id, client_secret_encrypted, enabled
            FROM oauth_provider_settings
            WHERE project_id = $1 AND provider = $2
            """,
            project_uuid, provider
        )
        
        if not config:
            return ProviderStatusResponse(
                provider=provider,
                configured=False,
                enabled=False,
                status="not_configured",
                message=f"{provider.title()} OAuth is not configured for this project",
                oauth_url=None
            )
        
        if not config["enabled"]:
            return ProviderStatusResponse(
                provider=provider,
                configured=True,
                enabled=False,
                status="disabled",
                message=f"{provider.title()} OAuth is configured but disabled",
                oauth_url=None
            )
        
        # Basic validation - check if credentials exist
        if not config["client_id"] or not config["client_secret_encrypted"]:
            return ProviderStatusResponse(
                provider=provider,
                configured=False,
                enabled=config["enabled"],
                status="incomplete",
                message="Missing client ID or client secret",
                oauth_url=None
            )
        
        # Generate OAuth URL using project slug
        from app.core.config import settings
        base_url = settings.BACKEND_URL or "http://localhost:8000"
        oauth_url = f"{base_url}/oauth/{provider}/{project['slug']}"
        
        return ProviderStatusResponse(
            provider=provider,
            configured=True,
            enabled=True,
            status="ready",
            message=f"{provider.title()} OAuth is configured and ready to use",
            oauth_url=oauth_url
        )

@router.delete("/{provider}", status_code=status.HTTP_204_NO_CONTENT)
async def delete_provider(
    provider: str,
    project_id: str = Query(..., description="Project ID"),
    current_user: UserResponse = Depends(get_current_user)
):
    """
    Delete OAuth provider configuration
    """
    pool = await get_main_db_pool()
    async with pool.acquire() as conn:
        # Convert to UUID only if it's a string
        project_uuid = uuid.UUID(project_id) if isinstance(project_id, str) else project_id
        user_uuid = uuid.UUID(current_user.id) if isinstance(current_user.id, str) else current_user.id
        
        # Verify user has access to project
        config = await conn.fetchrow(
            """
            SELECT ops.id
            FROM oauth_provider_settings ops
            JOIN projects p ON ops.project_id = p.id
            WHERE ops.project_id = $1 AND ops.provider = $2 AND p.user_id = $3
            """,
            project_uuid, provider, user_uuid
        )
        
        if not config:
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND,
                detail="Provider configuration not found or access denied"
            )
        
        # Delete provider
        await conn.execute(
            "DELETE FROM oauth_provider_settings WHERE project_id = $1 AND provider = $2",
            project_uuid, provider
        )
        
        return None

@router.patch("/{provider}/toggle", response_model=ProviderResponse)
async def toggle_provider(
    provider: str,
    project_id: str = Query(..., description="Project ID"),
    current_user: UserResponse = Depends(get_current_user)
):
    """
    Enable/disable OAuth provider
    """
    pool = await get_main_db_pool()
    async with pool.acquire() as conn:
        # Verify user has access and toggle
        project_uuid = uuid.UUID(project_id) if isinstance(project_id, str) else project_id
        user_uuid = uuid.UUID(current_user.id) if isinstance(current_user.id, str) else current_user.id

        updated = await conn.fetchrow(
            """
            UPDATE oauth_provider_settings ops
            SET enabled = NOT enabled, updated_at = NOW()
            FROM projects p
            WHERE ops.project_id = p.id
                AND ops.project_id = $1
                AND ops.provider = $2
                AND p.user_id = $3
            RETURNING ops.id, ops.project_id, ops.provider, ops.client_id, 
                      ops.client_secret_encrypted, ops.enabled, ops.created_at, ops.updated_at
            """,
            project_uuid, provider, user_uuid
        )
        
        if not updated:
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND,
                detail="Provider configuration not found or access denied"
            )
        
        # Decrypt and mask secret
        try:
            decrypted = decrypt_client_secret(updated["client_secret_encrypted"])
            masked = f"{'*' * 20}{decrypted[-4:]}" if len(decrypted) > 4 else "****"
        except:
            masked = "****"
        
        return ProviderResponse(
            id=str(updated["id"]),
            project_id=str(updated["project_id"]),
            provider=updated["provider"],
            client_id=updated["client_id"],
            client_secret_masked=masked,
            enabled=updated["enabled"],
            created_at=updated["created_at"],
            updated_at=updated["updated_at"]
        )
