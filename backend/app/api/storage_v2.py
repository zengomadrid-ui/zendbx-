"""
Storage API v2 — Project-scoped routes (/p/{project_slug}/storage/...)

Architecture V3:
- Clean service layer with repositories
- Provider abstraction
- Project-scoped: no UUIDs in URLs
- Bucket resolution by slug or UUID
- All business logic in service layer
"""
import io
import uuid
from typing import Optional

from fastapi import APIRouter, Depends, HTTPException, UploadFile, File, Query
from fastapi.responses import StreamingResponse, RedirectResponse
from pydantic import BaseModel

from app.core.security import get_current_user
from app.core.database import get_main_db_pool
from app.core.config import settings as _settings
from app.services.b2_storage import get_storage_provider
from app.repositories.storage_repository import StorageRepository
from app.services.storage.bucket_service import BucketService
from app.services.storage.object_service import ObjectService
from app.services.storage.upload_service import UploadService
from app.services.storage.project_service import ProjectService
from app.services.storage.signed_url_service import SignedUrlService

router = APIRouter(prefix="/p/{project_slug}/storage", tags=["storage-v2"])

# Provider bucket name (configured globally)
PROVIDER_BUCKET = _settings.B2_BUCKET_NAME


# ── Pydantic models ────────────────────────────────────────────────────────

class CreateBucketRequest(BaseModel):
    name: str
    description: Optional[str] = None
    is_public: bool = False

class UpdateBucketRequest(BaseModel):
    name: Optional[str] = None
    description: Optional[str] = None
    is_public: Optional[bool] = None

class SignedUrlRequest(BaseModel):
    expiry: str = "1h"

class BulkDeleteRequest(BaseModel):
    file_ids: list[str]


# ── Service initialization helpers ────────────────────────────────────────

def _get_services():
    """Initialize all storage services with dependencies."""
    provider = get_storage_provider()
    if not provider:
        raise HTTPException(
            status_code=503,
            detail="Storage provider unavailable. Please configure storage settings.",
        )
    
    repo = StorageRepository()
    return {
        "bucket": BucketService(repo, provider),
        "object": ObjectService(repo, provider),
        "upload": UploadService(repo, provider),
        "project": ProjectService(repo),
        "signed_url": SignedUrlService(provider),
    }


def _uid(current_user) -> uuid.UUID:
    """Extract user UUID from current_user."""
    if hasattr(current_user, "id"):
        return uuid.UUID(str(current_user.id))
    return uuid.UUID(str(current_user["id"]))


# ── Buckets ────────────────────────────────────────────────────────────────

@router.get("/buckets")
async def list_buckets(
    project_slug: str,
    current_user=Depends(get_current_user),
):
    """List all buckets in a project."""
    services = _get_services()
    pool = await get_main_db_pool()
    
    async with pool.acquire() as conn:
        project = await services["project"].resolve_project(project_slug, conn)
        return await services["bucket"].list_buckets(project["id"], conn)


@router.post("/buckets")
async def create_bucket(
    project_slug: str,
    body: CreateBucketRequest,
    current_user=Depends(get_current_user),
):
    """Create a new storage bucket."""
    services = _get_services()
    pool = await get_main_db_pool()
    
    async with pool.acquire() as conn:
        project = await services["project"].resolve_project(project_slug, conn)
        return await services["bucket"].create_bucket(
            project_id=project["id"],
            user_id=_uid(current_user),
            name=body.name,
            description=body.description,
            is_public=body.is_public,
            provider_bucket_name=PROVIDER_BUCKET,
            conn=conn,
        )


@router.patch("/buckets/{bucket}")
async def update_bucket(
    project_slug: str,
    bucket: str,
    body: UpdateBucketRequest,
    current_user=Depends(get_current_user),
):
    """Update bucket metadata."""
    services = _get_services()
    pool = await get_main_db_pool()
    
    async with pool.acquire() as conn:
        project = await services["project"].resolve_project(project_slug, conn)
        bucket_row = await services["project"].resolve_bucket(bucket, project["id"], conn)
        return await services["bucket"].update_bucket(
            bucket=bucket_row,
            name=body.name,
            description=body.description,
            is_public=body.is_public,
            conn=conn,
        )


