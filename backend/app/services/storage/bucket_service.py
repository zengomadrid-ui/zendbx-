"""
Bucket Service
Business logic for bucket operations.
"""
import re
import uuid
from typing import Optional, List, Dict, Any
from asyncpg import Connection
from fastapi import HTTPException

from app.repositories.storage_repository import StorageRepository
from app.services.storage_provider import StorageProvider


def slugify(name: str) -> str:
    """Convert bucket name to URL-safe slug."""
    slug = name.lower().strip()
    slug = re.sub(r"[^a-z0-9\-]", "-", slug)
    slug = re.sub(r"-+", "-", slug).strip("-")
    return slug or "bucket"


class BucketService:
    """Service for bucket management operations."""

    def __init__(
        self,
        repository: StorageRepository,
        storage_provider: StorageProvider,
    ):
        self.repo = repository
        self.provider = storage_provider

    async def list_buckets(
        self,
        project_id: uuid.UUID,
        conn: Connection,
    ) -> List[Dict[str, Any]]:
        """List all buckets in a project."""
        return await self.repo.list_buckets(project_id, conn)

    async def create_bucket(
        self,
        project_id: uuid.UUID,
        user_id: uuid.UUID,
        name: str,
        description: Optional[str],
        is_public: bool,
        provider_bucket_name: str,
        conn: Connection,
    ) -> Dict[str, Any]:
        """
        Create a new storage bucket.
        Validates uniqueness and creates the DB record.
        Provider verification is skipped if storage is not configured.
        """
        slug = slugify(name)

        # Check if bucket with this slug already exists
        exists = await self.repo.bucket_exists_by_slug(project_id, slug, conn)
        if exists:
            raise HTTPException(
                status_code=409,
                detail="A bucket with this name already exists in this project",
            )

        # Create bucket record first — provider is only needed for actual uploads
        bucket_id = uuid.uuid4()
        result = await self.repo.create_bucket(
            bucket_id=bucket_id,
            project_id=project_id,
            name=name,
            slug=slug,
            description=description,
            is_public=is_public,
            user_id=user_id,
            conn=conn,
        )

        # Try to verify/create the provider bucket — non-fatal if storage not configured
        if self.provider:
            try:
                await self.provider.create_bucket(provider_bucket_name, is_public)
            except Exception as e:
                # Log but don't fail — bucket metadata is already saved
                print(f"[BucketService] Provider bucket check failed (non-fatal): {e}")

        return result

    async def update_bucket(
        self,
        bucket: Dict[str, Any],
        name: Optional[str],
        description: Optional[str],
        is_public: Optional[bool],
        conn: Connection,
    ) -> Dict[str, Any]:
        """Update bucket metadata."""
        new_name = name if name is not None else bucket["name"]
        new_slug = slugify(new_name) if name else bucket["slug"]
        new_desc = description if description is not None else bucket["description"]
        new_public = is_public if is_public is not None else bucket["is_public"]

        await self.repo.update_bucket(
            bucket_id=bucket["id"],
            name=new_name,
            slug=new_slug,
            description=new_desc,
            is_public=new_public,
            conn=conn,
        )

        return {
            "success": True,
            "name": new_name,
            "slug": new_slug,
        }

    async def delete_bucket(
        self,
        bucket: Dict[str, Any],
        project_id: uuid.UUID,
        provider_bucket_name: str,
        conn: Connection,
    ) -> Dict[str, Any]:
        """
        Delete a bucket and all its objects.
        Deletes from provider, soft deletes database records, updates quotas.
        """
        # Get all object storage keys
        storage_keys = await self.repo.get_bucket_objects_keys(bucket["id"], conn)

        # Best-effort delete from provider
        if self.provider and storage_keys:
            for key in storage_keys:
                try:
                    await self.provider.delete_file(key, provider_bucket_name)
                except Exception as e:
                    print(f"[BucketService] Provider delete failed (non-fatal): {e}")

        # Soft delete all objects
        await self.repo.soft_delete_all_objects_in_bucket(bucket["id"], conn)

        # Soft delete bucket
        await self.repo.soft_delete_bucket(bucket["id"], conn)

        # Update project storage quota
        storage_freed = bucket.get("storage_used", 0)
        await self.repo.update_project_storage(project_id, -storage_freed, conn)

        return {"success": True}

    async def get_bucket_stats(
        self,
        bucket_id: uuid.UUID,
        conn: Connection,
    ) -> Optional[Dict[str, Any]]:
        """Get detailed statistics for a bucket."""
        return await self.repo.get_bucket_stats(bucket_id, conn)
