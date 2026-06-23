"""
Auth Context Collector
Collects authentication and user-related information for AI understanding
"""

from typing import Dict, Any, List, Optional
import logging
from app.core.db_router import get_main_db_pool

logger = logging.getLogger(__name__)


class AuthCollector:
    """
    Collects authentication context for a project
    Provides AI with understanding of:
    - Authentication providers configured
    - User statistics
    - Session information
    - Auth configuration
    """
    
    async def collect(self, project_id: str) -> Dict[str, Any]:
        """
        Collect complete auth context for a project
        
        Args:
            project_id: Project UUID
            
        Returns:
            Dict with auth context information
        """
        try:
            pool = await get_main_db_pool()
            
            async with pool.acquire() as conn:
                # Get auth providers configured
                providers = await self._get_auth_providers(conn, project_id)
                
                # Get user statistics
                user_stats = await self._get_user_stats(conn, project_id)
                
                # Get session configuration
                session_config = await self._get_session_config(conn, project_id)
                
                # Get MFA status
                mfa_status = await self._get_mfa_status(conn, project_id)
                
                # Get recent activity
                recent_activity = await self._get_recent_activity(conn, project_id)
                
                return {
                    "providers": providers,
                    "users": user_stats,
                    "sessions": session_config,
                    "mfa": mfa_status,
                    "recent_activity": recent_activity,
                    "status": "active",
                    "_collected_at": "now()"
                }
                
        except Exception as e:
            logger.error(f"Error collecting auth context: {str(e)}")
            return {
                "error": str(e),
                "status": "error",
                "_collected_at": "now()"
            }
    
    async def _get_auth_providers(
        self, 
        conn, 
        project_id: str
    ) -> List[Dict[str, Any]]:
        """Get configured authentication providers"""
        try:
            rows = await conn.fetch(
                """
                SELECT 
                    provider_name,
                    enabled,
                    config_json->>'client_id' as has_client_id,
                    CASE 
                        WHEN config_json->>'client_secret' IS NOT NULL THEN true
                        ELSE false
                    END as has_client_secret,
                    created_at,
                    updated_at
                FROM oauth_providers
                WHERE project_id = $1
                ORDER BY provider_name
                """,
                project_id
            )
            
            providers = []
            for row in rows:
                providers.append({
                    "provider": row["provider_name"],
                    "enabled": row["enabled"],
                    "configured": bool(row["has_client_id"]) and bool(row["has_client_secret"]),
                    "created_at": row["created_at"].isoformat() if row["created_at"] else None,
                    "updated_at": row["updated_at"].isoformat() if row["updated_at"] else None
                })
            
            return providers
            
        except Exception as e:
            logger.warning(f"Could not fetch auth providers: {str(e)}")
            return []
    
    async def _get_user_stats(
        self, 
        conn, 
        project_id: str
    ) -> Dict[str, Any]:
        """Get user statistics"""
        try:
            # Get total users
            total = await conn.fetchval(
                """
                SELECT COUNT(*) 
                FROM project_users 
                WHERE project_id = $1
                """,
                project_id
            )
            
            # Get active users (logged in within last 30 days)
            active = await conn.fetchval(
                """
                SELECT COUNT(DISTINCT pu.user_id)
                FROM project_users pu
                JOIN user_sessions us ON pu.user_id = us.user_id
                WHERE pu.project_id = $1 
                  AND us.expires_at > NOW()
                  AND us.created_at > NOW() - INTERVAL '30 days'
                """,
                project_id
            )
            
            # Get users by auth method
            by_method = await conn.fetch(
                """
                SELECT 
                    auth_method,
                    COUNT(*) as count
                FROM project_users
                WHERE project_id = $1
                GROUP BY auth_method
                """,
                project_id
            )
            
            methods = {row["auth_method"]: row["count"] for row in by_method}
            
            return {
                "total": total or 0,
                "active_30d": active or 0,
                "by_method": methods
            }
            
        except Exception as e:
            logger.warning(f"Could not fetch user stats: {str(e)}")
            return {
                "total": 0,
                "active_30d": 0,
                "by_method": {}
            }
    
    async def _get_session_config(
        self, 
        conn, 
        project_id: str
    ) -> Dict[str, Any]:
        """Get session configuration"""
        try:
            row = await conn.fetchrow(
                """
                SELECT 
                    session_timeout_minutes,
                    refresh_token_enabled,
                    max_concurrent_sessions
                FROM project_auth_config
                WHERE project_id = $1
                """,
                project_id
            )
            
            if row:
                return {
                    "timeout_minutes": row["session_timeout_minutes"],
                    "refresh_enabled": row["refresh_token_enabled"],
                    "max_concurrent": row["max_concurrent_sessions"]
                }
            else:
                # Default configuration
                return {
                    "timeout_minutes": 60,
                    "refresh_enabled": True,
                    "max_concurrent": 5
                }
                
        except Exception as e:
            logger.warning(f"Could not fetch session config: {str(e)}")
            return {
                "timeout_minutes": 60,
                "refresh_enabled": True,
                "max_concurrent": 5
            }
    
    async def _get_mfa_status(
        self, 
        conn, 
        project_id: str
    ) -> Dict[str, Any]:
        """Get MFA configuration status"""
        try:
            row = await conn.fetchrow(
                """
                SELECT 
                    mfa_enabled,
                    mfa_required_for_admin,
                    COUNT(CASE WHEN mfa_enabled THEN 1 END) as users_with_mfa
                FROM project_auth_config pac
                LEFT JOIN project_users pu ON pac.project_id = pu.project_id
                WHERE pac.project_id = $1
                GROUP BY pac.mfa_enabled, pac.mfa_required_for_admin
                """,
                project_id
            )
            
            if row:
                return {
                    "enabled": row["mfa_enabled"],
                    "required_for_admin": row["mfa_required_for_admin"],
                    "users_enrolled": row["users_with_mfa"] or 0
                }
            else:
                return {
                    "enabled": False,
                    "required_for_admin": False,
                    "users_enrolled": 0
                }
                
        except Exception as e:
            logger.warning(f"Could not fetch MFA status: {str(e)}")
            return {
                "enabled": False,
                "required_for_admin": False,
                "users_enrolled": 0
            }
    
    async def _get_recent_activity(
        self, 
        conn, 
        project_id: str,
        limit: int = 10
    ) -> List[Dict[str, Any]]:
        """Get recent authentication activity"""
        try:
            rows = await conn.fetch(
                """
                SELECT 
                    al.action,
                    al.user_id,
                    al.created_at,
                    al.ip_address,
                    pu.email
                FROM audit_logs al
                JOIN project_users pu ON al.user_id = pu.user_id
                WHERE al.project_id = $1
                  AND al.action IN ('login', 'logout', 'signup', 'password_reset')
                ORDER BY al.created_at DESC
                LIMIT $2
                """,
                project_id,
                limit
            )
            
            activity = []
            for row in rows:
                activity.append({
                    "action": row["action"],
                    "user_id": str(row["user_id"]),
                    "email": row["email"],
                    "timestamp": row["created_at"].isoformat() if row["created_at"] else None,
                    "ip_address": row["ip_address"]
                })
            
            return activity
            
        except Exception as e:
            logger.warning(f"Could not fetch recent activity: {str(e)}")
            return []
