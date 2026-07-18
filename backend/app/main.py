from fastapi import FastAPI, Request, status
from fastapi.responses import JSONResponse
from fastapi import Header
from typing import Optional
from app.core.config import settings
from app.core.database import close_all_pools
import traceback
import logging

# Setup logging
logger = logging.getLogger(__name__)

# Disable Swagger / ReDoc / OpenAPI schema in production so they are never
# indexed or discovered by search engines.
_is_production = settings.ENVIRONMENT == "production"

app = FastAPI(
    title=settings.APP_NAME,
    version=settings.APP_VERSION,
    debug=settings.DEBUG,
    # Docs are disabled in production; available only in development
    docs_url=None if _is_production else "/docs",
    redoc_url=None if _is_production else "/redoc",
    openapi_url=None if _is_production else "/openapi.json",
    description="ZendBX — instant backend platform. Postgres, REST APIs, auth, storage and realtime in one.",
)

# Global exception handlers to ensure CORS headers on all error responses
# Note: The CORS middleware handles the actual header injection, but we need
# to ensure proper JSON responses for all exception types
from fastapi import HTTPException as _HTTPException
from fastapi.exceptions import RequestValidationError
from starlette.exceptions import HTTPException as StarletteHTTPException

@app.exception_handler(_HTTPException)
async def http_exception_handler(request: Request, exc: _HTTPException):
    """Handle FastAPI HTTPException with proper error response."""
    return JSONResponse(
        status_code=exc.status_code,
        content={"detail": exc.detail},
    )

@app.exception_handler(StarletteHTTPException)
async def starlette_http_exception_handler(request: Request, exc: StarletteHTTPException):
    """Handle Starlette HTTPException with proper error response."""
    return JSONResponse(
        status_code=exc.status_code,
        content={"detail": exc.detail},
    )

@app.exception_handler(RequestValidationError)
async def validation_exception_handler(request: Request, exc: RequestValidationError):
    """Handle request validation errors (422) with detailed error info."""
    return JSONResponse(
        status_code=status.HTTP_422_UNPROCESSABLE_ENTITY,
        content={
            "detail": "Request validation failed",
            "errors": exc.errors(),
        },
    )

@app.exception_handler(Exception)
async def global_exception_handler(request: Request, exc: Exception):
    """Handle all unhandled exceptions as 500 errors."""
    print(f"❌ UNHANDLED EXCEPTION: {type(exc).__name__}: {str(exc)}")
    print(f"❌ Traceback:")
    print(traceback.format_exc())

    return JSONResponse(
        status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
        content={
            "detail": f"Internal server error: {str(exc)}",
            "type": type(exc).__name__
        },
    )

# CORS middleware - Must be added before routes
# Use our comprehensive CORS middleware that handles all response types
from app.middleware.cors_middleware import CORSMiddleware, get_allowed_origins_for_environment

allowed_origins = get_allowed_origins_for_environment(settings.ENVIRONMENT)

if settings.ENVIRONMENT == "production":
    print(f"🔒 Production CORS enabled for: {allowed_origins}")
else:
    print(f"🔓 Development CORS enabled for: {allowed_origins}")

app.add_middleware(
    CORSMiddleware,
    allowed_origins=allowed_origins,
    allow_credentials=True,
    allow_methods=["GET", "POST", "PUT", "PATCH", "DELETE", "OPTIONS", "HEAD"],
    allow_headers=[
        "Authorization",
        "apikey",
        "Content-Type",
        "Accept",
        "x-project-id",
        "x-api-key",
        "x-internal-secret",
        "Cache-Control",
        "Pragma",
        "X-Requested-With",
    ],
    expose_headers=[
        "X-RateLimit-Limit",
        "X-RateLimit-Remaining",
        "X-RateLimit-Used",
        "Content-Length",
        "Content-Range",
    ],
    max_age=3600,
)

# Session middleware for OAuth (must be added after CORS)
from starlette.middleware.sessions import SessionMiddleware
app.add_middleware(
    SessionMiddleware,
    secret_key=settings.SECRET_KEY,
    session_cookie="zendbx_session",
    max_age=3600,  # 1 hour
    same_site="lax",
    https_only=settings.ENVIRONMENT == "production"
)
print(f"🔐 Session middleware enabled for OAuth")

