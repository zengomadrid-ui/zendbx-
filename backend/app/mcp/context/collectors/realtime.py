"""
Realtime Context Collector
Collects realtime/WebSocket-related information for AI understanding
"""

from typing import Dict, Any, List, Optional
import logging
from app.core.db_router import get_main_db_pool

logger = logging.getLogger(__name__)


class RealtimeCollector:
    """
    Collects realtime context for a project
    Provides AI with understanding of:
    - Active WebSocket connections
    - Subscribed channels/topics
    - Realtime configuration
    - Message statistics
    """
    
    async def collect(self, project_id: str) -> Dict[str, Any]:
        """
        Collect complete realtime context for a project
        
        Args:
            project_id: Project UUID
            
        Returns:
            Dict with realtime context information
        """
        try:
            pool = await get_main_db_pool()
            
            async with pool.acquire() as conn:
                # Get realtime configuration
                config = await self._get_realtime_config(conn, project_id)
                
                # Get active connections (from recent sessions)
                connections = await self._get_connection_stats(conn, project_id)
                
                # Get subscribed channels
                channels = await self._get_channels(conn, project_id)
                
                # Get message statistics
                message_stats = await self._get_message_stats(conn, project_id)
                
                return {
                    "configuration": config,
                    "connections": connections,
                    "channels": channels,
                    "message_stats": message_stats,
                    "status": "active" if config.get("enabled") else "disabled",
                    "_collected_at": "now()"
                }
                
        except Exception as e:
            logger.error(f"Error collecting realtime context: {str(e)}")
            return {
                "error": str(e),
                "status": "error",
                "_collected_at": "now()"
            }
    
    async def _get_realtime_config(
        self, 
        conn, 
        project_id: str
    ) -> Dict[str, Any]:
        """Get realtime configuration"""
        try:
            row = await conn.fetchrow(
                """
                SELECT 
                    realtime_enabled,
                    max_connections_per_user,
                    message_rate_limit
                FROM project_realtime_config
                WHERE project_id = $1
                """,
                project_id
            )
            
            if row:
                return {
                    "enabled": row["realtime_enabled"],
                    "max_connections_per_user": row["max_connections_per_user"],
                    "message_rate_limit": row["message_rate_limit"]
                }
            else:
                # Default configuration
                return {
                    "enabled": True,
                    "max_connections_per_user": 10,
                    "message_rate_limit": 100
                }
                
        except Exception as e:
            logger.warning(f"Could not fetch realtime config: {str(e)}")
            return {
                "enabled": True,
                "max_connections_per_user": 10,
                "message_rate_limit": 100
            }
    
    async def _get_connection_stats(
        self, 
        conn, 
        project_id: str
    ) -> Dict[str, Any]:
        """Get WebSocket connection statistics"""
        try:
            # Get active connections (sessions active in last 5 minutes)
            row = await conn.fetchrow(
                """
                SELECT 
                    COUNT(*) as active_connections,
                    COUNT(DISTINCT user_id) as unique_users,
                    MAX(last_activity_at) as last_activity
                FROM realtime_connections
                WHERE project_id = $1
                  AND last_activity_at > NOW() - INTERVAL '5 minutes'
                  AND disconnected_at IS NULL
                """,
                project_id
            )
            
            if row:
                return {
                    "active": row["active_connections"] or 0,
                    "unique_users": row["unique_users"] or 0,
                    "last_activity": row["last_activity"].isoformat() if row["last_activity"] else None
                }
            else:
                return {
                    "active": 0,
                    "unique_users": 0,
                    "last_activity": None
                }
                
        except Exception as e:
            logger.warning(f"Could not fetch connection stats: {str(e)}")
            return {
                "active": 0,
                "unique_users": 0,
                "last_activity": None
            }
    
    async def _get_channels(
        self, 
        conn, 
        project_id: str
    ) -> List[Dict[str, Any]]:
        """Get subscribed channels/topics"""
        try:
            rows = await conn.fetch(
                """
                SELECT 
                    channel_name,
                    COUNT(*) as subscriber_count,
                    MAX(subscribed_at) as last_subscription
                FROM realtime_subscriptions
                WHERE project_id = $1
                  AND unsubscribed_at IS NULL
                GROUP BY channel_name
                ORDER BY subscriber_count DESC
                LIMIT 20
                """,
                project_id
            )
            
            channels = []
            for row in rows:
                channels.append({
                    "name": row["channel_name"],
                    "subscribers": row["subscriber_count"],
                    "last_subscription": row["last_subscription"].isoformat() if row["last_subscription"] else None
                })
            
            return channels
            
        except Exception as e:
            logger.warning(f"Could not fetch channels: {str(e)}")
            return []
    
    async def _get_message_stats(
        self, 
        conn, 
        project_id: str
    ) -> Dict[str, Any]:
        """Get realtime message statistics"""
        try:
            # Get message counts for last 24 hours
            row = await conn.fetchrow(
                """
                SELECT 
                    COUNT(*) as total_messages_24h,
                    COUNT(DISTINCT channel_name) as active_channels,
                    MAX(created_at) as last_message,
                    AVG(EXTRACT(EPOCH FROM (delivered_at - created_at))) as avg_latency_sec
                FROM realtime_messages
                WHERE project_id = $1
                  AND created_at > NOW() - INTERVAL '24 hours'
                """,
                project_id
            )
            
            if row:
                return {
                    "messages_24h": row["total_messages_24h"] or 0,
                    "active_channels": row["active_channels"] or 0,
                    "last_message": row["last_message"].isoformat() if row["last_message"] else None,
                    "avg_latency_ms": round(row["avg_latency_sec"] * 1000, 2) if row["avg_latency_sec"] else None
                }
            else:
                return {
                    "messages_24h": 0,
                    "active_channels": 0,
                    "last_message": None,
                    "avg_latency_ms": None
                }
                
        except Exception as e:
            logger.warning(f"Could not fetch message stats: {str(e)}")
            return {
                "messages_24h": 0,
                "active_channels": 0,
                "last_message": None,
                "avg_latency_ms": None
            }
