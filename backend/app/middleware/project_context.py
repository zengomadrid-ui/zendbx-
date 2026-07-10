"""
Project Context Middleware
PostgREST/Supabase-compatible authentication and project isolation.

Header priority:
  apikey: <anon_key or service_role_key>   → identifies the project + base role
  Authorization: Bearer <user_jwt>          → identifies the authenticated user

Schema isolation: SET search_path TO "<schema>", public
"""
from fastapi import Request
from starlette.middleware.base import BaseHTTPMiddleware
from starlette.responses import JSONResponse, RedirectResponse
import logging
import re
import jwt as pyjwt

from ..core.db_router import validate_project_key, get_main_db_pool, get_project_info
from ..core.config import settings
from ..core.database import execute_on_main_db

logger = logging.getLogger(__name__)


# Paths that bypass project context entirely
SKIP_PREFIXES = [
    "/api/auth/",
    "/api/projects",
    "/api/storage",
    "/api/admin",
    "/api/ai/",
    "/api/oauth",
    "/oauth",
    "/api/billing",
    "/api/analytics",
    "/api/backups",
    "/api/realtime",
    "/api/team",
    "/api/import",
    "/api/keys",
    "/api/sessions",
    "/api/users",
    "/api/audit",
    "/docs",
    "/openapi.json",
    "/health",
    "/v1/auth/",
    "/mcp",
]

SKIP_EXACT = {"/", "/health", "/version", "/docs", "/openapi.json", "/redoc", "/test-logs", "/debug-test"}

SKIP_PATH_PATTERNS = [
    re.compile(r"^/p/[^/]+/storage"),  # /p/{slug}/storage/...
]


