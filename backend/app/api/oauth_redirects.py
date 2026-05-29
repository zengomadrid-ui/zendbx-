"""
OAuth Redirect URLs Management API
Handles registration and management of allowed OAuth callback URLs
"""
from fastapi import APIRouter, HTTPException, Depends, status
from pydantic import BaseModel, HttpUrl, validator
from typing import List, Optional
from datetime import datetime
import uuid

from ..core.database import get_main_db_pool
from ..core.security import get_current_user, is_valid_https_url
from ..models.schemas import UserResponse

router = APIRouter(prefix="/api/oauth/redirect-urls", tags=["OAuth Redirect URLs"])

# ============================================
# SCHEMAS
# ============================================

class RedirectURLCreate(BaseModel):
    redirect_url: str
    
    @validator('redirect_url')
    def validate_url(cls, v):
        if not is_valid_https_url(v, allow_localhost=True):
            raise ValueError('Invalid URL format. Must be a valid HTTPS URL (HTTP allowed for localhost)')
        return v

class RedirectURLUpdate(BaseModel):
    active: bool

class RedirectURLResponse(BaseModel):
    id: str
    project_id: str
    redirect_url: str
    active: bool
    created_at: datetime

# ============================================
# ENDPOINTS
# ============================================

@router.post("", response_model=RedirectURLResponse, status_code=status.HTTP_201_CREATED)
async def create_redirect_url(
    data: RedirectURLCreate,
    project_id: str,
    current_user: UserResponse = Depends(get_current_user)
):
    """
    Add a new redirect URL to the whitelist
    """
    pool = await get_main_db_pool()
    async with pool.acquire() as conn:
        # Verify user has access to project
        project = await conn.fetchrow(
            "SELECT id FROM projects WHERE id = $1 AND user_id = $2",
            uuid.UUID(project_id), uuid.UUID(current_user.id)
        )
        
        if not project:
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND,
                detail="Project not found or access denied"
            )
        
        # Check if URL already exists
        existing = await conn.fetchrow(
            "SELECT id FROM oauth_redirect_urls WHERE project_id = $1 AND redirect_url = $2",
            uuid.UUID(project_id), data.redirect_url
        )
        
        if existing:
            raise HTTPException(
                status_code=status.HTTP_409_CONFLICT,
                detail="This redirect URL is already registered"
            )
        
        # Insert new redirect URL
        redirect_url = await conn.fetchrow(
            """
            INSERT INTO oauth_redirect_urls (project_id, redirect_url, active)
            VALUES ($1, $2, $3)
            RETURNING id, project_id, redirect_url, active, created_at
            """,
            uuid.UUID(project_id), data.redirect_url, True
        )
        
        return RedirectURLResponse(
            id=str(redirect_url["id"]),
            project_id=str(redirect_url["project_id"]),
            redirect_url=redirect_url["redirect_url"],
            active=redirect_url["active"],
            created_at=redirect_url["created_at"]
        )

@router.get("", response_model=List[RedirectURLResponse])
async def list_redirect_urls(
    project_id: str,
    current_user: UserResponse = Depends(get_current_user)
):
    """
    List all redirect URLs for a project
    """
    pool = await get_main_db_pool()
    async with pool.acquire() as conn:
        # Verify user has access to project
        project = await conn.fetchrow(
            "SELECT id FROM projects WHERE id = $1 AND user_id = $2",
            uuid.UUID(project_id), uuid.UUID(current_user.id)
        )
        
        if not project:
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND,
                detail="Project not found or access denied"
            )
        
        # Get all redirect URLs
        urls = await conn.fetch(
            """
            SELECT id, project_id, redirect_url, active, created_at
            FROM oauth_redirect_urls
            WHERE project_id = $1
            ORDER BY created_at DESC
            """,
            uuid.UUID(project_id)
        )
        
        return [
            RedirectURLResponse(
                id=str(url["id"]),
                project_id=str(url["project_id"]),
                redirect_url=url["redirect_url"],
                active=url["active"],
                created_at=url["created_at"]
            )
            for url in urls
        ]

@router.patch("/{url_id}", response_model=RedirectURLResponse)
async def update_redirect_url(
    url_id: str,
    data: RedirectURLUpdate,
    current_user: UserResponse = Depends(get_current_user)
):
    """
    Update redirect URL (enable/disable)
    """
    pool = await get_main_db_pool()
    async with pool.acquire() as conn:
        # Verify user owns the redirect URL
        url_data = await conn.fetchrow(
            """
            SELECT r.id, r.project_id, r.redirect_url, r.active, r.created_at
            FROM oauth_redirect_urls r
            JOIN projects p ON r.project_id = p.id
            WHERE r.id = $1 AND p.user_id = $2
            """,
            uuid.UUID(url_id), uuid.UUID(current_user.id)
        )
        
        if not url_data:
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND,
                detail="Redirect URL not found or access denied"
            )
        
        # Update active status
        updated = await conn.fetchrow(
            """
            UPDATE oauth_redirect_urls
            SET active = $1
            WHERE id = $2
            RETURNING id, project_id, redirect_url, active, created_at
            """,
            data.active, uuid.UUID(url_id)
        )
        
        return RedirectURLResponse(
            id=str(updated["id"]),
            project_id=str(updated["project_id"]),
            redirect_url=updated["redirect_url"],
            active=updated["active"],
            created_at=updated["created_at"]
        )

@router.delete("/{url_id}", status_code=status.HTTP_204_NO_CONTENT)
async def delete_redirect_url(
    url_id: str,
    current_user: UserResponse = Depends(get_current_user)
):
    """
    Delete a redirect URL
    """
    pool = await get_main_db_pool()
    async with pool.acquire() as conn:
        # Verify user owns the redirect URL
        url_data = await conn.fetchrow(
            """
            SELECT r.id
            FROM oauth_redirect_urls r
            JOIN projects p ON r.project_id = p.id
            WHERE r.id = $1 AND p.user_id = $2
            """,
            uuid.UUID(url_id), uuid.UUID(current_user.id)
        )
        
        if not url_data:
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND,
                detail="Redirect URL not found or access denied"
            )
        
        # Delete the redirect URL
        await conn.execute(
            "DELETE FROM oauth_redirect_urls WHERE id = $1",
            uuid.UUID(url_id)
        )
        
        return None
