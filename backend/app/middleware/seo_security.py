"""
SEO & Security middleware for the ZendBX API.

Responsibilities:
  1. Attach  X-Robots-Tag: noindex, nofollow  to every API response so that
     search-engine crawlers that somehow reach the backend never index it.
  2. Return 404 for /docs, /redoc and /openapi.json in production to prevent
     Swagger UI from being discovered or indexed.
  3. Remove server-fingerprinting headers (Server, X-Powered-By).
"""

from starlette.middleware.base import BaseHTTPMiddleware
from starlette.requests import Request
from starlette.responses import Response, JSONResponse
import os

# Paths that must never be accessible in production
_BLOCKED_IN_PRODUCTION = {"/docs", "/redoc", "/openapi.json", "/swagger"}

# Header applied to every response
_ROBOTS_NOINDEX = "noindex, nofollow, noarchive, nosnippet"


class SEOSecurityMiddleware(BaseHTTPMiddleware):
    """
    Applied globally — runs after CORS so CORS pre-flight still works correctly.
    """

    def __init__(self, app, environment: str = "production"):
        super().__init__(app)
        self.is_production = environment == "production"

    async def dispatch(self, request: Request, call_next) -> Response:
        path = request.url.path

        # ── Block API docs in production ─────────────────────────────────────
        if self.is_production and path.rstrip("/") in _BLOCKED_IN_PRODUCTION:
            return JSONResponse(
                status_code=404,
                content={"detail": "Not found"},
            )

        response: Response = await call_next(request)

        # ── Attach X-Robots-Tag to every response ────────────────────────────
        response.headers["X-Robots-Tag"] = _ROBOTS_NOINDEX

        # ── Remove server-fingerprinting headers ─────────────────────────────
        if "server" in response.headers:
            del response.headers["server"]
        if "x-powered-by" in response.headers:
            del response.headers["x-powered-by"]

        # ── Additional security headers ───────────────────────────────────────
        response.headers.setdefault("X-Content-Type-Options", "nosniff")
        response.headers.setdefault("X-Frame-Options", "DENY")
        response.headers.setdefault("Referrer-Policy", "strict-origin-when-cross-origin")

        return response
