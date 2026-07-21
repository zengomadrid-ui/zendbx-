"""
Project Role Management - Per-Project PostgreSQL Role System
Phase 3: Restricted Per-Project Role Provisioning

This module handles:
- Generation of unique, collision-safe PostgreSQL role names
- Project role creation with strict privilege restrictions
- Credential storage and retrieval
- Role cleanup on project deletion

Security Invariants:
- Each project has exactly one PostgreSQL role
- Project roles can ONLY access their own schema
- Project roles CANNOT access auth, public, or other project schemas
- Role names are server-generated, never client-controlled
"""

import re
import secrets
import hashlib
from typing import Optional, Dict
from uuid import UUID
from cryptography.fernet import Fernet
from app.core.config import settings
from app.core.database import execute_on_main_db
import asyncpg

# ============================================
# PROJECT ROLE NAMING
# ============================================

def generate_project_role_name(project_id: UUID) -> str:
    """
    Generate a unique, collision-safe PostgreSQL role name for a project.
    
    Format: zendbx_p_<uuid_without_hyphens>
    Example: zendbx_p_550e8400e29b41d4a716446655440000
    
    Constraints:
    - PostgreSQL identifier limit: 63 bytes
    - Prefix 'zendbx_p_' = 9 bytes
    - UUID without hyphens = 32 bytes
    - Total = 41 bytes (well within limit)
    
    Security:
    - Deterministic from project UUID
    - No collision risk (UUID uniqueness)
    - Server-generated only
    - Never derived from user input
    
    Args:
        project_id: Project UUID
        
    Returns:
        PostgreSQL role name string
    """
    # Remove hyphens from UUID
    uuid_str = str(project_id).replace('-', '')
    
    # Validate UUID format (must be 32 hex characters)
    if not re.match(r'^[a-f0-9]{32}$', uuid_str):
        raise ValueError(f"Invalid project UUID format: {project_id}")
    
    role_name = f"zendbx_p_{uuid_str}"
    
    # Validate final role name
    validate_postgres_identifier(role_name)
    
    return role_name


def validate_postgres_identifier(identifier: str) -> None:
    """
    Validate a PostgreSQL identifier for security.
    
    Rules:
    - Must start with letter or underscore
    - Can contain letters, digits, underscores
    - Must be <= 63 bytes
    - No SQL injection characters
    
    Args:
        identifier: Identifier to validate
        
    Raises:
        ValueError: If identifier is invalid
    """
    if not identifier:
        raise ValueError("Identifier cannot be empty")
    
    if len(identifier) > 63:
        raise ValueError(f"Identifier too long: {len(identifier)} bytes (max 63)")
    
    # PostgreSQL identifier rules
    if not re.match(r'^[a-zA-Z_][a-zA-Z0-9_]*$', identifier):
        raise ValueError(f"Invalid PostgreSQL identifier: {identifier}")
    
    # Reject SQL keywords and dangerous patterns
    dangerous_keywords = {'drop', 'alter', 'grant', 'revoke', 'delete', 'truncate'}
    if identifier.lower() in dangerous_keywords:
        raise ValueError(f"Identifier cannot be SQL keyword: {identifier}")


def quote_postgres_identifier(identifier: str) -> str:
    """
    Safely quote a PostgreSQL identifier.
    
    Uses double quotes and escapes any embedded quotes.
    
    Args:
        identifier: Identifier to quote
        
    Returns:
        Quoted identifier safe for SQL
    """
    # Escape any double quotes by doubling them
    escaped = identifier.replace('"', '""')
    return f'"{escaped}"'


# ============================================
# CREDENTIAL ENCRYPTION
# ============================================

def get_encryption_key() -> bytes:
    """
    Get Fernet encryption key for project credential storage.
    
    Uses dedicated PROJECT_CREDENTIAL_ENCRYPTION_KEY if configured,
    falls back to OAUTH_ENCRYPTION_KEY for backward compatibility.
    
    Returns:
        Fernet key bytes
        
    Raises:
        ValueError: If no encryption key configured
    """
    # Prefer dedicated project credential key
    if settings.PROJECT_CREDENTIAL_ENCRYPTION_KEY:
        return settings.PROJECT_CREDENTIAL_ENCRYPTION_KEY.encode()
    
    # Fall back to OAuth key for backward compatibility
    if settings.OAUTH_ENCRYPTION_KEY:
        return settings.OAUTH_ENCRYPTION_KEY.encode()
    
    raise ValueError(
        "No encryption key configured. Set PROJECT_CREDENTIAL_ENCRYPTION_KEY or OAUTH_ENCRYPTION_KEY. "
        "Generate with: python -c \"from cryptography.fernet import Fernet; print(Fernet.generate_key().decode())\""
    )