# SEO & Security middleware — attaches X-Robots-Tag and blocks docs in production
from app.middleware.seo_security import SEOSecurityMiddleware
app.add_middleware(SEOSecurityMiddleware, environment=settings.ENVIRONMENT)

# Add Project Context Middleware for multi-tenant support
from app.middleware.project_context import ProjectContextMiddleware
app.add_middleware(ProjectContextMiddleware)

# Add RLS Context Middleware for Row Level Security
from app.middleware.rls_context import RLSContextMiddleware
app.add_middleware(RLSContextMiddleware)

@app.on_event("startup")
async def startup():
    """Initialize application"""
    print("=" * 80)
    print(f"🚀 Starting {settings.APP_NAME} v{settings.APP_VERSION}")
    print(f"Environment: {settings.ENVIRONMENT}")
    
    # Show Git version information
    try:
        import subprocess
        import os
        git_commit = subprocess.check_output(['git', 'rev-parse', '--short', 'HEAD'], 
                                            cwd=os.path.dirname(os.path.dirname(__file__)),
                                            stderr=subprocess.DEVNULL).decode('utf-8').strip()
        git_branch = subprocess.check_output(['git', 'rev-parse', '--abbrev-ref', 'HEAD'],
                                            cwd=os.path.dirname(os.path.dirname(__file__)),
                                            stderr=subprocess.DEVNULL).decode('utf-8').strip()
        print(f"📦 Git Version: {git_branch}@{git_commit}")
    except Exception:
        print(f"📦 Git Version: Not available")
    
    # Show auth module file path
    try:
        import app.api.public_auth_v2 as auth_v2_module
        print(f"📄 Auth Module v2: {auth_v2_module.__file__}")
    except Exception as e:
        print(f"⚠️  Could not load auth_v2 module: {e}")
    
    print("=" * 80 + "\n")
    
    # Initialize database connection pool FIRST
    try:
        from app.core.db_router import initialize_main_pool
        pool = await initialize_main_pool()
        print(f"✅ Database pool initialized: {pool.get_size()} connections")
    except Exception as e:
        print(f"❌ CRITICAL: Database pool initialization failed: {str(e)}")
        print(f"   This will cause all database operations to fail!")
        raise  # Fail fast if we can't connect to database
    
    # Print all registered routes for debugging
    print("\n" + "="*80)
    print("REGISTERED ROUTES")
    print("="*80)
    auth_routes = []
    rest_routes = []
    other_routes = []
    
    for route in app.routes:
        if hasattr(route, 'path') and hasattr(route, 'methods'):
            path = route.path
            methods = ', '.join(route.methods) if route.methods else 'N/A'
            route_str = f"{methods:8} {path}"
            
            if '/auth/' in path:
                auth_routes.append(route_str)
            elif '/rest/' in path:
                rest_routes.append(route_str)
            else:
                other_routes.append(route_str)
    
    if auth_routes:
        print("\nAUTH ROUTES:")
        for r in sorted(auth_routes):
            print(f"  {r}")
    
    if rest_routes:
        print("\nREST API ROUTES:")
        for r in sorted(rest_routes)[:10]:  # Show first 10
            print(f"  {r}")
        if len(rest_routes) > 10:
            print(f"  ... and {len(rest_routes) - 10} more REST routes")
    
    print(f"\nTOTAL ROUTES: {len(app.routes)}")
    print("="*80 + "\n")
    
    # Redis setup
    from app.core.redis_client import redis_client
    await redis_client.connect()
    print(f"📊 Redis connected")
    
    # Initialize database schema if needed
    try:
        from app.services.db_initializer import initialize_database_on_startup
        db_ready = await initialize_database_on_startup(settings.DATABASE_URL)
        
        if not db_ready:
            print("⚠️  WARNING: Database schema incomplete - some features may not work")
            print("   The application will continue, but you should initialize the schema manually")
    except Exception as e:
        print(f"⚠️  Database initialization check failed: {str(e)}")
        print("   Continuing startup, but database may not be properly initialized")
    
    print(f"Database: Connected")
    
    # Load OAuth providers from database
    try:
        from app.services.oauth_service import load_oauth_providers_from_db
        await load_oauth_providers_from_db()
        print(f"🔐 OAuth providers loaded")
    except Exception as e:
        print(f"⚠️  OAuth provider loading failed: {str(e)}")
    
    # Initialize Redis for quota tracking (optional - don't crash if unavailable)
    try:
        from app.core.redis_client import redis_client
        await redis_client.connect()
        print(f"📊 Redis connected")
    except Exception as e:
        print(f"⚠️  Redis connection failed (continuing without Redis): {str(e)}")
    
    # Start realtime listener if enabled (optional - don't crash if unavailable)
    if settings.ENABLE_REALTIME:
        try:
            from app.services.realtime_listener import realtime_listener
            from app.services.websocket_client import websocket_client
            
            # Set callback to forward events to WebSocket server
            realtime_listener.set_callback(websocket_client.broadcast_event)
            
            # Start listening to main database
            await realtime_listener.start_listening(
                settings.DATABASE_URL,
                "main"
            )
            
            print(f"📡 Realtime listener started")
            print(f"🔗 WebSocket server: {settings.WEBSOCKET_SERVER_URL}")
        except Exception as e:
            print(f"⚠️  Realtime listener failed (continuing without realtime): {str(e)}")

