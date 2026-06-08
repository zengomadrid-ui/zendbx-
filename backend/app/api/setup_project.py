"""
Temporary Setup Endpoint - Create Project Database and Keys
This is a one-time setup endpoint to initialize a project without direct database access
"""
from fastapi import APIRouter, HTTPException
from pydantic import BaseModel
from uuid import UUID
import asyncpg
import logging

logger = logging.getLogger(__name__)

router = APIRouter()


class ProjectSetupRequest(BaseModel):
    project_id: str
    setup_secret: str  # Simple password protection


@router.post("/api/admin/setup-project")
async def setup_project(request: ProjectSetupRequest):
    """
    One-time setup endpoint to:
    1. Create project database
    2. Set up users table
    3. Generate API keys
    
    SECURITY: This should be removed after initial setup!
    """
    # Simple password protection (replace with your own secret)
    SETUP_SECRET = "zendbx_setup_2024"  # Change this!
    
    if request.setup_secret != SETUP_SECRET:
        raise HTTPException(status_code=403, detail="Invalid setup secret")
    
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
            
            # Create users table
            await project_conn.execute("""
                CREATE TABLE IF NOT EXISTS users (
                    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
                    email VARCHAR(255) UNIQUE NOT NULL,
                    name VARCHAR(255),
                    provider VARCHAR(50) DEFAULT 'email',
                    avatar_url TEXT,
                    is_active BOOLEAN DEFAULT TRUE,
                    metadata JSONB DEFAULT '{}',
                    created_at TIMESTAMPTZ DEFAULT NOW(),
                    updated_at TIMESTAMPTZ DEFAULT NOW(),
                    last_login_at TIMESTAMPTZ
                )
            """)
            
            await project_conn.execute(
                'CREATE INDEX IF NOT EXISTS idx_users_email ON users(email)'
            )
            
            results["steps"].append("✅ Users table created")
            
            await project_conn.close()
            
        except Exception as e:
            logger.error(f"Schema setup error: {str(e)}")
            results["steps"].append(f"⚠️  Schema setup: {str(e)}")
        
        # Step 4: Generate API keys
        async with main_pool.acquire() as conn:
            # Check if keys already exist
            existing_keys = await conn.fetch("""
                SELECT key_type, encrypted_key 
                FROM api_keys 
                WHERE project_id = $1 AND is_active = true
            """, project_id)
            
            if existing_keys:
                results["steps"].append(f"ℹ️  API keys already exist ({len(existing_keys)} keys)")
                results["keys"] = {
                    key['key_type']: key['encrypted_key'] 
                    for key in existing_keys
                }
            else:
                # Generate new keys
                import secrets
                import base64
                
                # Generate anon key
                anon_key = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.' + base64.b64encode(secrets.token_bytes(32)).decode()
                anon_hash = hashlib.sha256(anon_key.encode()).hexdigest()
                
                # Generate service_role key
                service_key = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.' + base64.b64encode(secrets.token_bytes(32)).decode()
                service_hash = hashlib.sha256(service_key.encode()).hexdigest()
                
                # Insert anon key
                await conn.execute("""
                    INSERT INTO api_keys (user_id, project_id, name, key_hash, key_prefix, encrypted_key, role, key_type, is_active)
                    VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9)
                """, 
                    project['user_id'], 
                    project_id, 
                    'anon (public)', 
                    anon_hash, 
                    anon_key[:20] + '...', 
                    anon_key, 
                    'read', 
                    'anon', 
                    True
                )
                
                # Insert service_role key
                await conn.execute("""
                    INSERT INTO api_keys (user_id, project_id, name, key_hash, key_prefix, encrypted_key, role, key_type, is_active)
                    VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9)
                """, 
                    project['user_id'], 
                    project_id, 
                    'service_role (secret)', 
                    service_hash, 
                    service_key[:20] + '...', 
                    service_key, 
                    'admin', 
                    'service_role', 
                    True
                )
                
                results["steps"].append("✅ API keys generated")
                results["keys"] = {
                    "anon": anon_key,
                    "service_role": service_key
                }
        
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
