"""
Session Management Service
Handles user sessions, device tracking, and session lifecycle
"""
from datetime import datetime, timedelta
from typing import Optional, List, Dict
from uuid import UUID
import secrets
from user_agents import parse

from app.core.database import get_main_db_pool


class SessionService:
    
    @staticmethod
    async def create_session(
        user_id: UUID,
        ip_address: str,
        user_agent: str,
        location: Optional[str] = None
    ) -> Dict:
        """Create a new session for user"""
        pool = await get_main_db_pool()
        
        # Parse user agent
        ua = parse(user_agent)
        device_name = f"{ua.browser.family} on {ua.os.family}"
        device_type = "mobile" if ua.is_mobile else "tablet" if ua.is_tablet else "desktop"
        browser = ua.browser.family
        os = ua.os.family
        
        # Generate session token
        session_token = secrets.token_urlsafe(32)
        expires_at = datetime.utcnow() + timedelta(days=30)
        
        async with pool.acquire() as conn:
            session = await conn.fetchrow(
                """
                INSERT INTO auth_sessions (
                    user_id, session_token, device_name, device_type,
                    browser, os, ip_address, location, user_agent, expires_at
                )
                VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10)
                RETURNING *
                """,
                user_id, session_token, device_name, device_type,
                browser, os, ip_address, location, user_agent, expires_at
            )
            
            # Update user's last login
            await conn.execute(
                """
                UPDATE users 
                SET last_login_at = NOW(), last_login_ip = $1
                WHERE id = $2
                """,
                ip_address, user_id
            )
            
            return dict(session)
    
    @staticmethod
    async def get_user_sessions(user_id: UUID) -> List[Dict]:
        """Get all active sessions for a user"""
        pool = await get_main_db_pool()
        
        async with pool.acquire() as conn:
            sessions = await conn.fetch(
                """
                SELECT * FROM auth_sessions
                WHERE user_id = $1 AND is_active = TRUE
                ORDER BY last_active DESC
                """,
                user_id
            )
            
            return [dict(s) for s in sessions]
    
    @staticmethod
    async def update_session_activity(session_token: str):
        """Update last_active timestamp"""
        pool = await get_main_db_pool()
        
        async with pool.acquire() as conn:
            await conn.execute(
                """
                UPDATE auth_sessions
                SET last_active = NOW()
                WHERE session_token = $1 AND is_active = TRUE
                """,
                session_token
            )
    
    @staticmethod
    async def logout_session(session_id: UUID, user_id: UUID) -> bool:
        """Logout a specific session"""
        pool = await get_main_db_pool()
        
        async with pool.acquire() as conn:
            result = await conn.execute(
                """
                UPDATE auth_sessions
                SET is_active = FALSE
                WHERE id = $1 AND user_id = $2
                """,
                session_id, user_id
            )
            
            return result == "UPDATE 1"
    
    @staticmethod
    async def logout_all_sessions(user_id: UUID, except_session_id: Optional[UUID] = None):
        """Logout all sessions for a user"""
        pool = await get_main_db_pool()
        
        async with pool.acquire() as conn:
            if except_session_id:
                await conn.execute(
                    """
                    UPDATE auth_sessions
                    SET is_active = FALSE
                    WHERE user_id = $1 AND id != $2
                    """,
                    user_id, except_session_id
                )
            else:
                await conn.execute(
                    """
                    UPDATE auth_sessions
                    SET is_active = FALSE
                    WHERE user_id = $1
                    """,
                    user_id
                )
    
    @staticmethod
    async def cleanup_expired_sessions():
        """Remove expired sessions (background task)"""
        pool = await get_main_db_pool()
        
        async with pool.acquire() as conn:
            await conn.execute(
                """
                UPDATE auth_sessions
                SET is_active = FALSE
                WHERE expires_at < NOW() AND is_active = TRUE
                """
            )
