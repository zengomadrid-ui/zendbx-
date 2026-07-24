"""
Unified Authentication Service
Central service for all authentication operations to ensure consistency.
"""
import logging
import secrets
from typing import Optional, Dict, Tuple
from uuid import UUID
import asyncpg
from pydantic import EmailStr

from app.core.security import hash_password

logger = logging.getLogger(__name__)


class AuthenticationService:
    """
    Centralized authentication service.
    All signup endpoints MUST use this service to ensure:
    - Passwords are always hashed
    - Usernames are never NULL
    - Duplicate usernames are handled
    - Consistent validation and error handling
    """
    
    @staticmethod
    async def create_user(
        conn: asyncpg.Connection,
        email: str,
        password: str,
        name: Optional[str] = None,
        project_id: Optional[UUID] = None,
        provider: str = "email"
    ) -> Dict:
        """
        Create a new user with guaranteed password hashing and username generation.
        
        Args:
            conn: Database connection
            email: User email (required)
            password: Plain text password (required) - will be hashed
            name: Display name (optional) - used for username
            project_id: Project ID for project-scoped auth (optional)
            provider: Auth provider ('email', 'google', 'github', etc.)
        
        Returns:
            Dict with user data
            
        Raises:
            ValueError: If validation fails
            RuntimeError: If password hashing fails
        """
        # STEP 1: Validate inputs
        if not email:
            raise ValueError("Email is required")
        if not password:
            raise ValueError("Password is required")
        
        logger.info(f"🔐 [AUTH SERVICE] Creating user: {email}")
        
        # STEP 2: Hash password (NEVER store plain text)
        try:
            logger.info(f"🔐 [AUTH SERVICE] About to hash password for {email}")
            logger.info(f"🔐 [AUTH SERVICE] Password type: {type(password)}")
            logger.info(f"🔐 [AUTH SERVICE] Password length: {len(password)}")
            
            password_hash = hash_password(password)
            
            logger.info(f"✅ [AUTH SERVICE] Password hashed successfully for {email}")
            logger.info(f"✅ [AUTH SERVICE] Hash type: {type(password_hash)}")
            logger.info(f"✅ [AUTH SERVICE] Hash length: {len(password_hash)}")
            logger.info(f"✅ [AUTH SERVICE] Hash preview: {password_hash[:20]}...")
            
            # Verify hash is valid (sanity check)
            if not password_hash or len(password_hash) < 20:
                raise RuntimeError("Password hashing produced invalid hash")
            if password_hash == "undefined" or password_hash == "null":
                raise RuntimeError("Password hashing produced invalid value")
            if not password_hash.startswith(('$2b$', '$2a$', '$2y$', '$argon2')):
                raise RuntimeError(f"Password hash has invalid format: {password_hash[:10]}")
                
        except Exception as e:
            logger.error(f"❌ [AUTH SERVICE] Password hashing failed for {email}: {str(e)}")
            raise RuntimeError(f"Failed to hash password: {str(e)}")
        
        # STEP 3: Generate username (NEVER NULL)
        username = await AuthenticationService._generate_unique_username(
            conn, name, email, project_id
        )
        logger.info(f"✅ [AUTH SERVICE] Username generated: {username} for {email}")
        
        # STEP 4: Insert user into database
        try:
            logger.info(f"🔍 [AUTH SERVICE] ===== BEFORE INSERT =====")
            logger.info(f"🔍 [AUTH SERVICE] email = {email} (type: {type(email)})")
            logger.info(f"🔍 [AUTH SERVICE] username = {username} (type: {type(username)})")
            logger.info(f"🔍 [AUTH SERVICE] password_hash = {password_hash[:30]}... (type: {type(password_hash)})")
            logger.info(f"🔍 [AUTH SERVICE] project_id = {project_id} (type: {type(project_id)})")
            logger.info(f"🔍 [AUTH SERVICE] provider = {provider}")
            
            if project_id:
                # Project-scoped auth (multi-tenant)
                logger.info(f"🔍 [AUTH SERVICE] Inserting into auth.users with project_id")
                user = await conn.fetchrow("""
                    INSERT INTO auth.users (
                        project_id, email, username, password_hash, provider,
                        email_verified, is_active, created_at, last_login_at, updated_at
                    )
                    VALUES ($1, $2, $3, $4, $5, FALSE, TRUE, NOW(), NOW(), NOW())
                    RETURNING id, email, username, provider, email_verified, 
                              is_active, created_at, last_login_at
                """, project_id, email, username, password_hash, provider)
            else:
                # Platform auth (main users table)
                logger.info(f"🔍 [AUTH SERVICE] Inserting into users (platform)")
                user = await conn.fetchrow("""
                    INSERT INTO users (
                        email, password_hash, full_name, is_active, is_verified,
                        created_at, updated_at
                    )
                    VALUES ($1, $2, $3, TRUE, FALSE, NOW(), NOW())
                    RETURNING id, email, full_name, is_active, is_verified, 
                              plan, role, created_at
                """, email, password_hash, username)
            
            user_dict = dict(user)
            logger.info(f"✅ [AUTH SERVICE] User created in database: {email} (ID: {user_dict['id']})")
            logger.info(f"✅ [AUTH SERVICE] Returned user keys: {list(user_dict.keys())}")
            
        except Exception as e:
            logger.error(f"❌ [AUTH SERVICE] Database insert failed for {email}: {str(e)}")
            raise
        
        # STEP 5: Post-insert verification
        logger.info(f"🔍 [AUTH SERVICE] Starting post-insert verification...")
        await AuthenticationService._verify_user_creation(
            conn, user_dict['id'], email, username, password_hash, project_id
        )
        
        logger.info(f"✅ [AUTH SERVICE] User creation complete and verified for {email}")
        return user_dict
    
    @staticmethod
    async def _generate_unique_username(
        conn: asyncpg.Connection,
        name: Optional[str],
        email: str,
        project_id: Optional[UUID]
    ) -> str:
        """
        Generate a unique username that is NEVER NULL.
        
        Strategy:
        1. If name provided, use it (sanitized)
        2. Otherwise use email prefix
        3. If duplicate, append random suffix
        4. Keep trying until unique
        """
        # Base username
        if name and name.strip():
            base_username = name.strip()[:50]  # Limit length
        else:
            base_username = email.split('@')[0]
        
        # Sanitize username (alphanumeric + underscore)
        base_username = ''.join(c if c.isalnum() or c == '_' else '_' for c in base_username)
        base_username = base_username[:50]  # PostgreSQL identifier limit
        
        # Ensure not empty
        if not base_username:
            base_username = f"user_{secrets.token_hex(4)}"
        
        # Try base username first
        username = base_username
        max_attempts = 10
        
        for attempt in range(max_attempts):
            # Check if username exists
            if project_id:
                # Check within project scope
                existing = await conn.fetchval("""
                    SELECT COUNT(*) FROM auth.users 
                    WHERE LOWER(username) = LOWER($1) AND project_id = $2
                """, username, project_id)
            else:
                # Check in platform users
                existing = await conn.fetchval("""
                    SELECT COUNT(*) FROM users 
                    WHERE LOWER(full_name) = LOWER($1)
                """, username)
            
            if existing == 0:
                # Username is unique
                return username
            
            # Username exists, add random suffix
            suffix = secrets.token_hex(2)  # 4 character hex
            username = f"{base_username}_{suffix}"
            logger.info(f"🔄 [AUTH SERVICE] Username collision, trying: {username}")
        
        # Fallback: use random username
        username = f"user_{secrets.token_hex(8)}"
        logger.warning(f"⚠️  [AUTH SERVICE] Using random username: {username}")
        return username
    
    @staticmethod
    async def _verify_user_creation(
        conn: asyncpg.Connection,
        user_id: UUID,
        email: str,
        expected_username: str,
        expected_password_hash: str,
        project_id: Optional[UUID]
    ) -> None:
        """
        Verify user was created correctly (sanity check).
        Throws exception if data is corrupted.
        """
        logger.info(f"🔍 [AUTH SERVICE] Verifying user creation: {email}")
        logger.info(f"🔍 [AUTH SERVICE] Expected username: {expected_username}")
        logger.info(f"🔍 [AUTH SERVICE] Expected password_hash prefix: {expected_password_hash[:20]}...")
        logger.info(f"🔍 [AUTH SERVICE] Project ID: {project_id}")
        
        if project_id:
            user = await conn.fetchrow("""
                SELECT email, username, password_hash, provider, project_id
                FROM auth.users
                WHERE id = $1 AND project_id = $2
            """, user_id, project_id)
        else:
            user = await conn.fetchrow("""
                SELECT email, full_name, password_hash
                FROM users
                WHERE id = $1
            """, user_id)
        
        if not user:
            raise RuntimeError(f"User verification failed: user not found after insert")
        
        logger.info(f"🔍 [AUTH SERVICE] Database returned user:")
        for key, value in dict(user).items():
            if key == 'password_hash':
                logger.info(f"  {key}: {value[:30] if value else None}...")
            else:
                logger.info(f"  {key}: {value}")
        
        # Verify username is not NULL
        username_field = user['username'] if project_id else user['full_name']
        if username_field is None:
            raise RuntimeError(f"CRITICAL: username is NULL after insert for {email}")
        
        # Verify password_hash is valid
        if not user['password_hash']:
            raise RuntimeError(f"CRITICAL: password_hash is NULL after insert for {email}")
        if user['password_hash'] == "undefined":
            raise RuntimeError(f"CRITICAL: password_hash is 'undefined' after insert for {email}")
        if not user['password_hash'].startswith(('$2b$', '$2a$', '$2y$', '$argon2')):
            raise RuntimeError(
                f"CRITICAL: password_hash has invalid format after insert for {email}: "
                f"{user['password_hash'][:20]}"
            )
        
        # Verify project_id if applicable
        if project_id:
            if not user.get('project_id'):
                raise RuntimeError(f"CRITICAL: project_id is NULL after insert for {email}")
            if user['project_id'] != project_id:
                raise RuntimeError(
                    f"CRITICAL: project_id mismatch after insert for {email}: "
                    f"expected {project_id}, got {user['project_id']}"
                )
        
        logger.info(f"✅ [AUTH SERVICE] User verification passed for {email}")
        logger.info(f"   - Username: {username_field}")
        logger.info(f"   - Password hash prefix: {user['password_hash'][:10]}")
        if project_id:
            logger.info(f"   - Project ID: {user['project_id']}")


# Global singleton instance
auth_service = AuthenticationService()