@app.on_event("shutdown")
async def shutdown():
    """Cleanup on shutdown"""
    # Disconnect Redis (if connected)
    try:
        from app.core.redis_client import redis_client
        await redis_client.disconnect()
        print("📊 Redis disconnected")
    except Exception as e:
        print(f"⚠️  Redis disconnect failed: {str(e)}")
    
    # Stop realtime listener (if running)
    if settings.ENABLE_REALTIME:
        try:
            from app.services.realtime_listener import realtime_listener
            from app.services.websocket_client import websocket_client
            
            await realtime_listener.stop_listening()
            await websocket_client.close()
            print("📡 Realtime listener stopped")
        except Exception as e:
            print(f"⚠️  Realtime listener stop failed: {str(e)}")
    
    # Close database pools
    try:
        from app.core.db_router import close_all_pools as close_project_pools
        await close_project_pools()
        await close_all_pools()
        print("💾 Database pools closed")
    except Exception as e:
        print(f"⚠️  Database pool close failed: {str(e)}")
    
    print("Application shutdown complete")

@app.get("/")
async def root():
    """Public root endpoint — no authentication required"""
    response = {
        "app": settings.APP_NAME,
        "version": settings.APP_VERSION,
        "status": "running",
        "dashboard": "https://zendbx.in",
    }
    # Only expose docs link in non-production environments
    if settings.ENVIRONMENT != "production":
        response["docs"] = "/docs"
    return response

@app.get("/health")
async def health_check():
    """Public health check — no authentication required"""
    # Check if schemas router is registered
    schemas_routes = [r for r in app.routes if hasattr(r, 'path') and 'schemas' in r.path]
    
    return {
        "status": "healthy",
        "app": settings.APP_NAME,
        "version": settings.APP_VERSION,
        "schemas_routes_count": len(schemas_routes),
        "schemas_routes": [r.path for r in schemas_routes] if schemas_routes else []
    }

@app.get("/version")
async def version():
    """Public version endpoint — no authentication required"""
    return {
        "app": settings.APP_NAME,
        "version": settings.APP_VERSION,
    }

# Import and include routers
from app.api import (
    auth, projects, tables, queries, ai, imports as imports_router, 
    auto_api, api_keys, oauth, oauth_settings, project_api, project_keys,
    sessions, admin_users, admin_security, audit, project_auth, public_auth,
    rest_v1, public_auth_v2,  # New multi-tenant APIs
    db_tables, db_functions, db_triggers, db_schema,  # Database management
    project_stats,  # Project statistics
    backups,  # Backup & Restore
    realtime,  # Realtime management
    team,  # Team collaboration
    analytics,  # Performance analytics
    billing,  # Billing & Usage Quotas
    admin_quotas,  # Admin quota management
    oauth_providers, oauth_redirects, oauth_login,  # OAuth URL Generator System
    storage,  # Object Storage (legacy /api/storage)
    storage_v2,  # Object Storage v2 (project-scoped /p/{slug}/storage)
    run_migration,  # One-time database migrations
    setup_project,  # Temporary setup endpoint
    mcp_info,  # MCP Information API
    mcp_server,  # MCP Server Implementation
    project_settings,  # Project Settings API
    schemas,  # Schema Discovery API (multi-schema table navigation)
)

