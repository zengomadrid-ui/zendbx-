"""
Project-Scoped Admin API
Provides administrative operations scoped to individual projects.

SECURITY:
- Requires project service_role JWT
- All operations are isolated to the authenticated project
- Cross-project access is denied with 403
- Platform-wide operations are NOT allowed

DIFFERENCE FROM /api/admin/*:
- /api/admin/* = Platform admins managing the entire ZendBX platform
- /api/project/{project_id}/admin/* = Project service managing a single project

KEY SECURITY RULES:
1. Project A service_role can ONLY access Project A resources
2. Project A service_role CANNOT access Project B resources
3. Project service_role CANNOT access platform-wide users/projects
4. All queries are scoped to project-specific auth.users table
5. Never query platform 'users' table directly
"""
from fastapi import APIRouter, HTTPException, status, Depends, Request
from uuid import UUID
from typing import Optional
import logging
import json

from app.core.project_auth import require_project_service_role, require_project_or_platform_admin
from app.core.database import get_main_db_pool
from app.services.audit_service import AuditService

logger = logging.getLogger(__name__)

router = APIRouter(prefix="/api/project", tags=["Project Admin"])


@router.get("/{project_id}/admin/users")
async def list_project_users(
    project_id: UUID,
    search: Optional[str] = None,
    limit: int = 50,
    offset: int = 0,
    principal: dict = Depends(require_project_or_platform_admin)
):
    """
    List users within the project's auth system.
    
    SCOPE: Project-specific auth.users table only
    NOT the platform users table.
    
    Security:
    - Project service_role: Can only list users in their own project
    - Platform admin: Can list users in any project
    - Cross-project access is denied
    """
    # Validate project_id matches token (already done by dependency, but explicit check)
    if principal.get("token_type") == "project":
        if str(principal.get("project_id")) != str(project_id):
            raise HTTPException(
                status_code=status.HTTP_403_FORBIDDEN,
                detail="Cross-project access denied"
            )
    
    pool = await get_main_db_pool()
    async with pool.acquire() as conn:
        # Get project details
        project = await conn.fetchrow(
            "SELECT id, database_name FROM projects WHERE id = $1",
            project_id
        )
        
        if not project:
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND,
                detail="Project not found"
            )
        
        database_name = project["database_name"]
        
        # Query project-specific auth.users table
        # SECURITY: Never query platform 'users' table
        conditions = []
        params = []
        param_count = 1
        
        if search:
            conditions.append(f"(email ILIKE ${param_count} OR raw_user_meta_data->>'full_name' ILIKE ${param_count})")
            params.append(f"%{search}%")
            param_count += 1
        
        where_clause = " AND ".join(conditions) if conditions else "TRUE"
        
        # Query project schema auth.users
        query = f"""
            SELECT 
                id, email, 
                raw_user_meta_data->>'full_name' as full_name,
                created_at, updated_at,
                last_sign_in_at,
                email_confirmed_at,
                banned_until,
                deleted_at
            FROM {database_name}.auth.users
            WHERE {where_clause}
            AND deleted_at IS NULL
            ORDER BY created_at DESC
            LIMIT ${param_count} OFFSET ${param_count + 1}
        """
        
        users = await conn.fetch(query, *params, limit, offset)
        
        # Count total
        count_query = f"""
            SELECT COUNT(*) 
            FROM {database_name}.auth.users
            WHERE {where_clause}
            AND deleted_at IS NULL
        """
        total = await conn.fetchval(count_query, *params)
        
        return {
            "users": [dict(u) for u in users],
            "total": total,
            "limit": limit,
            "offset": offset,
            "project_id": str(project_id)
        }


@router.get("/{project_id}/admin/users/{user_id}")
async def get_project_user(
    project_id: UUID,
    user_id: UUID,
    principal: dict = Depends(require_project_or_platform_admin)
):
    """
    Get details of a specific user in the project's auth system.
    
    SCOPE: Project-specific auth.users table only
    """
    # Validate project_id
    if principal.get("token_type") == "project":
        if str(principal.get("project_id")) != str(project_id):
            raise HTTPException(
                status_code=status.HTTP_403_FORBIDDEN,
                detail="Cross-project access denied"
            )
    
    pool = await get_main_db_pool()
    async with pool.acquire() as conn:
        # Get project details
        project = await conn.fetchrow(
            "SELECT id, database_name FROM projects WHERE id = $1",
            project_id
        )
        
        if not project:
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND,
                detail="Project not found"
            )
        
        database_name = project["database_name"]
        
        # Query project-specific user
        query = f"""
            SELECT 
                id, email,
                raw_user_meta_data->>'full_name' as full_name,
                raw_user_meta_data,
                created_at, updated_at,
                last_sign_in_at,
                email_confirmed_at,
                confirmed_at,
                banned_until,
                deleted_at,
                is_sso_user,
                is_super_admin
            FROM {database_name}.auth.users
            WHERE id = $1
            AND deleted_at IS NULL
        """
        
        user = await conn.fetchrow(query, user_id)
        
        if not user:
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND,
                detail="User not found in project"
            )
        
        return dict(user)


