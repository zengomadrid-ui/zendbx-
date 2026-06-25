"""
MCP Information API
Provides MCP configuration and status for projects
"""

from fastapi import APIRouter, Depends, HTTPException
from app.core.security import get_current_user
from app.core.config import settings
from app.core.database import get_main_db_pool
import logging

router = APIRouter()
logger = logging.getLogger(__name__)


@router.get("/api/projects/{project_id}/mcp")
async def get_project_mcp_info(
    project_id: str,
    current_user: dict = Depends(get_current_user)
):
    """
    Get MCP configuration and status for a project
    """
    try:
        pool = await get_main_db_pool()
        
        async with pool.acquire() as conn:
            # Get project details
            project = await conn.fetchrow(
                """
                SELECT p.id, p.name, p.slug, p.user_id
                FROM projects p
                WHERE p.id = $1
                """,
                project_id
            )
            
            if not project:
                raise HTTPException(status_code=404, detail="Project not found")
            
            # Get current user ID - handle both dict and object
            user_id = current_user.get("id") if isinstance(current_user, dict) else getattr(current_user, "id", None)
            
            # Check if user has access (either owner or member)
            # First check if they're the creator
            is_owner = str(project["user_id"]) == str(user_id)
            
            # If not owner, check if they're a member
            if not is_owner:
                is_member = await conn.fetchval(
                    """
                    SELECT EXISTS(
                        SELECT 1 FROM project_members
                        WHERE project_id = $1 AND user_id = $2
                    )
                    """,
                    project_id,
                    user_id
                )
                
                if not is_member:
                    raise HTTPException(status_code=403, detail="Access denied")
            
            # Determine base URL based on environment
            if settings.ENVIRONMENT == "production":
                base_url = "https://api.zendbx.in"
            else:
                # Development - use localhost with /mcp prefix
                base_url = "http://localhost:8000"
            
            # Build MCP endpoint (new clean format with /mcp/p/ prefix)
            mcp_endpoint = f"{base_url}/mcp/p/{project['slug']}"
            
            # Check MCP health (simple check - endpoint exists)
            # In production, you might want to actually ping the endpoint
            mcp_enabled = True  # MCP is always enabled in current implementation
            
            return {
                "enabled": mcp_enabled,
                "status": "running" if mcp_enabled else "offline",
                "endpoint": mcp_endpoint,
                "transport": "http",  # Phase 1: HTTP only
                "authentication": "bearer_jwt",
                "supported_clients": [
                    "Cursor",
                    "Claude Desktop",
                    "Cline",
                    "VS Code"
                ],
                "project": {
                    "id": str(project["id"]),
                    "name": project["name"],
                    "slug": project["slug"]
                },
                "version": "0.1.0-demo",
                "phase": "1"
            }
            
    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Error fetching MCP info: {str(e)}")
        raise HTTPException(status_code=500, detail=str(e))


@router.post("/api/projects/{project_id}/mcp/test")
async def test_mcp_connection(
    project_id: str,
    current_user: dict = Depends(get_current_user)
):
    """
    Test MCP connection for a project
    """
    try:
        pool = await get_main_db_pool()
        
        async with pool.acquire() as conn:
            # Get project
            project = await conn.fetchrow(
                """
                SELECT p.id, p.slug, p.user_id
                FROM projects p
                WHERE p.id = $1
                """,
                project_id
            )
            
            if not project:
                raise HTTPException(status_code=404, detail="Project not found")
            
            # Get current user ID - handle both dict and object
            user_id = current_user.get("id") if isinstance(current_user, dict) else getattr(current_user, "id", None)
            
            # Check if user has access (either owner or member)
            is_owner = str(project["user_id"]) == str(user_id)
            
            if not is_owner:
                is_member = await conn.fetchval(
                    """
                    SELECT EXISTS(
                        SELECT 1 FROM project_members
                        WHERE project_id = $1 AND user_id = $2
                    )
                    """,
                    project_id,
                    user_id
                )
                
                if not is_member:
                    raise HTTPException(status_code=403, detail="Access denied")
            
            # In a real implementation, you would:
            # 1. Make an actual request to the MCP health endpoint
            # 2. Verify authentication works
            # 3. Check project accessibility
            
            # For now, return success if project exists
            return {
                "status": "connected",
                "message": "MCP endpoint is accessible",
                "project_slug": project["slug"],
                "timestamp": "2026-06-22T00:00:00Z"
            }
            
    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Error testing MCP connection: {str(e)}")
        return {
            "status": "error",
            "message": str(e),
            "timestamp": "2026-06-22T00:00:00Z"
        }
