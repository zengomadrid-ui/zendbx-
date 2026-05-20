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
            'backup_history'
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
                    'init_schema_safe.sql'
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
        return True
    
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
        return True
    else:
        print("❌ Database initialization failed")
        if results['errors']:
            print("   Errors:")
            for error in results['errors'][:3]:
                print(f"   - {error}")
        print("\n⚠️  Manual initialization required:")
        print("   Run: psql $DATABASE_URL -f backend/database/init_main_database.sql")
        print("="*60 + "\n")
        return False
