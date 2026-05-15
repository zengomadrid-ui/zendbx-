"""
Project-Level Authentication API
Allows project owners to manage their app's users, sessions, and logs
"""
from fastapi import APIRouter, HTTPException, Depends, Query, status
from app.api.auth import get_current_user
from app.core.database import get_main_db_pool
from uuid import UUID
from typing import Optional, List
from datetime import datetime

router = APIRouter()

# ============================================
# HELPER: Verify Project Ownership
# ============================================

async def verify_project_ownership(project_id: UUID, current_user: dict):
    """Verify that the current user owns the project"""
    pool = await get_main_db_pool()
    async with pool.acquire() as conn:
        result = await conn.fetchrow(
            "SELECT id FROM projects WHERE id = $1 AND user_id = $2",
            project_id, current_user["id"]
        )
        
        if not result:
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND,
                detail="Project not found or access denied"
            )

# ============================================
# PROJECT USERS ENDPOINTS
# ============================================

@router.get("/projects/{project_id}/auth/users")
async def get_project_users(
    project_id: UUID,
    search: Optional[str] = None,
    provider: Optional[str] = None,
    limit: int = Query(50, le=100),
    offset: int = 0,
    current_user: dict = Depends(get_current_user)
):
    """Get all users who authenticated via this project's OAuth"""
    
    await verify_project_ownership(project_id, current_user)
    
    pool = await get_main_db_pool()
    async with pool.acquire() as conn:
        # Build query
        query = """
            SELECT 
                id, email, provider, full_name, avatar_url,
                created_at, last_login_at, last_login_ip, is_active,
                (SELECT COUNT(*) FROM project_sessions WHERE project_user_id = project_users.id AND is_active = TRUE) as active_sessions
            FROM project_users
            WHERE project_id = $1
        """
        params = [project_id]
        param_count = 2
        
        if search:
            query += f" AND email ILIKE ${param_count}"
            params.append(f"%{search}%")
            param_count += 1
        
        if provider:
            query += f" AND provider = ${param_count}"
            params.append(provider)
            param_count += 1
        
        query += f" ORDER BY created_at DESC LIMIT ${param_count} OFFSET ${param_count + 1}"
        params.extend([limit, offset])
        
        users = await conn.fetch(query, *params)
        
        # Get total count
        count_query = "SELECT COUNT(*) FROM project_users WHERE project_id = $1"
        count_params = [project_id]
        
        if search:
            count_query += " AND email ILIKE $2"
            count_params.append(f"%{search}%")
        if provider:
            count_query += f" AND provider = ${len(count_params) + 1}"
            count_params.append(provider)
        
        total = await conn.fetchval(count_query, *count_params)
        
        # Get provider stats
        provider_stats = await conn.fetch("""
            SELECT provider, COUNT(*) as count
            FROM project_users
            WHERE project_id = $1
            GROUP BY provider
        """, project_id)
        
        return {
            "users": [dict(u) for u in users],
            "total": total,
            "limit": limit,
            "offset": offset,
            "provider_stats": {p["provider"]: p["count"] for p in provider_stats}
        }


@router.get("/projects/{project_id}/auth/users/{user_id}")
async def get_project_user_details(
    project_id: UUID,
    user_id: UUID,
    current_user: dict = Depends(get_current_user)
):
    """Get detailed information about a specific project user"""
    
    await verify_project_ownership(project_id, current_user)
    
    pool = await get_main_db_pool()
    async with pool.acquire() as conn:
        # Get user details
        user = await conn.fetchrow("""
            SELECT *
            FROM project_users
            WHERE id = $1 AND project_id = $2
        """, user_id, project_id)
        
        if not user:
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND,
                detail="User not found"
            )
        
        # Get user's sessions
        sessions = await conn.fetch("""
            SELECT id, device_name, device_type, browser, os, ip_address,
                   last_active_at, is_active
            FROM project_sessions
            WHERE project_user_id = $1
            ORDER BY last_active_at DESC
            LIMIT 10
        """, user_id)
        
        # Get user's recent logs
        logs = await conn.fetch("""
            SELECT id, event_type, provider, ip_address, created_at, success
            FROM project_auth_logs
            WHERE project_user_id = $1
            ORDER BY created_at DESC
            LIMIT 20
        """, user_id)
        
        return {
            "user": dict(user),
            "sessions": [dict(s) for s in sessions],
            "recent_logs": [dict(l) for l in logs]
        }


