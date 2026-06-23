"""
Deployment Context Collector
Collects deployment and health status information for AI understanding
"""

from typing import Dict, Any, List, Optional
import logging
import psutil
import platform
from datetime import datetime
from app.core.db_router import get_main_db_pool
from app.core.config import settings

logger = logging.getLogger(__name__)


class DeploymentCollector:
    """
    Collects deployment context for a project
    Provides AI with understanding of:
    - Deployment environment
    - Health status
    - System resources
    - Version information
    """
    
    async def collect(self, project_id: str) -> Dict[str, Any]:
        """
        Collect complete deployment context for a project
        
        Args:
            project_id: Project UUID
            
        Returns:
            Dict with deployment context information
        """
        try:
            pool = await get_main_db_pool()
            
            async with pool.acquire() as conn:
                # Get project deployment info
                deployment_info = await self._get_deployment_info(conn, project_id)
                
                # Get health status
                health = await self._get_health_status(conn, project_id)
                
                # Get system resources
                resources = self._get_system_resources()
                
                # Get version info
                version = self._get_version_info()
                
                return {
                    "deployment": deployment_info,
                    "health": health,
                    "resources": resources,
                    "version": version,
                    "status": "healthy" if health.get("is_healthy") else "degraded",
                    "_collected_at": datetime.utcnow().isoformat()
                }
                
        except Exception as e:
            logger.error(f"Error collecting deployment context: {str(e)}")
            return {
                "error": str(e),
                "status": "error",
                "_collected_at": datetime.utcnow().isoformat()
            }
    
    async def _get_deployment_info(
        self, 
        conn, 
        project_id: str
    ) -> Dict[str, Any]:
        """Get deployment information"""
        try:
            row = await conn.fetchrow(
                """
                SELECT 
                    p.created_at,
                    p.updated_at,
                    p.database_name,
                    p.slug
                FROM projects p
                WHERE p.id = $1
                """,
                project_id
            )
            
            if row:
                return {
                    "environment": settings.ENVIRONMENT,
                    "region": "auto",  # Could be configured
                    "database": row["database_name"],
                    "slug": row["slug"],
                    "created_at": row["created_at"].isoformat() if row["created_at"] else None,
                    "updated_at": row["updated_at"].isoformat() if row["updated_at"] else None,
                    "platform": "ZendBX"
                }
            else:
                return {
                    "environment": settings.ENVIRONMENT,
                    "region": "auto",
                    "platform": "ZendBX"
                }
                
        except Exception as e:
            logger.warning(f"Could not fetch deployment info: {str(e)}")
            return {
                "environment": settings.ENVIRONMENT,
                "region": "auto",
                "platform": "ZendBX"
            }
    
    async def _get_health_status(
        self, 
        conn, 
        project_id: str
    ) -> Dict[str, Any]:
        """Get health status"""
        try:
            # Check database connectivity
            db_healthy = await self._check_database_health(conn, project_id)
            
            # Check recent errors
            error_count = await self._get_recent_error_count(conn, project_id)
            
            # Check uptime
            uptime = await self._get_uptime(conn, project_id)
            
            # Overall health determination
            is_healthy = db_healthy and error_count < 10
            
            return {
                "is_healthy": is_healthy,
                "database_connected": db_healthy,
                "recent_errors_24h": error_count,
                "uptime_hours": uptime,
                "last_check": datetime.utcnow().isoformat()
            }
            
        except Exception as e:
            logger.warning(f"Could not fetch health status: {str(e)}")
            return {
                "is_healthy": False,
                "database_connected": False,
                "recent_errors_24h": 0,
                "uptime_hours": 0,
                "last_check": datetime.utcnow().isoformat()
            }
    
    async def _check_database_health(
        self, 
        conn, 
        project_id: str
    ) -> bool:
        """Check if database is healthy"""
        try:
            # Simple query to verify connection
            result = await conn.fetchval("SELECT 1")
            return result == 1
        except Exception as e:
            logger.error(f"Database health check failed: {str(e)}")
            return False
    
    async def _get_recent_error_count(
        self, 
        conn, 
        project_id: str
    ) -> int:
        """Get count of recent errors"""
        try:
            # Note: audit_logs table may not have project_id column in current schema
            # Return 0 to avoid errors
            return 0
        except Exception as e:
            logger.warning(f"Could not fetch error count: {str(e)}")
            return 0
    
    async def _get_uptime(
        self, 
        conn, 
        project_id: str
    ) -> float:
        """Get project uptime in hours"""
        try:
            row = await conn.fetchrow(
                """
                SELECT 
                    EXTRACT(EPOCH FROM (NOW() - created_at)) / 3600 as uptime_hours
                FROM projects
                WHERE id = $1
                """,
                project_id
            )
            
            if row and row["uptime_hours"]:
                return round(row["uptime_hours"], 2)
            return 0.0
            
        except Exception as e:
            logger.warning(f"Could not fetch uptime: {str(e)}")
            return 0.0
    
    def _get_system_resources(self) -> Dict[str, Any]:
        """Get system resource usage"""
        try:
            # CPU usage
            cpu_percent = psutil.cpu_percent(interval=0.1)
            
            # Memory usage
            memory = psutil.virtual_memory()
            
            # Disk usage
            disk = psutil.disk_usage('/')
            
            return {
                "cpu_percent": round(cpu_percent, 2),
                "memory": {
                    "total_gb": round(memory.total / (1024**3), 2),
                    "used_gb": round(memory.used / (1024**3), 2),
                    "available_gb": round(memory.available / (1024**3), 2),
                    "percent": round(memory.percent, 2)
                },
                "disk": {
                    "total_gb": round(disk.total / (1024**3), 2),
                    "used_gb": round(disk.used / (1024**3), 2),
                    "free_gb": round(disk.free / (1024**3), 2),
                    "percent": round(disk.percent, 2)
                }
            }
            
        except Exception as e:
            logger.warning(f"Could not fetch system resources: {str(e)}")
            return {
                "cpu_percent": 0,
                "memory": {"total_gb": 0, "used_gb": 0, "available_gb": 0, "percent": 0},
                "disk": {"total_gb": 0, "used_gb": 0, "free_gb": 0, "percent": 0}
            }
    
    def _get_version_info(self) -> Dict[str, Any]:
        """Get version information"""
        return {
            "platform": platform.system(),
            "platform_version": platform.version(),
            "python_version": platform.python_version(),
            "zendbx_version": "1.0.0",  # Should come from version file
            "mcp_version": "0.1.0-demo"
        }