class ProjectContextMiddleware(BaseHTTPMiddleware):

    async def dispatch(self, request: Request, call_next):
        path = request.url.path
        
        # Always skip OPTIONS (CORS preflight)
        if request.method == "OPTIONS":
            return await call_next(request)

        # Public endpoints
        PUBLIC_PATHS = {"/", "/health", "/version", "/docs", "/redoc", "/openapi.json"}
        if path in PUBLIC_PATHS:
            return await call_next(request)

        # /p/{slug} with NO sub-path is a public info endpoint
        if re.match(r"^/p/[^/]+$", path):
            return await call_next(request)
        
        # /p/{slug}/docs redirects to main docs
        _slug_sub = re.match(r"^/p/[^/]+(/docs|/redoc|/openapi\.json)$", path)
        if _slug_sub:
            return RedirectResponse(url=_slug_sub.group(1), status_code=302)

        # Skip admin/auth paths
        if path in SKIP_EXACT:
            return await call_next(request)
        if any(path.startswith(p) for p in SKIP_PREFIXES):
            return await call_next(request)
        if any(pat.match(path) for pat in SKIP_PATH_PATTERNS):
            return await call_next(request)
        if "/v1/auth/" in path:
            return await call_next(request)

        try:
            # Resolve project ID
            project_id = None
            project_slug = None

            # a) Subdomain routing
            host = request.headers.get("host", "").split(":")[0]
            project_slug = self._slug_from_subdomain(host)

            # b) Path prefix /p/{slug}
            if not project_slug:
                project_slug = self._slug_from_path(path)

            # c) x-project-id header (legacy)
            if not project_slug:
                project_id = request.headers.get("x-project-id")

            # Resolve slug to project ID
            if project_slug and not project_id:
                project_id = await self._resolve_slug(project_slug)

            # Final check
            if not project_id:
                logger.error(f"Project context missing for path: {path}")
                return JSONResponse(
                    status_code=400,
                    content={"detail": "Missing project context. Use /p/{slug}/... or x-project-id header."},
                )

            # Read apikey and Authorization headers
            apikey_header = request.headers.get("apikey")
            auth_header = request.headers.get("authorization", "")
            bearer_token = auth_header[7:].strip() if auth_header.lower().startswith("bearer ") else None

            # Priority: apikey header → Bearer token
            project_key = apikey_header or bearer_token

            if not project_key:
                return JSONResponse(
                    status_code=401,
                    content={"detail": "Missing API key. Provide apikey header or Authorization: Bearer <anon_key>."},
                )

            # Validate project key
            try:
                ctx = await validate_project_key(project_id, project_key)
            except Exception as e:
                status_code = getattr(e, "status_code", 403)
                detail = getattr(e, "detail", str(e))
                return JSONResponse(
                    status_code=status_code,
                    content={"detail": detail},
                )

            schema = ctx["schema"]
            base_role = ctx["role"]
            jwt_secret = ctx["jwt_secret"]
            pool = ctx["pool"]

            # Identify authenticated user
            user_id = None
            user_role = base_role
            user_email = None

            # Determine user JWT for authentication
            # Priority: If apikey is present, use bearer_token for user auth
            #           Otherwise, bearer_token was already used for project auth
            user_bearer = None
            if apikey_header and bearer_token and bearer_token != apikey_header:
                # Case 1: Both apikey and different Authorization Bearer
                user_bearer = bearer_token
            elif not apikey_header and bearer_token:
                # Case 2: Only Authorization Bearer (already validated as project_key)
                # Check if it's a user token (role=authenticated) or project key (role=anon/service_role)
                try:
                    payload = pyjwt.decode(bearer_token, jwt_secret, algorithms=["HS256"])
                    token_role = payload.get("role", "")
                    if token_role == "authenticated":
                        user_bearer = bearer_token
                except Exception:
                    pass  # Keep user_bearer as None

            # Decode user JWT if present
            if user_bearer:
                try:
                    payload = pyjwt.decode(user_bearer, jwt_secret, algorithms=["HS256"])
                    token_role = payload.get("role", "")
                    
                    if token_role == "authenticated":
                        user_id = payload.get("sub")
                        user_role = "authenticated"
                        user_email = payload.get("email")
                except pyjwt.ExpiredSignatureError:
                    return JSONResponse(
                        status_code=401,
                        content={"detail": "User token expired"},
                    )
                except pyjwt.InvalidTokenError:
                    pass  # Ignore invalid user token, keep base role

            # Set search_path on request state
            request.state.project_id = project_id
            request.state.project_slug = project_slug or ctx.get("slug")
            request.state.project_schema = schema
            request.state.project_db = pool
            request.state.anon_key = project_key
            request.state.jwt_secret = jwt_secret
            request.state.rls_user_id = user_id
            request.state.rls_role = user_role
            request.state.rls_project_id = project_id
            request.state.user_email = user_email

            return await call_next(request)

        except Exception as e:
            logger.error(f"ProjectContextMiddleware error: {e}", exc_info=True)
            return JSONResponse(
                status_code=500,
                content={"detail": f"Internal server error: {str(e)}"},
            )

    # Helpers

    def _slug_from_subdomain(self, host: str) -> str | None:
        if not settings.ENABLE_SUBDOMAIN_ROUTING:
            return None
        base = settings.BASE_DOMAIN if settings.ENVIRONMENT == "production" else "localhost"
        if host.endswith(f".{base}"):
            slug = host[: -(len(base) + 1)]
            if slug not in ("www", "api", "ws"):
                return slug
        return None

    def _slug_from_path(self, path: str) -> str | None:
        """Extract project slug from /p/{slug} URL pattern"""
        m = re.match(r"^/p/([^/]+)", path)
        return m.group(1) if m else None

    async def _resolve_slug(self, slug: str) -> str | None:
        try:
            # First try as a direct UUID project ID
            import uuid
            try:
                uuid.UUID(slug)
                result = await execute_on_main_db("SELECT id FROM projects WHERE id = $1", slug)
                if result:
                    return str(result[0]["id"])
            except ValueError:
                pass

            # Then try as a slug
            result = await execute_on_main_db(
                "SELECT id, status FROM projects WHERE slug = $1 LIMIT 1",
                slug
            )
            
            if result:
                project = result[0]
                if project['status'] != 'active':
                    logger.warning(f"Project '{slug}' is not active (status: {project['status']})")
                return str(project["id"])
            else:
                logger.error(f"No project found with slug: {slug}")
                return None
                
        except Exception as e:
            logger.error(f"Error resolving slug '{slug}': {e}", exc_info=True)
            return None
