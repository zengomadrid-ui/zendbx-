"""
Audit Logs API with RBAC
Admin can see all logs, users can only see their own
"""
from fastapi import APIRouter, Depends, Query
from typing import Optional
from uuid import UUID

from app.api.auth import get_current_user
from app.services.audit_service import AuditService
from app.core.rbac import is_admin

router = APIRouter(prefix="/api/audit", tags=["Audit Logs"])


@router.get("/logs")
async def get_audit_logs(
    event_type: Optional[str] = None,
    success: Optional[bool] = None,
    date_from: Optional[str] = None,
    date_to: Optional[str] = None,
    limit: int = Query(100, le=1000),
    offset: int = 0,
    current_user: dict = Depends(get_current_user)
):
    """
    Get audit logs with RBAC:
    - Admin: can see all logs
    - User: can only see their own logs
    
    Filters:
    - event_type: Filter by event type (login, logout, etc.)
    - success: Filter by success status (true/false)
    - date_from: Filter logs from this date (YYYY-MM-DD)
    - date_to: Filter logs until this date (YYYY-MM-DD)
    """
    # If user is admin, they can see all logs
    # If user is regular user, filter by their user_id
    user_id_filter = None if is_admin(current_user) else current_user["id"]
    
    logs = await AuditService.get_logs(
        user_id=user_id_filter,
        event_type=event_type,
        success=success,
        date_from=date_from,
        date_to=date_to,
        limit=limit,
        offset=offset
    )
    
    return {
        **logs,
        "is_admin": is_admin(current_user),
        "filtered_by_user": user_id_filter is not None
    }


@router.get("/logs/user/{user_id}")
async def get_user_logs(
    user_id: UUID,
    limit: int = Query(100, le=1000),
    current_user: dict = Depends(get_current_user)
):
    """
    Get logs for a specific user:
    - Admin: can see any user's logs
    - User: can only see their own logs
    """
    # Check if user is trying to access someone else's logs
    if not is_admin(current_user) and str(current_user["id"]) != str(user_id):
        from fastapi import HTTPException, status
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Access denied. You can only view your own logs."
        )
    
    logs = await AuditService.get_logs(
        user_id=user_id,
        limit=limit
    )
    
    return logs


@router.get("/logs/stats")
async def get_logs_stats(current_user: dict = Depends(get_current_user)):
    """
    Get audit log statistics:
    - Admin: stats for all users
    - User: stats for their own logs only
    """
    from app.core.database import get_main_db_pool
    
    pool = await get_main_db_pool()
    
    async with pool.acquire() as conn:
        # Build query based on role
        if is_admin(current_user):
            # Admin sees all stats
            stats = await conn.fetchrow("""
                SELECT 
                    COUNT(*) as total_events,
                    COUNT(*) FILTER (WHERE success = TRUE) as successful_events,
                    COUNT(*) FILTER (WHERE success = FALSE) as failed_events,
                    COUNT(DISTINCT user_id) as unique_users,
                    COUNT(*) FILTER (WHERE created_at > NOW() - INTERVAL '24 hours') as last_24h
                FROM audit_logs
            """)
        else:
            # User sees only their stats
            stats = await conn.fetchrow("""
                SELECT 
                    COUNT(*) as total_events,
                    COUNT(*) FILTER (WHERE success = TRUE) as successful_events,
                    COUNT(*) FILTER (WHERE success = FALSE) as failed_events,
                    1 as unique_users,
                    COUNT(*) FILTER (WHERE created_at > NOW() - INTERVAL '24 hours') as last_24h
                FROM audit_logs
                WHERE user_id = $1
            """, current_user["id"])
        
        return {
            **dict(stats),
            "is_admin": is_admin(current_user)
        }
