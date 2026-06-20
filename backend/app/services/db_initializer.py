"""
Database Initialization Service
Automatically initializes database schema on startup if tables don't exist
"""

import asyncpg
from pathlib import Path
from typing import List, Dict
import os

class DatabaseInitializer:
    """Handles automatic database schema initialization"""
    
    def __init__(self, database_url: str):
        self.database_url = database_url
        self.schema_dir = Path(__file__).parent.parent.parent / "database"
        
    async def check_table_exists(self, conn: asyncpg.Connection, table_name: str) -> bool:
        """Check if a table exists in the database"""
        result = await conn.fetchval(
            """
            SELECT EXISTS (
                SELECT FROM information_schema.tables 
                WHERE table_schema = 'public' 
                AND table_name = $1
            )
            """,
            table_name
        )
        return result
    
    async def get_missing_tables(self, conn: asyncpg.Connection) -> List[str]:
        """Get list of required tables that don't exist"""
        required_tables = [
            'users',
            'projects',
            'user_tables',
            'query_history',
            'saved_queries',
            'api_keys',
            'file_uploads',
            'project_quotas',
            'password_reset_tokens',
            'oauth_providers',
            'oauth_connections',
            'login_attempts',
            'user_sessions',
            'audit_logs',
            'project_api_keys',
            'project_members',
            'subscription_plans',
            'user_subscriptions',
            'usage_records',
            'quota_overrides',
            'backup_schedules',
            'backup_history',
            'storage_buckets',
            'storage_objects',
        ]
        
        missing = []
        for table in required_tables:
            exists = await self.check_table_exists(conn, table)
            if not exists:
                missing.append(table)
        
        return missing
    
    async def execute_sql_file(self, conn: asyncpg.Connection, file_path: Path) -> Dict:
        """Execute SQL from a file"""
        try:
            with open(file_path, 'r', encoding='utf-8') as f:
                sql = f.read()
            
            # Remove CREATE DATABASE and \c commands (not needed, we're already connected)
            lines = sql.split('\n')
            filtered_lines = []
            for line in lines:
                line_stripped = line.strip()
                if not line_stripped.startswith('CREATE DATABASE') and not line_stripped.startswith('\\c'):
                    filtered_lines.append(line)
            
            sql = '\n'.join(filtered_lines)
            
            # Execute the SQL
            await conn.execute(sql)
            
            return {
                'status': 'success',
                'file': file_path.name,
                'message': f'Successfully executed {file_path.name}'
            }
        except Exception as e:
            return {
                'status': 'error',
                'file': file_path.name,
                'message': f'Error executing {file_path.name}: {str(e)}'
            }
    
    async def initialize_schema(self) -> Dict:
        """Initialize database schema if needed"""
        results = {
            'initialized': False,
            'missing_tables': [],
            'executed_files': [],
            'errors': []
        }
        
        try:
            # Connect to database
            conn = await asyncpg.connect(self.database_url)
            
            try:
                # Check for missing tables
                missing_tables = await self.get_missing_tables(conn)
                results['missing_tables'] = missing_tables
                
                if not missing_tables:
                    print("✅ All required tables exist")
                    return results
                
                print(f"⚠️  Missing tables detected: {', '.join(missing_tables)}")
                print(f"🔧 Initializing database schema...")
                
                # Execute safe initialization script (idempotent)
                init_scripts = [
                    'init_schema_safe.sql',
                    'add_api_keys_columns.sql'  # Add missing columns migration
                ]
                
                for script_name in init_scripts:
                    script_path = self.schema_dir / script_name
                    if script_path.exists():
                        print(f"   Executing {script_name}...")
                        result = await self.execute_sql_file(conn, script_path)
                        results['executed_files'].append(result)
                        
                        if result['status'] == 'error':
                            # Don't fail completely, some scripts might have dependencies
                            print(f"   ⚠️  {result['message']}")
                            results['errors'].append(result['message'])
                        else:
                            print(f"   ✅ {result['message']}")
                
                # Verify tables were created
                missing_after = await self.get_missing_tables(conn)
                
                if len(missing_after) < len(missing_tables):
                    results['initialized'] = True
                    print(f"✅ Database schema initialized successfully")
                    print(f"   Created {len(missing_tables) - len(missing_after)} tables")
                    
                    if missing_after:
                        print(f"   ⚠️  Still missing: {', '.join(missing_after)}")
                else:
                    print(f"❌ Schema initialization failed")
                    results['errors'].append("No tables were created")
                
            finally:
                await conn.close()
                
        except Exception as e:
            error_msg = f"Database initialization error: {str(e)}"
            print(f"❌ {error_msg}")
            results['errors'].append(error_msg)
        
        return results
    
    async def ensure_extensions(self) -> bool:
        """Ensure required PostgreSQL extensions are enabled"""
        try:
            conn = await asyncpg.connect(self.database_url)
            try:
                await conn.execute('CREATE EXTENSION IF NOT EXISTS "uuid-ossp"')
                await conn.execute('CREATE EXTENSION IF NOT EXISTS "pg_stat_statements"')
                print("✅ PostgreSQL extensions enabled")
                return True
            finally:
                await conn.close()
        except Exception as e:
            print(f"⚠️  Could not enable extensions: {str(e)}")
            return False
    
    async def validate_schema(self) -> Dict:
        """Validate that all required tables exist"""
        try:
            conn = await asyncpg.connect(self.database_url)
            try:
                missing_tables = await self.get_missing_tables(conn)
                
                if not missing_tables:
                    return {
                        'valid': True,
                        'message': 'All required tables exist',
                        'missing_tables': []
                    }
                else:
                    return {
                        'valid': False,
                        'message': f'Missing {len(missing_tables)} required tables',
                        'missing_tables': missing_tables
                    }
            finally:
                await conn.close()
        except Exception as e:
            return {
                'valid': False,
                'message': f'Validation error: {str(e)}',
                'missing_tables': []
            }