# ============================================
# PROJECT SESSIONS ENDPOINTS
# ============================================

@router.get("/projects/{project_id}/auth/sessions")
async def get_project_sessions(
    project_id: UUID,
    user_email: Optional[str] = None,
    active_only: bool = True,
    limit: int = Query(50, le=100),
    offset: int = 0,
    current_user: dict = Depends(get_current_user)
):
    """Get all sessions for this project's users"""
    
    await verify_project_ownership(project_id, current_user)
    
    pool = await get_main_db_pool()
    async with pool.acquire() as conn:
        query = """
            SELECT 
                s.id, s.user_email, s.device_name, s.device_type,
                s.browser, s.os, s.ip_address, s.location,
                s.created_at, s.last_active_at, s.is_active,
                u.full_name as user_name
            FROM project_sessions s
            LEFT JOIN project_users u ON s.project_user_id = u.id
            WHERE s.project_id = $1
        """
        params = [project_id]
        param_count = 2
        
        if active_only:
            query += f" AND s.is_active = TRUE"
        
        if user_email:
            query += f" AND s.user_email ILIKE ${param_count}"
            params.append(f"%{user_email}%")
            param_count += 1
        
        query += f" ORDER BY s.last_active_at DESC LIMIT ${param_count} OFFSET ${param_count + 1}"
        params.extend([limit, offset])
        
        sessions = await conn.fetch(query, *params)
        
        # Get total count
        count_query = "SELECT COUNT(*) FROM project_sessions WHERE project_id = $1"
        count_params = [project_id]
        
        if active_only:
            count_query += " AND is_active = TRUE"
        if user_email:
            count_query += f" AND user_email ILIKE ${len(count_params) + 1}"
            count_params.append(f"%{user_email}%")
        
        total = await conn.fetchval(count_query, *count_params)
        
        return {
            "sessions": [dict(s) for s in sessions],
            "total": total,
            "limit": limit,
            "offset": offset
        }


@router.delete("/projects/{project_id}/auth/sessions/{session_id}")
async def terminate_project_session(
    project_id: UUID,
    session_id: UUID,
    current_user: dict = Depends(get_current_user)
):
    """Terminate a specific session"""
    
    await verify_project_ownership(project_id, current_user)
    
    pool = await get_main_db_pool()
    async with pool.acquire() as conn:
        result = await conn.execute("""
            UPDATE project_sessions
            SET is_active = FALSE
            WHERE id = $1 AND project_id = $2
        """, session_id, project_id)
        
        if result == "UPDATE 0":
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND,
                detail="Session not found"
            )
        
        return {"message": "Session terminated successfully"}


@router.post("/projects/{project_id}/auth/sessions/terminate-user")
async def terminate_user_sessions(
    project_id: UUID,
    user_id: UUID,
    current_user: dict = Depends(get_current_user)
):
    """Terminate all sessions for a specific user"""
    
    await verify_project_ownership(project_id, current_user)
    
    pool = await get_main_db_pool()
    async with pool.acquire() as conn:
        result = await conn.execute("""
            UPDATE project_sessions
            SET is_active = FALSE
            WHERE project_user_id = $1 AND project_id = $2 AND is_active = TRUE
        """, user_id, project_id)
        
        return {"message": f"All user sessions terminated successfully"}


# ============================================
# PROJECT AUTH LOGS ENDPOINTS
# ============================================