def encrypt_credential(plaintext: str) -> str:
    """
    Encrypt a credential using Fernet symmetric encryption.
    
    Args:
        plaintext: Credential to encrypt
        
    Returns:
        Base64-encoded encrypted credential
    """
    key = get_encryption_key()
    f = Fernet(key)
    encrypted = f.encrypt(plaintext.encode())
    return encrypted.decode()


def decrypt_credential(encrypted: str) -> str:
    """
    Decrypt a credential.
    
    Args:
        encrypted: Encrypted credential string
        
    Returns:
        Decrypted plaintext credential
    """
    key = get_encryption_key()
    f = Fernet(key)
    decrypted = f.decrypt(encrypted.encode())
    return decrypted.decode()


# ============================================
# CREDENTIAL STORAGE
# ============================================

async def store_project_db_credentials(
    project_id: UUID,
    role_name: str,
    password: str
) -> None:
    """
    Store encrypted project database credentials.
    
    Credentials are stored in the projects table, encrypted at rest.
    Only accessible via platform pool.
    
    Args:
        project_id: Project UUID
        role_name: PostgreSQL role name
        password: Role password (will be encrypted)
    """
    encrypted_password = encrypt_credential(password)
    
    await execute_on_main_db(
        """
        UPDATE projects 
        SET 
            db_role_name = $1,
            db_role_password_encrypted = $2,
            updated_at = NOW()
        WHERE id = $3
        """,
        role_name,
        encrypted_password,
        project_id
    )


async def get_project_db_credentials(project_id: UUID) -> Dict[str, str]:
    """
    Retrieve and decrypt project database credentials.
    
    Args:
        project_id: Project UUID
        
    Returns:
        Dictionary with:
        - role_name: PostgreSQL role name
        - password: Decrypted password
        - connection_url: Full connection string
        
    Raises:
        ValueError: If credentials not found or invalid
    """
    result = await execute_on_main_db(
        """
        SELECT 
            db_role_name,
            db_role_password_encrypted,
            database_name
        FROM projects 
        WHERE id = $1
        """,
        project_id
    )
    
    if not result:
        raise ValueError(f"Project not found: {project_id}")
    
    row = dict(result[0])
    
    if not row['db_role_name'] or not row['db_role_password_encrypted']:
        raise ValueError(f"Project database credentials not configured: {project_id}")
    
    # Decrypt password
    password = decrypt_credential(row['db_role_password_encrypted'])
    
    # Build connection URL
    # Extract host, port, database from platform URL
    import re
    from urllib.parse import urlparse
    
    platform_url = settings.PLATFORM_DATABASE_URL or settings.DATABASE_URL
    parsed = urlparse(platform_url)
    
    connection_url = (
        f"postgresql://{row['db_role_name']}:{password}@"
        f"{parsed.hostname}:{parsed.port or 5432}{parsed.path}"
    )
    
    return {
        'role_name': row['db_role_name'],
        'password': password,
        'connection_url': connection_url,
        'schema_name': row['database_name']
    }


async def delete_project_db_credentials(project_id: UUID) -> None:
    """
    Remove project database credentials.
    
    Called during project deletion.
    
    Args:
        project_id: Project UUID
    """
    await execute_on_main_db(
        """
        UPDATE projects 
        SET 
            db_role_name = NULL,
            db_role_password_encrypted = NULL,
            updated_at = NOW()
        WHERE id = $1
        """,
        project_id
    )


# ============================================
# PROJECT ROLE PROVISIONING
# ============================================

