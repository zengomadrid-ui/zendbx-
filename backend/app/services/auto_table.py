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
    """Create auth.users table (Phase 1 Authentication Foundation)"""
    # Create auth schema if it doesn't exist
    await conn.execute("CREATE SCHEMA IF NOT EXISTS auth")
    
    # Create auth.users table with all Phase 1 fields
    await conn.execute("""
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
            updated_at TIMESTAMPTZ DEFAULT NOW()
        );
        
        ALTER TABLE auth.users ADD CONSTRAINT IF NOT EXISTS auth_users_email_unique UNIQUE (email);
        ALTER TABLE auth.users ADD CONSTRAINT IF NOT EXISTS auth_users_username_unique UNIQUE (username);
        
        CREATE INDEX IF NOT EXISTS idx_auth_users_email_lower ON auth.users (LOWER(email));
        CREATE INDEX IF NOT EXISTS idx_auth_users_username_lower ON auth.users (LOWER(username)) WHERE username IS NOT NULL;
        CREATE INDEX IF NOT EXISTS idx_auth_users_provider ON auth.users (provider);
        CREATE INDEX IF NOT EXISTS idx_auth_users_is_active ON auth.users (is_active);
        CREATE INDEX IF NOT EXISTS idx_auth_users_created_at ON auth.users (created_at DESC);
    """)
    
    # Create public.users view for application queries
    await conn.execute("""
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
    
    logger.info("Created auth.users table + public.users view")


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
    project_id: str,
    user_id: str,
    email: str,
    name: Optional[str] = None,
    provider: str = "email",
    avatar_url: Optional[str] = None,
    metadata: Optional[Dict] = None,
    password_hash: str = ""
):
    """
    Automatically sync user to auth.users table (project-scoped)
    Creates table if doesn't exist, uses UPSERT to avoid duplicates
    
    Args:
        pool: Database connection pool
        project_id: Project UUID (for project-scoped authentication)
        user_id: User UUID
        email: User email
        name: User name (mapped to username field)
        provider: Auth provider (email, google, github, etc.)
        avatar_url: Avatar URL
        metadata: Additional metadata
        password_hash: Bcrypt hashed password (empty string for OAuth users)
    """
    # Ensure auth.users table exists
    await ensure_table_exists(pool, "users")
    
    # UPSERT user into auth.users WITH project_id (project-scoped)
    async with pool.acquire() as conn:
        await conn.execute("""
            INSERT INTO auth.users (id, project_id, email, username, password_hash, provider, avatar_url, metadata, last_login_at)
            VALUES ($1, $2, $3, $4, $5, $6, $7, $8, NOW())
            ON CONFLICT (id) DO UPDATE SET
                project_id = EXCLUDED.project_id,
                email = EXCLUDED.email,
                username = EXCLUDED.username,
                provider = EXCLUDED.provider,
                avatar_url = EXCLUDED.avatar_url,
                metadata = EXCLUDED.metadata,
                last_login_at = NOW(),
                updated_at = NOW()
        """, user_id, project_id, email, name, password_hash, provider, avatar_url, metadata or {})
    
    logger.info(f"User {email} synced to auth.users table for project {project_id}")
