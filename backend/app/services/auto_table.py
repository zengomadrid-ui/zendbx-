"""
Auto Table Creation Service
Automatically creates tables on first access with smart schema inference
"""
import asyncpg
import logging
from typing import Dict, Any, Optional

logger = logging.getLogger(__name__)


async def ensure_table_exists(
    pool: asyncpg.Pool,
    table_name: str,
    sample_data: Optional[Dict[str, Any]] = None,
    schema: Optional[str] = None
) -> bool:
    """
    Check if table exists in the current search_path schema, create if not.
    The connection must already have search_path set (done by RLSEnforcer._prepare_conn).
    """
    async with pool.acquire() as conn:
        # Set search_path if schema provided
        if schema:
            await conn.execute(f'SET search_path TO "{schema}", public')

        # Check using current_schema() so it respects whatever search_path is active
        exists = await conn.fetchval("""
            SELECT EXISTS (
                SELECT 1 FROM information_schema.tables 
                WHERE table_schema = current_schema() AND table_name = $1
            )
        """, table_name)
        
        if exists:
            logger.debug(f"Table '{table_name}' already exists in schema '{schema or 'current'}'")
            return True
        
        logger.info(f"Auto-creating table '{table_name}' in schema '{schema or 'current'}'...")
        
        if table_name == "users":
            await create_users_table(conn)
        else:
            await create_generic_table(conn, table_name, sample_data)
        
        logger.info(f"Table '{table_name}' created successfully")
        return True


async def create_users_table(conn: asyncpg.Connection):
    """Create standard users table"""
    await conn.execute("""
        CREATE TABLE users (
            id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
            email TEXT UNIQUE NOT NULL,
            name TEXT,
            provider TEXT DEFAULT 'email',
            avatar_url TEXT,
            metadata JSONB DEFAULT '{}'::jsonb,
            is_active BOOLEAN DEFAULT TRUE,
            created_at TIMESTAMPTZ DEFAULT NOW(),
            updated_at TIMESTAMPTZ DEFAULT NOW(),
            last_login_at TIMESTAMPTZ
        );
        
        CREATE INDEX idx_users_email ON users(email);
        CREATE INDEX idx_users_created_at ON users(created_at DESC);
    """)
    logger.info("Created users table with indexes")

    # Install auth.users compatibility view now that the table exists
    await _install_auth_users_view(conn)


async def _install_auth_users_view(conn: asyncpg.Connection):
    """
    Install auth.users Supabase-compatible view.
    Called after users table is created so the view can reference it.
    Safe to call multiple times (uses CREATE OR REPLACE).
    """
    try:
        # Ensure auth schema exists first
        await conn.execute("CREATE SCHEMA IF NOT EXISTS auth")
        # Call the installer function if it exists, otherwise create the view directly
        fn_exists = await conn.fetchval("""
            SELECT EXISTS(
                SELECT 1 FROM pg_proc p
                JOIN pg_namespace n ON p.pronamespace = n.oid
                WHERE n.nspname = 'auth' AND p.proname = '_install_users_view'
            )
        """)
        if fn_exists:
            await conn.execute("SELECT auth._install_users_view()")
        else:
            # Fallback: create view directly (functions not yet installed)
            await conn.execute("""
                CREATE OR REPLACE VIEW auth.users AS
                SELECT
                    id,
                    email,
                    name,
                    name                                        AS full_name,
                    provider,
                    provider                                    AS oauth_provider,
                    (metadata ->> 'oauth_id')                  AS oauth_id,
                    avatar_url,
                    is_active,
                    CASE
                        WHEN provider = 'email'
                        THEN COALESCE((metadata ->> 'is_verified')::BOOLEAN, FALSE)
                        ELSE TRUE
                    END                                         AS is_verified,
                    COALESCE(metadata ->> 'plan', 'free')          AS plan,
                    COALESCE(metadata ->> 'role', 'authenticated') AS role,
                    metadata,
                    created_at,
                    updated_at,
                    last_login_at,
                    email       AS email_confirmed_at,
                    last_login_at AS last_sign_in_at
                FROM users
            """)
        logger.info("auth.users compatibility view installed")
    except Exception as e:
        # Non-fatal — view will be created on next migration run
        logger.warning(f"Could not install auth.users view: {e}")


async def create_generic_table(
    conn: asyncpg.Connection,
    table_name: str,
    sample_data: Optional[Dict[str, Any]] = None
):
    """
    Create a generic table with schema inferred from sample data
    
    Args:
        conn: Database connection
        table_name: Name of the table
        sample_data: Sample data for schema inference
    """
    # Start with base columns
    columns = [
        "id UUID PRIMARY KEY DEFAULT gen_random_uuid()",
        "created_at TIMESTAMPTZ DEFAULT NOW()",
        "updated_at TIMESTAMPTZ DEFAULT NOW()"
    ]
    
    # Infer additional columns from sample data
    if sample_data:
        for key, value in sample_data.items():
            if key in ["id", "created_at", "updated_at"]:
                continue
            
            # Infer PostgreSQL type from Python type
            col_type = infer_column_type(value)
            columns.append(f"{key} {col_type}")
    
    # Create table
    create_sql = f"CREATE TABLE {table_name} ({', '.join(columns)})"
    await conn.execute(create_sql)
    
    # Create indexes
    await conn.execute(f"CREATE INDEX idx_{table_name}_created_at ON {table_name}(created_at DESC)")
    
    logger.info(f"Created generic table '{table_name}' with {len(columns)} columns")


def infer_column_type(value: Any) -> str:
    """
    Infer PostgreSQL column type from Python value
    
    Args:
        value: Sample value
    
    Returns:
        str: PostgreSQL column type
    """
    if value is None:
        return "TEXT"
    elif isinstance(value, bool):
        return "BOOLEAN"
    elif isinstance(value, int):
        return "INTEGER"
    elif isinstance(value, float):
        return "NUMERIC"
    elif isinstance(value, (dict, list)):
        return "JSONB"
    elif isinstance(value, str):
        # Check if it looks like a UUID
        if len(value) == 36 and value.count('-') == 4:
            return "UUID"
        # Check if it looks like a timestamp
        elif 'T' in value or '-' in value[:10]:
            return "TIMESTAMPTZ"
        else:
            return "TEXT"
    else:
        return "TEXT"


async def auto_sync_user(
    pool: asyncpg.Pool,
    user_id: str,
    email: str,
    name: Optional[str] = None,
    provider: str = "email",
    avatar_url: Optional[str] = None,
    metadata: Optional[Dict] = None
):
    """
    Automatically sync user to users table
    Creates table if doesn't exist, uses UPSERT to avoid duplicates
    
    Args:
        pool: Database connection pool
        user_id: User UUID
        email: User email
        name: User name
        provider: Auth provider (email, google, github, etc.)
        avatar_url: Avatar URL
        metadata: Additional metadata
    """
    # Ensure users table exists
    await ensure_table_exists(pool, "users")
    
    # UPSERT user
    async with pool.acquire() as conn:
        await conn.execute("""
            INSERT INTO users (id, email, name, provider, avatar_url, metadata, last_login_at)
            VALUES ($1, $2, $3, $4, $5, $6, NOW())
            ON CONFLICT (id) DO UPDATE SET
                email = EXCLUDED.email,
                name = EXCLUDED.name,
                provider = EXCLUDED.provider,
                avatar_url = EXCLUDED.avatar_url,
                metadata = EXCLUDED.metadata,
                last_login_at = NOW(),
                updated_at = NOW()
        """, user_id, email, name, provider, avatar_url, metadata or {})
    
    logger.info(f"User {email} synced to users table")
