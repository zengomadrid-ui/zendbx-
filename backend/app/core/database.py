import asyncpg
import asyncio
from typing import Dict, Optional
from app.core.config import settings
import logging
from uuid import UUID

logger = logging.getLogger(__name__)

# Connection pools for each database
connection_pools: Dict[str, asyncpg.Pool] = {}

# ============================================
# PHASE 4: ISOLATED CONNECTION POOLS
# ============================================

# Platform pool (trusted - has access to auth tables)
platform_pool: Optional[asyncpg.Pool] = None

# Provisioner pool (elevated - has CREATEROLE privilege)
provisioner_pool: Optional[asyncpg.Pool] = None

# Project pools (restricted - per-project isolation)
# Key: project_id (str), Value: asyncpg.Pool
project_pools: Dict[str, asyncpg.Pool] = {}

# Project pool configuration
MAX_PROJECT_POOLS = 50  # Maximum number of cached project pools
PROJECT_POOL_SIZE = 5   # Max connections per project pool

async def get_platform_db_pool() -> asyncpg.Pool:
    """
    Get trusted platform pool - HAS ACCESS TO AUTH TABLES
    
    Use for:
    - Authentication operations (signup, login, password reset)
    - Platform operations (projects, users)
    - Trusted internal operations
    
    Security:
    - Can access public schema (platform tables)
    - Can access auth schema (authentication tables)
    - Should NEVER be used for project-facing SQL execution
    """
    global platform_pool
    
    if platform_pool is None:
        max_retries = 3
        retry_delay = 2
        
        # Use PLATFORM_DATABASE_URL if available, fall back to DATABASE_URL
        platform_url = getattr(settings, 'PLATFORM_DATABASE_URL', settings.DATABASE_URL)
        
        logger.info("🔌 Creating platform database pool...")
        
        for attempt in range(max_retries):
            try:
                # Determine SSL context
                ssl_context = None
                if any(indicator in platform_url.lower() for indicator in ['render.com', 'amazonaws.com']):
                    import ssl
                    ssl_context = ssl.create_default_context()
                    logger.info("🔒 SSL enabled for platform connection")
                
                # Create platform pool
                platform_pool = await asyncpg.create_pool(
                    platform_url,
                    min_size=2,
                    max_size=10,
                    max_queries=50000,
                    max_inactive_connection_lifetime=300,
                    timeout=30,
                    command_timeout=60,
                    ssl=ssl_context,
                    server_settings={
                        'application_name': 'zendbx_platform',
                        'search_path': 'public,auth',
                        'jit': 'off',
                        'statement_timeout': '60000'
                    }
                )
                
                # Test the pool
                async with platform_pool.acquire() as conn:
                    result = await conn.fetchval('SELECT 1')
                    if result == 1:
                        logger.info(f"✅ Platform pool connected (attempt {attempt + 1})")
                    else:
                        raise Exception("Platform pool test query failed")
                
                break
                
            except Exception as e:
                if attempt < max_retries - 1:
                    logger.warning(f"⚠️  Platform pool attempt {attempt + 1} failed: {e}")
                    await asyncio.sleep(retry_delay)
                    retry_delay *= 2
                else:
                    logger.error(f"❌ Platform pool failed after {max_retries} attempts: {e}")
                    raise Exception(f"Platform database connection failed: {e}")
    
    return platform_pool