async def initialize_database_on_startup(database_url: str) -> bool:
    """
    Initialize database schema on application startup
    Returns True if database is ready, False otherwise
    """
    print("\n" + "="*60)
    print("DATABASE INITIALIZATION CHECK")
    print("="*60)
    
    initializer = DatabaseInitializer(database_url)
    
    # Step 1: Ensure extensions
    await initializer.ensure_extensions()
    
    # Step 2: Validate schema
    validation = await initializer.validate_schema()
    
    if validation['valid']:
        print("✅ Database schema is valid and ready")
        print("="*60 + "\n")
    else:
        # Step 3: Initialize schema if needed
        print(f"⚠️  {validation['message']}")
        print(f"   Missing tables: {', '.join(validation['missing_tables'][:5])}")
        if len(validation['missing_tables']) > 5:
            print(f"   ... and {len(validation['missing_tables']) - 5} more")
        
        print("\n🔧 Attempting automatic schema initialization...")
        
        results = await initializer.initialize_schema()
        
        if results['initialized']:
            print("✅ Database initialized successfully")
            print("="*60 + "\n")
        else:
            print("❌ Database initialization failed")
            if results['errors']:
                print("   Errors:")
                for error in results['errors'][:3]:
                    print(f"   - {error}")
            print("="*60 + "\n")

    # Step 4: Fix any projects missing JWT secrets (permanent fix for existing projects)
    await fix_projects_missing_jwt_secrets(database_url)

    # Step 5: Ensure storage columns exist on projects table (Neon migration fix)
    await ensure_storage_columns(database_url)

    return True


async def ensure_storage_columns(database_url: str):
    """
    Ensure storage_used and max_storage columns exist on projects table.
    Also ensures storage_buckets and storage_objects tables exist.
    Idempotent — safe to run on every startup.
    """
    try:
        conn = await asyncpg.connect(database_url)
        try:
            await conn.execute("""
                ALTER TABLE projects ADD COLUMN IF NOT EXISTS storage_used BIGINT DEFAULT 0;
                ALTER TABLE projects ADD COLUMN IF NOT EXISTS max_storage BIGINT DEFAULT 1073741824;
            """)

            await conn.execute("""
                CREATE TABLE IF NOT EXISTS storage_buckets (
                    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
                    project_id UUID NOT NULL REFERENCES projects(id) ON DELETE CASCADE,
                    name VARCHAR(255) NOT NULL,
                    slug VARCHAR(255) NOT NULL,
                    description TEXT,
                    is_public BOOLEAN DEFAULT FALSE,
                    storage_used BIGINT DEFAULT 0,
                    file_count INTEGER DEFAULT 0,
                    created_by UUID,
                    created_at TIMESTAMP DEFAULT NOW(),
                    updated_at TIMESTAMP DEFAULT NOW(),
                    deleted_at TIMESTAMP NULL,
                    UNIQUE(project_id, slug)
                );
                CREATE INDEX IF NOT EXISTS idx_storage_buckets_project_id ON storage_buckets(project_id);
                CREATE INDEX IF NOT EXISTS idx_storage_buckets_deleted_at ON storage_buckets(deleted_at);
                CREATE INDEX IF NOT EXISTS idx_storage_buckets_project_slug ON storage_buckets(project_id, slug) WHERE deleted_at IS NULL;
            """)

            await conn.execute("""
                CREATE TABLE IF NOT EXISTS storage_objects (
                    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
                    project_id UUID NOT NULL REFERENCES projects(id) ON DELETE CASCADE,
                    bucket_id UUID NOT NULL REFERENCES storage_buckets(id) ON DELETE CASCADE,
                    file_name TEXT,
                    original_name TEXT,
                    file_size BIGINT,
                    mime_type TEXT,
                    storage_key TEXT,
                    version INTEGER DEFAULT 1,
                    uploaded_by UUID,
                    download_count BIGINT DEFAULT 0,
                    last_downloaded_at TIMESTAMP NULL,
                    created_at TIMESTAMP DEFAULT NOW(),
                    updated_at TIMESTAMP DEFAULT NOW(),
                    deleted_at TIMESTAMP NULL
                );
                CREATE INDEX IF NOT EXISTS idx_storage_objects_bucket_id   ON storage_objects(bucket_id);
                CREATE INDEX IF NOT EXISTS idx_storage_objects_project_id  ON storage_objects(project_id);
                CREATE INDEX IF NOT EXISTS idx_storage_objects_storage_key ON storage_objects(storage_key);
            """)

            print("✅ Storage schema ensured (columns + tables)")
        finally:
            await conn.close()
    except Exception as e:
        print(f"⚠️  Could not ensure storage schema: {str(e)}")


