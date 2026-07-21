"""
Temporary Setup Endpoint - Create Project Database and Keys
This is a one-time setup endpoint to initialize a project without direct database access

SECURITY: This endpoint is protected by admin JWT authentication.
Remove from production once initial setup is complete.
"""
from fastapi import APIRouter, HTTPException, Depends
from pydantic import BaseModel
from uuid import UUID
import asyncpg
import logging
import os

from app.core.rbac import require_admin

logger = logging.getLogger(__name__)

router = APIRouter()


class ProjectSetupRequest(BaseModel):
    project_id: str
    force_regenerate: bool = False


@router.post("/api/admin/setup-project")
async def setup_project(
    request: ProjectSetupRequest,
    _current_user: dict = Depends(require_admin),   # ← CRITICAL-3 fix: admin JWT required
):
    
    try:
        project_id = UUID(request.project_id)
    except ValueError:
        raise HTTPException(status_code=400, detail="Invalid project ID format")
    
    from ..core.db_router import get_main_db_pool
    from ..core.config import settings
    
    results = {
        "project_id": str(project_id),
        "steps": []
    }
    
    try:
        # Get main database pool
        main_pool = await get_main_db_pool()
        
        # Step 1: Get project details
        async with main_pool.acquire() as conn:
            project = await conn.fetchrow("""
                SELECT 
                    p.id,
                    p.name,
                    p.slug,
                    p.database_name,
                    p.user_id
                FROM projects p
                WHERE p.id = $1
            """, project_id)
            
            if not project:
                raise HTTPException(status_code=404, detail="Project not found")
            
            results["project_name"] = project['name']
            results["database_name"] = project['database_name']
            results["steps"].append("✅ Project found in main database")
        
        # Step 2: Create project database
        db_name = project['database_name']
        
        # Parse DATABASE_URL to get connection params
        import re
        match = re.match(r'postgresql://([^:]+):([^@]+)@([^:/]+)(?::(\d+))?/(.+)', settings.DATABASE_URL)
        if not match:
            raise ValueError("Invalid DATABASE_URL format")
        
        db_user, db_password, db_host, db_port, _ = match.groups()
        db_port = db_port or "5432"
        
        # Connect to postgres database to create new database
        try:
            postgres_conn = await asyncpg.connect(
                host=db_host,
                port=int(db_port),
                database='postgres',  # Connect to postgres to create new DB
                user=db_user,
                password=db_password,
                timeout=30
            )
            
            # Check if database exists
            exists = await postgres_conn.fetchval(
                "SELECT 1 FROM pg_database WHERE datname = $1",
                db_name
            )
            
            if exists:
                results["steps"].append(f"ℹ️  Database '{db_name}' already exists")
            else:
                # Create database (can't use parameters for database name)
                await postgres_conn.execute(f'CREATE DATABASE "{db_name}"')
                results["steps"].append(f"✅ Database '{db_name}' created")
            
            await postgres_conn.close()
            
        except Exception as e:
            logger.error(f"Database creation error: {str(e)}")
            results["steps"].append(f"⚠️  Database creation: {str(e)}")
        
        # Step 3: Set up project database schema
        try:
            project_conn = await asyncpg.connect(
                host=db_host,
                port=int(db_port),
                database=db_name,
                user=db_user,
                password=db_password,
                timeout=30
            )
            
            # Enable extensions
            await project_conn.execute('CREATE EXTENSION IF NOT EXISTS "uuid-ossp"')
            await project_conn.execute('CREATE EXTENSION IF NOT EXISTS "pgcrypto"')
            results["steps"].append("✅ PostgreSQL extensions enabled")
            
            # Create auth schema (Phase 1)
            await project_conn.execute('CREATE SCHEMA IF NOT EXISTS auth')
            results["steps"].append("✅ Auth schema created")
            
            # Create auth.users table (Phase 1 Foundation)
            await project_conn.execute("""
                CREATE TABLE IF NOT EXISTS auth.users (
                    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
                    email TEXT NOT NULL,
                    username TEXT,
                    password_hash TEXT NOT NULL DEFAULT '',
                    provider TEXT NOT NULL DEFAULT 'email',
                    email_verified BOOLEAN DEFAULT FALSE,
                    is_active BOOLEAN DEFAULT TRUE,
                    avatar_url TEXT,
                    metadata JSONB DEFAULT '{}'::jsonb,
                    last_login_at TIMESTAMPTZ,
                    created_at TIMESTAMPTZ DEFAULT NOW(),
                    updated_at TIMESTAMPTZ DEFAULT NOW(),
                    CONSTRAINT auth_users_email_unique UNIQUE (email),
                    CONSTRAINT auth_users_username_unique UNIQUE (username)
                )
            """)
            
            await project_conn.execute(
                'CREATE INDEX IF NOT EXISTS idx_auth_users_email_lower ON auth.users (LOWER(email))'
            )
            await project_conn.execute(
                'CREATE INDEX IF NOT EXISTS idx_auth_users_username_lower ON auth.users (LOWER(username)) WHERE username IS NOT NULL'
            )
            await project_conn.execute(
                'CREATE INDEX IF NOT EXISTS idx_auth_users_provider ON auth.users (provider)'
            )
            await project_conn.execute(
                'CREATE INDEX IF NOT EXISTS idx_auth_users_is_active ON auth.users (is_active)'
            )
            await project_conn.execute(
                'CREATE INDEX IF NOT EXISTS idx_auth_users_created_at ON auth.users (created_at DESC)'
            )
            
            results["steps"].append("✅ auth.users table created (Phase 1)")
            
            # Create public.users view for application queries
            await project_conn.execute("""
                CREATE OR REPLACE VIEW public.users AS
                SELECT
                    id,
                    email,
                    username,
                    provider,
                    avatar_url,
                    is_active,
                    email_verified,
                    metadata,
                    created_at,
                    updated_at,
                    last_login_at
                FROM auth.users;
            """)
            
            results["steps"].append("✅ public.users view created (Phase 2)")
            
            await project_conn.close()
            
        except Exception as e:
            logger.error(f"Schema setup error: {str(e)}")
            results["steps"].append(f"⚠️  Schema setup: {str(e)}")
        
        # Step 4: Generate API keys and JWT secret
        async with main_pool.acquire() as conn:
            # Check if JWT secret exists
            jwt_secret_val = await conn.fetchval("""
                SELECT jwt_secret FROM projects WHERE id = $1
            """, project_id)
            
            if not jwt_secret_val:
                jwt_secret_val = secrets.token_urlsafe(32)
                await conn.execute("""
                    UPDATE projects SET jwt_secret = $1, updated_at = NOW() WHERE id = $2
                """, jwt_secret_val, project_id)
                results["steps"].append("✅ JWT secret generated and saved")
            else:
                results["steps"].append("ℹ️  JWT secret already exists")
            
            results["jwt_secret"] = jwt_secret_val
            
            # Check if keys already exist
            existing_keys = await conn.fetch("""
                SELECT key_type, encrypted_key 
                FROM api_keys 
                WHERE project_id = $1 AND is_active = true
            """, project_id)
            
            if existing_keys and not request.force_regenerate:
                results["steps"].append(f"ℹ️  API keys already exist ({len(existing_keys)} keys)")
                results["keys"] = {
                    key['key_type']: key['encrypted_key'] 
                    for key in existing_keys
                }
            else:
                if existing_keys:
                    await conn.execute(
                        "UPDATE api_keys SET is_active = false WHERE project_id = $1",
                        project_id
                    )
                    results["steps"].append("🔄 Old keys deactivated, regenerating...")

                import jwt as pyjwt
                from datetime import datetime
                
                now_ts = int(datetime.utcnow().timestamp())
                slug = project['slug'] or ''
                anon_payload = {"iss": "zendbx", "project_id": str(project_id), "project_slug": slug, "role": "anon", "iat": now_ts}
                service_payload = {"iss": "zendbx", "project_id": str(project_id), "project_slug": slug, "role": "service_role", "iat": now_ts}
                
                anon_key = pyjwt.encode(anon_payload, jwt_secret_val, algorithm="HS256")
                service_key = pyjwt.encode(service_payload, jwt_secret_val, algorithm="HS256")
                
                import hashlib
                anon_hash = hashlib.sha256(anon_key.encode()).hexdigest()
                service_hash = hashlib.sha256(service_key.encode()).hexdigest()
                
                await conn.execute("""
                    INSERT INTO api_keys (user_id, project_id, name, key_hash, key_prefix, encrypted_key, role, key_type, is_active)
                    VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9)
                """, project['user_id'], project_id, 'anon (public)', anon_hash, anon_key[:17] + '...', anon_key, 'read', 'anon', True)
                
                await conn.execute("""
                    INSERT INTO api_keys (user_id, project_id, name, key_hash, key_prefix, encrypted_key, role, key_type, is_active)
                    VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9)
                """, project['user_id'], project_id, 'service_role (secret)', service_hash, service_key[:17] + '...', service_key, 'admin', 'service_role', True)
                
                results["steps"].append("✅ JWT-signed API keys generated")
                results["keys"] = {"anon": anon_key, "service_role": service_key}
        
        results["status"] = "success"
        results["message"] = "Project setup completed successfully!"
        
        return results
        
    except Exception as e:
        logger.error(f"Setup failed: {str(e)}")
        raise HTTPException(
            status_code=500,
            detail=f"Setup failed: {str(e)}"
        )