@router.delete("/{project_id}/admin/users/{user_id}")
async def delete_project_user(
    project_id: UUID,
    user_id: UUID,
    request: Request,
    principal: dict = Depends(require_project_or_platform_admin)
):
    """
    Delete a user from the project's auth system (soft delete).
    
    SCOPE: Project-specific auth.users table only
    SECURITY: Cannot delete users from other projects or platform users
    """
    # Validate project_id
    if principal.get("token_type") == "project":
        if str(principal.get("project_id")) != str(project_id):
            raise HTTPException(
                status_code=status.HTTP_403_FORBIDDEN,
                detail="Cross-project access denied"
            )
    
    pool = await get_main_db_pool()
    async with pool.acquire() as conn:
        # Get project details
        project = await conn.fetchrow(
            "SELECT id, database_name FROM projects WHERE id = $1",
            project_id
        )
        
        if not project:
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND,
                detail="Project not found"
            )
        
        database_name = project["database_name"]
        
        # Soft delete user in project schema
        query = f"""
            UPDATE {database_name}.auth.users
            SET deleted_at = NOW()
            WHERE id = $1
            AND deleted_at IS NULL
            RETURNING email
        """
        
        result = await conn.fetchrow(query, user_id)
        
        if not result:
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND,
                detail="User not found in project or already deleted"
            )
        
        # Log audit event
        await AuditService.log_event(
            event_type="project_user_deleted",
            user_id=principal.get("user_id"),
            event_data=json.dumps({
                "project_id": str(project_id),
                "deleted_user_id": str(user_id),
                "deleted_user_email": result["email"]
            }),
            ip_address=request.client.host if request.client else "unknown",
            success=True
        )
        
        return {
            "message": "User deleted successfully",
            "user_id": str(user_id),
            "project_id": str(project_id)
        }


@router.get("/{project_id}/admin/stats")
async def get_project_stats(
    project_id: UUID,
    principal: dict = Depends(require_project_or_platform_admin)
):
    """
    Get statistics for the project.
    
    SCOPE: Project-specific metrics only
    """
    # Validate project_id
    if principal.get("token_type") == "project":
        if str(principal.get("project_id")) != str(project_id):
            raise HTTPException(
                status_code=status.HTTP_403_FORBIDDEN,
                detail="Cross-project access denied"
            )
    
    pool = await get_main_db_pool()
    async with pool.acquire() as conn:
        # Get project details
        project = await conn.fetchrow(
            "SELECT id, database_name, name, created_at FROM projects WHERE id = $1",
            project_id
        )
        
        if not project:
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND,
                detail="Project not found"
            )
        
        database_name = project["database_name"]
        
        # Get user count
        user_count_query = f"""
            SELECT COUNT(*) 
            FROM {database_name}.auth.users
            WHERE deleted_at IS NULL
        """
        user_count = await conn.fetchval(user_count_query)
        
        # Get recent signups (last 7 days)
        recent_signups_query = f"""
            SELECT COUNT(*)
            FROM {database_name}.auth.users
            WHERE created_at > NOW() - INTERVAL '7 days'
            AND deleted_at IS NULL
        """
        recent_signups = await conn.fetchval(recent_signups_query)
        
        # Get active users (signed in last 30 days)
        active_users_query = f"""
            SELECT COUNT(*)
            FROM {database_name}.auth.users
            WHERE last_sign_in_at > NOW() - INTERVAL '30 days'
            AND deleted_at IS NULL
        """
        active_users = await conn.fetchval(active_users_query)
        
        return {
            "project_id": str(project_id),
            "project_name": project["name"],
            "total_users": user_count or 0,
            "recent_signups_7d": recent_signups or 0,
            "active_users_30d": active_users or 0,
            "project_created_at": project["created_at"].isoformat() if project["created_at"] else None
        }


@router.get("/{project_id}/admin/health")
async def check_project_health(
    project_id: UUID,
    principal: dict = Depends(require_project_or_platform_admin)
):
    """
    Check health status of the project.
    
    SCOPE: Project-specific health checks only
    """
    # Validate project_id
    if principal.get("token_type") == "project":
        if str(principal.get("project_id")) != str(project_id):
            raise HTTPException(
                status_code=status.HTTP_403_FORBIDDEN,
                detail="Cross-project access denied"
            )
    
    pool = await get_main_db_pool()
    async with pool.acquire() as conn:
        # Get project
        project = await conn.fetchrow(
            "SELECT id, database_name, status FROM projects WHERE id = $1",
            project_id
        )
        
        if not project:
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND,
                detail="Project not found"
            )
        
        database_name = project["database_name"]
        
        # Check if schema exists
        schema_exists = await conn.fetchval(
            "SELECT EXISTS(SELECT 1 FROM information_schema.schemata WHERE schema_name = $1)",
            database_name
        )
        
        # Check if auth.users table exists
        auth_table_exists = await conn.fetchval(
            f"""
            SELECT EXISTS(
                SELECT 1 FROM information_schema.tables 
                WHERE table_schema = '{database_name}' 
                AND table_name = 'users'
            )
            """
        )
        
        health_status = "healthy"
        issues = []
        
        if not schema_exists:
            health_status = "unhealthy"
            issues.append("Project schema does not exist")
        
        if not auth_table_exists:
            health_status = "unhealthy"
            issues.append("Auth users table does not exist")
        
        if project["status"] != "active":
            health_status = "degraded"
            issues.append(f"Project status is {project['status']}")
        
        return {
            "project_id": str(project_id),
            "health_status": health_status,
            "schema_exists": schema_exists,
            "auth_table_exists": auth_table_exists,
            "project_status": project["status"],
            "issues": issues
        }
