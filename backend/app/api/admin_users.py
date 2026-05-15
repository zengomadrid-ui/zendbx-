"""
User Management API (Admin)
"""
from fastapi import APIRouter, Depends, HTTPException, status, Request
from typing import Optional
from uuid import UUID
from datetime import datetime
import json

from app.api.auth import get_current_user
from app.core.database import get_main_db_pool
from app.services.audit_service import AuditService
from app.core.rbac import require_admin, is_admin

router = APIRouter(prefix="/api/admin/users", tags=["Admin - Users"])


@router.get("")
async def list_users(
    search: Optional[str] = None,
    provider: Optional[str] = None,
    is_suspended: Optional[bool] = None,
    limit: int = 50,
    offset: int = 0,
    current_user: dict = Depends(require_admin)  # ADMIN ONLY
):
    """List all users with filters - ADMIN ONLY"""
    pool = await get_main_db_pool()
    
    conditions = []
    params = []
    param_count = 1
    
    if search:
        conditions.append(f"(email ILIKE ${param_count} OR full_name ILIKE ${param_count})")
        params.append(f"%{search}%")
        param_count += 1
    
    if provider:
        conditions.append(f"oauth_provider = ${param_count}")
        params.append(provider)
        param_count += 1
    
    if is_suspended is not None:
        conditions.append(f"is_suspended = ${param_count}")
        params.append(is_suspended)
        param_count += 1
    
    where_clause = " AND ".join(conditions) if conditions else "TRUE"
    
    async with pool.acquire() as conn:
        users = await conn.fetch(
            f"""
            SELECT 
                u.id, u.email, u.full_name, u.oauth_provider,
                u.is_suspended, u.suspended_at, u.suspended_reason,
                u.last_login_at, u.last_login_ip, u.created_at,
                COUNT(DISTINCT s.id) as active_sessions,
                COUNT(DISTINCT p.id) as project_count
            FROM users u
            LEFT JOIN auth_sessions s ON u.id = s.user_id AND s.is_active = TRUE
            LEFT JOIN projects p ON u.id = p.user_id
            WHERE {where_clause}
            GROUP BY u.id
            ORDER BY u.created_at DESC
            LIMIT ${param_count} OFFSET ${param_count + 1}
            """,
            *params, limit, offset
        )
        
        total = await conn.fetchval(
            f"SELECT COUNT(*) FROM users WHERE {where_clause}",
            *params
        )
        
        return {
            "users": [dict(u) for u in users],
            "total": total,
            "limit": limit,
            "offset": offset
        }


@router.get("/{user_id}")
async def get_user(
    user_id: UUID,
    current_user: dict = Depends(require_admin)  # ADMIN ONLY
):
    """Get user details - ADMIN ONLY"""
    pool = await get_main_db_pool()
    
    async with pool.acquire() as conn:
        user = await conn.fetchrow(
            """
            SELECT 
                u.*,
                ss.mfa_enabled,
                ss.mfa_method,
                COUNT(DISTINCT s.id) as active_sessions,
                COUNT(DISTINCT p.id) as project_count
            FROM users u
            LEFT JOIN security_settings ss ON u.id = ss.user_id
            LEFT JOIN auth_sessions s ON u.id = s.user_id AND s.is_active = TRUE
            LEFT JOIN projects p ON u.id = p.user_id
            WHERE u.id = $1
            GROUP BY u.id, ss.mfa_enabled, ss.mfa_method
            """,
            user_id
        )
        
        if not user:
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND,
                detail="User not found"
            )
        
        return dict(user)


@router.patch("/{user_id}/suspend")
async def suspend_user(
    user_id: UUID,
    reason: str,
    request: Request,
    current_user: dict = Depends(require_admin)  # ADMIN ONLY
):
    """Suspend a user - ADMIN ONLY"""
    pool = await get_main_db_pool()
    
    async with pool.acquire() as conn:
        # Check if user exists
        user = await conn.fetchrow("SELECT id, email FROM users WHERE id = $1", user_id)
        
        if not user:
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND,
                detail="User not found"
            )
        
        # Suspend user
        await conn.execute(
            """
            UPDATE users
            SET is_suspended = TRUE,
                suspended_at = NOW(),
                suspended_reason = $1
            WHERE id = $2
            """,
            reason, user_id
        )
        
        # Logout all sessions
        await conn.execute(
            "UPDATE auth_sessions SET is_active = FALSE WHERE user_id = $1",
            user_id
        )
        
        # Log audit event
        await AuditService.log_event(
            event_type="user_suspended",
            user_id=current_user["id"],
            event_data=json.dumps({
                "suspended_user_id": str(user_id),
                "suspended_user_email": user["email"],
                "reason": reason
            }),
            ip_address=request.client.host,
            success=True
        )
        
        return {"message": "User suspended successfully"}


@router.patch("/{user_id}/unsuspend")
async def unsuspend_user(
    user_id: UUID,
    request: Request,
    current_user: dict = Depends(require_admin)  # ADMIN ONLY
):
    """Unsuspend a user - ADMIN ONLY"""
    pool = await get_main_db_pool()
    
    async with pool.acquire() as conn:
        user = await conn.fetchrow("SELECT id, email FROM users WHERE id = $1", user_id)
        
        if not user:
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND,
                detail="User not found"
            )
        
        await conn.execute(
            """
            UPDATE users
            SET is_suspended = FALSE,
                suspended_at = NULL,
                suspended_reason = NULL
            WHERE id = $1
            """,
            user_id
        )
        
        await AuditService.log_event(
            event_type="user_unsuspended",
            user_id=current_user["id"],
            event_data=json.dumps({
                "unsuspended_user_id": str(user_id),
                "unsuspended_user_email": user["email"]
            }),
            ip_address=request.client.host,
            success=True
        )
        
        return {"message": "User unsuspended successfully"}


@router.delete("/{user_id}")
async def delete_user(
    user_id: UUID,
    request: Request,
    current_user: dict = Depends(require_admin)  # ADMIN ONLY
):
    """Delete a user (soft delete recommended) - ADMIN ONLY"""
    pool = await get_main_db_pool()
    
    async with pool.acquire() as conn:
        user = await conn.fetchrow("SELECT id, email FROM users WHERE id = $1", user_id)
        
        if not user:
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND,
                detail="User not found"
            )
        
        # Prevent self-deletion
        if str(user_id) == str(current_user["id"]):
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail="Cannot delete your own account"
            )
        
        # Delete user (CASCADE will handle related records)
        await conn.execute("DELETE FROM users WHERE id = $1", user_id)
        
        await AuditService.log_event(
            event_type="user_deleted",
            user_id=current_user["id"],
            event_data=json.dumps({
                "deleted_user_id": str(user_id),
                "deleted_user_email": user["email"]
            }),
            ip_address=request.client.host,
            success=True
        )
        
        return {"message": "User deleted successfully"}


@router.get("/{user_id}/activity")
async def get_user_activity(
    user_id: UUID,
    limit: int = 50,
    current_user: dict = Depends(require_admin)  # ADMIN ONLY
):
    """Get user activity logs - ADMIN ONLY"""
    logs = await AuditService.get_logs(
        user_id=user_id,
        limit=limit
    )
    
    return logs