@router.get("/projects/{project_id}/auth/logs")
async def get_project_auth_logs(
    project_id: UUID,
    event_type: Optional[str] = None,
    user_email: Optional[str] = None,
    success: Optional[bool] = None,
    limit: int = Query(100, le=500),
    offset: int = 0,
    current_user: dict = Depends(get_current_user)
):
    """Get authentication logs for this project"""
    
    await verify_project_ownership(project_id, current_user)
    
    pool = await get_main_db_pool()
    async with pool.acquire() as conn:
        query = """
            SELECT 
                id, user_email, event_type, provider, ip_address,
                success, error_message, created_at, metadata
            FROM project_auth_logs
            WHERE project_id = $1
        """
        params = [project_id]
        param_count = 2
        
        if event_type:
            query += f" AND event_type = ${param_count}"
            params.append(event_type)
            param_count += 1
        
        if user_email:
            query += f" AND user_email ILIKE ${param_count}"
            params.append(f"%{user_email}%")
            param_count += 1
        
        if success is not None:
            query += f" AND success = ${param_count}"
            params.append(success)
            param_count += 1
        
        query += f" ORDER BY created_at DESC LIMIT ${param_count} OFFSET ${param_count + 1}"
        params.extend([limit, offset])
        
        logs = await conn.fetch(query, *params)
        
        # Get total count
        count_query = "SELECT COUNT(*) FROM project_auth_logs WHERE project_id = $1"
        count_params = [project_id]
        
        if event_type:
            count_query += f" AND event_type = ${len(count_params) + 1}"
            count_params.append(event_type)
        if user_email:
            count_query += f" AND user_email ILIKE ${len(count_params) + 1}"
            count_params.append(f"%{user_email}%")
        if success is not None:
            count_query += f" AND success = ${len(count_params) + 1}"
            count_params.append(success)
        
        total = await conn.fetchval(count_query, *count_params)
        
        # Get event type stats
        event_stats = await conn.fetch("""
            SELECT event_type, COUNT(*) as count
            FROM project_auth_logs
            WHERE project_id = $1
            GROUP BY event_type
        """, project_id)
        
        return {
            "logs": [dict(l) for l in logs],
            "total": total,
            "limit": limit,
            "offset": offset,
            "event_stats": {e["event_type"]: e["count"] for e in event_stats}
        }


# ============================================
# PROJECT OAUTH PROVIDERS ENDPOINTS
# ============================================

@router.get("/projects/{project_id}/auth/providers")
async def get_project_providers(
    project_id: UUID,
    current_user: dict = Depends(get_current_user)
):
    """Get OAuth providers configured for this project"""
    
    await verify_project_ownership(project_id, current_user)
    
    pool = await get_main_db_pool()
    async with pool.acquire() as conn:
        providers = await conn.fetch("""
            SELECT id, provider, is_enabled, redirect_url, created_at, updated_at
            FROM project_oauth_providers
            WHERE project_id = $1
            ORDER BY provider
        """, project_id)
        
        # Get usage stats
        usage_stats = await conn.fetch("""
            SELECT provider, COUNT(*) as user_count
            FROM project_users
            WHERE project_id = $1
            GROUP BY provider
        """, project_id)
        
        return {
            "providers": [dict(p) for p in providers],
            "usage_stats": {u["provider"]: u["user_count"] for u in usage_stats}
        }


@router.get("/projects/{project_id}/auth/stats")
async def get_project_auth_stats(
    project_id: UUID,
    current_user: dict = Depends(get_current_user)
):
    """Get authentication statistics for this project"""
    
    await verify_project_ownership(project_id, current_user)
    
    pool = await get_main_db_pool()
    async with pool.acquire() as conn:
        # Total users
        total_users = await conn.fetchval("""
            SELECT COUNT(*) FROM project_users WHERE project_id = $1
        """, project_id)
        
        # Active sessions
        active_sessions = await conn.fetchval("""
            SELECT COUNT(*) FROM project_sessions 
            WHERE project_id = $1 AND is_active = TRUE
        """, project_id)
        
        # Recent signups (last 7 days)
        recent_signups = await conn.fetchval("""
            SELECT COUNT(*) FROM project_users 
            WHERE project_id = $1 AND created_at > NOW() - INTERVAL '7 days'
        """, project_id)
        
        # Recent logins (last 24 hours)
        recent_logins = await conn.fetchval("""
            SELECT COUNT(*) FROM project_auth_logs 
            WHERE project_id = $1 
            AND event_type = 'login_success' 
            AND created_at > NOW() - INTERVAL '24 hours'
        """, project_id)
        
        # Provider breakdown
        provider_breakdown = await conn.fetch("""
            SELECT provider, COUNT(*) as count
            FROM project_users
            WHERE project_id = $1
            GROUP BY provider
        """, project_id)
        
        return {
            "total_users": total_users,
            "active_sessions": active_sessions,
            "recent_signups": recent_signups,
            "recent_logins": recent_logins,
            "provider_breakdown": {p["provider"]: p["count"] for p in provider_breakdown}
        }
