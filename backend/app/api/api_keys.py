"""
API Key Management Endpoints
Allows users to generate, list, and revoke API keys for external access
"""
from fastapi import APIRouter, Depends, HTTPException, status
from typing import List
from uuid import UUID
import secrets
import hashlib
from datetime import datetime

from ..core.database import get_main_db_pool
from ..api.auth import get_current_user
from ..models.schemas import (
    APIKeyCreate,
    APIKeyResponse,
    APIKeyListResponse
)

router = APIRouter(prefix="/api/projects/{project_id}/api-keys", tags=["API Keys"])


def generate_api_key() -> tuple[str, str, str]:
    """
    Generate a new API key
    Returns: (full_key, key_hash, key_prefix)
    """
    # Generate 32-byte random key
    random_bytes = secrets.token_bytes(32)
    full_key = f"nex_{random_bytes.hex()}"
    
    # Hash for storage
    key_hash = hashlib.sha256(full_key.encode()).hexdigest()
    
    # Prefix for display (first 13 chars)
    key_prefix = full_key[:13]  # "nex_abc123..."
    
    return full_key, key_hash, key_prefix


@router.post("", response_model=APIKeyResponse, status_code=status.HTTP_201_CREATED)
async def create_api_key(
    project_id: UUID,
    key_data: APIKeyCreate,
    current_user: dict = Depends(get_current_user)
):
    """Generate a new API key for a project"""
    pool = await get_main_db_pool()
    
    async with pool.acquire() as conn:
        # Verify project ownership
        project = await conn.fetchrow(
            "SELECT id, user_id FROM projects WHERE id = $1",
            project_id
        )
        
        if not project:
            raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Project not found")
        
        if str(project["user_id"]) != str(current_user["id"]):
            raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="Not authorized")
        
        # Generate key
        full_key, key_hash, key_prefix = generate_api_key()
        
        # Store in database
        api_key = await conn.fetchrow(
            """
            INSERT INTO api_keys (user_id, project_id, name, key_hash, key_prefix, role)
            VALUES ($1, $2, $3, $4, $5, $6)
            RETURNING id, name, key_prefix, role, is_active, created_at
            """,
            current_user["id"], project_id, key_data.name, key_hash, key_prefix, key_data.role
        )
        
        return {
            "id": str(api_key["id"]),
            "name": api_key["name"],
            "key": full_key,
            "key_prefix": api_key["key_prefix"],
            "role": api_key["role"],
            "is_active": api_key["is_active"],
            "created_at": api_key["created_at"].isoformat(),
            "message": "⚠️ Save this key securely. It won't be shown again."
        }


@router.get("", response_model=APIKeyListResponse)
async def list_api_keys(project_id: UUID, current_user: dict = Depends(get_current_user)):
    """List all API keys for a project"""
    pool = await get_main_db_pool()
    
    async with pool.acquire() as conn:
        project = await conn.fetchrow("SELECT id, user_id FROM projects WHERE id = $1", project_id)
        if not project:
            raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Project not found")
        if str(project["user_id"]) != str(current_user["id"]):
            raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="Not authorized")
        
        keys = await conn.fetch(
            """
            SELECT id, name, key_prefix, encrypted_key, role, is_active, last_used_at, created_at
            FROM api_keys WHERE project_id = $1 ORDER BY created_at DESC
            """,
            project_id
        )
        
        return {
            "keys": [
                {
                    "id": str(key["id"]),
                    "name": key["name"],
                    # Use encrypted_key if available, otherwise fall back to key_prefix
                    "key_prefix": key["encrypted_key"] if key["encrypted_key"] else key["key_prefix"],
                    "role": key["role"],
                    "is_active": key["is_active"],
                    "last_used_at": key["last_used_at"].isoformat() if key["last_used_at"] else None,
                    "created_at": key["created_at"].isoformat()
                }
                for key in keys
            ]
        }


@router.delete("/{key_id}", status_code=status.HTTP_204_NO_CONTENT)
async def revoke_api_key(project_id: UUID, key_id: UUID, current_user: dict = Depends(get_current_user)):
    """Revoke (delete) an API key"""
    pool = await get_main_db_pool()
    
    async with pool.acquire() as conn:
        key = await conn.fetchrow(
            """
            SELECT ak.id, p.user_id as project_owner_id
            FROM api_keys ak JOIN projects p ON ak.project_id = p.id
            WHERE ak.id = $1 AND ak.project_id = $2
            """,
            key_id, project_id
        )
        
        if not key:
            raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="API key not found")
        if str(key["project_owner_id"]) != str(current_user["id"]):
            raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="Not authorized")
        
        await conn.execute("DELETE FROM api_keys WHERE id = $1", key_id)
        return None


@router.patch("/{key_id}/toggle", response_model=dict)
async def toggle_api_key(project_id: UUID, key_id: UUID, current_user: dict = Depends(get_current_user)):
    """Enable or disable an API key"""
    pool = await get_main_db_pool()
    
    async with pool.acquire() as conn:
        key = await conn.fetchrow(
            """
            SELECT ak.id, ak.is_active, p.user_id as project_owner_id
            FROM api_keys ak JOIN projects p ON ak.project_id = p.id
            WHERE ak.id = $1 AND ak.project_id = $2
            """,
            key_id, project_id
        )
        
        if not key:
            raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="API key not found")
        if str(key["project_owner_id"]) != str(current_user["id"]):
            raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="Not authorized")
        
        new_status = not key["is_active"]
        await conn.execute("UPDATE api_keys SET is_active = $1 WHERE id = $2", new_status, key_id)
        
        return {
            "id": key_id,
            "is_active": new_status,
            "message": f"API key {'enabled' if new_status else 'disabled'}"
        }
