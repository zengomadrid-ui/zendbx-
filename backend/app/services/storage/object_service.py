"""
Object Service
Business logic for file/object operations.
"""
import uuid
from typing import Optional, List, Dict, Any, Tuple
from asyncpg import Connection
from fastapi import HTTPException

from app.repositories.storage_repository import StorageRepository
from app.services.storage_provider import StorageProvider


class ObjectService:
    """Service for storage object operations."""

    def __init__(
        self,
        repository: StorageRepository,
        storage_provider: StorageProvider,
    ):
        self.repo = repository
        self.provider = storage_provider

    async def list_objects(
        self,
        bucket_id: uuid.UUID,
        prefix: Optional[str],
        conn: Connection,
    ) -> List[Dict[str, Any]]:
        """List objects in a bucket with optional prefix filter."""
        return await self.repo.list_objects(bucket_id, prefix, conn)

    async def list_files(
        self,
        bucket_id: uuid.UUID,
        search: Optional[str],
        sort_by: str,
        sort_dir: str,
        conn: Connection,
    ) -> List[Dict[str, Any]]:
        """List files with search and sorting."""
        # Validate sort column
        allowed_sorts = {"created_at", "file_size", "original_name", "download_count"}
        if sort_by not in allowed_sorts:
            sort_by = "created_at"

        return await self.repo.list_files_with_search(
            bucket_id,
            search,
            sort_by,
            sort_dir,
            conn,
        )

    async def get_object(
        self,
        object_id: uuid.UUID,
        project_id: uuid.UUID,
        conn: Connection,
    ) -> Dict[str, Any]:
        """Get object metadata by ID."""
        obj = await self.repo.get_object_by_id(object_id, project_id, conn)
        if not obj:
            raise HTTPException(status_code=404, detail="File not found")
        return obj

    async def delete_object(
        self,
        obj: Dict[str, Any],
        project_id: uuid.UUID,
        provider_bucket_name: str,
        conn: Connection,
    ) -> Dict[str, Any]:
        """
        Delete a storage object.
        Removes from provider, soft deletes record, updates quotas.
        """
        # Delete from provider
        await self.provider.delete_file(obj["storage_key"], provider_bucket_name)

        # Soft delete object
        await self.repo.soft_delete_object(obj["id"], conn)

        # Update bucket stats
        file_size = obj.get("file_size", 0)
        await self.repo.update_bucket_stats(
            bucket_id=obj["bucket_id"],
            storage_delta=-file_size,
            file_count_delta=-1,
            conn=conn,
        )

        # Update project storage
        await self.repo.update_project_storage(project_id, -file_size, conn)

        return {"success": True}

    async def download_object(
        self,
        obj: Dict[str, Any],
        provider_bucket_name: str,
        conn: Connection,
    ) -> Tuple[bytes, str, str]:
        """
        Download object from storage.
        Returns (data, mime_type, filename) tuple.
        """
        data = await self.provider.get_file(obj["storage_key"], provider_bucket_name)
        if data is None:
            raise HTTPException(status_code=404, detail="File not found in storage")

        # Increment download count
        await self.repo.increment_download_count(obj["id"], conn)

        mime_type = obj.get("mime_type") or "application/octet-stream"
        filename = obj.get("original_name") or "download"

        return data, mime_type, filename

    async def get_object_metadata(
        self,
        storage_key: str,
        provider_bucket_name: str,
    ) -> Optional[Dict[str, Any]]:
        """Get metadata from storage provider."""
        return await self.provider.get_file_metadata(storage_key, provider_bucket_name)
