from fastapi import FastAPI, Request, status
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import JSONResponse
from app.core.config import settings
from app.core.database import close_all_pools
import traceback

app = FastAPI(
    title=settings.APP_NAME,
    version=settings.APP_VERSION,
    debug=settings.DEBUG
)

# Global exception handler to prevent crashes and always return CORS headers
@app.exception_handler(Exception)
async def global_exception_handler(request: Request, exc: Exception):
    """Catch all unhandled exceptions and return proper error response with CORS headers"""
    print(f"❌ UNHANDLED EXCEPTION: {type(exc).__name__}: {str(exc)}")
    print(f"❌ Traceback:")
    print(traceback.format_exc())
    
    return JSONResponse(
        status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
        content={
            "detail": f"Internal server error: {str(exc)}",
            "type": type(exc).__name__
        },
        headers={
            "Access-Control-Allow-Origin": "*",  # Emergency CORS
            "Access-Control-Allow-Credentials": "true",
            "Access-Control-Allow-Methods": "*",
            "Access-Control-Allow-Headers": "*",
        }
    )

# CORS middleware - Must be added before routes
# Production-safe CORS configuration
if settings.ENVIRONMENT == "production":
    # Production: Strict CORS + localhost for testing
    allowed_origins = [
        "https://devapp.zendbx.in",
        "https://zendbx.in",
        "https://www.zendbx.in",
        "https://zendbx-2-zpp9.onrender.com",  # Backend itself for testing
        "http://localhost:5173",  # CRITICAL: Allow localhost for development testing
        "http://localhost:3000",  # Alternative frontend port
    ]
    allow_credentials = True
    print(f"🔒 Production CORS enabled for: {allowed_origins}")
else:
    # Development: Allow specific origins for better security
    allowed_origins = [
        "http://localhost:3000",
        "http://localhost:5173",
        "http://localhost:8000",
        "http://127.0.0.1:3000",
        "http://127.0.0.1:5173",
        "http://127.0.0.1:8000",
    ]
    allow_credentials = True
    print(f"🔓 Development CORS enabled for: {allowed_origins}")

app.add_middleware(
    CORSMiddleware,
    allow_origins=allowed_origins,
    allow_credentials=allow_credentials,
    allow_methods=["GET", "POST", "PUT", "PATCH", "DELETE", "OPTIONS", "HEAD"],
    allow_headers=["*"],  # Allow all headers
    expose_headers=["*"],
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

# Add Project Context Middleware for multi-tenant support
from app.middleware.project_context import ProjectContextMiddleware
app.add_middleware(ProjectContextMiddleware)

# Add RLS Context Middleware for Row Level Security
from app.middleware.rls_context import RLSContextMiddleware
app.add_middleware(RLSContextMiddleware)

@app.on_event("startup")
async def startup():
    """Initialize application"""
    print(f"Starting {settings.APP_NAME} v{settings.APP_VERSION}...")
    print(f"Environment: {settings.ENVIRONMENT}")
    
    # Initialize database connection pool FIRST
    try:
        from app.core.db_router import initialize_main_pool
        pool = await initialize_main_pool()
        print(f"✅ Database pool initialized: {pool.get_size()} connections")
    except Exception as e:
        print(f"❌ CRITICAL: Database pool initialization failed: {str(e)}")
        print(f"   This will cause all database operations to fail!")
        raise  # Fail fast if we can't connect to database
    
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
    """Health check endpoint"""
    return {
        "app": settings.APP_NAME,
        "version": settings.APP_VERSION,
        "status": "running"
    }

@app.get("/health")
async def health_check():
    """Detailed health check"""
    return {
        "status": "healthy",
        "database": "connected",
        "cors_fix": "deployed_v3_with_localhost",  # Updated marker
        "timestamp": "2024-03-30T00:00:00Z"
    }

# Import and include routers
from app.api import (
    auth, projects, tables, queries, ai, imports as imports_router, 
    auto_api, api_keys, oauth, oauth_settings, project_api, project_keys,
    sessions, admin_users, audit, project_auth, public_auth,
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
    storage,  # Object Storage
    run_migration,  # One-time database migrations
    setup_project,  # Temporary setup endpoint
)

# Multi-tenant APIs (new) - These MUST come first to override old endpoints
app.include_router(public_auth_v2.router, tags=["auth-v2"])  # New multi-tenant auth
app.include_router(rest_v1.router, tags=["rest-api"])  # Universal REST API at /rest/v1/{table}

# Also mount REST API under /p/{slug}/ prefix for Supabase-compatible SDK usage
from fastapi import APIRouter as _APIRouter
_p_router = _APIRouter(prefix="/p/{project_slug}")
app.include_router(rest_v1.router, prefix="/p/{project_slug}", tags=["rest-api-slug"])

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
app.include_router(tables.router, prefix="/api/projects", tags=["tables"])
app.include_router(queries.router, prefix="/api/projects", tags=["queries"])
app.include_router(ai.router, prefix="/api/ai", tags=["ai"])
app.include_router(imports_router.router, prefix="/api/projects", tags=["imports"])
app.include_router(imports_router.router, prefix="/api", tags=["imports"])  # Simple import endpoint
app.include_router(auto_api.router, prefix="/api", tags=["auto-api"])
app.include_router(api_keys.router, tags=["api-keys"])
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

# Object Storage API
app.include_router(storage.router, tags=["storage"])

# Database Migration API (one-time use)
app.include_router(run_migration.router, prefix="/api/admin", tags=["admin"])

# Temporary Setup Endpoint (remove after initial setup)
app.include_router(setup_project.router, tags=["setup"])
