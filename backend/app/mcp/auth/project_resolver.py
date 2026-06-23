"""
Project Resolver
Resolves project from slug/ID and validates ownership
Enforces cross-tenant isolation
"""

from typing import Optional, Dict, Any
from uuid import UUID
import asyncpg
import logging

from app.core.db_router import get_main_db_pool
from ..core.types import UserID, OrganizationID, ProjectID, UserRole
from ..core.exceptions import AuthorizationError

logger = logging.getLogger(__name__)


class ProjectResolver:
    """
    Resolves projects and validates access
    Critical for multi-tenant security
    """
    
    def __init__(self):
        self.pool: Optional[asyncpg.Pool] = None
    
    async def initialize(self):
        """Initialize database connection"""
        pool = await get_main_db_pool()
        if pool is None:
            raise Exception("Failed to initialize database pool")
        self.pool = pool
        print(f"✅ ProjectResolver: Database pool initialized (size: {self.pool.get_size()})")
    
    async def resolve_project(
        self,
        project_identifier: str,
        user_id: UserID,
        organization_id: OrganizationID
    ) -> Dict[str, Any]:
        """
        Resolve project from slug or ID
        Validate user has access
        
        Returns project data dict
        """
        # Try to parse as UUID first
        project_id = None
        try:
            project_id = UUID(project_identifier)
            is_uuid = True
        except ValueError:
            is_uuid = False
        
        async with self.pool.acquire() as conn:
            if is_uuid:
                # Query by ID
                project = await conn.fetchrow(
                    """
                    SELECT 
                        p.id, p.name, p.slug, p.description, p.database_name,
                        p.status, p.created_at, p.user_id as owner_id,
                        pm.role
                    FROM projects p
                    LEFT JOIN project_members pm ON p.id = pm.project_id AND pm.user_id = $2
                    WHERE p.id = $1
                    """,
                    project_id,
                    user_id
                )
            else:
                # Query by slug
                project = await conn.fetchrow(
                    """
                    SELECT 
                        p.id, p.name, p.slug, p.description, p.database_name,
                        p.status, p.created_at, p.user_id as owner_id,
                        pm.role
                    FROM projects p
                    LEFT JOIN project_members pm ON p.id = pm.project_id AND pm.user_id = $2
                    WHERE p.slug = $1
                    """,
                    project_identifier,
                    user_id
                )
            
            if not project:
                raise AuthorizationError(
                    f"Project not found: {project_identifier}",
                    details={"project": project_identifier}
                )
            
            # Verify project is active
            if project["status"] != "active":
                raise AuthorizationError(
                    f"Project is not active: {project['status']}",
                    details={"project": project_identifier, "status": project["status"]}
                )
            
            # Determine effective role:
            # 1. Project owner always has OWNER role (even if not in project_members)
            # 2. Otherwise use project_members.role
            effective_role = project["role"]

            if not effective_role:
                if str(project["owner_id"]) == str(user_id):
                    effective_role = "owner"
                    logger.info(f"User {user_id} is the project owner — granting owner role")
                else:
                    raise AuthorizationError(
                        "You are not a member of this project",
                        details={"project": project_identifier}
                    )
            
            return {
                "id": project["id"],
                "name": project["name"],
                "slug": project["slug"],
                "description": project["description"],
                "database_name": project["database_name"],
                "organization_id": organization_id,  # Use passed organization_id
                "status": project["status"],
                "created_at": project["created_at"],
                "role": effective_role
            }
    
    async def get_user_role(self, project_id: ProjectID, user_id: UserID) -> UserRole:
        """Get user's role in project"""
        async with self.pool.acquire() as conn:
            result = await conn.fetchval(
                """
                SELECT role
                FROM project_members
                WHERE project_id = $1 AND user_id = $2
                """,
                project_id,
                user_id
            )
            
            if not result:
                return UserRole.READ_ONLY
            
            # Map database role to UserRole enum
            role_map = {
                "owner": UserRole.OWNER,
                "admin": UserRole.ADMIN,
                "developer": UserRole.DEVELOPER,
                "viewer": UserRole.READ_ONLY
            }
            
            return role_map.get(result, UserRole.READ_ONLY)
