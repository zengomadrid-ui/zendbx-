"""
Atomic Project Provisioning Service

This service ensures project creation is fully atomic:
- All steps succeed OR all steps rollback
- No partial projects exist
- All failures are properly logged and propagated
- Verification steps ensure database state is consistent

Architecture:
- Single PostgreSQL transaction for all operations
- Verification after each critical step
- Structured logging (no print statements)
- Explicit exception propagation
"""

import asyncpg
import secrets
import hashlib
import logging
from typing import Dict, Optional, Tuple
from uuid import UUID
import jwt as pyjwt
from datetime import datetime
from pathlib import Path

logger = logging.getLogger(__name__)


class ProvisioningError(Exception):
    """Base exception for provisioning errors"""
    pass


class SchemaCreationError(ProvisioningError):
    """Raised when schema creation fails"""
    pass


class MetadataCreationError(ProvisioningError):
    """Raised when metadata table creation fails"""
    pass


class APIKeyGenerationError(ProvisioningError):
    """Raised when API key generation fails"""
    pass


class VerificationError(ProvisioningError):
    """Raised when verification fails"""
    pass


class AtomicProjectProvisioner:
    """Handles atomic project provisioning with full transaction support"""
    
    def __init__(self, database_url: str):
        self.database_url = database_url
        self.schema_dir = Path(__file__).parent.parent.parent / "database"
    
    async def generate_unique_slug(self, conn: asyncpg.Connection, name: str) -> str:
        """
        Generate unique, human-readable slug from project name.
        Handles collisions with incremental counters.
        
        Args:
            conn: Database connection (must be in transaction)
            name: Project name
            
        Returns:
            Unique slug
        """
        import re
        
        # Convert to lowercase and replace special chars with hyphens
        slug = name.lower()
        slug = re.sub(r'[^a-z0-9]+', '-', slug)
        slug = slug.strip('-')
        
        if not slug:
            slug = 'project'
        
        # Check if slug is available
        result = await conn.fetchval(
            "SELECT EXISTS(SELECT 1 FROM projects WHERE slug = $1)",
            slug
        )
        
        if not result:
            return slug
        
        # Handle collision with numbered suffix
        counter = 2
        while counter <= 100:
            numbered_slug = f"{slug}-{counter}"
            result = await conn.fetchval(
                "SELECT EXISTS(SELECT 1 FROM projects WHERE slug = $1)",
                numbered_slug
            )
            
            if not result:
                return numbered_slug
            
            counter += 1
        
        # Fallback to UUID suffix if too many collisions
        import uuid
        return f"{slug}-{str(uuid.uuid4())[:8]}"
    
    async def generate_unique_db_name(self, conn: asyncpg.Connection) -> str:
        """
        Generate unique database/schema name.
        
        Args:
            conn: Database connection (must be in transaction)
            
        Returns:
            Unique database name
        """
        while True:
            db_name = f"proj_{secrets.token_hex(4)}"
            
            result = await conn.fetchval(
                "SELECT EXISTS(SELECT 1 FROM projects WHERE database_name = $1)",
                db_name
            )
            
            if not result:
                return db_name
    
    async def verify_schema_exists(
        self,
        conn: asyncpg.Connection,
        schema_name: str
    ) -> bool:
        """
        Verify that a schema exists in the database.
        
        Args:
            conn: Database connection
            schema_name: Schema name to verify
            
        Returns:
            True if schema exists, False otherwise
            
        Raises:
            VerificationError: If verification query fails
        """
        try:
            result = await conn.fetchval(
                """
                SELECT EXISTS(
                    SELECT 1 FROM information_schema.schemata
                    WHERE schema_name = $1
                )
                """,
                schema_name
            )
            return bool(result)
        except Exception as e:
            logger.error(f"Schema verification failed for {schema_name}: {e}")
            raise VerificationError(f"Failed to verify schema existence: {e}")
    
    async def verify_table_exists(
        self,
        conn: asyncpg.Connection,
        schema_name: str,
        table_name: str
    ) -> bool:
        """
        Verify that a table exists in a schema.
        
        Args:
            conn: Database connection
            schema_name: Schema name
            table_name: Table name to verify
            
        Returns:
            True if table exists, False otherwise
            
        Raises:
            VerificationError: If verification query fails
        """
        try:
            result = await conn.fetchval(
                """
                SELECT EXISTS(
                    SELECT 1 FROM information_schema.tables
                    WHERE table_schema = $1 AND table_name = $2
                )
                """,
                schema_name,
                table_name
            )
            return bool(result)
        except Exception as e:
            logger.error(f"Table verification failed for {schema_name}.{table_name}: {e}")
            raise VerificationError(f"Failed to verify table existence: {e}")
    
    async def create_project_schema(
        self,
        conn: asyncpg.Connection,
        schema_name: str
    ) -> None:
        """
        Create project schema with verification.
        
        Args:
            conn: Database connection (must be in transaction)
            schema_name: Schema name to create
            
        Raises:
            SchemaCreationError: If schema creation fails
            VerificationError: If verification fails
        """
        try:
            logger.info(f"Creating schema: {schema_name}")
            await conn.execute(f'CREATE SCHEMA "{schema_name}"')
            
            # Verify schema was created
            if not await self.verify_schema_exists(conn, schema_name):
                raise SchemaCreationError(f"Schema {schema_name} not found after creation")
            
            logger.info(f"Schema created and verified: {schema_name}")
            
        except VerificationError:
            raise
        except Exception as e:
            logger.error(f"Schema creation failed for {schema_name}: {e}")
            raise SchemaCreationError(f"Failed to create schema: {e}")
    
    async def create_helper_functions(
        self,
        conn: asyncpg.Connection,
        schema_name: str
    ) -> None:
        """
        Create helper functions in project schema.
        
        Args:
            conn: Database connection (must be in transaction)
            schema_name: Schema name
            
        Raises:
            SchemaCreationError: If function creation fails
        """
        try:
            logger.info(f"Creating helper functions in schema: {schema_name}")
            
            # Create update_updated_at_column function
            await conn.execute(f'''
                CREATE OR REPLACE FUNCTION "{schema_name}".update_updated_at_column()
                RETURNS TRIGGER AS $$
                BEGIN
                    NEW.updated_at = NOW();
                    RETURN NEW;
                END;
                $$ LANGUAGE plpgsql;
            ''')
            
            logger.info(f"Helper functions created in schema: {schema_name}")
            
        except Exception as e:
            logger.error(f"Helper function creation failed for {schema_name}: {e}")
            raise SchemaCreationError(f"Failed to create helper functions: {e}")
    
    async def create_metadata_table(
        self,
        conn: asyncpg.Connection,
        schema_name: str
    ) -> None:
        """
        Create metadata table in project schema with verification.
        
        Args:
            conn: Database connection (must be in transaction)
            schema_name: Schema name
            
        Raises:
            MetadataCreationError: If metadata table creation fails
            VerificationError: If verification fails
        """
        try:
            logger.info(f"Creating metadata table in schema: {schema_name}")
            
            await conn.execute(f'''
                CREATE TABLE "{schema_name}"._zendbx_metadata (
                    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
                    table_name VARCHAR(255) UNIQUE NOT NULL,
                    created_by VARCHAR(255),
                    created_at TIMESTAMPTZ DEFAULT NOW(),
                    updated_at TIMESTAMPTZ DEFAULT NOW()
                )
            ''')
            
            # Verify table was created
            if not await self.verify_table_exists(conn, schema_name, "_zendbx_metadata"):
                raise MetadataCreationError(
                    f"Metadata table not found in schema {schema_name} after creation"
                )
            
            logger.info(f"Metadata table created and verified in schema: {schema_name}")
            
        except VerificationError:
            raise
        except Exception as e:
            logger.error(f"Metadata table creation failed for {schema_name}: {e}")
            raise MetadataCreationError(f"Failed to create metadata table: {e}")
    
    async def generate_jwt_keys(
        self,
        project_id: UUID,
        slug: str,
        jwt_secret: str
    ) -> Dict[str, str]:
        """
        Generate JWT-signed API keys for project.
        
        Args:
            project_id: Project UUID
            slug: Project slug
            jwt_secret: JWT signing secret
            
        Returns:
            Dict with 'anon' and 'service_role' keys
            
        Raises:
            APIKeyGenerationError: If key generation fails
        """
        try:
            logger.info(f"Generating JWT keys for project: {project_id}")
            
            now_ts = int(datetime.utcnow().timestamp())
            
            anon_payload = {
                "iss": "zendbx",
                "project_id": str(project_id),
                "project_slug": slug,
                "role": "anon",
                "iat": now_ts,
            }
            
            service_payload = {
                "iss": "zendbx",
                "project_id": str(project_id),
                "project_slug": slug,
                "role": "service_role",
                "iat": now_ts,
            }
            
            anon_key = pyjwt.encode(anon_payload, jwt_secret, algorithm="HS256")
            service_key = pyjwt.encode(service_payload, jwt_secret, algorithm="HS256")
            
            logger.info(f"JWT keys generated for project: {project_id}")
            
            return {
                "anon": anon_key,
                "service_role": service_key
            }
            
        except Exception as e:
            logger.error(f"JWT key generation failed for project {project_id}: {e}")
            raise APIKeyGenerationError(f"Failed to generate JWT keys: {e}")
    
    async def store_api_keys(
        self,
        conn: asyncpg.Connection,
        user_id: UUID,
        project_id: UUID,
        keys: Dict[str, str]
    ) -> None:
        """
        Store API keys in database.
        
        Args:
            conn: Database connection (must be in transaction)
            user_id: User UUID
            project_id: Project UUID
            keys: Dict with 'anon' and 'service_role' keys
            
        Raises:
            APIKeyGenerationError: If key storage fails
        """
        try:
            logger.info(f"Storing API keys for project: {project_id}")
            
            anon_key = keys["anon"]
            service_key = keys["service_role"]
            
            anon_hash = hashlib.sha256(anon_key.encode()).hexdigest()
            service_hash = hashlib.sha256(service_key.encode()).hexdigest()
            
            # Insert anon key
            await conn.execute(
                """
                INSERT INTO api_keys (
                    user_id, project_id, name, key_hash, key_prefix,
                    encrypted_key, role, key_type, is_active
                )
                VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9)
                """,
                user_id, project_id, "anon (public)",
                anon_hash, anon_key[:20] + "...", anon_key,
                "read", "anon", True
            )
            
            # Insert service_role key
            await conn.execute(
                """
                INSERT INTO api_keys (
                    user_id, project_id, name, key_hash, key_prefix,
                    encrypted_key, role, key_type, is_active
                )
                VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9)
                """,
                user_id, project_id, "service_role (secret)",
                service_hash, service_key[:20] + "...", service_key,
                "admin", "service_role", True
            )
            
            logger.info(f"API keys stored for project: {project_id}")
            
        except Exception as e:
            logger.error(f"API key storage failed for project {project_id}: {e}")
            raise APIKeyGenerationError(f"Failed to store API keys: {e}")
    
    async def initialize_quota(
        self,
        conn: asyncpg.Connection,
        project_id: UUID
    ) -> None:
        """
        Initialize project quota tracking.
        
        Args:
            conn: Database connection (must be in transaction)
            project_id: Project UUID
            
        Raises:
            ProvisioningError: If quota initialization fails
        """
        try:
            logger.info(f"Initializing quota for project: {project_id}")
            
            await conn.execute(
                "INSERT INTO project_quotas (project_id) VALUES ($1)",
                project_id
            )
            
            logger.info(f"Quota initialized for project: {project_id}")
            
        except Exception as e:
            logger.error(f"Quota initialization failed for project {project_id}: {e}")
            raise ProvisioningError(f"Failed to initialize quota: {e}")
    
    async def provision_project(
        self,
        user_id: UUID,
        name: str,
        description: Optional[str] = None
    ) -> Dict:
        """
        Atomically provision a new project.
        
        All steps execute in a single transaction:
        1. Generate unique identifiers
        2. Insert project row
        3. Create PostgreSQL schema
        4. Create helper functions
        5. Create metadata table
        6. Generate and store API keys
        7. Initialize quota tracking
        
        If ANY step fails, the entire transaction is rolled back.
        
        Args:
            user_id: Owner's user ID
            name: Project name
            description: Optional project description
            
        Returns:
            Dict with project details and API keys
            
        Raises:
            ProvisioningError: If provisioning fails at any step
        """
        conn = None
        transaction = None
        
        try:
            # Connect to database
            logger.info(f"Starting atomic provisioning for project: {name}")
            conn = await asyncpg.connect(self.database_url)
            
            # Start transaction
            transaction = conn.transaction()
            await transaction.start()
            
            try:
                # Step 1: Generate unique identifiers
                logger.info("Step 1: Generating unique identifiers")
                db_name = await self.generate_unique_db_name(conn)
                schema_name = db_name  # Use db_name as schema_name
                jwt_secret = secrets.token_urlsafe(32)
                
                # Step 2: Insert project row (to get project_id)
                logger.info("Step 2: Creating project metadata")
                result = await conn.fetchrow(
                    """
                    INSERT INTO projects (
                        user_id, name, description, database_name,
                        schema_name, jwt_secret, slug, status
                    )
                    VALUES ($1, $2, $3, $4, $5, $6, $7, $8)
                    RETURNING id, user_id, name, slug, description,
                              database_name, schema_name, status,
                              created_at, updated_at
                    """,
                    user_id, name, description, db_name,
                    schema_name, jwt_secret, "",  # Temporary slug
                    "active"
                )
                
                project = dict(result)
                project_id = project["id"]
                
                # Step 3: Generate clean slug
                logger.info("Step 3: Generating unique slug")
                slug = await self.generate_unique_slug(conn, name)
                
                await conn.execute(
                    "UPDATE projects SET slug = $1 WHERE id = $2",
                    slug, project_id
                )
                project["slug"] = slug
                
                # Step 4: Create PostgreSQL schema
                logger.info(f"Step 4: Creating PostgreSQL schema: {schema_name}")
                await self.create_project_schema(conn, schema_name)
                
                # Step 5: Create helper functions
                logger.info("Step 5: Creating helper functions")
                await self.create_helper_functions(conn, schema_name)
                
                # Step 6: Create metadata table
                logger.info("Step 6: Creating metadata table")
                await self.create_metadata_table(conn, schema_name)
                
                # Step 7: Generate and store API keys
                logger.info("Step 7: Generating API keys")
                keys = await self.generate_jwt_keys(project_id, slug, jwt_secret)
                await self.store_api_keys(conn, user_id, project_id, keys)
                
                # Step 8: Initialize quota
                logger.info("Step 8: Initializing quota tracking")
                await self.initialize_quota(conn, project_id)
                
                # Commit transaction
                await transaction.commit()
                logger.info(f"✅ Project provisioned successfully: {name} (ID: {project_id})")
                
                return {
                    "project": project,
                    "keys": keys,
                    "status": "success"
                }
                
            except Exception as e:
                # Rollback transaction on any error
                logger.error(f"Provisioning failed, rolling back transaction: {e}")
                await transaction.rollback()
                raise
                
        except Exception as e:
            logger.error(f"Atomic provisioning failed for project '{name}': {e}")
            raise ProvisioningError(f"Failed to provision project: {e}")
            
        finally:
            if conn:
                await conn.close()