async def get_provisioner_db_pool() -> asyncpg.Pool:
    """
    Get provisioner pool - HAS CREATEROLE PRIVILEGE
    
    Use for:
    - Creating project-specific PostgreSQL roles
    - Creating project schemas
    - Granting/revoking permissions
    - Project provisioning and deletion
    
    Security:
    - Has CREATEROLE privilege (elevated)
    - Should be used ONLY for provisioning operations
    - Never use for runtime project operations
    """
    global provisioner_pool
    
    if provisioner_pool is None:
        # Use PROVISIONER_DATABASE_URL if available, fall back to PLATFORM_DATABASE_URL
        provisioner_url = getattr(settings, 'PROVISIONER_DATABASE_URL', 
                                 getattr(settings, 'PLATFORM_DATABASE_URL', settings.DATABASE_URL))
        
        logger.info("🔌 Creating provisioner database pool...")
        
        # Determine SSL context
        ssl_context = None
        if any(indicator in provisioner_url.lower() for indicator in ['render.com', 'amazonaws.com']):
            import ssl
            ssl_context = ssl.create_default_context()
        
        provisioner_pool = await asyncpg.create_pool(
            provisioner_url,
            min_size=1,
            max_size=5,  # Limited connections for provisioner
            timeout=30,
            command_timeout=120,  # Longer timeout for DDL operations
            ssl=ssl_context,
            server_settings={
                'application_name': 'zendbx_provisioner',
                'search_path': 'public',
                'statement_timeout': '120000'
            }
        )
        
        logger.info("✅ Provisioner pool created")
    
    return provisioner_pool


async def get_project_db_pool_isolated(project_id: str, connection_url: str, project_schema: str) -> asyncpg.Pool:
    """
    Get project-specific isolated pool - RESTRICTED ACCESS
    
    Uses project-specific PostgreSQL role with access ONLY to project schema
    
    Args:
        project_id: Project UUID as string
        connection_url: Full connection URL with project-specific credentials
        project_schema: Project schema name (e.g., "proj_550e8400")
    
    Security:
    - Can access ONLY the specified project schema
    - CANNOT access auth schema
    - CANNOT access public platform schema
    - CANNOT access other project schemas
    - PostgreSQL enforces isolation even if application code has bugs
    
    Returns:
        asyncpg.Pool configured for project-specific access
    """
    global project_pools
    
    if project_id not in project_pools:
        # Check if we need to evict old pools (LRU-style)
        if len(project_pools) >= MAX_PROJECT_POOLS:
            # Evict the oldest pool (simple FIFO for now)
            # In production, implement proper LRU with access timestamps
            oldest_project_id = next(iter(project_pools))
            oldest_pool = project_pools.pop(oldest_project_id)
            await oldest_pool.close()
            logger.info(f"🗑️  Evicted old project pool: {oldest_project_id}")
        
        logger.info(f"🔌 Creating isolated project pool: {project_id}")
        
        # Determine SSL context
        ssl_context = None
        if any(indicator in connection_url.lower() for indicator in ['render.com', 'amazonaws.com']):
            import ssl
            ssl_context = ssl.create_default_context()
        
        # Create project-specific pool
        project_pools[project_id] = await asyncpg.create_pool(
            connection_url,
            min_size=1,
            max_size=PROJECT_POOL_SIZE,
            max_queries=10000,
            max_inactive_connection_lifetime=600,  # 10 minutes
            timeout=30,
            command_timeout=60,
            ssl=ssl_context,
            server_settings={
                'application_name': f'zendbx_project_{project_id[:8]}',
                'search_path': f'"{project_schema}"',  # ONLY project schema
                'jit': 'off',
                'statement_timeout': '60000'
            }
        )
        
        logger.info(f"✅ Project pool created: {project_id}")
    
    return project_pools[project_id]


async def close_project_pool(project_id: str):
    """
    Close and remove a project's connection pool
    
    Use when:
    - Project is deleted
    - Pool needs to be recreated
    - Application shutdown
    
    Args:
        project_id: Project UUID as string
    """
    global project_pools
    
    if project_id in project_pools:
        pool = project_pools.pop(project_id)
        await pool.close()
        logger.info(f"✅ Closed project pool: {project_id}")


async def get_main_db_pool() -> asyncpg.Pool:
    """
    DEPRECATED: Use get_platform_db_pool() instead
    
    Kept for backward compatibility during migration
    """
    return await get_platform_db_pool()
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
                    # HIGH-4 FIX: Use proper certificate verification instead of CERT_NONE.
                    # create_default_context() loads the system CA bundle and enables
                    # hostname verification by default — no extra configuration needed.
                    ssl_context = ssl.create_default_context()
                    print(f"🔒 SSL enabled for cloud database (certificate verification ON)")
                
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

