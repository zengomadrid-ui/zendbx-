import asyncpg
import asyncio
from typing import Dict, Optional
from app.core.config import settings

# Connection pools for each database
connection_pools: Dict[str, asyncpg.Pool] = {}

async def get_main_db_pool() -> asyncpg.Pool:
    """
    Get connection pool for main database
    Supports both local development and cloud PostgreSQL (Render, AWS RDS, etc.)
    """
    if "main" not in connection_pools:
        max_retries = 3
        retry_delay = 2
        
        # Extract database host for logging (sanitized)
        try:
            from urllib.parse import urlparse
            parsed = urlparse(settings.DATABASE_URL)
            db_host = parsed.hostname or "unknown"
            db_name = parsed.path.lstrip('/') or "unknown"
            print(f"🔌 Connecting to PostgreSQL: {db_host}/{db_name}")
        except:
            db_host = "unknown"
            print(f"🔌 Connecting to PostgreSQL...")
        
        for attempt in range(max_retries):
            try:
                # Clear any existing failed pool
                if "main" in connection_pools:
                    try:
                        await connection_pools["main"].close()
                    except:
                        pass
                    del connection_pools["main"]
                
                # Determine if we need SSL (cloud databases usually require it)
                ssl_context = None
                if any(indicator in settings.DATABASE_URL.lower() for indicator in ['render.com', 'amazonaws.com', 'azure.com', 'digitalocean.com']):
                    import ssl
                    ssl_context = ssl.create_default_context()
                    ssl_context.check_hostname = False
                    ssl_context.verify_mode = ssl.CERT_NONE
                    print(f"🔒 SSL enabled for cloud database")
                
                # Create connection pool
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
                
                # Test the pool with a simple query
                async with connection_pools["main"].acquire() as conn:
                    result = await conn.fetchval('SELECT 1')
                    if result == 1:
                        print(f"✅ Database connection successful (attempt {attempt + 1})")
                    else:
                        raise Exception("Database test query failed")
                
                break
                
            except Exception as e:
                error_msg = str(e)
                if attempt < max_retries - 1:
                    print(f"⚠️  Connection attempt {attempt + 1} failed: {error_msg}")
                    print(f"   Retrying in {retry_delay}s...")
                    await asyncio.sleep(retry_delay)
                    retry_delay *= 2
                else:
                    print(f"\n❌ Failed to connect to database after {max_retries} attempts")
                    print(f"   Error: {error_msg}")
                    print(f"   Database Host: {db_host}")
                    print(f"\n🔧 Troubleshooting:")
                    print(f"   1. Verify DATABASE_URL environment variable is set correctly")
                    print(f"   2. Check database server is running and accessible")
                    print(f"   3. Verify network connectivity and firewall rules")
                    print(f"   4. Check database credentials are correct")
                    
                    # Don't print Windows-specific instructions in production
                    if settings.ENVIRONMENT != "production":
                        print(f"   5. For local development: Ensure PostgreSQL service is running")
                    
                    raise Exception(f"Database connection failed: {error_msg}")
                    
    return connection_pools["main"]

async def get_project_db_pool(database_name: str) -> asyncpg.Pool:
    """
    Get connection pool for a project schema
    Since we use schemas (not separate databases), we return the main pool
    and set the search_path when executing queries
    """
    # We use schemas, not separate databases, so just return the main pool
    # The search_path will be set in execute_on_project_db
    return await get_main_db_pool()

async def execute_on_main_db(query: str, *args):
    """Execute query on main database"""
    pool = await get_main_db_pool()
    async with pool.acquire() as conn:
        return await conn.fetch(query, *args)

