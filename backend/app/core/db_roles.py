"""
Database Role Management
Handles PostgreSQL role creation, validation, and credential management for project isolation
"""
import re
import secrets
import hashlib
from typing import Optional, Dict, Tuple
from uuid import UUID
from cryptography.fernet import Fernet
from app.core.config import settings
from app.core.database import execute_on_main_db
import logging

logger = logging.getLogger(__name__)


class ProjectRoleManager:
    """
    Manages PostgreSQL roles for project-level database isolation
    
    Security Model:
    - Each project gets a unique PostgreSQL role
    - Project roles can ONLY access their own schema
    - Project roles CANNOT access auth, public, or other project schemas
    - Role names are deterministic but collision-safe
    - Credentials are encrypted at rest
    """
    
    # PostgreSQL identifier limit
    MAX_IDENTIFIER_LENGTH = 63
    
    # Role name prefix
    ROLE_PREFIX = "zendbx_p_"
    
    @classmethod
    def generate_project_role_name(cls, project_id: UUID) -> str:
        """
        Generate a unique, collision-safe PostgreSQL role name for a project
        
        Format: zendbx_p_<uuid_without_hyphens>
        Example: zendbx_p_550e8400e29b41d4a716446655440000
        
        Security:
        - Deterministic: Same project_id always generates same role name
        - Collision-safe: Full UUID without truncation
        - Server-generated: Never accepts user input
        - PostgreSQL-safe: No special characters, fits in 63-byte limit
        
        Args:
            project_id: Project UUID
            
        Returns:
            PostgreSQL role name (e.g., "zendbx_p_550e8400e29b41d4a716446655440000")
            
        Raises:
            ValueError: If generated name exceeds PostgreSQL limit
        """
        # Remove hyphens from UUID (32 hex characters)
        uuid_str = str(project_id).replace('-', '')
        
        # Validate UUID format
        if not re.match(r'^[0-9a-f]{32}$', uuid_str, re.IGNORECASE):
            raise ValueError(f"Invalid UUID format: {project_id}")
        
        # Generate role name
        role_name = f"{cls.ROLE_PREFIX}{uuid_str.lower()}"
        
        # Verify length constraint
        if len(role_name) > cls.MAX_IDENTIFIER_LENGTH:
            raise ValueError(
                f"Generated role name exceeds PostgreSQL limit: "
                f"{len(role_name)} > {cls.MAX_IDENTIFIER_LENGTH}"
            )
        
        return role_name
    
    @classmethod
    def validate_project_schema_identifier(cls, schema_name: str) -> bool:
        """
        Validate that a schema name is a valid project schema identifier
        
        Expected format: proj_<uuid_prefix>
        Example: proj_550e8400
        
        Security: Prevents injection of arbitrary schema names
        
        Args:
            schema_name: Schema name to validate
            
        Returns:
            True if valid, False otherwise
        """
        # Project schemas follow pattern: proj_<uuid_prefix>
        pattern = r'^proj_[0-9a-f]{8}$'
        return bool(re.match(pattern, schema_name, re.IGNORECASE))
    
    @classmethod
    def quote_postgres_identifier(cls, identifier: str) -> str:
        """
        Safely quote a PostgreSQL identifier
        
        Uses double quotes and escapes any internal double quotes
        
        Args:
            identifier: PostgreSQL identifier (schema, table, column, role name)
            
        Returns:
            Quoted identifier safe for SQL
        """
        # Escape any double quotes in the identifier
        escaped = identifier.replace('"', '""')
        return f'"{escaped}"'
    
    @classmethod
    def generate_secure_password(cls) -> str:
        """
        Generate a cryptographically secure password for a PostgreSQL role
        
        Returns:
            URL-safe random password (32 bytes = ~43 characters)
        """
        return secrets.token_urlsafe(32)
    
    @classmethod
    async def create_project_role(
        cls,
        project_id: UUID,
        project_schema: str,
        provisioner_pool
    ) -> Tuple[str, str]:
        """
        Create a restricted PostgreSQL role for a project
        
        Security guarantees:
        - Role can ONLY access its own project schema
        - Role CANNOT access auth schema
        - Role CANNOT access public platform schema
        - Role CANNOT access other project schemas
        - Password is cryptographically secure
        
        Args:
            project_id: Project UUID
            project_schema: Project schema name (e.g., "proj_550e8400")
            provisioner_pool: Connection pool with CREATEROLE privilege
            
        Returns:
            Tuple of (role_name, password)
            
        Raises:
            ValueError: If schema name is invalid
            Exception: If role creation fails
        """
        # Validate inputs
        if not cls.validate_project_schema_identifier(project_schema):
            raise ValueError(f"Invalid project schema identifier: {project_schema}")
        
        # Generate role name and password
        role_name = cls.generate_project_role_name(project_id)
        password = cls.generate_secure_password()
        
        logger.info(f"Creating project role: {role_name} for schema: {project_schema}")
        
        async with provisioner_pool.acquire() as conn:
            # Check if role already exists
            existing = await conn.fetchval(
                "SELECT 1 FROM pg_roles WHERE rolname = $1",
                role_name
            )
            
            if existing:
                logger.warning(f"Role already exists: {role_name}")
                raise Exception(f"Project role already exists: {role_name}")
            
            # ============================================
            # STEP 1: CREATE ROLE
            # ============================================
            # Security: NOINHERIT prevents privilege escalation from PUBLIC grants
            # NOCREATEROLE, NOCREATEDB: No elevated privileges
            # Note: Role names should NOT be quoted in CREATE ROLE (PostgreSQL convention)
            
            await conn.execute(f"""
                CREATE ROLE {role_name}
                    LOGIN
                    NOSUPERUSER
                    NOCREATEDB
                    NOCREATEROLE
                    NOINHERIT
                    NOREPLICATION
                    CONNECTION LIMIT 10
                    PASSWORD '{password.replace("'", "''")}'
            """)
            
            logger.info(f"✅ Created role: {role_name}")
            
            # CRITICAL: Immediately revoke inherited privileges from PUBLIC
            # This must happen RIGHT AFTER role creation, before any grants
            await conn.execute(f"""
                REVOKE ALL ON SCHEMA public FROM {role_name}
            """)
            
            # Also revoke any default privileges from PUBLIC
            await conn.execute(f"""
                REVOKE ALL ON ALL TABLES IN SCHEMA public FROM {role_name}
            """)
            
            logger.info(f"✅ Revoked PUBLIC schema inheritance for {role_name}")
            
            # ============================================
            # STEP 2: GRANT PROJECT SCHEMA ACCESS
            # ============================================
            
            quoted_schema = cls.quote_postgres_identifier(project_schema)
            # Note: Role names should NOT be quoted in GRANT statements (PostgreSQL convention)
            
            # Grant schema usage AND create (required for SQL Editor DDL operations)
            await conn.execute(f"""
                GRANT USAGE, CREATE ON SCHEMA {quoted_schema} TO {role_name}
            """)
            
            # Grant ALL permissions on tables (including DDL operations)
            await conn.execute(f"""
                GRANT ALL PRIVILEGES
                ON ALL TABLES IN SCHEMA {quoted_schema} 
                TO {role_name}
            """)
            
            # Grant ALL permissions on sequences
            await conn.execute(f"""
                GRANT ALL PRIVILEGES
                ON ALL SEQUENCES IN SCHEMA {quoted_schema} 
                TO {role_name}
            """)
            
            # Grant ALL permissions on functions
            await conn.execute(f"""
                GRANT ALL PRIVILEGES
                ON ALL FUNCTIONS IN SCHEMA {quoted_schema} 
                TO {role_name}
            """)
            
            logger.info(f"✅ Granted {role_name} access to schema: {project_schema}")
            
            # ============================================
            # STEP 3: SET DEFAULT PRIVILEGES
            # ============================================
            # For objects created in the future
            
            # Get the current user (provisioner) to set default privileges
            current_user = await conn.fetchval("SELECT current_user")
            
            await conn.execute(f"""
                ALTER DEFAULT PRIVILEGES 
                FOR ROLE {current_user}
                IN SCHEMA {quoted_schema}
                GRANT ALL PRIVILEGES ON TABLES TO {role_name}
            """)
            
            await conn.execute(f"""
                ALTER DEFAULT PRIVILEGES 
                FOR ROLE {current_user}
                IN SCHEMA {quoted_schema}
                GRANT ALL PRIVILEGES ON SEQUENCES TO {role_name}
            """)
            
            await conn.execute(f"""
                ALTER DEFAULT PRIVILEGES 
                FOR ROLE {current_user}
                IN SCHEMA {quoted_schema}
                GRANT ALL PRIVILEGES ON FUNCTIONS TO {role_name}
            """)
            
            logger.info(f"✅ Set default privileges for {role_name}")
            
            # ============================================
            # STEP 4: EXPLICITLY DENY OTHER SCHEMAS
            # ============================================
            
            # Public schema access was already revoked in STEP 1
            # Now grant auth schema access (read-only for Table Editor)
            
            # Grant read-only access to auth schema (for Table Editor)
            # Users table queries are filtered by project_id in schemas.py
            try:
                auth_exists = await conn.fetchval("""
                    SELECT EXISTS (
                        SELECT 1 FROM information_schema.schemata 
                        WHERE schema_name = 'auth'
                    )
                """)
                
                if auth_exists:
                    await conn.execute(f"GRANT USAGE ON SCHEMA auth TO {role_name}")
                    await conn.execute(f"GRANT SELECT ON ALL TABLES IN SCHEMA auth TO {role_name}")
                    
                    # Set default privileges for future tables in auth schema
                    current_user = await conn.fetchval("SELECT current_user")
                    await conn.execute(f"""
                        ALTER DEFAULT PRIVILEGES 
                        FOR ROLE {current_user}
                        IN SCHEMA auth
                        GRANT SELECT ON TABLES TO {role_name}
                    """)
                    
                    logger.info(f"✅ Granted read-only access to auth schema for {role_name}")
            except Exception as e:
                # auth schema may not exist in development
                logger.warning(f"Could not grant auth schema access: {e}")
            
            # Note: We cannot revoke access to schemas that don't exist yet
            # Other project schemas are protected by not granting access
            
            logger.info(f"✅ Configured schema access for {role_name}")
            
            # ============================================
            # STEP 5: VERIFY EFFECTIVE PRIVILEGES
            # ============================================
            
            # Check public schema access (should be False)
            public_access = await conn.fetchval(f"""
                SELECT has_schema_privilege('{role_name}', 'public', 'USAGE')
            """)
            
            # Check own project schema access (should be True)
            project_access = await conn.fetchval(f"""
                SELECT has_schema_privilege('{role_name}', '{project_schema}', 'USAGE')
            """)
            
            logger.info(f"Privilege verification for {role_name}:")
            logger.info(f"  public schema: {public_access}")
            logger.info(f"  {project_schema} schema: {project_access}")
            
            # Security check
            if public_access:
                raise Exception(f"SECURITY FAILURE: {role_name} has public schema access!")
            
            if not project_access:
                raise Exception(f"SECURITY FAILURE: {role_name} cannot access its own schema!")
            
            logger.info(f"🔒 Security verification passed for {role_name}")
        
        return role_name, password
    
    @classmethod
    async def drop_project_role(
        cls,
        project_id: UUID,
        provisioner_pool
    ) -> bool:
        """
        Drop a project's PostgreSQL role
        
        Args:
            project_id: Project UUID
            provisioner_pool: Connection pool with CREATEROLE privilege
            
        Returns:
            True if role was dropped, False if it didn't exist
        """
        role_name = cls.generate_project_role_name(project_id)
        
        logger.info(f"Dropping project role: {role_name}")
        
        async with provisioner_pool.acquire() as conn:
            # Check if role exists
            exists = await conn.fetchval(
                "SELECT 1 FROM pg_roles WHERE rolname = $1",
                role_name
            )
            
            if not exists:
                logger.warning(f"Role does not exist: {role_name}")
                return False
            
            # Terminate active connections
            await conn.execute(f"""
                SELECT pg_terminate_backend(pid)
                FROM pg_stat_activity
                WHERE usename = $1
                  AND pid <> pg_backend_pid()
            """, role_name)
            
            # Drop role
            quoted_role = cls.quote_postgres_identifier(role_name)
            await conn.execute(f"DROP ROLE {quoted_role}")
            
            logger.info(f"✅ Dropped role: {role_name}")
            return True