async def execute_on_project_db(project_id: UUID, database_name: str, query: str, *args, rls_user_id: str = None, rls_role: str = None):
    """
    Execute query on project database using ISOLATED PROJECT ROLE
    
    PHASE 5.0 MIGRATION: Now uses project-specific restricted PostgreSQL roles
    
    Args:
        project_id: Project UUID (for credential lookup)
        database_name: Project schema name (for search_path)
        query: SQL query to execute
        *args: Query parameters
        rls_user_id: RLS user ID context
        rls_role: RLS role context
    
    Security:
    - Uses project-specific isolated pool (zendbx_p_<uuid> role)
    - PostgreSQL enforces isolation (not just search_path)
    - Fail-closed: Missing credentials = query fails
    - No privileged fallback
    
    CRITICAL: Does NOT split queries incorrectly
    - Preserves $$ ... $$ blocks
    - Preserves function definitions
    - Only splits on semicolons OUTSIDE of quoted strings and function bodies
    """
    from app.middleware.rls_context import set_rls_context as _set_rls_ctx
    from app.core.db_roles import ProjectCredentialStore
    from cryptography.fernet import Fernet

    async def _inject_rls(conn):
        """Inject RLS session variables if context provided."""
        if rls_user_id is not None or rls_role is not None:
            await _set_rls_ctx(conn, user_id=rls_user_id, role=rls_role or 'anon')

    # PHASE 5.0: Get isolated project pool
    # FAIL-CLOSED: No fallback to privileged pools
    # Get encrypted credentials from database
    admin_conn = None
    try:
        admin_conn = await asyncpg.connect(settings.DATABASE_URL)
        cred_row = await admin_conn.fetchrow(
            'SELECT role_name, encrypted_password FROM public.project_db_credentials WHERE project_id = $1',
            project_id
        )
    finally:
        if admin_conn:
            await admin_conn.close()
    
    if not cred_row:
        # FAIL-CLOSED: No credentials = fail immediately (no privileged fallback)
        raise Exception(f"Project credentials not found for {project_id}. Project may not be provisioned.")
    
    # Decrypt credentials
    encryption_key = settings.PROJECT_CREDENTIAL_ENCRYPTION_KEY.encode()
    f = Fernet(encryption_key)
    
    try:
        decrypted_password = f.decrypt(cred_row['encrypted_password'].encode()).decode()
    except Exception as decrypt_error:
        # FAIL-CLOSED: Decryption failure = fail immediately (no privileged fallback)
        raise Exception(f"Failed to decrypt project credentials for {project_id}: {decrypt_error}")
    
    # Build connection URL
    connection_url = f"postgresql://{cred_row['role_name']}:{decrypted_password}@localhost:5432/nexora_main"
    
    try:
        # Get isolated project pool
        pool = await get_project_db_pool_isolated(
            str(project_id),
            connection_url,
            database_name
        )
        logger.info(f"✅ Using isolated pool for project {project_id} (role: {cred_row['role_name']})")
    except Exception as pool_error:
        # FAIL-CLOSED: Pool creation failure = fail immediately (no privileged fallback)
        raise Exception(f"Failed to create isolated project pool for {project_id}: {pool_error}")

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
    """Close all connection pools (platform, provisioner, and all project pools)"""
    global platform_pool, provisioner_pool, project_pools
    
    # Close legacy pools
    for pool in connection_pools.values():
        await pool.close()
    connection_pools.clear()
    
    # Close platform pool
    if platform_pool:
        await platform_pool.close()
        platform_pool = None
        logger.info("✅ Closed platform pool")
    
    # Close provisioner pool
    if provisioner_pool:
        await provisioner_pool.close()
        provisioner_pool = None
        logger.info("✅ Closed provisioner pool")
    
    # Close all project pools
    for project_id, pool in project_pools.items():
        await pool.close()
        logger.info(f"✅ Closed project pool: {project_id}")
    project_pools.clear()
