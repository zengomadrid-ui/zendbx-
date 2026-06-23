"""
Storage Context Collector
Collects storage and file-related information for AI understanding
"""

from typing import Dict, Any, List, Optional
import logging
from app.core.db_router import get_main_db_pool

logger = logging.getLogger(__name__)


class StorageCollector:
    """
    Collects storage context for a project
    Provides AI with understanding of:
    - Storage buckets configured
    - Bucket policies and access rules
    - Storage statistics
    - File organization
    """
    
    async def collect(self, project_id: str) -> Dict[str, Any]:
        """
        Collect complete storage context for a project
        
        Args:
            project_id: Project UUID
            
        Returns:
            Dict with storage context information
        """
        try:
            pool = await get_main_db_pool()
            
            async with pool.acquire() as conn:
                # Get storage buckets
                buckets = await self._get_buckets(conn, project_id)
                
                # Get storage statistics
                stats = await self._get_storage_stats(conn, project_id)
                
                # Get storage configuration
                config = await self._get_storage_config(conn, project_id)
                
                # Get recent uploads
                recent_uploads = await self._get_recent_uploads(conn, project_id)
                
                return {
                    "buckets": buckets,
                    "statistics": stats,
                    "configuration": config,
                    "recent_uploads": recent_uploads,
                    "status": "active",
                    "_collected_at": "now()"
                }
                
        except Exception as e:
            logger.error(f"Error collecting storage context: {str(e)}")
            return {
                "error": str(e),
                "status": "error",
                "_collected_at": "now()"
            }
    
    async def _get_buckets(
        self, 
        conn, 
        project_id: str
    ) -> List[Dict[str, Any]]:
        """Get storage buckets with their configurations"""
        try:
            rows = await conn.fetch(
                """
                SELECT 
                    b.id,
                    b.name,
                    b.public,
                    b.file_size_limit,
                    b.allowed_mime_types,
                    b.created_at,
                    COUNT(o.id) as object_count,
                    COALESCE(SUM(o.size), 0) as total_size
                FROM storage_buckets b
                LEFT JOIN storage_objects o ON b.id = o.bucket_id
                WHERE b.project_id = $1
                GROUP BY b.id, b.name, b.public, b.file_size_limit, 
                         b.allowed_mime_types, b.created_at
                ORDER BY b.name
                """,
                project_id
            )
            
            buckets = []
            for row in rows:
                buckets.append({
                    "id": str(row["id"]),
                    "name": row["name"],
                    "public": row["public"],
                    "file_size_limit": row["file_size_limit"],
                    "allowed_mime_types": row["allowed_mime_types"],
                    "object_count": row["object_count"],
                    "total_size_bytes": row["total_size"],
                    "total_size_mb": round(row["total_size"] / (1024 * 1024), 2) if row["total_size"] else 0,
                    "created_at": row["created_at"].isoformat() if row["created_at"] else None
                })
            
            return buckets
            
        except Exception as e:
            logger.warning(f"Could not fetch storage buckets: {str(e)}")
            return []
    
    async def _get_storage_stats(
        self, 
        conn, 
        project_id: str
    ) -> Dict[str, Any]:
        """Get overall storage statistics"""
        try:
            row = await conn.fetchrow(
                """
                SELECT 
                    COUNT(DISTINCT b.id) as bucket_count,
                    COUNT(o.id) as total_objects,
                    COALESCE(SUM(o.size), 0) as total_size,
                    COUNT(DISTINCT o.owner_id) as unique_uploaders,
                    MAX(o.created_at) as last_upload
                FROM storage_buckets b
                LEFT JOIN storage_objects o ON b.id = o.bucket_id
                WHERE b.project_id = $1
                """,
                project_id
            )
            
            if row:
                total_size_bytes = row["total_size"] or 0
                return {
                    "bucket_count": row["bucket_count"] or 0,
                    "total_objects": row["total_objects"] or 0,
                    "total_size_bytes": total_size_bytes,
                    "total_size_mb": round(total_size_bytes / (1024 * 1024), 2),
                    "total_size_gb": round(total_size_bytes / (1024 * 1024 * 1024), 4),
                    "unique_uploaders": row["unique_uploaders"] or 0,
                    "last_upload": row["last_upload"].isoformat() if row["last_upload"] else None
                }
            else:
                return {
                    "bucket_count": 0,
                    "total_objects": 0,
                    "total_size_bytes": 0,
                    "total_size_mb": 0,
                    "total_size_gb": 0,
                    "unique_uploaders": 0,
                    "last_upload": None
                }
                
        except Exception as e:
            logger.warning(f"Could not fetch storage stats: {str(e)}")
            return {
                "bucket_count": 0,
                "total_objects": 0,
                "total_size_bytes": 0,
                "total_size_mb": 0,
                "total_size_gb": 0,
                "unique_uploaders": 0,
                "last_upload": None
            }
    
    async def _get_storage_config(
        self, 
        conn, 
        project_id: str
    ) -> Dict[str, Any]:
        """Get storage configuration"""
        try:
            row = await conn.fetchrow(
                """
                SELECT 
                    storage_provider,
                    storage_quota_gb,
                    upload_rate_limit
                FROM project_storage_config
                WHERE project_id = $1
                """,
                project_id
            )
            
            if row:
                return {
                    "provider": row["storage_provider"] or "b2",
                    "quota_gb": row["storage_quota_gb"] or 10,
                    "rate_limit": row["upload_rate_limit"] or 100
                }
            else:
                # Default configuration
                return {
                    "provider": "b2",
                    "quota_gb": 10,
                    "rate_limit": 100
                }
                
        except Exception as e:
            logger.warning(f"Could not fetch storage config: {str(e)}")
            return {
                "provider": "b2",
                "quota_gb": 10,
                "rate_limit": 100
            }
    
    async def _get_recent_uploads(
        self, 
        conn, 
        project_id: str,
        limit: int = 10
    ) -> List[Dict[str, Any]]:
        """Get recent file uploads"""
        try:
            rows = await conn.fetch(
                """
                SELECT 
                    o.id,
                    o.name,
                    o.size,
                    o.mimetype,
                    b.name as bucket_name,
                    o.created_at,
                    u.email as uploader_email
                FROM storage_objects o
                JOIN storage_buckets b ON o.bucket_id = b.id
                LEFT JOIN users u ON o.owner_id = u.id
                WHERE b.project_id = $1
                ORDER BY o.created_at DESC
                LIMIT $2
                """,
                project_id,
                limit
            )
            
            uploads = []
            for row in rows:
                uploads.append({
                    "id": str(row["id"]),
                    "name": row["name"],
                    "size_bytes": row["size"],
                    "size_mb": round(row["size"] / (1024 * 1024), 2) if row["size"] else 0,
                    "mimetype": row["mimetype"],
                    "bucket": row["bucket_name"],
                    "uploader": row["uploader_email"],
                    "uploaded_at": row["created_at"].isoformat() if row["created_at"] else None
                })
            
            return uploads
            
        except Exception as e:
            logger.warning(f"Could not fetch recent uploads: {str(e)}")
            return []
