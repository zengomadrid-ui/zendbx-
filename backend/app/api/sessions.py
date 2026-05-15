"""
Session Management API
"""
from fastapi import APIRouter, Depends, HTTPException, status, Request
from typing import List
from uuid import UUID
import json

from app.api.auth import get_current_user
from app.services.session_service import SessionService
from app.services.audit_service import AuditService
from app.core.rbac import is_admin

router = APIRouter(prefix="/api/auth/sessions", tags=["Sessions"])


@router.get("")
async def get_sessions(current_user: dict = Depends(get_current_user)):
    """
    Get sessions:
    - Admin: can see all sessions
    - User: can only see their own sessions
    """
    if is_admin(current_user):
        # Admin can see all sessions
        from app.core.database import get_main_db_pool
        pool = await get_main_db_pool()
        
        async with pool.acquire() as conn:
            sessions = await conn.fetch(
                """
                SELECT s.*, u.email as user_email, u.full_name as user_name
                FROM auth_sessions s
                JOIN users u ON s.user_id = u.id
                WHERE s.is_active = TRUE
                ORDER BY s.last_active DESC
                """
            )
            
            return {
                "sessions": [dict(s) for s in sessions],
                "total": len(sessions),
                "is_admin": True
            }
    else:
        # Regular user can only see their own sessions
        sessions = await SessionService.get_user_sessions(current_user["id"])
        
        return {
            "sessions": sessions,
            "total": len(sessions),
            "is_admin": False
        }


@router.delete("/{session_id}")
async def logout_session(
    session_id: UUID,
    request: Request,
    current_user: dict = Depends(get_current_user)
):
    """Logout a specific session"""
    success = await SessionService.logout_session(session_id, current_user["id"])
    
    if not success:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Session not found"
        )
    
    # Log audit event
    await AuditService.log_event(
        event_type="session_logout",
        user_id=current_user["id"],
        event_data=json.dumps({"session_id": str(session_id)}),
        ip_address=request.client.host,
        success=True
    )
    
    return {"message": "Session logged out successfully"}


@router.delete("")
async def logout_all_sessions(
    request: Request,
    current_user: dict = Depends(get_current_user)
):
    """Logout all sessions except current one"""
    # Get current session ID from token (you'll need to implement this)
    # For now, logout all sessions
    await SessionService.logout_all_sessions(current_user["id"])
    
    # Log audit event
    await AuditService.log_event(
        event_type="all_sessions_logout",
        user_id=current_user["id"],
        ip_address=request.client.host,
        success=True
    )
    
    return {"message": "All sessions logged out successfully"}
