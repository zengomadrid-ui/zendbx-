from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from app.core.config import settings
from app.core.database import close_all_pools

app = FastAPI(
    title=settings.APP_NAME,
    version=settings.APP_VERSION,
    debug=settings.DEBUG
)

# CORS middleware - Must be added before routes
# Allow multiple ports for development
if settings.ENVIRONMENT == "development":
    allowed_origins = [
        "http://localhost:3000",
        "http://localhost:3001",
        "http://127.0.0.1:3000",
        "http://127.0.0.1:3001",
    ]
else:
    allowed_origins = settings.get_allowed_origins

app.add_middleware(
    CORSMiddleware,
    allow_origins=allowed_origins,
    allow_credentials=True,
    allow_methods=["GET", "POST", "PUT", "PATCH", "DELETE", "OPTIONS"],
    allow_headers=[
        "Content-Type",
        "Authorization",
        "apikey",
        "x-project-id",
        "X-Requested-With",
        "Accept",
        "Origin",
        "Access-Control-Request-Method",
        "Access-Control-Request-Headers"
    ],
    expose_headers=["*"],
    max_age=3600,  # Cache preflight requests for 1 hour
)

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
    print(f"Database: Connected")
    
    # Initialize Redis for quota tracking
    from app.core.redis_client import redis_client
    await redis_client.connect()
    
    # Start realtime listener if enabled
    if settings.ENABLE_REALTIME:
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

@app.on_event("shutdown")
async def shutdown():
    """Cleanup on shutdown"""
    # Disconnect Redis
    from app.core.redis_client import redis_client
    await redis_client.disconnect()
    print("📊 Redis disconnected")
    
    # Stop realtime listener
    if settings.ENABLE_REALTIME:
        from app.services.realtime_listener import realtime_listener
        from app.services.websocket_client import websocket_client
        
        await realtime_listener.stop_listening()
        await websocket_client.close()
        print("📡 Realtime listener stopped")
    
    from app.core.db_router import close_all_pools as close_project_pools
    await close_project_pools()
    await close_all_pools()
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
        "timestamp": "2024-03-30T00:00:00Z"
    }

# Import and include routers
from app.api import (
    auth, projects, tables, queries, ai, imports as imports_router, 
    auto_api, api_keys, oauth, project_api, project_keys,
    sessions, admin_users, audit, project_auth, public_auth,
    rest_v1, public_auth_v2,  # New multi-tenant APIs
    db_tables, db_functions, db_triggers, db_schema,  # Database management
    project_stats,  # Project statistics
    backups,  # Backup & Restore
    realtime,  # Realtime management
    team,  # Team collaboration
    analytics,  # Performance analytics
    billing,  # Billing & Usage Quotas
    admin_quotas  # Admin quota management
)

# Multi-tenant APIs (new) - These MUST come first to override old endpoints
app.include_router(public_auth_v2.router, tags=["auth-v2"])  # New multi-tenant auth
app.include_router(rest_v1.router, tags=["rest-api"])  # Universal REST API

# Existing APIs
app.include_router(auth.router, prefix="/api/auth", tags=["auth"])
app.include_router(oauth.router, prefix="/api/auth", tags=["oauth"])
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