async def execute_on_project_db(database_name: str, query: str, *args, rls_user_id: str = None, rls_role: str = None):
    """
    Execute query on project database - properly handles PostgreSQL functions and dollar-quoted strings
    
    CRITICAL: Does NOT split queries incorrectly
    - Preserves $$ ... $$ blocks
    - Preserves function definitions
    - Only splits on semicolons OUTSIDE of quoted strings and function bodies
    """
    from app.middleware.rls_context import set_rls_context as _set_rls_ctx

    async def _inject_rls(conn):
        """Inject RLS session variables if context provided."""
        if rls_user_id is not None or rls_role is not None:
            await _set_rls_ctx(conn, user_id=rls_user_id, role=rls_role or 'anon')

    pool = await get_project_db_pool(database_name)

    # If there are parameters, this must be a single parameterized statement
    if args:
        async with pool.acquire() as conn:
            # Set search_path to the project schema
            await conn.execute(f'SET search_path TO "{database_name}", public')
            await _inject_rls(conn)
            return await conn.fetch(query, *args)
    
    # For queries without parameters, we need to handle multi-statement execution
    # But we must be VERY careful not to split inside function definitions
    
    # Check if this looks like a single statement (no splitting needed)
    query_stripped = query.strip()
    
    # If query doesn't contain semicolons, or only has one at the end, execute as-is
    semicolon_count = query_stripped.count(';')
    if semicolon_count == 0 or (semicolon_count == 1 and query_stripped.endswith(';')):
        async with pool.acquire() as conn:
            # Set search_path to the project schema
            await conn.execute(f'SET search_path TO "{database_name}", public')
            await _inject_rls(conn)
            try:
                result = await conn.fetch(query)
                return result
            except:
                # If fetch fails, try execute (for DDL statements)
                await conn.execute(query)
                return []
    
    # For multi-statement queries, use a smarter splitting approach
    # that respects dollar-quoted strings and function bodies
    statements = smart_split_sql(query)
    
    if len(statements) == 0:
        return []
    
    if len(statements) == 1:
        # Single statement after smart split
        async with pool.acquire() as conn:
            # Set search_path to the project schema
            await conn.execute(f'SET search_path TO "{database_name}", public')
            await _inject_rls(conn)
            try:
                return await conn.fetch(statements[0])
            except:
                await conn.execute(statements[0])
                return []
    
    # Multiple statements - execute each with logging
    logs = []
    last_result = []
    import time
    
    for idx, stmt in enumerate(statements, 1):
        start = time.time()
        async with pool.acquire() as conn:
            # CRITICAL: Set search_path for EACH statement in multi-statement queries
            await conn.execute(f'SET search_path TO "{database_name}", public')
            await _inject_rls(conn)
            
            try:
                result = await conn.fetch(stmt)
                exec_time = int((time.time() - start) * 1000)
                
                logs.append({
                    'statement': stmt[:100] + ('...' if len(stmt) > 100 else ''),
                    'status': 'success',
                    'message': f'Statement {idx}/{len(statements)} executed successfully. {len(result)} rows returned.',
                    'rows_affected': len(result),
                    'execution_time_ms': exec_time
                })
                
                if result:
                    last_result = result
                    
            except Exception as fetch_error:
                try:
                    status = await conn.execute(stmt)
                    exec_time = int((time.time() - start) * 1000)
                    
                    rows_affected = 0
                    if status.startswith('INSERT'):
                        parts = status.split()
                        if len(parts) >= 3:
                            rows_affected = int(parts[2])
                    elif status.startswith('UPDATE') or status.startswith('DELETE'):
                        parts = status.split()
                        if len(parts) >= 2:
                            rows_affected = int(parts[1])
                    
                    logs.append({
                        'statement': stmt[:100] + ('...' if len(stmt) > 100 else ''),
                        'status': 'success',
                        'message': f'Statement {idx}/{len(statements)} executed: {status}',
                        'rows_affected': rows_affected,
                        'execution_time_ms': exec_time
                    })
                    
                except Exception as exec_error:
                    exec_time = int((time.time() - start) * 1000)
                    error_msg = str(exec_error)
                    
                    logs.append({
                        'statement': stmt[:100] + ('...' if len(stmt) > 100 else ''),
                        'status': 'error',
                        'message': f'Statement {idx}/{len(statements)} failed: {error_msg}',
                        'execution_time_ms': exec_time
                    })
                    
                    raise Exception(f"Execution stopped at statement {idx}/{len(statements)}: {error_msg}")
    
    return {'result': last_result, 'logs': logs}


