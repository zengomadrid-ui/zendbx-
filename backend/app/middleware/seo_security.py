"""
SEO & Security middleware for the ZendBX API.

Implemented as a pure ASGI middleware (not BaseHTTPMiddleware) to avoid
the known Starlette streaming / EndOfStream bug that breaks CORS pre-flight
and causes 500 errors on valid requests.

Responsibilities:
  1. Attach  X-Robots-Tag: noindex, nofollow  on every HTTP response.
  2. Return 404 for /docs, /redoc, /openapi.json, /swagger in production.
  3. Strip Server / X-Powered-By fingerprinting headers.
  4. Add baseline security headers (X-Content-Type-Options, etc.).
"""

from starlette.types import ASGIApp, Receive, Scope, Send
from starlette.responses import JSONResponse

# Paths blocked in production (exact match after stripping trailing slash)
_BLOCKED_IN_PRODUCTION = {"/docs", "/redoc", "/openapi.json", "/swagger"}

_ROBOTS_NOINDEX = "noindex, nofollow, noarchive, nosnippet"

# Headers to inject on every response
_SECURITY_HEADERS = [
    (b"x-robots-tag",           _ROBOTS_NOINDEX.encode()),
    (b"x-content-type-options",  b"nosniff"),
    (b"x-frame-options",         b"DENY"),
    (b"referrer-policy",         b"strict-origin-when-cross-origin"),
    # MEDIUM-2 FIX: Add HSTS (2-year max-age with subdomains + preload)
    (b"strict-transport-security", b"max-age=63072000; includeSubDomains; preload"),
    # LOW-3 FIX: Add Content-Security-Policy
    (b"content-security-policy", b"default-src 'none'; frame-ancestors 'none'"),
    # Permissions policy — disable unnecessary browser APIs
    (b"permissions-policy",      b"geolocation=(), microphone=(), camera=()"),
]

# Headers to remove (fingerprinting)
_STRIP_HEADERS = {b"server", b"x-powered-by"}


class SEOSecurityMiddleware:
    """Pure ASGI middleware — safe with streaming responses and CORS pre-flight."""

    def __init__(self, app: ASGIApp, environment: str = "production") -> None:
        self.app = app
        self.is_production = environment == "production"

    async def __call__(self, scope: Scope, receive: Receive, send: Send) -> None:
        if scope["type"] != "http":
            # Pass through websocket / lifespan scopes unchanged
            await self.app(scope, receive, send)
            return

        path: str = scope.get("path", "")

        # ── Block API docs in production ──────────────────────────────────────
        if self.is_production and path.rstrip("/") in _BLOCKED_IN_PRODUCTION:
            response = JSONResponse(status_code=404, content={"detail": "Not found"})
            await response(scope, receive, send)
            return

        # ── Wrap send to mutate response headers ──────────────────────────────
        async def send_with_headers(message):
            if message["type"] == "http.response.start":
                headers: list = list(message.get("headers", []))

                # Strip fingerprinting headers
                headers = [
                    (name, value)
                    for name, value in headers
                    if name.lower() not in _STRIP_HEADERS
                ]

                # Collect existing header names (lower-case) for setdefault logic
                existing = {name.lower() for name, _ in headers}

                # Inject security headers (skip if already present)
                for name, value in _SECURITY_HEADERS:
                    if name not in existing:
                        headers.append((name, value))

                message = {**message, "headers": headers}

            await send(message)

        await self.app(scope, receive, send_with_headers)