@router.delete("/buckets/{bucket}")
async def delete_bucket(
    project_slug: str,
    bucket: str,
    current_user=Depends(get_current_user),
):
    """Delete a bucket and all its objects."""
    services = _get_services()
    pool = await get_main_db_pool()
    
    async with pool.acquire() as conn:
        project = await services["project"].resolve_project(project_slug, conn)
        bucket_row = await services["project"].resolve_bucket(bucket, project["id"], conn)
        return await services["bucket"].delete_bucket(
            bucket=bucket_row,
            project_id=project["id"],
            provider_bucket_name=PROVIDER_BUCKET,
            conn=conn,
        )


@router.get("/buckets/{bucket}/stats")
async def bucket_stats(
    project_slug: str,
    bucket: str,
    current_user=Depends(get_current_user),
):
    """Get detailed statistics for a bucket."""
    services = _get_services()
    pool = await get_main_db_pool()
    
    async with pool.acquire() as conn:
        project = await services["project"].resolve_project(project_slug, conn)
        bucket_row = await services["project"].resolve_bucket(bucket, project["id"], conn)
        return await services["bucket"].get_bucket_stats(bucket_row["id"], conn)


# ── Upload ─────────────────────────────────────────────────────────────────

@router.post("/buckets/{bucket}/upload")
async def upload_file(
    project_slug: str,
    bucket: str,
    file: UploadFile = File(...),
    current_user=Depends(get_current_user),
):
    """
    Upload a file to a bucket.
    SDK endpoint: POST /p/{project_slug}/storage/buckets/{bucket_slug_or_uuid}/upload
    """
    services = _get_services()
    pool = await get_main_db_pool()
    
    async with pool.acquire() as conn:
        project = await services["project"].resolve_project(project_slug, conn)
        bucket_row = await services["project"].resolve_bucket(bucket, project["id"], conn)
        return await services["upload"].upload_file(
            file=file,
            bucket=bucket_row,
            project=project,
            user_id=_uid(current_user),
            provider_bucket_name=PROVIDER_BUCKET,
            conn=conn,
        )


# ── Objects / Files ────────────────────────────────────────────────────────

@router.get("/buckets/{bucket}/objects")
async def list_objects(
    project_slug: str,
    bucket: str,
    prefix: Optional[str] = Query(None),
    current_user=Depends(get_current_user),
):
    """List objects in a bucket with optional prefix filter."""
    services = _get_services()
    pool = await get_main_db_pool()
    
    async with pool.acquire() as conn:
        project = await services["project"].resolve_project(project_slug, conn)
        bucket_row = await services["project"].resolve_bucket(bucket, project["id"], conn)
        return await services["object"].list_objects(bucket_row["id"], prefix, conn)


@router.get("/buckets/{bucket}/files")
async def list_files(
    project_slug: str,
    bucket: str,
    search: Optional[str] = Query(None),
    sort_by: str = Query("created_at"),
    sort_dir: str = Query("desc"),
    current_user=Depends(get_current_user),
):
    """List files with search and sorting."""
    services = _get_services()
    pool = await get_main_db_pool()
    
    async with pool.acquire() as conn:
        project = await services["project"].resolve_project(project_slug, conn)
        bucket_row = await services["project"].resolve_bucket(bucket, project["id"], conn)
        return await services["object"].list_files(
            bucket_row["id"],
            search,
            sort_by,
            sort_dir,
            conn,
        )


@router.get("/files/{file_id}")
async def get_file_metadata(
    project_slug: str,
    file_id: str,
    current_user=Depends(get_current_user),
):
    """Get file metadata."""
    services = _get_services()
    pool = await get_main_db_pool()
    
    async with pool.acquire() as conn:
        project = await services["project"].resolve_project(project_slug, conn)
        return await services["object"].get_object(uuid.UUID(file_id), project["id"], conn)


@router.delete("/files/{file_id}")
async def delete_file(
    project_slug: str,
    file_id: str,
    current_user=Depends(get_current_user),
):
    """Delete a file."""
    services = _get_services()
    pool = await get_main_db_pool()
    
    async with pool.acquire() as conn:
        project = await services["project"].resolve_project(project_slug, conn)
        file_row = await services["object"].get_object(uuid.UUID(file_id), project["id"], conn)
        return await services["object"].delete_object(
            obj=file_row,
            project_id=project["id"],
            provider_bucket_name=PROVIDER_BUCKET,
            conn=conn,
        )


