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

# EMERGENCY MIGRATION ENDPOINT - MUST BE BEFORE MIDDLEWARE
# This endpoint bypasses all middleware (project context, RLS, etc.)
@app.post("/emergency/apply-migration-003", include_in_schema=False)
async def emergency_apply_migration_003(x_admin_secret: str = Header(None, alias="X-Admin-Secret")):
    """Emergency endpoint to create project_db_credentials table"""
    from fastapi import HTTPException, status
    import asyncpg
    
    # Verify admin access
    if not x_admin_secret or x_admin_secret != settings.SECRET_KEY:
        raise HTTPException(status_code=403, detail="Unauthorized")
    
    results = {"status": "starting", "steps": [], "errors": []}
    
    try:
        conn = await asyncpg.connect(settings.DATABASE_URL)
        try:
            # Check if exists
            exists_before = await conn.fetchval("""
                SELECT EXISTS (
                    SELECT 1 FROM information_schema.tables 
                    WHERE table_schema = 'public' AND table_name = 'project_db_credentials'
                )
            """)
            results["table_exists_before"] = exists_before
            
            if exists_before:
                results["status"] = "already_applied"
                results["message"] = "Table already exists"
                return results
            
            # Create table
            results["steps"].append("Creating table...")
            await conn.execute("""
                CREATE TABLE IF NOT EXISTS project_db_credentials (
                    project_id UUID PRIMARY KEY REFERENCES projects(id) ON DELETE CASCADE,
                    role_name VARCHAR(255) NOT NULL UNIQUE,
                    encrypted_password TEXT NOT NULL,
                    created_at TIMESTAMPTZ DEFAULT NOW(),
                    updated_at TIMESTAMPTZ DEFAULT NOW()
                )
            """)
            results["steps"].append("✅ Table created")
            
            # Create index
            await conn.execute("""
                CREATE INDEX IF NOT EXISTS idx_project_db_credentials_role_name 
                ON project_db_credentials(role_name)
            """)
            results["steps"].append("✅ Index created")
            
            # Set permissions
            await conn.execute("REVOKE ALL ON project_db_credentials FROM PUBLIC")
            results["steps"].append("✅ Revoked PUBLIC access")
            
            # Create trigger
            await conn.execute("""
                CREATE OR REPLACE FUNCTION update_project_db_credentials_updated_at()
                RETURNS TRIGGER AS $$
                BEGIN
                    NEW.updated_at = NOW();
                    RETURN NEW;
                END;
                $$ LANGUAGE plpgsql
            """)
            await conn.execute("""
                DROP TRIGGER IF EXISTS trigger_update_project_db_credentials_updated_at 
                ON project_db_credentials
            """)
            await conn.execute("""
                CREATE TRIGGER trigger_update_project_db_credentials_updated_at
                BEFORE UPDATE ON project_db_credentials
                FOR EACH ROW
                EXECUTE FUNCTION update_project_db_credentials_updated_at()
            """)
            results["steps"].append("✅ Trigger created")
            
            # Verify
            exists_after = await conn.fetchval("""
                SELECT EXISTS (
                    SELECT 1 FROM information_schema.tables 
                    WHERE table_schema = 'public' AND table_name = 'project_db_credentials'
                )
            """)
            results["table_exists_after"] = exists_after
            project_count = await conn.fetchval("SELECT COUNT(*) FROM projects")
            results["project_count"] = project_count
            results["status"] = "success"
            results["message"] = f"Migration applied successfully. {project_count} projects exist."
            
        finally:
            await conn.close()
    except Exception as e:
        results["status"] = "error"
        results["message"] = str(e)
        raise HTTPException(status_code=500, detail=results)
    
    return results

@app.get("/emergency/check-encryption-key", include_in_schema=False)
async def check_encryption_key(x_admin_secret: str = Header(None, alias="X-Admin-Secret")):
    """Check if PROJECT_CREDENTIAL_ENCRYPTION_KEY is valid"""
    from fastapi import HTTPException, status
    from cryptography.fernet import Fernet
    
    if not x_admin_secret or x_admin_secret != settings.SECRET_KEY:
        raise HTTPException(status_code=403, detail="Unauthorized")
    
    result = {
        "key_exists": bool(settings.PROJECT_CREDENTIAL_ENCRYPTION_KEY),
        "key_length": len(settings.PROJECT_CREDENTIAL_ENCRYPTION_KEY) if settings.PROJECT_CREDENTIAL_ENCRYPTION_KEY else 0,
        "key_format_valid": False,
        "error": None
    }
    
    if settings.PROJECT_CREDENTIAL_ENCRYPTION_KEY:
        try:
            # Try to create a Fernet instance
            f = Fernet(settings.PROJECT_CREDENTIAL_ENCRYPTION_KEY.encode())
            # Try a test encryption/decryption
            test_data = b"test"
            encrypted = f.encrypt(test_data)
            decrypted = f.decrypt(encrypted)
            result["key_format_valid"] = (decrypted == test_data)
        except Exception as e:
            result["error"] = str(e)
    else:
        result["error"] = "PROJECT_CREDENTIAL_ENCRYPTION_KEY is not set"
    
    return result

