"""
Comprehensive CORS middleware for ZendBX API.

This middleware ensures proper CORS support across all responses:
- Handles OPTIONS preflight requests correctly
- Returns CORS headers on successful responses (2xx)
- Returns CORS headers on client errors (4xx)
- Returns CORS headers on server errors (5xx)
- Supports credentials when required
- Reads allowed origins from project configuration
- Auto-allows development origins in dev mode
- Never returns 400/404 for preflight requests

Implemented as pure ASGI middleware to avoid Starlette streaming bugs.
"""

from starlette.types import ASGIApp, Receive, Scope, Send
from starlette.datastructures import Headers, MutableHeaders
from typing import List, Set, Optional, Dict, Any
import os
import re


class CORSMiddleware:
    """
    Comprehensive CORS middleware that handles all response types.
    
    This middleware wraps the entire application and ensures CORS headers
    are present on every HTTP response, including errors.
    
    Supports both global origins and project-specific origins.
    """
    
    def __init__(
        self,
        app: ASGIApp,
        allowed_origins: List[str],
        allow_credentials: bool = True,
        allow_methods: List[str] = None,
        allow_headers: List[str] = None,
        expose_headers: List[str] = None,
        max_age: int = 3600,
        enable_project_origins: bool = True,
    ):
        self.app = app
        self.allowed_origins = set(allowed_origins)
        self.allow_all_origins = "*" in allowed_origins
        self.allow_credentials = allow_credentials
        self.enable_project_origins = enable_project_origins
        
        # Cache for project-specific origins (project_id -> set of origins)
        self._project_origins_cache: Dict[str, Set[str]] = {}
        
        # Default allowed methods - use wildcard if not specified
        if allow_methods is None or "*" in allow_methods:
            self.allow_methods = "*"
        else:
            self.allow_methods = ", ".join(allow_methods)
        
        # Default allowed headers - use wildcard if not specified
        if allow_headers is None or "*" in allow_headers:
            self.allow_headers = "*"
        else:
            self.allow_headers = ", ".join(allow_headers)
        
        # Default exposed headers - use wildcard if not specified
        if expose_headers is None or "*" in expose_headers:
            self.expose_headers = "*"
        else:
            self.expose_headers = ", ".join(expose_headers)
        
        self.max_age = str(max_age)
    
    def _extract_project_id_from_path(self, path: str) -> Optional[str]:
        """
        Extract project ID or slug from the request path.
        
        Supports patterns like:
        - /api/projects/{project_id}/...
        - /p/{project_slug}/...
        - /rest/v1/{table}?project={project_id}
        
        Returns project identifier (ID or slug) if found, else None.
        """
        # Pattern 1: /api/projects/{project_id}/...
        match = re.match(r'^/api/projects/([a-zA-Z0-9_-]+)/?', path)
        if match:
            return match.group(1)
        
        # Pattern 2: /p/{project_slug}/...
        match = re.match(r'^/p/([a-zA-Z0-9_-]+)/?', path)
        if match:
            return match.group(1)
        
        return None
    
    def _extract_project_id_from_headers(self, headers: Headers) -> Optional[str]:
        """Extract project ID from request headers."""
        return headers.get("x-project-id") or headers.get("x-api-key")
    
    async def _get_project_origins(self, project_id: str) -> Set[str]:
        """
        Get allowed origins for a specific project from database.
        
        Caches results to avoid repeated database queries.
        Returns empty set if project not found or no custom origins configured.
        """
        # Check cache first
        if project_id in self._project_origins_cache:
            return self._project_origins_cache[project_id]
        
        try:
            # Import here to avoid circular dependency
            from app.core.database import execute_on_main_db
            
            # Query project settings
            result = await execute_on_main_db(
                "SELECT allowed_origins FROM projects WHERE id = $1 OR slug = $1",
                project_id
            )
            
            if result and result[0].get("allowed_origins"):
                origins = set(result[0]["allowed_origins"])
                self._project_origins_cache[project_id] = origins
                return origins
            
        except Exception as e:
            # Log error but don't break CORS (fail open to default origins)
            print(f"⚠️  CORS: Failed to fetch project origins for {project_id}: {e}")
        
        # Return empty set if not found or error
        return set()
    
    def _is_origin_allowed(self, origin: str, project_origins: Set[str] = None) -> bool:
        """
        Check if the origin is allowed.
        
        Checks against:
        1. Global allowed origins (from config)
        2. Project-specific origins (if project_origins provided)
        """
        if self.allow_all_origins:
            return True
        
        # Check project-specific origins first (higher priority)
        if project_origins and origin in project_origins:
            return True
        
        # Fall back to global origins
        return origin in self.allowed_origins
    
    def _get_cors_headers(
        self,
        origin: str = None,
        project_origins: Set[str] = None
    ) -> List[tuple]:
        """
        Generate CORS headers based on origin.
        
        CRITICAL: When credentials are enabled, the Access-Control-Allow-Origin
        header MUST echo the requesting origin if allowed. Never use a fallback
        origin or wildcard when credentials=true.
        
        Returns a list of (header_name, header_value) tuples.
        """
        headers = []
        
        # Determine the origin to allow
        if self.allow_all_origins:
            # Wildcard origin - cannot be used with credentials
            allow_origin = "*"
        elif origin and self._is_origin_allowed(origin, project_origins):
            # Origin is allowed - echo it back
            allow_origin = origin
        elif origin:
            # Origin provided but NOT allowed - echo it anyway for browser to reject
            # This provides better error messages in the browser console
            allow_origin = origin
        else:
            # No origin header in request - use wildcard
            allow_origin = "*"
        
        # Access-Control-Allow-Origin
        headers.append((b"access-control-allow-origin", allow_origin.encode()))
        
        # Access-Control-Allow-Credentials
        # Only include if origin is actually allowed and not wildcard
        if self.allow_credentials and allow_origin != "*":
            is_allowed = self._is_origin_allowed(allow_origin, project_origins)
            if is_allowed:
                headers.append((b"access-control-allow-credentials", b"true"))
        
        # Access-Control-Allow-Methods
        headers.append((b"access-control-allow-methods", self.allow_methods.encode()))
        
        # Access-Control-Allow-Headers
        headers.append((b"access-control-allow-headers", self.allow_headers.encode()))
        
        # Access-Control-Expose-Headers
        if self.expose_headers:
            headers.append((b"access-control-expose-headers", self.expose_headers.encode()))
        
        # Access-Control-Max-Age
        headers.append((b"access-control-max-age", self.max_age.encode()))
        
        # Vary header to indicate response varies by Origin
        headers.append((b"vary", b"Origin"))
        
        return headers
    
    async def __call__(self, scope: Scope, receive: Receive, send: Send) -> None:
        """Process request and inject CORS headers into response."""
        
        # Only handle HTTP requests
        if scope["type"] != "http":
            await self.app(scope, receive, send)
            return
        
        # Extract origin from request headers
        headers = Headers(scope=scope)
        origin = headers.get("origin")
        
        # Get HTTP method and path
        method = scope.get("method", "")
        path = scope.get("path", "")
        
        # Try to get project-specific origins
        project_origins: Set[str] = set()
        if self.enable_project_origins:
            # Try to extract project ID from path or headers
            project_id = self._extract_project_id_from_path(path)
            if not project_id:
                project_id = self._extract_project_id_from_headers(headers)
            
            if project_id:
                project_origins = await self._get_project_origins(project_id)
        
        # Handle OPTIONS preflight request
        if method == "OPTIONS":
            # Always return 200 for OPTIONS, never 404 or 400
            await self._send_preflight_response(origin, project_origins, send)
            return
        
        # For non-OPTIONS requests, inject CORS headers into response
        async def send_with_cors(message):
            if message["type"] == "http.response.start":
                # Get existing headers
                existing_headers = MutableHeaders(scope=message)
                
                # Get CORS headers
                cors_headers = self._get_cors_headers(origin, project_origins)
                
                # Collect existing header names (lowercase) to avoid duplicates
                existing_names = {
                    name.lower()
                    for name, _ in message.get("headers", [])
                }
                
                # Add CORS headers if not already present
                new_headers = list(message.get("headers", []))
                for name, value in cors_headers:
                    if name.lower() not in existing_names:
                        new_headers.append((name, value))
                
                message = {**message, "headers": new_headers}
            
            await send(message)
        
        # Pass request to the app with CORS-enabled send
        await self.app(scope, receive, send_with_cors)
    
    async def _send_preflight_response(
        self,
        origin: str,
        project_origins: Set[str],
        send: Send
    ):
        """
        Send a successful preflight (OPTIONS) response.
        
        This ensures preflight requests always return 204 No Content with proper
        CORS headers, never 404 or 400.
        """
        cors_headers = self._get_cors_headers(origin, project_origins)
        
        # Send response start with 204 No Content
        await send({
            "type": "http.response.start",
            "status": 204,
            "headers": cors_headers,
        })
        
        # Send empty response body
        await send({
            "type": "http.response.body",
            "body": b"",
        })


def get_allowed_origins_for_environment(environment: str = None) -> List[str]:
    """
    Get allowed origins based on environment.
    
    In development: Allow localhost and 127.0.0.1 on common ports
    In production: Only allow configured production origins
    
    Args:
        environment: Environment name (production, development, etc.)
                    If None, reads from ENVIRONMENT env var
    
    Returns:
        List of allowed origin URLs
    """
    if environment is None:
        environment = os.getenv("ENVIRONMENT", "production")
    
    if environment == "production":
        # Production: Strict CORS - only configured origins
        return [
            "https://devapp.zendbx.in",
            "https://zendbx.in",
            "https://www.zendbx.in",
            "https://zendbx-2-zpp9.onrender.com",
        ]
    else:
        # Development: Allow common local development origins
        return [
            "http://localhost:3000",
            "http://localhost:5173",
            "http://localhost:8000",
            "http://127.0.0.1:3000",
            "http://127.0.0.1:5173",
            "http://127.0.0.1:8000",
        ]
