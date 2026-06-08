"""
Project Context Middleware
Intercepts requests and resolves project context from headers OR subdomain
"""
from fastapi import Request, HTTPException
from starlette.middleware.base import BaseHTTPMiddleware
from starlette.responses import JSONResponse
import logging
import re

from ..core.db_router import get_project_db
from ..core.config import settings
from ..core.database import execute_on_main_db

logger = logging.getLogger(__name__)


class ProjectContextMiddleware(BaseHTTPMiddleware):
    """
    Middleware that extracts project context from:
    1. Subdomain (e.g., project-slug-id.zendbx.in)
    2. Path prefix (e.g., /p/project-slug-id)
    3. Headers (x-project-id)
    """
    
    # Paths that don't require project context (admin endpoints)
    SKIP_PATHS = [
        "/api/auth/",
        "/api/projects",
        "/api/admin",
        "/api/ai/",  # AI endpoints (admin only)
        "/docs",
        "/openapi.json",
        "/health",
        "/v1/auth/",  # New multi-tenant auth endpoints
    ]
    
    # Exact match paths (not prefix match)
    SKIP_EXACT_PATHS = ["/"]
    
    async def extract_project_from_subdomain(self, host: str) -> str:
        """Extract project slug from subdomain"""
        if not settings.ENABLE_SUBDOMAIN_ROUTING:
            return None
        
        # Remove port if present
        host = host.split(':')[0]
        
        # Check if it's a project subdomain
        # Format: project-slug-id.zendbx.in or project-slug-id.localhost
        base_domain = settings.BASE_DOMAIN if settings.ENVIRONMENT == "production" else "localhost"
        
        if host.endswith(f".{base_domain}"):
            # Extract subdomain
            slug = host.replace(f".{base_domain}", "")
            
            # Ignore www, api, ws subdomains
            if slug in ["www", "api", "ws"]:
                return None
            
            logger.info(f"Extracted project slug from subdomain: {slug}")
            return slug
        
        return None
    
    async def extract_project_from_path(self, path: str) -> str:
        """Extract project slug from path prefix /p/slug"""
        match = re.match(r'^/p/([^/]+)', path)
        if match:
            slug = match.group(1)
            logger.info(f"Extracted project slug from path: {slug}")
            return slug
        return None
    
    async def get_project_id_from_slug(self, slug: str) -> str:
        """Resolve project ID from slug"""
        try:
            result = await execute_on_main_db(
                "SELECT id FROM projects WHERE slug = $1",
                slug
            )
            
            if result:
                project_id = str(result[0]["id"])
                logger.info(f"Resolved slug '{slug}' to project ID: {project_id}")
                return project_id
            else:
                logger.warning(f"Project not found for slug: {slug}")
                return None
        except Exception as e:
            logger.error(f"Error resolving project slug: {str(e)}")
            return None
    
    async def dispatch(self, request: Request, call_next):
        # CRITICAL: Skip for OPTIONS requests FIRST (CORS preflight)
        if request.method == "OPTIONS":
            print(f"🔵 ProjectContext: Skipping OPTIONS {request.url.path}")
            return await call_next(request)
        
        # Skip middleware for admin endpoints (prefix match)
        if any(request.url.path.startswith(path) for path in self.SKIP_PATHS):
            return await call_next(request)
        
        # Skip middleware for exact path matches
        if request.url.path in self.SKIP_EXACT_PATHS:
            return await call_next(request)
        
        try:
            # Try to extract project context from multiple sources
            project_id = None
            project_slug = None
            
            # 1. Try subdomain routing (highest priority)
            host = request.headers.get("host", "")
            project_slug = await self.extract_project_from_subdomain(host)
            
            # 2. Try path-based routing
            if not project_slug:
                project_slug = await self.extract_project_from_path(request.url.path)
            
            # 3. Try header-based routing (legacy)
            if not project_slug:
                project_id = request.headers.get("x-project-id")
            
            # Resolve slug to project ID if needed
            if project_slug and not project_id:
                project_id = await self.get_project_id_from_slug(project_slug)
            
            # Extract auth header
            auth_header = request.headers.get("authorization")
            
            # Log request
            logger.info(f"{request.method} {request.url.path} - Project: {project_id}")
            
            if not project_id:
                logger.warning(f"Missing x-project-id header for {request.url.path}")
                return JSONResponse(
                    status_code=400,
                    content={"detail": "Missing x-project-id header"}
                )
            
            # Extract ANON_KEY from Bearer token
            anon_key = None
            if auth_header:
                if auth_header.startswith("Bearer "):
                    anon_key = auth_header.split(" ", 1)[1]
                elif auth_header.startswith("bearer "):
                    anon_key = auth_header.split(" ", 1)[1]
            
            if not anon_key:
                logger.warning(f"Missing or invalid Authorization header for {request.url.path}")
                return JSONResponse(
                    status_code=401,
                    content={"detail": "Missing or invalid Authorization header. Expected: Bearer <ANON_KEY>"}
                )
            
            # Validate and get project database
            try:
                project_db = await get_project_db(project_id, anon_key)
            except HTTPException as e:
                logger.error(f"Project validation failed: {e.detail}")
                return JSONResponse(
                    status_code=e.status_code,
                    content={"detail": e.detail}
                )
            
            # Inject into request state
            request.state.project_id = project_id
            request.state.project_db = project_db
            request.state.anon_key = anon_key
            
            logger.debug(f"Project context injected: {project_id}")
            
            # Continue to endpoint
            response = await call_next(request)
            return response
            
        except Exception as e:
            logger.error(f"Middleware error: {str(e)}", exc_info=True)
            return JSONResponse(
                status_code=500,
                content={"detail": f"Internal server error: {str(e)}"}
            )