@router.post("/files/bulk-delete")
async def bulk_delete_files(
    project_slug: str,
    body: BulkDeleteRequest,
    current_user=Depends(get_current_user),
):
    """Delete multiple files at once."""
    services = _get_services()
    pool = await get_main_db_pool()
    deleted = 0
    
    async with pool.acquire() as conn:
        project = await services["project"].resolve_project(project_slug, conn)
        for file_id_str in body.file_ids:
            try:
                file_row = await services["object"].get_object(
                    uuid.UUID(file_id_str),
                    project["id"],
                    conn,
                )
                await services["object"].delete_object(
                    obj=file_row,
                    project_id=project["id"],
                    provider_bucket_name=PROVIDER_BUCKET,
                    conn=conn,
                )
                deleted += 1
            except Exception:
                # Silently skip failed deletions
                pass
    
    return {"success": True, "deleted": deleted}


@router.get("/files/{file_id}/download")
async def download_file(
    project_slug: str,
    file_id: str,
    current_user=Depends(get_current_user),
):
    """Download a file."""
    services = _get_services()
    pool = await get_main_db_pool()
    
    async with pool.acquire() as conn:
        project = await services["project"].resolve_project(project_slug, conn)
        file_row = await services["object"].get_object(uuid.UUID(file_id), project["id"], conn)
        data, mime, name = await services["object"].download_object(
            obj=file_row,
            provider_bucket_name=PROVIDER_BUCKET,
            conn=conn,
        )
    
    return StreamingResponse(
        io.BytesIO(data),
        media_type=mime,
        headers={"Content-Disposition": f'attachment; filename="{name}"'},
    )


@router.get("/files/{file_id}/preview")
async def preview_file(
    project_slug: str,
    file_id: str,
    current_user=Depends(get_current_user),
):
    """Preview a file (inline display for public buckets, download for private)."""
    services = _get_services()
    pool = await get_main_db_pool()
    
    async with pool.acquire() as conn:
        project = await services["project"].resolve_project(project_slug, conn)
        file_row = await services["object"].get_object(uuid.UUID(file_id), project["id"], conn)
        
        # Check if bucket is public
        bucket = await StorageRepository.get_bucket_by_id(file_row["bucket_id"], conn)
        if bucket and bucket.get("is_public"):
            # Return public URL redirect
            url = await services["signed_url"].get_public_url(
                file_row["storage_key"],
                PROVIDER_BUCKET,
            )
            return RedirectResponse(url=url)
        
        # Download and stream for private buckets
        data, mime, _ = await services["object"].download_object(
            obj=file_row,
            provider_bucket_name=PROVIDER_BUCKET,
            conn=conn,
        )
    
    return StreamingResponse(io.BytesIO(data), media_type=mime)


@router.post("/files/{file_id}/signed-url")
async def generate_signed_url(
    project_slug: str,
    file_id: str,
    body: SignedUrlRequest,
    current_user=Depends(get_current_user),
):
    """Generate a temporary signed URL for file access."""
    services = _get_services()
    pool = await get_main_db_pool()
    
    async with pool.acquire() as conn:
        project = await services["project"].resolve_project(project_slug, conn)
        file_row = await services["object"].get_object(uuid.UUID(file_id), project["id"], conn)
    
    return await services["signed_url"].generate_signed_url(
        storage_key=file_row["storage_key"],
        expiry=body.expiry,
        provider_bucket_name=PROVIDER_BUCKET,
    )


@router.get("/analytics")
async def storage_analytics(
    project_slug: str,
    current_user=Depends(get_current_user),
):
    """Get comprehensive storage analytics for the project."""
    services = _get_services()
    pool = await get_main_db_pool()
    
    async with pool.acquire() as conn:
        project = await services["project"].resolve_project(project_slug, conn)
        return await services["project"].get_storage_analytics(
            project_id=project["id"],
            project=project,
            conn=conn,
        )
