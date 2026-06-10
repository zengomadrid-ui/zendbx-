"""
Storage API — Legacy Routes (/api/storage/...)

DEPRECATED: Use /p/{project_slug}/storage/* instead.
Maintained for backward compatibility. All business logic routes through
the V3 service layer (repositories + services/storage/).
No SQL, no provider calls — this router is thin.
"""
import io
import uuid
from typing import Optional

from fastapi import APIRouter, Depends, HTTPException, UploadFile, File, Form, Query
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

router = APIRouter(prefix="/api/storage", tags=["storage"])

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


def _get_services():
    """Initialize all storage services. Provider may be None if B2 not configured."""
    provider = get_storage_provider()  # None if B2 not set — handled per-operation
    repo = StorageRepository()
    return {
        "bucket": BucketService(repo, provider),
        "object": ObjectService(repo, provider),
        "upload": UploadService(repo, provider),
        "project": ProjectService(repo),
        "signed_url": SignedUrlService(provider),
    }


def _require_provider():
    """Call this only for operations that actually need B2 (upload, download, signed URL)."""
    provider = get_storage_provider()
    if not provider:
        raise HTTPException(
            status_code=503,
            detail="Storage provider unavailable. Configure B2_KEY_ID and B2_APPLICATION_KEY in environment variables.",
        )
    return provider


def _uid(current_user) -> uuid.UUID:
    if hasattr(current_user, "id"):
        return uuid.UUID(str(current_user.id))
    return uuid.UUID(str(current_user["id"]))


# ── Buckets ────────────────────────────────────────────────────────────────

@router.get("/buckets")
async def list_buckets(
    project_id: str = Query(...),
    current_user=Depends(get_current_user),
):
    services = _get_services()
    pool = await get_main_db_pool()
    async with pool.acquire() as conn:
        project = await services["project"].resolve_project_for_user(
            project_id, _uid(current_user), conn
        )
        return await services["bucket"].list_buckets(project["id"], conn)


@router.post("/buckets")
async def create_bucket(
    body: CreateBucketRequest,
    project_id: str = Query(...),
    current_user=Depends(get_current_user),
):
    services = _get_services()
    pool = await get_main_db_pool()
    async with pool.acquire() as conn:
        project = await services["project"].resolve_project_for_user(
            project_id, _uid(current_user), conn
        )
        return await services["bucket"].create_bucket(
            project_id=project["id"],
            user_id=_uid(current_user),
            name=body.name,
            description=body.description,
            is_public=body.is_public,
            provider_bucket_name=PROVIDER_BUCKET,
            conn=conn,
        )


@router.patch("/buckets/{bucket_id}")
async def update_bucket(
    bucket_id: str,
    body: UpdateBucketRequest,
    project_id: str = Query(...),
    current_user=Depends(get_current_user),
):
    services = _get_services()
    pool = await get_main_db_pool()
    async with pool.acquire() as conn:
        project = await services["project"].resolve_project_for_user(
            project_id, _uid(current_user), conn
        )
        bucket_row = await services["project"].resolve_bucket(bucket_id, project["id"], conn)
        return await services["bucket"].update_bucket(
            bucket=bucket_row,
            name=body.name,
            description=body.description,
            is_public=body.is_public,
            conn=conn,
        )


@router.delete("/buckets/{bucket_id}")
async def delete_bucket(
    bucket_id: str,
    project_id: str = Query(...),
    current_user=Depends(get_current_user),
):
    services = _get_services()
    pool = await get_main_db_pool()
    async with pool.acquire() as conn:
        project = await services["project"].resolve_project_for_user(
            project_id, _uid(current_user), conn
        )
        bucket_row = await services["project"].resolve_bucket(bucket_id, project["id"], conn)
        return await services["bucket"].delete_bucket(
            bucket=bucket_row,
            project_id=project["id"],
            provider_bucket_name=PROVIDER_BUCKET,
            conn=conn,
        )


