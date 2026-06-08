"""
Row Level Security (RLS) Context Middleware

This middleware extracts user identity from JWT tokens and sets PostgreSQL
session variables that RLS policies can use to filter data.

Key Features:
- Extracts user_id from JWT tokens
- Sets PostgreSQL session variables (current_user_id, current_role)
- Supports service_role bypass for admin operations
- Validates JWT tokens against project secrets
"""
from fastapi import Request, HTTPException
from starlette.middleware.base import BaseHTTPMiddleware
from starlette.responses import JSONResponse
import logging
import jwt

from ..core.db_router import get_main_db_pool

logger = logging.getLogger(__name__)


class RLSContextMiddleware(BaseHTTPMiddleware):
    """
    Middleware that sets RLS context for database queries
    
    Flow:
    1. Extract JWT token from Authorization header
    2. Decode and validate token
    3. Extract user_id and role
    4. Set PostgreSQL session variables for RLS
    """
    
    # Paths that don't require RLS context
    SKIP_PATHS = [
        "/api/auth/",
        "/api/projects",
        "/api/admin",
        "/api/ai/",  # AI endpoints (admin only)
        "/docs",
        "/openapi.json",
        "/health",
        "/v1/auth/",  # Public auth endpoints
        "/"
    ]
    
    async def dispatch(self, request: Request, call_next):
        # CRITICAL: Skip for OPTIONS requests FIRST (CORS preflight)
        if request.method == "OPTIONS":
            print(f"🔵 RLSContext: Skipping OPTIONS {request.url.path}")
            return await call_next(request)
        
        # Skip middleware for public endpoints
        if any(request.url.path.startswith(path) for path in self.SKIP_PATHS):
            return await call_next(request)
        
        try:
            # Extract Authorization header
            auth_header = request.headers.get("authorization")
            
            if not auth_header:
                logger.warning(f"Missing Authorization header for {request.url.path}")
                return JSONResponse(
                    status_code=401,
                    content={"detail": "Missing Authorization header"}
                )
            
            # Extract token
            if not auth_header.startswith("Bearer "):
                logger.warning(f"Invalid Authorization format for {request.url.path}")
                return JSONResponse(
                    status_code=401,
                    content={"detail": "Invalid Authorization format. Expected: Bearer <token>"}
                )
            
            token = auth_header.replace("Bearer ", "")
            
            # Decode token to get project_id and role
            try:
                # First, decode without verification to get project_id
                unverified = jwt.decode(token, options={"verify_signature": False})
                project_id = unverified.get("project_id") or request.headers.get("x-project-id")
                role = unverified.get("role", "anon")
                
                if not project_id:
                    return JSONResponse(
                        status_code=400,
                        content={"detail": "Token missing project_id"}
                    )
                
                # Get JWT secret for this project
                main_pool = await get_main_db_pool()
                async with main_pool.acquire() as conn:
                    jwt_secret = await conn.fetchval(
                        "SELECT jwt_secret FROM projects WHERE id = $1",
                        project_id
                    )
                    
                    if not jwt_secret:
                        return JSONResponse(
                            status_code=404,
                            content={"detail": "Project not found"}
                        )
                
                # Now verify the token with the correct secret
                payload = jwt.decode(token, jwt_secret, algorithms=["HS256"])
                
                # Extract user context
                user_id = payload.get("sub")  # User ID from JWT
                user_role = payload.get("role", "anon")  # Role: anon, authenticated, service_role
                
                # Store in request state
                request.state.rls_user_id = user_id
                request.state.rls_role = user_role
                request.state.rls_project_id = project_id
                request.state.jwt_payload = payload
                
                logger.debug(f"RLS Context: user_id={user_id}, role={user_role}, project={project_id}")
                
            except jwt.ExpiredSignatureError:
                return JSONResponse(
                    status_code=401,
                    content={"detail": "Token expired"}
                )
            except jwt.InvalidTokenError as e:
                logger.error(f"Invalid JWT token: {str(e)}")
                return JSONResponse(
                    status_code=401,
                    content={"detail": f"Invalid token: {str(e)}"}
                )
            
            # Continue to endpoint
            response = await call_next(request)
            return response
            
        except Exception as e:
            logger.error(f"RLS Middleware error: {str(e)}", exc_info=True)
            return JSONResponse(
                status_code=500,
                content={"detail": f"Internal server error: {str(e)}"}
            )


async def set_rls_context(conn, user_id: str = None, role: str = "anon"):
    """
    Set PostgreSQL session variables for RLS
    
    These variables can be accessed in RLS policies using:
    - current_setting('app.current_user_id', true)
    - current_setting('app.current_role', true)
    
    Args:
        conn: asyncpg connection
        user_id: User ID to set (None for anonymous)
        role: User role (anon, authenticated, service_role)
    """
    try:
        # Set user_id (empty string if None)
        await conn.execute(
            "SELECT set_config('app.current_user_id', $1, false)",
            user_id or ''
        )
        
        # Set role
        await conn.execute(
            "SELECT set_config('app.current_role', $1, false)",
            role
        )
        
        logger.debug(f"RLS context set: user_id={user_id}, role={role}")
        
    except Exception as e:
        logger.error(f"Failed to set RLS context: {str(e)}")
        raise


async def clear_rls_context(conn):
    """Clear RLS context variables"""
    try:
        await conn.execute("SELECT set_config('app.current_user_id', '', false)")
        await conn.execute("SELECT set_config('app.current_role', 'anon', false)")
    except Exception as e:
        logger.error(f"Failed to clear RLS context: {str(e)}")
