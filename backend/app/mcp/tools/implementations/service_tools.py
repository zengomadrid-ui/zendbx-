"""
Service Tools
Tools for auth, storage, functions, deployment, and project operations
"""

from typing import Dict, Any
import logging
from ...core.types import AuthContext, Permission, ToolCategory
from ..base import BaseTool
from app.core.db_router import get_main_db_pool
from ...context.collectors import (
    AuthCollector,
    StorageCollector,
    FunctionsCollector,
    DeploymentCollector
)
from ...utils.serialization import make_json_safe

logger = logging.getLogger(__name__)


class ListUsersTool(BaseTool):
    """
    List all users in the project
    """
    
    name = "auth.list_users"
    description = "List all users in the project with their authentication details"
    category = ToolCategory.AUTH
    required_permissions = [Permission.READ_AUTH]
    
    input_schema = {
        "type": "object",
        "properties": {
            "limit": {
                "type": "integer",
                "description": "Maximum number of users to return (default: 100)",
                "default": 100
            },
            "offset": {
                "type": "integer",
                "description": "Offset for pagination (default: 0)",
                "default": 0
            }
        },
        "required": []
    }
    
    async def execute(
        self,
        auth_context: AuthContext,
        parameters: Dict[str, Any]
    ) -> Dict[str, Any]:
        """List users"""
        try:
            pool = await get_main_db_pool()
            limit = parameters.get("limit", 100)
            offset = parameters.get("offset", 0)
            
            async with pool.acquire() as conn:
                # Get total count
                total = await conn.fetchval(
                    """
                    SELECT COUNT(*) 
                    FROM project_users 
                    WHERE project_id = $1
                    """,
                    auth_context.project_id
                )
                
                # Get users
                rows = await conn.fetch(
                    """
                    SELECT 
                        pu.id,
                        pu.email,
                        pu.provider,
                        pu.provider_user_id,
                        pu.full_name,
                        pu.avatar_url,
                        pu.metadata,
                        pu.created_at,
                        pu.last_login_at,
                        pu.last_login_ip,
                        pu.is_active
                    FROM project_users pu
                    WHERE pu.project_id = $1
                    ORDER BY pu.created_at DESC
                    LIMIT $2 OFFSET $3
                    """,
                    auth_context.project_id,
                    limit,
                    offset
                )
                
                users = []
                for row in rows:
                    users.append({
                        "id": str(row["id"]),
                        "email": row["email"],
                        "provider": row["provider"],
                        "provider_user_id": row["provider_user_id"],
                        "full_name": row["full_name"],
                        "avatar_url": row["avatar_url"],
                        "metadata": row["metadata"],
                        "created_at": row["created_at"].isoformat() if row["created_at"] else None,
                        "last_login_at": row["last_login_at"].isoformat() if row["last_login_at"] else None,
                        "last_login_ip": row["last_login_ip"],
                        "is_active": row["is_active"]
                    })
                
                result = {
                    "total": total,
                    "limit": limit,
                    "offset": offset,
                    "count": len(users),
                    "users": users
                }
                
                return make_json_safe(result)
                
        except Exception as e:
            logger.error(f"Error listing users: {str(e)}")
            raise


class ListBucketsTool(BaseTool):
    """
    List all storage buckets
    """
    
    name = "storage.list_buckets"
    description = "List all storage buckets with their configuration and statistics"
    category = ToolCategory.STORAGE
    required_permissions = [Permission.READ_STORAGE]
    
    input_schema = {
        "type": "object",
        "properties": {},
        "required": []
    }
    
    async def execute(
        self,
        auth_context: AuthContext,
        parameters: Dict[str, Any]
    ) -> Dict[str, Any]:
        """List buckets"""
        try:
            collector = StorageCollector()
            context = await collector.collect(str(auth_context.project_id))
            
            result = {
                "project_id": str(auth_context.project_id),
                "buckets": context.get("buckets", []),
                "statistics": context.get("statistics", {}),
                "status": context.get("status", "unknown")
            }
            
            return make_json_safe(result)
                
        except Exception as e:
            logger.error(f"Error listing buckets: {str(e)}")
            raise


