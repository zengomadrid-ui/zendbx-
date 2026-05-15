"""
Multi-Factor Authentication Service
Handles TOTP and SMS-based 2FA
"""
import pyotp
import secrets
from typing import Optional, List
from uuid import UUID

from app.core.database import get_main_db_pool


class MFAService:
    
    @staticmethod
    def generate_totp_secret() -> str:
        """Generate a new TOTP secret"""
        return pyotp.random_base32()
    
    @staticmethod
    def generate_totp_uri(secret: str, email: str, issuer: str = "AURIX") -> str:
        """Generate TOTP URI for QR code"""
        totp = pyotp.TOTP(secret)
        return totp.provisioning_uri(name=email, issuer_name=issuer)
    
    @staticmethod
    def verify_totp(secret: str, code: str) -> bool:
        """Verify TOTP code"""
        totp = pyotp.TOTP(secret)
        return totp.verify(code, valid_window=1)
    
    @staticmethod
    def generate_backup_codes(count: int = 10) -> List[str]:
        """Generate backup codes"""
        return [secrets.token_hex(4).upper() for _ in range(count)]
    
    @staticmethod
    async def enable_mfa(
        user_id: UUID,
        method: str,
        secret: str,
        backup_codes: List[str]
    ):
        """Enable MFA for user"""
        pool = await get_main_db_pool()
        
        async with pool.acquire() as conn:
            await conn.execute(
                """
                UPDATE security_settings
                SET mfa_enabled = TRUE,
                    mfa_method = $1,
                    mfa_secret = $2,
                    backup_codes = $3,
                    updated_at = NOW()
                WHERE user_id = $4
                """,
                method, secret, backup_codes, user_id
            )
    
    @staticmethod
    async def disable_mfa(user_id: UUID):
        """Disable MFA for user"""
        pool = await get_main_db_pool()
        
        async with pool.acquire() as conn:
            await conn.execute(
                """
                UPDATE security_settings
                SET mfa_enabled = FALSE,
                    mfa_method = NULL,
                    mfa_secret = NULL,
                    backup_codes = NULL,
                    updated_at = NOW()
                WHERE user_id = $1
                """,
                user_id
            )
    
    @staticmethod
    async def get_mfa_settings(user_id: UUID):
        """Get MFA settings for user"""
        pool = await get_main_db_pool()
        
        async with pool.acquire() as conn:
            settings = await conn.fetchrow(
                """
                SELECT mfa_enabled, mfa_method, mfa_secret, backup_codes
                FROM security_settings
                WHERE user_id = $1
                """,
                user_id
            )
            
            return dict(settings) if settings else None
    
    @staticmethod
    async def verify_backup_code(user_id: UUID, code: str) -> bool:
        """Verify and consume a backup code"""
        pool = await get_main_db_pool()
        
        async with pool.acquire() as conn:
            settings = await conn.fetchrow(
                """
                SELECT backup_codes FROM security_settings
                WHERE user_id = $1
                """,
                user_id
            )
            
            if not settings or not settings['backup_codes']:
                return False
            
            backup_codes = settings['backup_codes']
            
            if code.upper() in backup_codes:
                # Remove used code
                backup_codes.remove(code.upper())
                
                await conn.execute(
                    """
                    UPDATE security_settings
                    SET backup_codes = $1
                    WHERE user_id = $2
                    """,
                    backup_codes, user_id
                )
                
                return True
            
            return False
    
    @staticmethod
    async def regenerate_backup_codes(user_id: UUID) -> List[str]:
        """Regenerate backup codes"""
        backup_codes = MFAService.generate_backup_codes()
        pool = await get_main_db_pool()
        
        async with pool.acquire() as conn:
            await conn.execute(
                """
                UPDATE security_settings
                SET backup_codes = $1,
                    updated_at = NOW()
                WHERE user_id = $2
                """,
                backup_codes, user_id
            )
        
        return backup_codes