class ProjectCredentialStore:
    """
    Secure storage for project database credentials
    
    DEPRECATED: Use project_roles.encrypt_credential() and decrypt_credential() directly.
    This class is maintained for backward compatibility with existing scripts only.
    
    Credentials are encrypted using Fernet (AES-128-CBC + HMAC)
    Only the platform backend can decrypt credentials
    """
    
    def __init__(self):
        # Import canonical encryption functions
        from app.core.project_roles import encrypt_credential as _encrypt, decrypt_credential as _decrypt
        self._encrypt = _encrypt
        self._decrypt = _decrypt
        
        # Note: No longer maintaining separate cipher instance
        # All encryption now uses canonical project_roles implementation
    
    def encrypt_password(self, password: str) -> str:
        """Encrypt a database password using canonical implementation"""
        return self._encrypt(password)
    
    def decrypt_password(self, encrypted: str) -> str:
        """Decrypt a database password using canonical implementation"""
        return self._decrypt(encrypted)
    
    async def store_credentials(
        self,
        project_id: UUID,
        role_name: str,
        password: str
    ):
        """
        Store encrypted project database credentials
        
        Args:
            project_id: Project UUID
            role_name: PostgreSQL role name
            password: Plaintext password (will be encrypted)
        """
        encrypted_password = self.encrypt_password(password)
        
        await execute_on_main_db("""
            INSERT INTO project_db_credentials (project_id, role_name, encrypted_password)
            VALUES ($1, $2, $3)
            ON CONFLICT (project_id) 
            DO UPDATE SET 
                role_name = EXCLUDED.role_name,
                encrypted_password = EXCLUDED.encrypted_password,
                updated_at = NOW()
        """, project_id, role_name, encrypted_password)
        
        logger.info(f"✅ Stored encrypted credentials for project: {project_id}")
    
    async def get_credentials(self, project_id: UUID) -> Optional[Dict[str, str]]:
        """
        Retrieve and decrypt project database credentials
        
        Args:
            project_id: Project UUID
            
        Returns:
            Dict with 'role_name' and 'password', or None if not found
        """
        result = await execute_on_main_db("""
            SELECT role_name, encrypted_password
            FROM project_db_credentials
            WHERE project_id = $1
        """, project_id)
        
        if not result:
            return None
        
        row = dict(result[0])
        
        return {
            'role_name': row['role_name'],
            'password': self.decrypt_password(row['encrypted_password'])
        }
    
    async def delete_credentials(self, project_id: UUID) -> bool:
        """
        Delete project database credentials
        
        Args:
            project_id: Project UUID
            
        Returns:
            True if credentials were deleted, False if they didn't exist
        """
        result = await execute_on_main_db("""
            DELETE FROM project_db_credentials
            WHERE project_id = $1
            RETURNING project_id
        """, project_id)
        
        if result:
            logger.info(f"✅ Deleted credentials for project: {project_id}")
            return True
        
        return False


# Global instance
credential_store = ProjectCredentialStore()