@app.post("/emergency/clear-and-reprovision", include_in_schema=False)
async def clear_and_reprovision(x_admin_secret: str = Header(None, alias="X-Admin-Secret")):
    """Clear all credentials and re-provision from scratch"""
    from fastapi import HTTPException, status
    from app.core.db_roles import ProjectRoleManager, ProjectCredentialStore
    import asyncpg
    
    if not x_admin_secret or x_admin_secret != settings.SECRET_KEY:
        raise HTTPException(status_code=403, detail="Unauthorized")
    
    results = {
        "status": "starting",
        "cleared": 0,
        "provisioned": 0,
        "failed": 0,
        "projects": []
    }
    
    try:
        admin_conn = await asyncpg.connect(settings.DATABASE_URL)
        
        try:
            # Step 1: Delete ALL existing credentials
            deleted = await admin_conn.execute("DELETE FROM project_db_credentials")
            results["cleared"] = int(deleted.split()[-1]) if deleted else 0
            
            # Step 2: Get all projects
            projects = await admin_conn.fetch("""
                SELECT p.id, p.name, p.database_name
                FROM projects p
                WHERE p.database_name LIKE 'proj_%'
                ORDER BY p.created_at
            """)
            
            results["project_count"] = len(projects)
            
            if not projects:
                results["status"] = "no_projects"
                return results
            
            # Step 3: Provision each project
            class SimplePoolWrapper:
                def __init__(self, conn):
                    self._conn = conn
                def acquire(self):
                    return self
                async def __aenter__(self):
                    return self._conn
                async def __aexit__(self, *args):
                    pass
            
            provisioner_pool = SimplePoolWrapper(admin_conn)
            credential_store = ProjectCredentialStore()
            
            for proj in projects:
                project_id = proj['id']
                schema_name = proj['database_name']
                project_name = proj['name']
                
                project_result = {
                    "project_id": str(project_id),
                    "name": project_name
                }
                
                role_name = ProjectRoleManager.generate_project_role_name(project_id)
                
                try:
                    # Check if role exists
                    role_exists = await admin_conn.fetchval(
                        "SELECT EXISTS(SELECT 1 FROM pg_roles WHERE rolname = $1)",
                        role_name
                    )
                    
                    if role_exists:
                        # Revoke public access
                        await admin_conn.execute(f"REVOKE ALL ON SCHEMA public FROM {role_name}")
                        await admin_conn.execute(f"REVOKE ALL ON SCHEMA auth FROM {role_name}")
                        
                        # Reset password
                        new_password = ProjectRoleManager.generate_secure_password()
                        await admin_conn.execute(f"""
                            ALTER ROLE {role_name} 
                            PASSWORD '{new_password.replace("'", "''")}'
                        """)
                    else:
                        # Create new role
                        role_name, new_password = await ProjectRoleManager.create_project_role(
                            project_id, schema_name, provisioner_pool
                        )
                    
                    # Store credentials with current encryption key
                    await credential_store.store_credentials(
                        project_id, role_name, new_password
                    )
                    
                    project_result["status"] = "provisioned"
                    results["provisioned"] += 1
                    
                except Exception as e:
                    project_result["status"] = "failed"
                    project_result["error"] = str(e)
                    results["failed"] += 1
                
                results["projects"].append(project_result)
            
        finally:
            await admin_conn.close()
        
        if results["failed"] > 0:
            results["status"] = "partial_success"
        else:
            results["status"] = "success"
        
        results["message"] = f"Cleared {results['cleared']}, provisioned {results['provisioned']}, failed {results['failed']}"
        
    except Exception as e:
        results["status"] = "error"
        results["message"] = str(e)
        raise HTTPException(status_code=500, detail=results)
    
    return results