def smart_split_sql(query: str) -> list:
    """
    Smart SQL splitter that respects:
    - Dollar-quoted strings ($$ ... $$, $tag$ ... $tag$)
    - Single-quoted strings ('...')
    - Multi-line comments (/* ... */)
    - Single-line comments (--)
    - Function definitions
    
    Only splits on semicolons that are NOT inside quoted strings or comments.
    """
    statements = []
    current_statement = []
    
    i = 0
    length = len(query)
    
    while i < length:
        char = query[i]
        
        # Check for multi-line comment /* ... */
        if char == '/' and i + 1 < length and query[i + 1] == '*':
            # Start of multi-line comment
            current_statement.append('/')
            current_statement.append('*')
            i += 2
            
            # Find closing */
            while i < length:
                if query[i] == '*' and i + 1 < length and query[i + 1] == '/':
                    # Found closing */
                    current_statement.append('*')
                    current_statement.append('/')
                    i += 2
                    break
                else:
                    current_statement.append(query[i])
                    i += 1
            continue
        
        # Check for dollar-quoted string
        elif char == '$':
            # Find the tag (e.g., $$ or $func$ or $body$)
            tag_end = i + 1
            while tag_end < length and query[tag_end] != '$':
                tag_end += 1
            
            if tag_end < length:
                # Found closing $ of tag
                tag = query[i:tag_end + 1]  # e.g., "$$" or "$func$"
                current_statement.append(tag)
                i = tag_end + 1
                
                # Now find the closing tag
                while i < length:
                    if query[i:i+len(tag)] == tag:
                        # Found closing tag
                        current_statement.append(tag)
                        i += len(tag)
                        break
                    else:
                        current_statement.append(query[i])
                        i += 1
                continue
        
        # Check for single-quoted string
        elif char == "'":
            current_statement.append(char)
            i += 1
            # Find closing quote, handling escaped quotes ('')
            while i < length:
                if query[i] == "'":
                    current_statement.append(query[i])
                    i += 1
                    # Check for escaped quote
                    if i < length and query[i] == "'":
                        current_statement.append(query[i])
                        i += 1
                    else:
                        break
                else:
                    current_statement.append(query[i])
                    i += 1
            continue
        
        # Check for single-line comment
        elif char == '-' and i + 1 < length and query[i + 1] == '-':
            # Single-line comment, skip to end of line
            while i < length and query[i] != '\n':
                current_statement.append(query[i])
                i += 1
            if i < length:
                current_statement.append('\n')
                i += 1
            continue
        
        # Check for semicolon (statement terminator)
        elif char == ';':
            current_statement.append(char)
            i += 1
            
            # End of statement
            stmt = ''.join(current_statement).strip()
            if stmt:
                statements.append(stmt)
            current_statement = []
            continue
        
        # Regular character
        else:
            current_statement.append(char)
            i += 1
    
    # Add any remaining statement
    stmt = ''.join(current_statement).strip()
    if stmt:
        statements.append(stmt)
    
    return statements

async def create_project_database(database_name: str) -> bool:
    """
    Create a new project schema (not a separate database)
    Uses PostgreSQL schemas for multi-tenancy instead of separate databases
    This works on managed PostgreSQL services like Render
    """
    try:
        print(f"🔧 Creating project schema: {database_name}")
        pool = await get_main_db_pool()
        async with pool.acquire() as conn:
            # Create schema instead of database
            await conn.execute(f'CREATE SCHEMA IF NOT EXISTS "{database_name}"')
            print(f"✅ Schema created: {database_name}")
            
            # Set search path to new schema
            await conn.execute(f'SET search_path TO "{database_name}"')
            
            # Enable extensions (these are database-wide, not schema-specific)
            # uuid-ossp not needed - using gen_random_uuid() instead
            # pg_stat_statements optional
            
            # Create helper function in the schema
            await conn.execute(f'''
                CREATE OR REPLACE FUNCTION "{database_name}".update_updated_at_column()
                RETURNS TRIGGER AS $$
                BEGIN
                    NEW.updated_at = NOW();
                    RETURN NEW;
                END;
                $$ LANGUAGE plpgsql;
            ''')
            print(f"✅ Helper function created in schema: {database_name}")
            
            # Create metadata table in the schema
            await conn.execute(f'''
                CREATE TABLE "{database_name}"._zendbx_metadata (
                    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
                    table_name VARCHAR(255) UNIQUE NOT NULL,
                    created_by VARCHAR(255),
                    created_at TIMESTAMPTZ DEFAULT NOW(),
                    updated_at TIMESTAMPTZ DEFAULT NOW()
                )
            ''')
            print(f"✅ Metadata table created in schema: {database_name}")
            
        print(f"🎉 Project schema fully initialized: {database_name}")
        return True
    except Exception as e:
        print(f"❌ Error creating project schema {database_name}: {e}")
        import traceback
        print(f"❌ Traceback: {traceback.format_exc()}")
        return False

async def drop_project_database(database_name: str) -> bool:
    """
    Drop a project schema (not a separate database)
    Removes the schema and all its contents
    """
    try:
        print(f"🗑️  Dropping project schema: {database_name}")
        pool = await get_main_db_pool()
        async with pool.acquire() as conn:
            # Drop schema with CASCADE to remove all objects
            await conn.execute(f'DROP SCHEMA IF EXISTS "{database_name}" CASCADE')
            print(f"✅ Schema dropped: {database_name}")
        
        return True
    except Exception as e:
        print(f"❌ Error dropping project schema {database_name}: {e}")
        return False
    except Exception as e:
        print(f"Error dropping database: {e}")
        return False

async def close_all_pools():
    """Close all connection pools"""
    for pool in connection_pools.values():
        await pool.close()
    connection_pools.clear()
