"""
Storage Monitoring Service
Tracks database size, backup size, and enforces storage quotas
"""
import uuid
from typing import Dict, Any, Optional, List
from datetime import datetime
from app.core.database import get_main_db_pool, get_project_db_pool


class StorageMonitor:
    """
    Monitor and enforce storage quotas
    """
    
    async def get_database_size(self, project_id: str) -> int:
        """
        Get actual database size in bytes for a project
        """
        try:
            pool = await get_project_db_pool(project_id)
            async with pool.acquire() as conn:
                result = await conn.fetchrow(
                    """
                    SELECT pg_database_size(current_database()) as size_bytes
                    """
                )
                return result['size_bytes'] if result else 0
        except Exception as e:
            print(f"Error getting database size: {e}")
            return 0
    
    async def get_all_user_databases_size(self, user_id: str) -> int:
        """
        Get total size of all databases owned by user
        """
        try:
            pool = await get_main_db_pool()
            async with pool.acquire() as conn:
                # Get all projects for user
                projects = await conn.fetch(
                    """
                    SELECT id, database_name FROM projects
                    WHERE owner_id = $1
                    """,
                    uuid.UUID(user_id)
                )
                
                total_size = 0
                for project in projects:
                    size = await self.get_database_size(str(project['id']))
                    total_size += size
                
                return total_size
        except Exception as e:
            print(f"Error getting total database size: {e}")
            return 0
    
    async def get_backup_storage_size(self, user_id: str) -> int:
        """
        Get total backup storage used by user
        """
        try:
            pool = await get_main_db_pool()
            async with pool.acquire() as conn:
                result = await conn.fetchrow(
                    """
                    SELECT COALESCE(SUM(file_size), 0) as total_size
                    FROM backups
                    WHERE user_id = $1
                    """,
                    uuid.UUID(user_id)
                )
                return result['total_size'] if result else 0
        except Exception as e:
            print(f"Error getting backup size: {e}")
            return 0
    
    async def get_total_storage_usage(self, user_id: str) -> Dict[str, int]:
        """
        Get complete storage breakdown
        """
        database_size = await self.get_all_user_databases_size(user_id)
        backup_size = await self.get_backup_storage_size(user_id)
        
        return {
            "database_bytes": database_size,
            "backup_bytes": backup_size,
            "total_bytes": database_size + backup_size,
            "database_mb": round(database_size / 1024 / 1024, 2),
            "backup_mb": round(backup_size / 1024 / 1024, 2),
            "total_mb": round((database_size + backup_size) / 1024 / 1024, 2)
        }
    
    async def check_storage_quota(
        self,
        user_id: str,
        limit_bytes: int,
        additional_bytes: int = 0
    ) -> Dict[str, Any]:
        """
        Check if user can add more storage
        
        Args:
            user_id: User ID
            limit_bytes: Storage limit in bytes
            additional_bytes: Additional storage to check
        
        Returns:
            Dict with allowed status and details
        """
        current_usage = await self.get_total_storage_usage(user_id)
        total_bytes = current_usage['total_bytes']
        new_total = total_bytes + additional_bytes
        
        allowed = new_total <= limit_bytes
        percentage = (new_total / limit_bytes * 100) if limit_bytes > 0 else 100.0
        remaining_bytes = max(0, limit_bytes - new_total)
        
        return {
            "allowed": allowed,
            "current_bytes": total_bytes,
            "limit_bytes": limit_bytes,
            "remaining_bytes": remaining_bytes,
            "percentage": round(percentage, 2),
            "current_mb": current_usage['total_mb'],
            "limit_mb": round(limit_bytes / 1024 / 1024, 2),
            "remaining_mb": round(remaining_bytes / 1024 / 1024, 2),
            "breakdown": current_usage
        }
    
    async def enforce_storage_limit(
        self,
        user_id: str,
        limit_bytes: int
    ) -> Optional[Dict[str, Any]]:
        """
        Check if user has exceeded storage limit
        Returns warning/error if over limit
        """
        check = await self.check_storage_quota(user_id, limit_bytes)
        
        if not check['allowed']:
            return {
                "error": "storage_quota_exceeded",
                "message": f"Storage limit exceeded. Using {check['current_mb']}MB of {check['limit_mb']}MB",
                "current_usage": check['current_mb'],
                "limit": check['limit_mb'],
                "percentage": check['percentage']
            }
        
        # Warning at 80%
        if check['percentage'] >= 80:
            return {
                "warning": "storage_quota_warning",
                "message": f"Storage usage at {check['percentage']:.0f}%",
                "current_usage": check['current_mb'],
                "limit": check['limit_mb'],
                "percentage": check['percentage']
            }
        
        return None
    
    async def get_table_sizes(self, project_id: str) -> List[Dict[str, Any]]:
        """
        Get size of each table in a project database
        """
        try:
            pool = await get_project_db_pool(project_id)
            async with pool.acquire() as conn:
                results = await conn.fetch(
                    """
                    SELECT
                        schemaname,
                        tablename,
                        pg_size_pretty(pg_total_relation_size(schemaname||'.'||tablename)) AS size,
                        pg_total_relation_size(schemaname||'.'||tablename) AS size_bytes
                    FROM pg_tables
                    WHERE schemaname NOT IN ('pg_catalog', 'information_schema')
                    ORDER BY pg_total_relation_size(schemaname||'.'||tablename) DESC
                    LIMIT 50
                    """
                )
                
                return [
                    {
                        "schema": row['schemaname'],
                        "table": row['tablename'],
                        "size": row['size'],
                        "size_bytes": row['size_bytes']
                    }
                    for row in results
                ]
        except Exception as e:
            print(f"Error getting table sizes: {e}")
            return []
    
    async def cleanup_old_backups(
        self,
        user_id: str,
        keep_count: int = 10
    ) -> int:
        """
        Delete old backups to free space
        Keeps most recent backups
        """
        try:
            pool = await get_main_db_pool()
            async with pool.acquire() as conn:
                # Get backups to delete
                to_delete = await conn.fetch(
                    """
                    SELECT id, file_path
                    FROM backups
                    WHERE user_id = $1
                    ORDER BY created_at DESC
                    OFFSET $2
                    """,
                    uuid.UUID(user_id),
                    keep_count
                )
                
                deleted_count = 0
                for backup in to_delete:
                    # Delete file
                    import os
                    if os.path.exists(backup['file_path']):
                        os.remove(backup['file_path'])
                    
                    # Delete record
                    await conn.execute(
                        "DELETE FROM backups WHERE id = $1",
                        backup['id']
                    )
                    deleted_count += 1
                
                return deleted_count
        except Exception as e:
            print(f"Error cleaning up backups: {e}")
            return 0
    
    async def update_storage_usage_in_db(self, user_id: str) -> bool:
        """
        Update storage usage in usage_tracking table
        Called periodically to sync actual usage
        """
        try:
            storage = await self.get_total_storage_usage(user_id)
            
            pool = await get_main_db_pool()
            async with pool.acquire() as conn:
                # Get current month period
                period = await conn.fetchrow(
                    "SELECT * FROM get_current_month_period()"
                )
                
                # Update usage tracking
                await conn.execute(
                    """
                    UPDATE usage_tracking
                    SET database_size_bytes = $1,
                        updated_at = NOW()
                    WHERE user_id = $2
                    AND period_start = $3
                    """,
                    storage['total_bytes'],
                    uuid.UUID(user_id),
                    period['period_start']
                )
                
                return True
        except Exception as e:
            print(f"Error updating storage usage: {e}")
            return False


# Singleton instance
storage_monitor = StorageMonitor()