@app.post("/emergency/provision-all-projects", include_in_schema=False)
async def emergency_provision_all_projects(x_admin_secret: str = Header(None, alias="X-Admin-Secret")):
    """Emergency endpoint to provision credentials for all projects"""
    from fastapi import HTTPException, status
    from app.core.db_roles import ProjectRoleManager, ProjectCredentialStore
    import asyncpg
    
    # Verify admin access
    if not x_admin_secret or x_admin_secret != settings.SECRET_KEY:
        raise HTTPException(status_code=403, detail="Unauthorized")
    
    results = {
        "status": "starting",
        "projects": [],
        "provisioned": 0,
        "existed": 0,
        "failed": 0,
        "errors": []
    }
    
    try:
        admin_conn = await asyncpg.connect(settings.DATABASE_URL)
        
        try:
            # Get list of project schemas
            schemas = await admin_conn.fetch("""
                SELECT schema_name 
                FROM information_schema.schemata 
                WHERE schema_name LIKE 'proj_%'
                ORDER BY schema_name
            """)
            
            schema_names = [s['schema_name'] for s in schemas]
            results["schema_count"] = len(schema_names)
            
            # Get projects that match these schemas
            projects = await admin_conn.fetch("""
                SELECT p.id, p.name, p.slug, p.database_name
                FROM projects p
                WHERE p.database_name = ANY($1)
                ORDER BY p.created_at
            """, schema_names)
            
            results["project_count"] = len(projects)
            
            if not projects:
                results["status"] = "no_projects"
                results["message"] = "No projects found to provision"
                return results
            
            # Create pool wrapper
            class SimplePoolWrapper:
                def __init__(self, conn):
                    self._conn = conn
                def acquire(self):
                    return self
                async def __aenter__(self):
                    return self._conn
                async def __aexit__(self, *args):
                    pass
            
            provisioner_pool = SimplePoolWrapper(admin_conn)
            credential_store = ProjectCredentialStore()
            
            # Provision each project
            for proj in projects:
                project_id = proj['id']
                schema_name = proj['database_name']
                project_name = proj['name']
                
                project_result = {
                    "project_id": str(project_id),
                    "name": project_name,
                    "schema": schema_name,
                    "status": "pending"
                }
                
                role_name = ProjectRoleManager.generate_project_role_name(project_id)
                project_result["role_name"] = role_name
                
                try:
                    role_name, password = await ProjectRoleManager.create_project_role(
                        project_id, schema_name, provisioner_pool
                    )
                    
                    await credential_store.store_credentials(
                        project_id, role_name, password
                    )
                    
                    project_result["status"] = "provisioned"
                    results["provisioned"] += 1
                    
                except Exception as e:
                    error_msg = str(e)
                    
                    if 'already exists' in error_msg.lower() or 'SECURITY FAILURE' in error_msg:
                        try:
                            # Role exists - need to fix security
                            if 'SECURITY FAILURE' in error_msg:
                                # Revoke public schema access
                                await admin_conn.execute(f"REVOKE ALL ON SCHEMA public FROM {role_name}")
                                await admin_conn.execute(f"REVOKE ALL ON SCHEMA auth FROM {role_name}")
                                project_result["security_fixed"] = True
                            
                            creds = await credential_store.get_credentials(project_id)
                            if creds:
                                project_result["status"] = "existed"
                                results["existed"] += 1
                            else:
                                new_password = ProjectRoleManager.generate_secure_password()
                                
                                await admin_conn.execute(f"""
                                    ALTER ROLE {role_name} 
                                    PASSWORD '{new_password.replace("'", "''")}'
                                """)
                                
                                await credential_store.store_credentials(
                                    project_id, role_name, new_password
                                )
                                
                                project_result["status"] = "password_reset"
                                results["provisioned"] += 1
                                
                        except Exception as cred_error:
                            project_result["status"] = "failed"
                            project_result["error"] = str(cred_error)
                            results["failed"] += 1
                    else:
                        project_result["status"] = "failed"
                        project_result["error"] = error_msg
                        results["failed"] += 1
                
                results["projects"].append(project_result)
            
        finally:
            await admin_conn.close()
        
        if results["failed"] > 0:
            results["status"] = "partial_success"
            results["message"] = f"Provisioned {results['provisioned']}, existed {results['existed']}, failed {results['failed']}"
        else:
            results["status"] = "success"
            results["message"] = f"All {results['project_count']} projects provisioned successfully"
        
    except Exception as e:
        results["status"] = "error"
        results["message"] = str(e)
        raise HTTPException(status_code=500, detail=results)
    
    return results

