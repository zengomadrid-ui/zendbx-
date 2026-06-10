"""
Project Service for Storage
Resolves projects and validates permissions.
"""
import uuid
from typing import Dict, Any
from asyncpg import Connection
from fastapi import HTTPException

from app.repositories.storage_repository import StorageRepository


class ProjectService:
    """Service for project resolution and validation."""

    def __init__(self, repository: StorageRepository):
        self.repo = repository

    async def resolve_project(
        self,
        slug_or_id: str,
        conn: Connection,
    ) -> Dict[str, Any]:
        """
        Resolve project by slug or UUID.
        Raises 404 if not found.
        """
        project = await self.repo.get_project_by_slug_or_id(slug_or_id, conn)
        if not project:
            raise HTTPException(status_code=404, detail="Project not found")
        return project

    async def resolve_project_for_user(
        self,
        slug_or_id: str,
        user_id: uuid.UUID,
        conn: Connection,
    ) -> Dict[str, Any]:
        """
        Resolve project with ownership verification.
        Raises 404 if not found or user doesn't have access.
        """
        project = await self.repo.get_project_by_slug_or_id_for_user(
            slug_or_id,
            user_id,
            conn,
        )
        if not project:
            raise HTTPException(
                status_code=404,
                detail="Project not found or access denied",
            )
        return project

    async def resolve_bucket(
        self,
        identifier: str,
        project_id: uuid.UUID,
        conn: Connection,
    ) -> Dict[str, Any]:
        """
        Resolve bucket by slug or UUID within a project.
        Raises 404 if not found.
        """
        bucket = await self.repo.get_bucket_by_slug_or_id(identifier, project_id, conn)
        if not bucket:
            raise HTTPException(status_code=404, detail="Bucket not found")
        return bucket

    async def get_storage_analytics(
        self,
        project_id: uuid.UUID,
        project: Dict[str, Any],
        conn: Connection,
    ) -> Dict[str, Any]:
        """
        Get comprehensive storage analytics for a project.
        """
        # Get totals
        totals = await self.repo.get_storage_totals(project_id, conn)

        # Get largest files
        largest = await self.repo.get_largest_files(project_id, 10, conn)

        # Get recent uploads
        recent = await self.repo.get_recent_uploads(project_id, 10, conn)

        # Get storage growth (last 30 days)
        growth = await self.repo.get_storage_growth(project_id, 30, conn)

        # Calculate usage percentage
        storage_used = totals.get("storage_used", 0)
        max_storage = project.get("max_storage", 0)
        usage_percent = round(
            (storage_used / max_storage * 100) if max_storage > 0 else 0,
            2,
        )

        return {
            "storage_used": storage_used,
            "max_storage": max_storage,
            "storage_used_percent": usage_percent,
            "file_count": totals.get("file_count", 0),
            "bucket_count": totals.get("bucket_count", 0),
            "download_count": totals.get("download_count", 0),
            "largest_files": largest,
            "recent_uploads": recent,
            "storage_growth": growth,
        }