async def create_project_role(
    project_id: UUID,
    schema_name: str,
    provisioner_pool: asyncpg.Pool
) -> Dict[str, str]:
    """
    Create a restricted PostgreSQL role for a project.
    
    This role will have:
    - Database CONNECT privilege
    - USAGE on its project schema ONLY
    - SELECT, INSERT, UPDATE, DELETE on tables in its schema
    - NO access to auth, public, or other project schemas
    
    Args:
        project_id: Project UUID
        schema_name: Project schema name (e.g., proj_550e8400)
        provisioner_pool: Connection pool with CREATEROLE privilege
        
    Returns:
        Dictionary with role_name and password
    """
    # Generate role name
    role_name = generate_project_role_name(project_id)
    
    # Generate secure password
    password = secrets.token_urlsafe(32)
    
    async with provisioner_pool.acquire() as conn:
        # Check if role already exists
        existing = await conn.fetchval(
            "SELECT 1 FROM pg_roles WHERE rolname = $1",
            role_name
        )
        
        if existing:
            raise ValueError(f"Project role already exists: {role_name}")
        
        # Validate schema name format
        if not re.match(r'^proj_[a-f0-9]{8,}$', schema_name):
            raise ValueError(f"Invalid project schema name: {schema_name}")
        
        # ============================================
        # STEP 1: CREATE ROLE
        # ============================================
        # Using parameterized password setting for security
        await conn.execute(f"""
            CREATE ROLE {role_name}
                LOGIN
                NOSUPERUSER
                NOCREATEDB
                NOCREATEROLE
                INHERIT
                NOREPLICATION
                NOINHERIT
                CONNECTION LIMIT 10
        """)
        
        # Set password separately using secure parameter
        await conn.execute(
            f"ALTER ROLE {role_name} PASSWORD $1",
            password
        )
        
        # ============================================
        # STEP 2: GRANT PROJECT SCHEMA ACCESS
        # ============================================
        
        # Grant USAGE on project schema
        await conn.execute(f'''
            GRANT USAGE ON SCHEMA {quote_postgres_identifier(schema_name)} 
            TO {role_name}
        ''')
        
        # Grant table permissions (SELECT, INSERT, UPDATE, DELETE)
        # Note: Not granting TRUNCATE, REFERENCES, TRIGGER for security
        await conn.execute(f'''
            GRANT SELECT, INSERT, UPDATE, DELETE 
            ON ALL TABLES IN SCHEMA {quote_postgres_identifier(schema_name)}
            TO {role_name}
        ''')
        
        # Grant sequence permissions
        await conn.execute(f'''
            GRANT USAGE, SELECT 
            ON ALL SEQUENCES IN SCHEMA {quote_postgres_identifier(schema_name)}
            TO {role_name}
        ''')
        
        # Grant function execution (if needed for triggers, etc.)
        await conn.execute(f'''
            GRANT EXECUTE 
            ON ALL FUNCTIONS IN SCHEMA {quote_postgres_identifier(schema_name)}
            TO {role_name}
        ''')
        
        # Grant CREATE privilege so users can create tables
        await conn.execute(f'''
            GRANT CREATE 
            ON SCHEMA {quote_postgres_identifier(schema_name)}
            TO {role_name}
        ''')
        
        # ============================================
        # STEP 3: SET DEFAULT PRIVILEGES
        # ============================================
        
        # For tables created by this role
        await conn.execute(f'''
            ALTER DEFAULT PRIVILEGES 
            FOR ROLE {role_name}
            IN SCHEMA {quote_postgres_identifier(schema_name)}
            GRANT SELECT, INSERT, UPDATE, DELETE ON TABLES TO {role_name}
        ''')
        
        # For sequences created by this role
        await conn.execute(f'''
            ALTER DEFAULT PRIVILEGES 
            FOR ROLE {role_name}
            IN SCHEMA {quote_postgres_identifier(schema_name)}
            GRANT USAGE, SELECT ON SEQUENCES TO {role_name}
        ''')
        
        # For tables created by provisioner (migrations)
        provisioner_role = conn.get_settings()['session_authorization']
        await conn.execute(f'''
            ALTER DEFAULT PRIVILEGES 
            FOR ROLE {provisioner_role}
            IN SCHEMA {quote_postgres_identifier(schema_name)}
            GRANT SELECT, INSERT, UPDATE, DELETE ON TABLES TO {role_name}
        ''')
        
        # For sequences created by provisioner
        await conn.execute(f'''
            ALTER DEFAULT PRIVILEGES 
            FOR ROLE {provisioner_role}
            IN SCHEMA {quote_postgres_identifier(schema_name)}
            GRANT USAGE, SELECT ON SEQUENCES TO {role_name}
        ''')
        
        # ============================================
        # STEP 4: EXPLICITLY DENY OTHER SCHEMAS
        # ============================================
        
        # Revoke access to auth schema
        await conn.execute(f'REVOKE ALL ON SCHEMA auth FROM {role_name}')
        
        # Revoke access to public schema (platform tables)
        await conn.execute(f'REVOKE ALL ON SCHEMA public FROM {role_name}')
        
        # Note: Cannot revoke access to other project schemas since we don't
        # grant it in the first place. PostgreSQL default is no access.
        
        # ============================================
        # STEP 5: ADD COMMENT FOR DOCUMENTATION
        # ============================================
        
        await conn.execute(f"""
            COMMENT ON ROLE {role_name} IS 
            'Project role for {project_id}. Schema: {schema_name}. Created: {conn.get_settings()["TimeZone"]}. Isolated access.'
        """)
    
    return {
        'role_name': role_name,
        'password': password,
        'schema_name': schema_name
    }


