"""
Upload Service
Business logic for file uploads.
"""
import re
import uuid
from typing import Dict, Any
from asyncpg import Connection
from fastapi import HTTPException, UploadFile

from app.repositories.storage_repository import StorageRepository
from app.services.storage_provider import StorageProvider


# Upload limits by plan
PLAN_UPLOAD_LIMITS = {
    "free": 10 * 1024 * 1024,  # 10 MB
    "pro": 100 * 1024 * 1024,  # 100 MB
    "enterprise": 500 * 1024 * 1024,  # 500 MB
}

# Allowed MIME types
ALLOWED_MIME_PREFIXES = [
    "image/",
    "video/",
    "audio/",
    "text/",
    "application/pdf",
    "application/json",
    "application/zip",
    "application/x-zip-compressed",
    "application/vnd.ms-excel",
    "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
    "application/msword",
    "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
]

# Blocked file extensions
BLOCKED_EXTENSIONS = {
    ".exe",
    ".bat",
    ".cmd",
    ".sh",
    ".apk",
    ".iso",
    ".dmg",
    ".msi",
    ".ps1",
    ".scr",
    ".vbs",
}


def _sanitize_filename(filename: str) -> str:
    """Sanitize filename to prevent path traversal and special chars."""
    return re.sub(r"[^a-zA-Z0-9._\-]", "_", filename or "file")


def _is_mime_allowed(mime: str) -> bool:
    """Check if MIME type is allowed."""
    return any(mime.startswith(prefix) for prefix in ALLOWED_MIME_PREFIXES)


def _is_extension_blocked(filename: str) -> bool:
    """Check if file extension is blocked."""
    if "." not in filename:
        return False
    ext = "." + filename.rsplit(".", 1)[-1].lower()
    return ext in BLOCKED_EXTENSIONS


class UploadService:
    """Service for file upload operations."""

    def __init__(
        self,
        repository: StorageRepository,
        storage_provider: StorageProvider,
    ):
        self.repo = repository
        self.provider = storage_provider

    async def upload_file(
        self,
        file: UploadFile,
        bucket: Dict[str, Any],
        project: Dict[str, Any],
        user_id: uuid.UUID,
        provider_bucket_name: str,
        conn: Connection,
    ) -> Dict[str, Any]:
        """
        Upload a file to storage.
        Validates file, uploads to provider, creates database record, updates quotas.
        """
        # Validate file extension
        if _is_extension_blocked(file.filename or ""):
            raise HTTPException(
                status_code=400,
                detail="File type not allowed for security reasons",
            )

        # Read file data
        file_data = await file.read()
        file_size = len(file_data)

        # Validate file size based on user plan
        user_plan = project.get("plan", "free")
        upload_limit = PLAN_UPLOAD_LIMITS.get(user_plan, PLAN_UPLOAD_LIMITS["free"])
        
        if file_size > upload_limit:
            limit_mb = upload_limit // 1024 // 1024
            raise HTTPException(
                status_code=413,
                detail=f"File too large. Your {user_plan} plan allows up to {limit_mb} MB per file.",
            )

        # Validate MIME type
        mime_type = file.content_type or "application/octet-stream"
        if not _is_mime_allowed(mime_type):
            raise HTTPException(
                status_code=415,
                detail=f"MIME type '{mime_type}' is not allowed",
            )

        # Check project storage quota
        storage_used = project.get("storage_used", 0)
        max_storage = project.get("max_storage", 0)
        
        if storage_used + file_size > max_storage:
            raise HTTPException(
                status_code=413,
                detail="Storage quota exceeded. Please upgrade your plan or free up space.",
            )

        # Generate storage key
        project_id = project["id"]
        bucket_slug = bucket["slug"]
        file_uuid = uuid.uuid4()
        safe_filename = _sanitize_filename(file.filename or "file")
        storage_key = f"{project_id}/{bucket_slug}/{file_uuid}/{safe_filename}"

        # Upload to storage provider
        success = await self.provider.upload_file(
            storage_key,
            file_data,
            mime_type,
            provider_bucket_name,
        )
        
        if not success:
            raise HTTPException(
                status_code=500,
                detail="Failed to upload file to storage provider",
            )

        # Create database record
        object_id = uuid.uuid4()
        result = await self.repo.create_object(
            object_id=object_id,
            project_id=project_id,
            bucket_id=bucket["id"],
            file_name=safe_filename,
            original_name=file.filename or safe_filename,
            file_size=file_size,
            mime_type=mime_type,
            storage_key=storage_key,
            user_id=user_id,
            conn=conn,
        )

        # Update bucket stats
        await self.repo.update_bucket_stats(
            bucket_id=bucket["id"],
            storage_delta=file_size,
            file_count_delta=1,
            conn=conn,
        )

        # Update project storage
        await self.repo.update_project_storage(project_id, file_size, conn)

        return result
