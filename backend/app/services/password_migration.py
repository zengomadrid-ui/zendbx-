"""
Password Migration Service
Handles automatic rehashing of weak or outdated password hashes
"""

import logging
from typing import Optional
from app.core.security import (
    verify_password_with_migration_check,
    hash_password,
    detect_weak_hash,
    is_password_hash_secure
)
from app.core.database import execute_on_main_db
from uuid import UUID

logger = logging.getLogger(__name__)

# ============================================
# PASSWORD MIGRATION SERVICE
# ============================================

class PasswordMigrationService:
    """
    Service for migrating password hashes to secure bcrypt.
    
    Handles:
    - Detection of weak hashes (MD5, SHA256, old bcrypt)
    - Automatic rehashing on successful login
    - Migration tracking and reporting
    """
    
    async def check_and_migrate_password(
        self,
        user_id: UUID,
        email: str,
        plain_password: str,
        current_hash: str
    ) -> tuple[bool, bool]:
        """
        Verify password and migrate if needed.
        
        This is called during login to automatically upgrade weak hashes.
        
        Args:
            user_id: User's UUID
            email: User's email (for logging only)
            plain_password: Plain text password from login (NEVER logged)
            current_hash: Current password hash from database
        
        Returns:
            (password_valid, was_migrated)
        """
        # Check if password is valid and if hash needs upgrade
        is_valid, needs_rehash = verify_password_with_migration_check(
            plain_password,
            current_hash
        )
        
        if not is_valid:
            return False, False
        
        # If hash is secure, no migration needed
        if not needs_rehash:
            return True, False
        
        # Detect weak algorithm
        weak_algorithm = detect_weak_hash(current_hash)
        if weak_algorithm:
            logger.warning(
                f"Weak password hash detected for user {email}",
                extra={
                    "user_id": str(user_id),
                    "email": email,
                    "weak_algorithm": weak_algorithm
                }
            )
        
        # Rehash with secure bcrypt
        try:
            new_hash = hash_password(plain_password)
            
            # Update database
            await execute_on_main_db(
                """
                UPDATE users 
                SET password_hash = $1,
                    updated_at = NOW()
                WHERE id = $2
                """,
                new_hash,
                user_id
            )
            
            # Log migration success (not password value)
            logger.info(
                f"✅ Password hash migrated for user: {email}",
                extra={
                    "user_id": str(user_id),
                    "email": email,
                    "from_algorithm": weak_algorithm or "bcrypt_weak",
                    "to_algorithm": "bcrypt_12"
                }
            )
            
            # Log to audit table
            await self._log_migration(
                user_id,
                email,
                weak_algorithm or "bcrypt_weak"
            )
            
            return True, True
            
        except Exception as e:
            # Don't fail login if migration fails
            logger.error(
                f"Failed to migrate password hash for user: {email}",
                extra={
                    "user_id": str(user_id),
                    "email": email,
                    "error": str(e)
                }
            )
            return True, False
    
    async def _log_migration(
        self,
        user_id: UUID,
        email: str,
        from_algorithm: str
    ):
        """Log password hash migration to audit table"""
        try:
            await execute_on_main_db(
                """
                INSERT INTO auth_audit_log (
                    event_type, email, metadata, created_at
                )
                VALUES ($1, $2, $3, NOW())
                """,
                "password_hash_migrated",
                email,
                {
                    "user_id": str(user_id),
                    "from_algorithm": from_algorithm,
                    "to_algorithm": "bcrypt_12"
                }
            )
        except Exception as e:
            logger.error(f"Failed to log password migration: {e}")
    
    async def scan_weak_hashes(self) -> dict:
        """
        Scan database for users with weak password hashes.
        
        Returns statistics about password hash security.
        """
        try:
            # Get all password hashes
            result = await execute_on_main_db(
                """
                SELECT id, email, password_hash, created_at
                FROM users
                WHERE is_active = TRUE
                ORDER BY created_at DESC
                """
            )
            
            stats = {
                "total_users": len(result),
                "secure_hashes": 0,
                "weak_hashes": 0,
                "weak_by_algorithm": {},
                "users_needing_migration": []
            }
            
            for user in result:
                weak_algo = detect_weak_hash(user["password_hash"])
                
                if weak_algo:
                    stats["weak_hashes"] += 1
                    stats["weak_by_algorithm"][weak_algo] = \
                        stats["weak_by_algorithm"].get(weak_algo, 0) + 1
                    stats["users_needing_migration"].append({
                        "user_id": str(user["id"]),
                        "email": user["email"],
                        "algorithm": weak_algo,
                        "created_at": user["created_at"].isoformat()
                    })
                elif is_password_hash_secure(user["password_hash"]):
                    stats["secure_hashes"] += 1
                else:
                    # Unknown or insecure but not identified
                    stats["weak_hashes"] += 1
                    stats["weak_by_algorithm"]["unknown"] = \
                        stats["weak_by_algorithm"].get("unknown", 0) + 1
            
            return stats
            
        except Exception as e:
            logger.error(f"Error scanning password hashes: {e}")
            return {
                "error": str(e),
                "total_users": 0,
                "secure_hashes": 0,
                "weak_hashes": 0
            }
    
    async def force_rehash_user(self, user_id: UUID) -> bool:
        """
        Force a user to reset their password (for weak hashes).
        
        Sets a flag that requires password reset on next login.
        """
        try:
            await execute_on_main_db(
                """
                UPDATE users
                SET metadata = COALESCE(metadata, '{}'::jsonb) || 
                    '{"requires_password_reset": true, "reason": "security_upgrade"}'::jsonb,
                    updated_at = NOW()
                WHERE id = $1
                """,
                user_id
            )
            
            logger.info(f"User {user_id} flagged for forced password reset")
            return True
            
        except Exception as e:
            logger.error(f"Failed to flag user for password reset: {e}")
            return False


# ============================================
# SINGLETON INSTANCE
# ============================================

password_migration_service = PasswordMigrationService()