class ListFunctionsTool(BaseTool):
    """
    List all database functions
    """
    
    name = "functions.list_functions"
    description = "List all database functions and stored procedures"
    category = ToolCategory.FUNCTIONS
    required_permissions = [Permission.READ_DATABASE]
    
    input_schema = {
        "type": "object",
        "properties": {
            "include_triggers": {
                "type": "boolean",
                "description": "Include trigger functions (default: true)",
                "default": True
            }
        },
        "required": []
    }
    
    async def execute(
        self,
        auth_context: AuthContext,
        parameters: Dict[str, Any]
    ) -> Dict[str, Any]:
        """List functions"""
        try:
            collector = FunctionsCollector()
            context = await collector.collect(
                str(auth_context.project_id),
                auth_context.database_name
            )
            
            include_triggers = parameters.get("include_triggers", True)
            
            result = {
                "project_id": str(auth_context.project_id),
                "database": auth_context.database_name,
                "functions": context.get("functions", []),
                "statistics": context.get("statistics", {}),
                "status": context.get("status", "unknown")
            }
            
            if include_triggers:
                result["triggers"] = context.get("triggers", [])
            
            return make_json_safe(result)
                
        except Exception as e:
            logger.error(f"Error listing functions: {str(e)}")
            raise


class HealthCheckTool(BaseTool):
    """
    Get deployment health status
    """
    
    name = "deployment.health_check"
    description = "Get deployment health status including system resources and uptime"
    category = ToolCategory.DEPLOYMENT
    required_permissions = [Permission.READ_DEPLOYMENT]
    
    input_schema = {
        "type": "object",
        "properties": {},
        "required": []
    }
    
    async def execute(
        self,
        auth_context: AuthContext,
        parameters: Dict[str, Any]
    ) -> Dict[str, Any]:
        """Health check"""
        try:
            collector = DeploymentCollector()
            context = await collector.collect(str(auth_context.project_id))
            
            result = {
                "project_id": str(auth_context.project_id),
                "health": context.get("health", {}),
                "resources": context.get("resources", {}),
                "deployment": context.get("deployment", {}),
                "status": context.get("status", "unknown")
            }
            
            return make_json_safe(result)
                
        except Exception as e:
            logger.error(f"Error getting health status: {str(e)}")
            raise


class ProjectInfoTool(BaseTool):
    """
    Get project information
    """
    
    name = "project.get_info"
    description = "Get detailed project information including configuration and statistics"
    category = ToolCategory.PROJECT
    required_permissions = [Permission.READ_PROJECT]
    
    input_schema = {
        "type": "object",
        "properties": {},
        "required": []
    }
    
    async def execute(
        self,
        auth_context: AuthContext,
        parameters: Dict[str, Any]
    ) -> Dict[str, Any]:
        """Get project info"""
        try:
            pool = await get_main_db_pool()
            
            async with pool.acquire() as conn:
                # Get project details
                project = await conn.fetchrow(
                    """
                    SELECT 
                        id,
                        name,
                        slug,
                        description,
                        database_name,
                        status,
                        created_at,
                        updated_at,
                        user_id
                    FROM projects
                    WHERE id = $1
                    """,
                    auth_context.project_id
                )
                
                if not project:
                    raise ValueError("Project not found")
                
                # Get project statistics
                user_count = await conn.fetchval(
                    "SELECT COUNT(*) FROM project_users WHERE project_id = $1",
                    auth_context.project_id
                )
                
                # Try to get API key count (handle missing revoked column gracefully)
                try:
                    api_key_count = await conn.fetchval(
                        "SELECT COUNT(*) FROM project_api_keys WHERE project_id = $1 AND is_active = true",
                        auth_context.project_id
                    )
                except:
                    # Fallback if column doesn't exist
                    try:
                        api_key_count = await conn.fetchval(
                            "SELECT COUNT(*) FROM project_api_keys WHERE project_id = $1",
                            auth_context.project_id
                        )
                    except:
                        api_key_count = 0
                
                # Get table count
                table_count = await conn.fetchval(
                    """
                    SELECT COUNT(*)
                    FROM information_schema.tables
                    WHERE table_schema = $1
                        AND table_type = 'BASE TABLE'
                    """,
                    project["database_name"]
                )
                
                result = {
                    "project": {
                        "id": str(project["id"]),
                        "name": project["name"],
                        "slug": project["slug"],
                        "description": project["description"],
                        "database_name": project["database_name"],
                        "status": project["status"],
                        "created_at": project["created_at"].isoformat() if project["created_at"] else None,
                        "updated_at": project["updated_at"].isoformat() if project["updated_at"] else None,
                        "owner_id": str(project["user_id"]) if project["user_id"] else None
                    },
                    "statistics": {
                        "user_count": user_count,
                        "api_key_count": api_key_count,
                        "table_count": table_count
                    },
                    "access": {
                        "role": auth_context.role.value if hasattr(auth_context.role, 'value') else str(auth_context.role) if hasattr(auth_context, 'role') else "unknown",
                        "permissions": [perm.value if hasattr(perm, 'value') else str(perm) for perm in auth_context.permissions]
                    }
                }
                
                return make_json_safe(result)
                
        except Exception as e:
            logger.error(f"Error getting project info: {str(e)}")
            raise
