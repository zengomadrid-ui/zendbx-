"""
Audit Logging Service
Tracks all authentication and security events
"""
from typing import Optional, Dict, Any
from uuid import UUID
from datetime import datetime

from app.core.database import get_main_db_pool


class AuditService:
    
    @staticmethod
    async def log_event(
        event_type: str,
        user_id: Optional[UUID] = None,
        event_data: Optional[Dict[str, Any]] = None,
        ip_address: Optional[str] = None,
        user_agent: Optional[str] = None,
        success: bool = True,
        error_message: Optional[str] = None
    ):
        """Log an audit event"""
        pool = await get_main_db_pool()
        
        async with pool.acquire() as conn:
            await conn.execute(
                """
                INSERT INTO audit_logs (
                    user_id, event_type, event_data, ip_address,
                    user_agent, success, error_message
                )
                VALUES ($1, $2, $3, $4, $5, $6, $7)
                """,
                user_id, event_type, event_data, ip_address,
                user_agent, success, error_message
            )
    
    @staticmethod
    async def get_logs(
        user_id: Optional[UUID] = None,
        event_type: Optional[str] = None,
        success: Optional[bool] = None,
        date_from: Optional[str] = None,
        date_to: Optional[str] = None,
        limit: int = 100,
        offset: int = 0
    ):
        """Get audit logs with filters"""
        pool = await get_main_db_pool()
        
        conditions = []
        params = []
        param_count = 1
        
        if user_id:
            conditions.append(f"user_id = ${param_count}")
            params.append(user_id)
            param_count += 1
        
        if event_type:
            conditions.append(f"event_type = ${param_count}")
            params.append(event_type)
            param_count += 1
        
        if success is not None:
            conditions.append(f"success = ${param_count}")
            params.append(success)
            param_count += 1
        
        if date_from:
            conditions.append(f"created_at >= ${param_count}::date")
            params.append(date_from)
            param_count += 1
        
        if date_to:
            conditions.append(f"created_at <= ${param_count}::date + interval '1 day'")
            params.append(date_to)
            param_count += 1
        
        where_clause = " AND ".join(conditions) if conditions else "TRUE"
        
        async with pool.acquire() as conn:
            logs = await conn.fetch(
                f"""
                SELECT 
                    al.*,
                    u.email as user_email
                FROM audit_logs al
                LEFT JOIN users u ON al.user_id = u.id
                WHERE {where_clause}
                ORDER BY al.created_at DESC
                LIMIT ${param_count} OFFSET ${param_count + 1}
                """,
                *params, limit, offset
            )
            
            total = await conn.fetchval(
                f"SELECT COUNT(*) FROM audit_logs WHERE {where_clause}",
                *params
            )
            
            return {
                "logs": [dict(log) for log in logs],
                "total": total,
                "limit": limit,
                "offset": offset
            }
    
    @staticmethod
    async def log_login_attempt(
        email: str,
        ip_address: str,
        success: bool,
        error_message: Optional[str] = None
    ):
        """Log login attempt"""
        pool = await get_main_db_pool()
        
        async with pool.acquire() as conn:
            await conn.execute(
                """
                INSERT INTO login_attempts (email, ip_address, success, error_message)
                VALUES ($1, $2, $3, $4)
                """,
                email, ip_address, success, error_message
            )
    
    @staticmethod
    async def get_recent_login_attempts(email: str, minutes: int = 15):
        """Get recent login attempts for rate limiting"""
        pool = await get_main_db_pool()
        
        async with pool.acquire() as conn:
            attempts = await conn.fetch(
                """
                SELECT * FROM login_attempts
                WHERE email = $1 
                AND created_at > NOW() - INTERVAL '%s minutes'
                ORDER BY created_at DESC
                """,
                email, minutes
            )
            
            return [dict(a) for a in attempts]