@router.get("/buckets/{bucket_id}/stats")
async def bucket_stats(
    bucket_id: str,
    project_id: str = Query(...),
    current_user=Depends(get_current_user),
):
    services = _get_services()
    pool = await get_main_db_pool()
    async with pool.acquire() as conn:
        project = await services["project"].resolve_project_for_user(
            project_id, _uid(current_user), conn
        )
        bucket_row = await services["project"].resolve_bucket(bucket_id, project["id"], conn)
        return await services["bucket"].get_bucket_stats(bucket_row["id"], conn)


# ── Upload ─────────────────────────────────────────────────────────────────

@router.post("/buckets/{bucket_id}/upload")
async def upload_to_bucket(
    bucket_id: str,
    project_id: str = Form(...),
    file: UploadFile = File(...),
    current_user=Depends(get_current_user),
):
    _require_provider()
    services = _get_services()
    pool = await get_main_db_pool()
    async with pool.acquire() as conn:
        project = await services["project"].resolve_project_for_user(
            project_id, _uid(current_user), conn
        )
        bucket_row = await services["project"].resolve_bucket(bucket_id, project["id"], conn)
        return await services["upload"].upload_file(
            file=file,
            bucket=bucket_row,
            project=project,
            user_id=_uid(current_user),
            provider_bucket_name=PROVIDER_BUCKET,
            conn=conn,
        )


@router.post("/upload")
async def upload_file(
    project_id: str = Form(...),
    bucket_id: str = Form(...),
    file: UploadFile = File(...),
    current_user=Depends(get_current_user),
):
    _require_provider()
    services = _get_services()
    pool = await get_main_db_pool()
    async with pool.acquire() as conn:
        project = await services["project"].resolve_project_for_user(
            project_id, _uid(current_user), conn
        )
        bucket_row = await services["project"].resolve_bucket(bucket_id, project["id"], conn)
        return await services["upload"].upload_file(
            file=file,
            bucket=bucket_row,
            project=project,
            user_id=_uid(current_user),
            provider_bucket_name=PROVIDER_BUCKET,
            conn=conn,
        )


# ── Objects / Files ────────────────────────────────────────────────────────

@router.get("/buckets/{bucket_id}/objects")
async def list_objects(
    bucket_id: str,
    project_id: str = Query(...),
    prefix: Optional[str] = Query(None),
    current_user=Depends(get_current_user),
):
    services = _get_services()
    pool = await get_main_db_pool()
    async with pool.acquire() as conn:
        project = await services["project"].resolve_project_for_user(
            project_id, _uid(current_user), conn
        )
        bucket_row = await services["project"].resolve_bucket(bucket_id, project["id"], conn)
        return await services["object"].list_objects(bucket_row["id"], prefix, conn)


@router.get("/buckets/{bucket_id}/files")
async def list_files(
    bucket_id: str,
    project_id: str = Query(...),
    search: Optional[str] = Query(None),
    sort_by: str = Query("created_at"),
    sort_dir: str = Query("desc"),
    current_user=Depends(get_current_user),
):
    services = _get_services()
    pool = await get_main_db_pool()
    async with pool.acquire() as conn:
        project = await services["project"].resolve_project_for_user(
            project_id, _uid(current_user), conn
        )
        bucket_row = await services["project"].resolve_bucket(bucket_id, project["id"], conn)
        return await services["object"].list_files(
            bucket_row["id"], search, sort_by, sort_dir, conn
        )


@router.get("/files/{file_id}")
async def get_file_metadata(
    file_id: str,
    project_id: str = Query(...),
    current_user=Depends(get_current_user),
):
    services = _get_services()
    pool = await get_main_db_pool()
    async with pool.acquire() as conn:
        project = await services["project"].resolve_project_for_user(
            project_id, _uid(current_user), conn
        )
        return await services["object"].get_object(uuid.UUID(file_id), project["id"], conn)