async def fix_projects_missing_jwt_secrets(database_url: str):
    """
    Fix any existing projects that are missing JWT secrets or API keys.
    Also regenerates anon/service_role keys as real JWTs signed with jwt_secret.
    This runs on every startup and is idempotent.
    """
    import secrets as secrets_module
    import hashlib
    import jwt as pyjwt
    import time

    try:
        conn = await asyncpg.connect(database_url)
        try:
            # Step 1: Ensure every project has a jwt_secret
            projects_fixed = await conn.execute("""
                UPDATE projects
                SET jwt_secret = md5(random()::text) || md5(random()::text),
                    updated_at = NOW()
                WHERE jwt_secret IS NULL OR jwt_secret = ''
            """)
            if projects_fixed != "UPDATE 0":
                print(f"✅ Fixed JWT secrets: {projects_fixed}")

            # Step 2: Get ALL projects with their jwt_secret
            all_projects = await conn.fetch("""
                SELECT p.id, p.user_id, p.jwt_secret
                FROM projects p
                WHERE p.jwt_secret IS NOT NULL AND p.jwt_secret != ''
            """)

            for project in all_projects:
                project_id = project['id']
                user_id = project['user_id']
                jwt_secret = project['jwt_secret']

                # Check if this project has valid anon/service_role keys
                # A key is valid if it can be decoded with the current jwt_secret
                existing_keys = await conn.fetch("""
                    SELECT id, encrypted_key, key_type
                    FROM api_keys
                    WHERE project_id = $1 AND is_active = true
                    AND key_type IN ('anon', 'service_role')
                """, project_id)

                has_valid_anon = False
                has_valid_service = False

                for key in existing_keys:
                    enc = key['encrypted_key'] or ''
                    try:
                        payload = pyjwt.decode(enc, jwt_secret, algorithms=["HS256"])
                        if key['key_type'] == 'anon' and payload.get('role') == 'anon':
                            has_valid_anon = True
                        if key['key_type'] == 'service_role' and payload.get('role') == 'service_role':
                            has_valid_service = True
                    except Exception:
                        pass  # key doesn't match current jwt_secret

                if has_valid_anon and has_valid_service:
                    continue  # keys are fine

                # Deactivate stale keys
                await conn.execute("""
                    UPDATE api_keys SET is_active = false
                    WHERE project_id = $1 AND key_type IN ('anon', 'service_role')
                """, project_id)

                # Generate real JWTs signed with the project's jwt_secret
                now = int(time.time())
                anon_payload = {
                    "iss": "zendbx",
                    "project_id": str(project_id),
                    "role": "anon",
                    "iat": now,
                }
                service_payload = {
                    "iss": "zendbx",
                    "project_id": str(project_id),
                    "role": "service_role",
                    "iat": now,
                }

                anon_key = pyjwt.encode(anon_payload, jwt_secret, algorithm="HS256")
                service_key = pyjwt.encode(service_payload, jwt_secret, algorithm="HS256")

                anon_hash = hashlib.sha256(anon_key.encode()).hexdigest()
                service_hash = hashlib.sha256(service_key.encode()).hexdigest()

                await conn.execute("""
                    INSERT INTO api_keys
                        (user_id, project_id, name, key_hash, key_prefix, encrypted_key, role, key_type, is_active)
                    VALUES
                        ($1, $2, 'anon (public)',         $3, $4, $5, 'read',  'anon',         true),
                        ($1, $2, 'service_role (secret)', $6, $7, $8, 'admin', 'service_role', true)
                    ON CONFLICT DO NOTHING
                """,
                    user_id, project_id,
                    anon_hash,    anon_key[:20] + '...',    anon_key,
                    service_hash, service_key[:20] + '...', service_key,
                )
                print(f"✅ Regenerated JWT API keys for project {project_id}")

        finally:
            await conn.close()

    except Exception as e:
        print(f"⚠️  Could not fix project secrets: {str(e)}")
