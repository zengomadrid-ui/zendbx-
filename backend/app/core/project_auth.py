"""
Project-Scoped Authorization
Provides authorization dependencies for project-scoped operations.

SECURITY RULES:
1. Project service_role tokens can ONLY access their own project
2. Project tokens CANNOT access platform admin endpoints
3. Project tokens CANNOT access other projects
4. Cross-project operations are ALWAYS denied
5. Token project_id MUST match requested project_id

This module enforces project isolation at the authorization layer.
"""
from fastapi import HTTPException, status, Depends
from typing import Optional
from uuid import UUID
import logging

from .security import resolve_principal
from fastapi import Request

logger = logging.getLogger(__name__)


async def require_project_service_role(
    request: Request,
    project_id: Optional[UUID] = None
) -> dict:
    """
    Require valid project service_role JWT with project isolation.
    
    This dependency:
    1. Validates the JWT token (platform or project)
    2. Ensures token is project-scoped (not platform)
    3. Verifies role is service_role
    4. Enforces project_id binding (token project must match requested project)
    5. Rejects cross-project access with 403
    
    Args:
        request: FastAPI request object
        project_id: Optional project UUID to validate against token
        
    Returns:
        Principal dict with user_id, project_id, token_type, role
        
    Raises:
        401: Invalid/missing/expired token
        403: Wrong token type, insufficient role, or cross-project access
        
    Usage:
        @router.get("/api/project/{project_id}/admin/users")
        async def list_users(
            project_id: UUID,
            principal: dict = Depends(require_project_service_role)
        ):
            # project_id is automatically validated against token
            pass
    """
    # Resolve principal (validates token)
    principal = await resolve_principal(request)
    
    # SECURITY CHECK 1: Must be project token, not platform
    if principal.get("token_type") != "project":
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Platform tokens cannot be used for project-scoped operations. "
                   "Use project service_role key instead."
        )
    
    # SECURITY CHECK 2: Must have project_id in token
    token_project_id = principal.get("project_id")
    if not token_project_id:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Token does not contain project identity"
        )
    
    # SECURITY CHECK 3: Validate role is service_role
    # Note: resolve_principal already validates role is "authenticated" or "service_role"
    # But we need service_role specifically for admin operations
    # We need to re-extract role from the JWT since resolve_principal doesn't return it
    
    # Get token from request
    authorization = request.headers.get("Authorization", "")
    if not authorization.startswith("Bearer "):
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Invalid authorization header"
        )
    
    token = authorization[7:].strip()
    
    # Decode project JWT to get role
    from .database import get_main_db_pool
    pool = await get_main_db_pool()
    async with pool.acquire() as conn:
        project = await conn.fetchrow(
            "SELECT id, jwt_secret FROM projects WHERE id = $1",
            UUID(token_project_id)
        )
    
    if not project:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Project not found"
        )
    
    import jwt as pyjwt
    try:
        payload = pyjwt.decode(token, project["jwt_secret"], algorithms=["HS256"])
    except pyjwt.InvalidTokenError:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Invalid token"
        )
    
    role = payload.get("role", "")
    
    # SECURITY CHECK 4: Role must be service_role for admin operations
    if role != "service_role":
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Insufficient permissions. service_role required for this operation."
        )
    
    # SECURITY CHECK 5: Project isolation - token project must match requested project
    if project_id is not None:
        if str(token_project_id) != str(project_id):
            logger.warning(
                f"Cross-project access attempt: token project_id={token_project_id}, "
                f"requested project_id={project_id}"
            )
            raise HTTPException(
                status_code=status.HTTP_403_FORBIDDEN,
                detail="Cross-project access denied. Token project does not match requested project."
            )
    
    # Add role to principal for convenience
    principal["role"] = role
    
    return principal


async def require_project_or_platform_admin(
    request: Request,
    project_id: Optional[UUID] = None
) -> dict:
    """
    Allow EITHER platform admin OR project service_role for the specified project.
    
    This is useful for endpoints that can be accessed by:
    - Platform administrators (for management/support)
    - Project service_role (for project-specific operations)
    
    SECURITY:
    - Platform admins can access ANY project
    - Project service_role can ONLY access their OWN project
    
    Args:
        request: FastAPI request object
        project_id: Optional project UUID to validate project tokens against
        
    Returns:
        Principal dict with user_id, project_id (if project token), token_type, role
        
    Raises:
        401: Invalid/missing/expired token
        403: Insufficient permissions or cross-project access
        
    Usage:
        @router.get("/api/project/{project_id}/settings")
        async def get_settings(
            project_id: UUID,
            principal: dict = Depends(require_project_or_platform_admin)
        ):
            # Accessible by platform admin OR project service_role
            pass
    """
    # Resolve principal
    principal = await resolve_principal(request)
    
    token_type = principal.get("token_type")
    
    # Case 1: Platform JWT
    if token_type == "platform":
        # Check if user is platform admin
        from .database import get_main_db_pool
        pool = await get_main_db_pool()
        async with pool.acquire() as conn:
            user = await conn.fetchrow(
                "SELECT role FROM users WHERE id = $1",
                UUID(principal["user_id"])
            )
        
        if not user or user["role"] != "admin":
            raise HTTPException(
                status_code=status.HTTP_403_FORBIDDEN,
                detail="Platform admin role required"
            )
        
        principal["role"] = "admin"
        return principal
    
    # Case 2: Project JWT
    elif token_type == "project":
        # Use project service_role validation
        return await require_project_service_role(request, project_id)
    
    else:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Invalid token type"
        )


def extract_project_id_from_path(request: Request) -> Optional[UUID]:
    """
    Extract project_id from URL path.
    
    Supports patterns:
    - /api/project/{project_id}/...
    - /p/{project_slug}/...
    
    Returns:
        UUID if found in path, None otherwise
    """
    import re
    
    # Try UUID pattern first
    uuid_pattern = r'/api/project/([0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12})'
    match = re.search(uuid_pattern, request.url.path, re.IGNORECASE)
    if match:
        try:
            return UUID(match.group(1))
        except ValueError:
            pass
    
    return None