import hashlib
import secrets


@router.post("/api/admin/add-jwt-secret")
async def add_jwt_secret(
    request: ProjectSetupRequest,
    _current_user: dict = Depends(require_admin),   # ← CRITICAL-3 fix: admin JWT required
):
    """
    Add JWT secret to project if missing
    """
    
    try:
        project_id = UUID(request.project_id)
    except ValueError:
        raise HTTPException(status_code=400, detail="Invalid project ID format")
    
    from ..core.db_router import get_main_db_pool
    
    try:
        main_pool = await get_main_db_pool()
        
        async with main_pool.acquire() as conn:
            # Check current jwt_secret
            project = await conn.fetchrow("""
                SELECT id, name, jwt_secret
                FROM projects
                WHERE id = $1
            """, project_id)
            
            if not project:
                raise HTTPException(status_code=404, detail="Project not found")
            
            if project['jwt_secret']:
                return {
                    "status": "already_exists",
                    "message": "JWT secret already configured",
                    "project_id": str(project_id),
                    "project_name": project['name']
                }
            
            # Generate JWT secret (32 bytes = 256 bits)
            jwt_secret = secrets.token_urlsafe(32)
            
            # Update project with JWT secret
            await conn.execute("""
                UPDATE projects
                SET jwt_secret = $1, updated_at = NOW()
                WHERE id = $2
            """, jwt_secret, project_id)
            
            return {
                "status": "success",
                "message": "JWT secret added successfully",
                "project_id": str(project_id),
                "project_name": project['name'],
                "jwt_secret": jwt_secret
            }
            
    except Exception as e:
        logger.error(f"Failed to add JWT secret: {str(e)}")
        raise HTTPException(status_code=500, detail=f"Failed: {str(e)}")
