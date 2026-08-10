"""
Security Headers Middleware
Adds comprehensive security headers to all HTTP responses

OWASP Recommended Headers:
- Content-Security-Policy (CSP)
- Strict-Transport-Security (HSTS)
- X-Frame-Options
- X-Content-Type-Options
- X-XSS-Protection (legacy but still useful)
- Referrer-Policy
- Permissions-Policy
"""
from starlette.middleware.base import BaseHTTPMiddleware
from starlette.requests import Request
from starlette.responses import Response
from app.core.config import settings
import logging

logger = logging.getLogger(__name__)


class SecurityHeadersMiddleware(BaseHTTPMiddleware):
    """
    Middleware to add security headers to all responses
    
    Features:
    - Content Security Policy (CSP)
    - HTTP Strict Transport Security (HSTS)
    - Frame protection (X-Frame-Options)
    - Content sniffing protection
    - XSS protection
    - Referrer policy
    - Permissions policy
    """
    
    async def dispatch(self, request: Request, call_next):
        response = await call_next(request)
        
        # Only add security headers to HTML/JSON responses (not CORS preflight)
        if request.method != "OPTIONS":
            # Content Security Policy
            # Relaxed for development, strict for production
            if settings.ENVIRONMENT == "production":
                response.headers["Content-Security-Policy"] = (
                    "default-src 'self'; "
                    "script-src 'self' 'unsafe-inline' 'unsafe-eval' https://accounts.google.com https://apis.google.com; "
                    "style-src 'self' 'unsafe-inline' https://fonts.googleapis.com; "
                    "font-src 'self' https://fonts.gstatic.com; "
                    "img-src 'self' data: https: blob:; "
                    "connect-src 'self' https://api.zendbx.in https://*.zendbx.in; "
                    "frame-src 'self' https://accounts.google.com; "
                    "object-src 'none'; "
                    "base-uri 'self'; "
                    "form-action 'self'; "
                    "frame-ancestors 'none'; "
                    "upgrade-insecure-requests;"
                )
            else:
                # Development: More permissive for hot reload and development tools
                response.headers["Content-Security-Policy"] = (
                    "default-src 'self'; "
                    "script-src 'self' 'unsafe-inline' 'unsafe-eval' http://localhost:* https://accounts.google.com; "
                    "style-src 'self' 'unsafe-inline'; "
                    "connect-src 'self' http://localhost:* ws://localhost:* https://*.zendbx.in; "
                    "img-src 'self' data: https: http://localhost:*; "
                    "frame-src 'self' https://accounts.google.com;"
                )
            
            # Strict Transport Security (HSTS)
            # Only enable in production with HTTPS
            if settings.ENVIRONMENT == "production":
                response.headers["Strict-Transport-Security"] = (
                    "max-age=31536000; includeSubDomains; preload"
                )
            
            # Prevent clickjacking attacks
            response.headers["X-Frame-Options"] = "DENY"
            
            # Prevent MIME-type sniffing
            response.headers["X-Content-Type-Options"] = "nosniff"
            
            # XSS Protection (legacy but still useful for older browsers)
            response.headers["X-XSS-Protection"] = "1; mode=block"
            
            # Referrer Policy - don't leak full URL to external sites
            response.headers["Referrer-Policy"] = "strict-origin-when-cross-origin"
            
            # Permissions Policy (formerly Feature-Policy)
            # Disable potentially dangerous features
            response.headers["Permissions-Policy"] = (
                "geolocation=(), "
                "microphone=(), "
                "camera=(), "
                "payment=(), "
                "usb=(), "
                "magnetometer=(), "
                "gyroscope=(), "
                "accelerometer=()"
            )
            
            # Additional security headers
            response.headers["X-Permitted-Cross-Domain-Policies"] = "none"
            response.headers["X-Download-Options"] = "noopen"
            
            # Remove server identification header
            if "Server" in response.headers:
                del response.headers["Server"]
            
            # Remove X-Powered-By if present
            if "X-Powered-By" in response.headers:
                del response.headers["X-Powered-By"]
        
        return response
