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
from starlette.responses import JSONResponse
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
    "/api/admin",
    "/api/ai/",
    "/docs",
    "/openapi.json",
    "/health",
    "/v1/auth/",
]
SKIP_EXACT = {"/", "/health"}


class ProjectContextMiddleware(BaseHTTPMiddleware):

    async def dispatch(self, request: Request, call_next):
        # Always skip OPTIONS (CORS preflight)
        if request.method == "OPTIONS":
            return await call_next(request)

        path = request.url.path

        # Skip admin/auth paths
        if path in SKIP_EXACT:
            return await call_next(request)
        if any(path.startswith(p) for p in SKIP_PREFIXES):
            return await call_next(request)
        if "/v1/auth/" in path:
            return await call_next(request)

        try:
            # ── Step 1: Resolve project ID ────────────────────────────────────
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

            if project_slug and not project_id:
                project_id = await self._resolve_slug(project_slug)

            if not project_id:
                return JSONResponse(
                    status_code=400,
                    content={"detail": "Missing project context. Use /p/{slug}/... or x-project-id header."},
                    headers=self._cors_headers(request),
                )

            # ── Step 2: Read apikey and Authorization headers ─────────────────
            apikey_header = request.headers.get("apikey")
            auth_header = request.headers.get("authorization", "")
            bearer_token = auth_header[7:].strip() if auth_header.lower().startswith("bearer ") else None

            # ── Step 3: Determine project key ─────────────────────────────────
            # Priority: apikey header → Bearer token (if anon/service_role)
            project_key = apikey_header or bearer_token

            if not project_key:
                return JSONResponse(
                    status_code=401,
                    content={"detail": "Missing API key. Provide apikey header or Authorization: Bearer <anon_key>."},
                    headers=self._cors_headers(request),
                )

            # ── Step 4: Validate project key ──────────────────────────────────
            try:
                ctx = await validate_project_key(project_id, project_key)
            except Exception as e:
                status_code = getattr(e, "status_code", 403)
                detail = getattr(e, "detail", str(e))
                return JSONResponse(
                    status_code=status_code,
                    content={"detail": detail},
                    headers=self._cors_headers(request),
                )

            schema = ctx["schema"]
            base_role = ctx["role"]      # 'anon' or 'service_role'
            jwt_secret = ctx["jwt_secret"]
            pool = ctx["pool"]

            # ── Step 5: Identify authenticated user ───────────────────────────
            user_id = None
            user_role = base_role
            user_email = None

            # If apikey was used for project identification and Bearer is a separate user JWT
            user_bearer = bearer_token if apikey_header else None

            if user_bearer:
                try:
                    payload = pyjwt.decode(user_bearer, jwt_secret, algorithms=["HS256"])
                    token_role = payload.get("role", "")
                    if token_role == "authenticated":
                        user_id = payload.get("sub")
                        user_role = "authenticated"
                        user_email = payload.get("email")
                        logger.debug(f"Authenticated user: {user_id}")
                except pyjwt.ExpiredSignatureError:
                    return JSONResponse(
                        status_code=401,
                        content={"detail": "User token expired"},
                        headers=self._cors_headers(request),
                    )
                except pyjwt.InvalidTokenError:
                    pass  # Ignore invalid user token, keep base role

            # ── Step 6: Set search_path on request state ──────────────────────
            # We store context on request.state; actual SET search_path happens
            # per-connection in RLSEnforcer and auth endpoints.
            request.state.project_id = project_id
            request.state.project_slug = project_slug or ctx.get("slug")
            request.state.project_schema = schema
            request.state.project_db = pool          # shared pool
            request.state.anon_key = project_key
            request.state.jwt_secret = jwt_secret
            request.state.rls_user_id = user_id
            request.state.rls_role = user_role
            request.state.rls_project_id = project_id
            request.state.user_email = user_email

            logger.info(
                f"{request.method} {path} | project={project_id} schema={schema} role={user_role}"
            )

            return await call_next(request)

        except Exception as e:
            logger.error(f"ProjectContextMiddleware error: {e}", exc_info=True)
            return JSONResponse(
                status_code=500,
                content={"detail": f"Internal server error: {str(e)}"},
                headers=self._cors_headers(request),
            )

    # ── Helpers ────────────────────────────────────────────────────────────────

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
        m = re.match(r"^/p/([^/]+)", path)
        return m.group(1) if m else None

    async def _resolve_slug(self, slug: str) -> str | None:
        try:
            # First try as a direct UUID project ID
            import uuid
            try:
                uuid.UUID(slug)
                # It's a valid UUID - check if it's a real project ID
                result = await execute_on_main_db("SELECT id FROM projects WHERE id = $1", slug)
                if result:
                    return str(result[0]["id"])
            except ValueError:
                pass  # Not a UUID, fall through to slug lookup

            # Then try as a slug
            result = await execute_on_main_db("SELECT id FROM projects WHERE slug = $1", slug)
            return str(result[0]["id"]) if result else None
        except Exception as e:
            logger.error(f"Slug resolution error: {e}")
            return None

    def _cors_headers(self, request: Request) -> dict:
        origin = request.headers.get("origin", "*")
        return {
            "Access-Control-Allow-Origin": origin,
            "Access-Control-Allow-Credentials": "true",
            "Access-Control-Allow-Methods": "GET, POST, PUT, PATCH, DELETE, OPTIONS, HEAD",
            "Access-Control-Allow-Headers": "*",
        }