@app.post("/admin/fix-all-privileges", include_in_schema=False)
async def admin_fix_all_privileges(x_admin_secret: str = Header(None, alias="X-Admin-Secret")):
    """
    Admin endpoint to grant ALL privileges to all project roles
    Registered BEFORE middleware to avoid project context requirement
    """
    from fastapi import HTTPException
    from app.core.database import get_main_db_pool
    
    # Verify admin access
    if not x_admin_secret or x_admin_secret != settings.SECRET_KEY:
        raise HTTPException(status_code=403, detail="Unauthorized")
    
    results = {
        "status": "starting",
        "projects": [],
        "fixed": 0,
        "already_ok": 0,
        "failed": 0
    }
    
    try:
        pool = await get_main_db_pool()
        
        async with pool.acquire() as conn:
            # Get all projects with credentials
            projects = await conn.fetch("""
                SELECT 
                    p.id,
                    p.name,
                    p.slug,
                    COALESCE(p.schema_name, p.database_name) as schema,
                    pdc.role_name
                FROM projects p
                JOIN project_db_credentials pdc ON pdc.project_id = p.id
                WHERE COALESCE(p.schema_name, p.database_name) LIKE 'proj_%'
                ORDER BY p.name
            """)
            
            results["total_projects"] = len(projects)
            
            for proj in projects:
                schema = proj['schema']
                role_name = proj['role_name']
                project_name = proj['name']
                
                project_result = {
                    "name": project_name,
                    "schema": schema,
                    "role": role_name,
                    "status": "pending"
                }
                
                try:
                    # Check current privileges
                    has_usage = await conn.fetchval(f"""
                        SELECT has_schema_privilege('{role_name}', '{schema}', 'USAGE')
                    """)
                    
                    has_create = await conn.fetchval(f"""
                        SELECT has_schema_privilege('{role_name}', '{schema}', 'CREATE')
                    """)
                    
                    if has_usage and has_create:
                        project_result["status"] = "already_ok"
                        project_result["message"] = "Already has correct privileges"
                        results["already_ok"] += 1
                        results["projects"].append(project_result)
                        continue
                    
                    # Grant all privileges
                    await conn.execute(f'GRANT USAGE, CREATE ON SCHEMA "{schema}" TO {role_name}')
                    await conn.execute(f'GRANT ALL PRIVILEGES ON ALL TABLES IN SCHEMA "{schema}" TO {role_name}')
                    await conn.execute(f'GRANT ALL PRIVILEGES ON ALL SEQUENCES IN SCHEMA "{schema}" TO {role_name}')
                    await conn.execute(f'GRANT ALL PRIVILEGES ON ALL FUNCTIONS IN SCHEMA "{schema}" TO {role_name}')
                    
                    # Set default privileges for future objects
                    current_user = await conn.fetchval("SELECT current_user")
                    
                    await conn.execute(f"""
                        ALTER DEFAULT PRIVILEGES FOR ROLE {current_user} IN SCHEMA "{schema}"
                        GRANT ALL PRIVILEGES ON TABLES TO {role_name}
                    """)
                    await conn.execute(f"""
                        ALTER DEFAULT PRIVILEGES FOR ROLE {current_user} IN SCHEMA "{schema}"
                        GRANT ALL PRIVILEGES ON SEQUENCES TO {role_name}
                    """)
                    await conn.execute(f"""
                        ALTER DEFAULT PRIVILEGES FOR ROLE {current_user} IN SCHEMA "{schema}"
                        GRANT ALL PRIVILEGES ON FUNCTIONS TO {role_name}
                    """)
                    
                    # Verify
                    has_create_after = await conn.fetchval(f"""
                        SELECT has_schema_privilege('{role_name}', '{schema}', 'CREATE')
                    """)
                    
                    if has_create_after:
                        project_result["status"] = "fixed"
                        project_result["message"] = "Privileges granted successfully"
                        results["fixed"] += 1
                    else:
                        project_result["status"] = "verification_failed"
                        project_result["message"] = "Privileges granted but verification failed"
                        results["failed"] += 1
                    
                except Exception as e:
                    project_result["status"] = "error"
                    project_result["error"] = str(e)
                    results["failed"] += 1
                
                results["projects"].append(project_result)
            
            # Set final status
            if results["failed"] > 0:
                results["status"] = "partial_success"
            else:
                results["status"] = "success"
            
            results["message"] = f"Fixed {results['fixed']}, already OK {results['already_ok']}, failed {results['failed']}"
            
    except Exception as e:
        results["status"] = "error"
        results["message"] = str(e)
        raise HTTPException(status_code=500, detail=results)
    
    return results

print("⚠️  Emergency migration endpoint registered BEFORE middleware: POST /emergency/apply-migration-003")
print("⚠️  Emergency provisioning endpoint registered BEFORE middleware: POST /emergency/provision-all-projects")
print("⚠️  Admin privilege fix endpoint registered BEFORE middleware: POST /admin/fix-all-privileges")
print("   Endpoint should be accessible without project context")

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