async def drop_project_role(
    role_name: str,
    provisioner_pool: asyncpg.Pool
) -> None:
    """
    Drop a project PostgreSQL role.
    
    Called during project deletion.
    Must handle active connections gracefully.
    
    Args:
        role_name: Role to drop
        provisioner_pool: Connection pool with CREATEROLE privilege
    """
    async with provisioner_pool.acquire() as conn:
        # Terminate any active connections using this role
        await conn.execute(f"""
            SELECT pg_terminate_backend(pid)
            FROM pg_stat_activity
            WHERE usename = $1
            AND pid <> pg_backend_pid()
        """, role_name)
        
        # Drop the role
        await conn.execute(f"DROP ROLE IF EXISTS {role_name}")


# ============================================
# PRIVILEGE VERIFICATION
# ============================================

async def verify_project_role_isolation(
    role_name: str,
    own_schema: str,
    test_pool: asyncpg.Pool
) -> Dict[str, bool]:
    """
    Verify that a project role has proper isolation.
    
    Tests:
    - Can access own schema
    - Cannot access auth schema
    - Cannot access public schema
    
    Args:
        role_name: Role to test
        own_schema: The project's own schema
        test_pool: Connection pool using the project role
        
    Returns:
        Dictionary of test results
    """
    results = {}
    
    async with test_pool.acquire() as conn:
        # Verify connected as correct role
        current_user = await conn.fetchval("SELECT current_user")
        results['correct_user'] = (current_user == role_name)
        
        # Test own schema access
        try:
            has_usage = await conn.fetchval(f"""
                SELECT has_schema_privilege($1, $2, 'USAGE')
            """, role_name, own_schema)
            results['own_schema_usage'] = has_usage
        except Exception as e:
            results['own_schema_usage'] = False
            results['own_schema_error'] = str(e)
        
        # Test auth schema denial
        try:
            has_usage = await conn.fetchval(f"""
                SELECT has_schema_privilege($1, 'auth', 'USAGE')
            """, role_name)
            results['auth_schema_denied'] = not has_usage
        except Exception as e:
            results['auth_schema_denied'] = True
        
        # Test public schema denial
        try:
            has_usage = await conn.fetchval(f"""
                SELECT has_schema_privilege($1, 'public', 'USAGE')
            """, role_name)
            results['public_schema_denied'] = not has_usage
        except Exception as e:
            results['public_schema_denied'] = True
        
        # Test cannot query auth.users
        try:
            await conn.fetch("SELECT * FROM auth.users LIMIT 1")
            results['auth_users_denied'] = False
        except asyncpg.PostgresError:
            results['auth_users_denied'] = True
        
        # Test cannot query public.projects
        try:
            await conn.fetch("SELECT * FROM public.projects LIMIT 1")
            results['public_projects_denied'] = False
        except asyncpg.PostgresError:
            results['public_projects_denied'] = True
    
    return results
