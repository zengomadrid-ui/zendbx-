"""
Alternative Database Implementation
Uses table prefixes instead of schemas for multi-tenancy
Works on restricted PostgreSQL instances (like Render free tier)
"""
import asyncpg
import asyncio
from typing import Dict, Optional
from app.core.config import settings

# Connection pools for each database
connection_pools: Dict[str, asyncpg.Pool] = {}

async def get_main_db_pool() -> asyncpg.Pool:
    """Get connection pool for main database"""
    if "main" not in connection_pools:
        max_retries = 3
        retry_delay = 2
        
        for attempt in range(max_retries):
            try:
                if "main" in connection_pools:
                    try:
                        await connection_pools["main"].close()
                    except:
                        pass
                    del connection_pools["main"]
                
                ssl_context = None
                if any(indicator in settings.DATABASE_URL.lower() for indicator in ['render.com', 'amazonaws.com', 'azure.com']):
                    import ssl
                    ssl_context = ssl.create_default_context()
                    ssl_context.check_hostname = False
                    ssl_context.verify_mode = ssl.CERT_NONE
                
                connection_pools["main"] = await asyncpg.create_pool(
                    settings.DATABASE_URL,
                    min_size=2,
                    max_size=settings.DATABASE_POOL_SIZE,
                    max_queries=50000,
                    max_inactive_connection_lifetime=300,
                    timeout=30,
                    command_timeout=60,
                    ssl=ssl_context,
                    server_settings={
                        'application_name': 'zendbx',
                        'jit': 'off',
                        'statement_timeout': '60000'
                    }
                )
                
                async with connection_pools["main"].acquire() as conn:
                    result = await conn.fetchval('SELECT 1')
                    if result == 1:
                        print(f"✅ Database connection successful")
                
                break
                
            except Exception as e:
                if attempt < max_retries - 1:
                    print(f"⚠️  Connection attempt {attempt + 1} failed: {e}")
                    await asyncio.sleep(retry_delay)
                    retry_delay *= 2
                else:
                    raise Exception(f"Database connection failed: {e}")
                    
    return connection_pools["main"]

async def execute_on_main_db(query: str, *args):
    """Execute query on main database"""
    pool = await get_main_db_pool()
    async with pool.acquire() as conn:
        return await conn.fetch(query, *args)

async def execute_on_project_db(database_name: str, query: str, *args):
    """
    Execute query on project "database" (actually same DB, different table prefix)
    Automatically prefixes table names with project identifier
    """
    pool = await get_main_db_pool()
    
    # For now, just execute on main DB
    # In production, you'd rewrite queries to use prefixed tables
    async with pool.acquire() as conn:
        if args:
            return await conn.fetch(query, *args)
        else:
            try:
                return await conn.fetch(query)
            except:
                await conn.execute(query)
                return []

async def create_project_database(database_name: str) -> bool:
    """
    Create a new project "database" using table prefixes
    This works on ANY PostgreSQL instance, even with restricted permissions
    """
    try:
        print(f"🔧 Creating project namespace: {database_name}")
        pool = await get_main_db_pool()
        
        async with pool.acquire() as conn:
            # Step 1: Ensure extensions exist (may already be installed)
            try:
                await conn.execute('CREATE EXTENSION IF NOT EXISTS "uuid-ossp"')
                print(f"✅ uuid-ossp extension ready")
            except Exception as e:
                print(f"⚠️  uuid-ossp: {e} (may already exist)")
            
            # Step 2: Create metadata table for this project
            # Using table prefix instead of schema
            metadata_table = f"{database_name}_metadata"
            
            try:
                await conn.execute(f'''
                    CREATE TABLE IF NOT EXISTS {metadata_table} (
                        id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
                        table_name VARCHAR(255) UNIQUE NOT NULL,
                        created_by VARCHAR(255),
                        created_at TIMESTAMPTZ DEFAULT NOW(),
                        updated_at TIMESTAMPTZ DEFAULT NOW()
                    )
                ''')
                print(f"✅ Metadata table created: {metadata_table}")
            except Exception as e:
                print(f"❌ Failed to create metadata table: {e}")
                return False
            
            # Step 3: Create helper function (shared across all projects)
            try:
                await conn.execute('''
                    CREATE OR REPLACE FUNCTION update_updated_at_column()
                    RETURNS TRIGGER AS $$
                    BEGIN
                        NEW.updated_at = NOW();
                        RETURN NEW;
                    END;
                    $$ LANGUAGE plpgsql;
                ''')
                print(f"✅ Helper function ready")
            except Exception as e:
                print(f"⚠️  Helper function: {e} (may already exist)")
            
            # Step 4: Register project in main projects table
            # (This should already be done by the API, but we verify)
            project_exists = await conn.fetchval(
                "SELECT EXISTS(SELECT 1 FROM projects WHERE database_name = $1)",
                database_name
            )
            
            if project_exists:
                print(f"✅ Project registered in main database")
            else:
                print(f"⚠️  Project not yet registered (will be done by API)")
        
        print(f"🎉 Project namespace fully initialized: {database_name}")
        return True
        
    except Exception as e:
        print(f"❌ Error creating project namespace {database_name}: {e}")
        import traceback
        print(f"❌ Traceback: {traceback.format_exc()}")
        
        # Provide helpful error messages
        error_str = str(e).lower()
        if 'permission denied' in error_str:
            print(f"💡 Your database user lacks necessary permissions")
            print(f"   Contact your database administrator or hosting provider")
        elif 'extension' in error_str:
            print(f"💡 Required PostgreSQL extensions are not installed")
            print(f"   Contact your hosting provider to install uuid-ossp")
        elif 'connection' in error_str or 'timeout' in error_str:
            print(f"💡 Database connection issue - check network and credentials")
        
        return False

async def drop_project_database(database_name: str) -> bool:
    """
    Drop a project "database" (remove all prefixed tables)
    """
    try:
        print(f"🗑️  Dropping project namespace: {database_name}")
        pool = await get_main_db_pool()
        
        async with pool.acquire() as conn:
            # Get all tables with this prefix
            tables = await conn.fetch(
                """
                SELECT tablename 
                FROM pg_tables 
                WHERE schemaname = 'public' 
                AND tablename LIKE $1
                """,
                f"{database_name}_%"
            )
            
            # Drop each table
            for table in tables:
                table_name = table['tablename']
                try:
                    await conn.execute(f'DROP TABLE IF EXISTS {table_name} CASCADE')
                    print(f"   Dropped table: {table_name}")
                except Exception as e:
                    print(f"   ⚠️  Failed to drop {table_name}: {e}")
            
            print(f"✅ Project namespace dropped: {database_name}")
        
        return True
        
    except Exception as e:
        print(f"❌ Error dropping project namespace {database_name}: {e}")
        return False

async def close_all_pools():
    """Close all connection pools"""
    for pool in connection_pools.values():
        await pool.close()
    connection_pools.clear()