# Multi-tenant APIs (new slug-based routing) - These MUST come first to override old endpoints
print(f"📍 Registering slug-based auth router from: app.api.public_auth_v2")
app.include_router(public_auth_v2.router, tags=["auth-v2"])  # New: /p/{slug}/v1/auth/*
app.include_router(rest_v1.router, tags=["rest-api"])  # New: /p/{slug}/v1/rest/{table}
app.include_router(storage_v2.router, tags=["storage-v2"])  # New: /p/{slug}/v1/storage/*

# OAuth URL Generator System (public endpoints - no prefix)
app.include_router(oauth_login.router)  # Public OAuth login URLs
app.include_router(oauth_providers.router)  # OAuth provider management
app.include_router(oauth_redirects.router)  # OAuth redirect URL management

# Existing APIs
app.include_router(auth.router, prefix="/api/auth", tags=["auth"])
app.include_router(oauth.router, prefix="/api/auth", tags=["oauth"])
app.include_router(oauth_settings.router, prefix="/api/auth", tags=["oauth-settings"])
app.include_router(sessions.router, tags=["sessions"])
app.include_router(admin_users.router, tags=["admin"])
app.include_router(audit.router, tags=["audit"])
app.include_router(project_auth.router, prefix="/api", tags=["project-auth"])
# app.include_router(public_auth.router, tags=["public-auth"])  # OLD - Disabled in favor of v2
app.include_router(projects.router, prefix="/api/projects", tags=["projects"])
app.include_router(project_keys.router, prefix="/api", tags=["project-keys"])

# Schema Discovery API - CRITICAL: Must be before tables router for route priority
print(f"� SCHEMAS MODULE: Importing and registering...")
print(f"   Schemas router object: {schemas.router}")
print(f"   Schemas router routes: {[r.path for r in schemas.router.routes]}")
print(f"   Registering at prefix: /api/projects")
app.include_router(schemas.router, prefix="/api/projects", tags=["schemas"])
print(f"   ✅ Schemas router registered! Total routes: {len(app.routes)}")

app.include_router(tables.router, prefix="/api/projects", tags=["tables"])
app.include_router(queries.router, prefix="/api/projects", tags=["queries"])
app.include_router(ai.router, prefix="/api/ai", tags=["ai"])
app.include_router(imports_router.router, prefix="/api/projects", tags=["imports"])
app.include_router(imports_router.router, prefix="/api", tags=["imports"])  # Simple import endpoint
app.include_router(auto_api.router, prefix="/api", tags=["auto-api"])
app.include_router(api_keys.router, tags=["api-keys"])

# Object Storage API (legacy — dashboard uses these endpoints with /api/storage)
app.include_router(storage.router, tags=["storage"])

# Project API (catch-all for project-scoped routes)
app.include_router(project_api.router, tags=["project-api"])

# Database Management APIs
app.include_router(db_tables.router, prefix="/api/projects/{project_id}", tags=["database"])
app.include_router(db_functions.router, prefix="/api/projects/{project_id}", tags=["database"])
app.include_router(db_triggers.router, prefix="/api/projects/{project_id}", tags=["database"])
app.include_router(db_schema.router, prefix="/api/projects/{project_id}", tags=["database"])

# Project Statistics API
app.include_router(project_stats.router, prefix="/api/projects", tags=["statistics"])

# Backup & Restore API
app.include_router(backups.router, tags=["backups"])

# Realtime API
app.include_router(realtime.router, prefix="/api", tags=["realtime"])

# Team Collaboration API
app.include_router(team.router, prefix="/api/projects", tags=["team"])

# Performance Analytics API
app.include_router(analytics.router, prefix="/api", tags=["analytics"])

# Billing & Usage Quotas API
app.include_router(billing.router, tags=["billing"])

# Admin Quota Management API
app.include_router(admin_quotas.router, tags=["admin-quotas"])

# Database Migration API (one-time use)
app.include_router(run_migration.router, prefix="/api/admin", tags=["admin"])

# Temporary Setup Endpoint (remove after initial setup)
app.include_router(setup_project.router, tags=["setup"])

# MCP Information API
app.include_router(mcp_info.router, tags=["mcp"])

# MCP Server Implementation - Register with /mcp prefix for new architecture
app.include_router(mcp_server.router, prefix="/mcp", tags=["mcp-server"])

# Project Settings API
app.include_router(project_settings.router, tags=["project-settings"])