@router.delete("/files/{file_id}")
async def delete_file(
    file_id: str,
    project_id: str = Query(...),
    current_user=Depends(get_current_user),
):
    services = _get_services()
    pool = await get_main_db_pool()
    async with pool.acquire() as conn:
        project = await services["project"].resolve_project_for_user(
            project_id, _uid(current_user), conn
        )
        file_row = await services["object"].get_object(uuid.UUID(file_id), project["id"], conn)
        return await services["object"].delete_object(
            obj=file_row,
            project_id=project["id"],
            provider_bucket_name=PROVIDER_BUCKET,
            conn=conn,
        )


@router.post("/files/bulk-delete")
async def bulk_delete_files(
    body: BulkDeleteRequest,
    project_id: str = Query(...),
    current_user=Depends(get_current_user),
):
    services = _get_services()
    pool = await get_main_db_pool()
    deleted = 0
    async with pool.acquire() as conn:
        project = await services["project"].resolve_project_for_user(
            project_id, _uid(current_user), conn
        )
        for file_id_str in body.file_ids:
            try:
                file_row = await services["object"].get_object(
                    uuid.UUID(file_id_str), project["id"], conn
                )
                await services["object"].delete_object(
                    obj=file_row,
                    project_id=project["id"],
                    provider_bucket_name=PROVIDER_BUCKET,
                    conn=conn,
                )
                deleted += 1
            except Exception:
                pass
    return {"success": True, "deleted": deleted}


@router.get("/files/{file_id}/download")
async def download_file(
    file_id: str,
    project_id: str = Query(...),
    current_user=Depends(get_current_user),
):
    _require_provider()
    services = _get_services()
    pool = await get_main_db_pool()
    async with pool.acquire() as conn:
        project = await services["project"].resolve_project_for_user(
            project_id, _uid(current_user), conn
        )
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
    file_id: str,
    project_id: str = Query(...),
    current_user=Depends(get_current_user),
):
    services = _get_services()
    pool = await get_main_db_pool()
    async with pool.acquire() as conn:
        project = await services["project"].resolve_project_for_user(
            project_id, _uid(current_user), conn
        )
        file_row = await services["object"].get_object(uuid.UUID(file_id), project["id"], conn)
        bucket = await StorageRepository.get_bucket_by_id(file_row["bucket_id"], conn)

    if bucket and bucket.get("is_public"):
        url = await services["signed_url"].get_public_url(
            file_row["storage_key"], PROVIDER_BUCKET
        )
        return RedirectResponse(url=url)

    async with pool.acquire() as conn:
        data, mime, _ = await services["object"].download_object(
            obj=file_row,
            provider_bucket_name=PROVIDER_BUCKET,
            conn=conn,
        )
    return StreamingResponse(io.BytesIO(data), media_type=mime)


@router.post("/files/{file_id}/signed-url")
async def generate_signed_url(
    file_id: str,
    body: SignedUrlRequest,
    project_id: str = Query(...),
    current_user=Depends(get_current_user),
):
    _require_provider()
    services = _get_services()
    pool = await get_main_db_pool()
    async with pool.acquire() as conn:
        project = await services["project"].resolve_project_for_user(
            project_id, _uid(current_user), conn
        )
        file_row = await services["object"].get_object(uuid.UUID(file_id), project["id"], conn)
    return await services["signed_url"].generate_signed_url(
        storage_key=file_row["storage_key"],
        expiry=body.expiry,
        provider_bucket_name=PROVIDER_BUCKET,
    )


@router.get("/analytics")
async def storage_analytics(
    project_id: str = Query(...),
    current_user=Depends(get_current_user),
):
    services = _get_services()
    pool = await get_main_db_pool()
    async with pool.acquire() as conn:
        project = await services["project"].resolve_project_for_user(
            project_id, _uid(current_user), conn
        )
        return await services["project"].get_storage_analytics(
            project_id=project["id"],
            project=project,
            conn=conn,
        )
