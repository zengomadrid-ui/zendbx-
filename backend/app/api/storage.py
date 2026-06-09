"""
Storage API Routes
All routes use the StorageProvider abstraction — now using Backblaze B2.
"""
import uuid
import re
from typing import Optional, List
from datetime import datetime

from fastapi import APIRouter, Depends, HTTPException, UploadFile, File, Form, Query
from fastapi.responses import StreamingResponse, Response
from pydantic import BaseModel

from app.core.security import get_current_user
from app.core.database import get_main_db_pool
from app.services.b2_storage import get_storage_provider
from app.core.config import settings as _settings

router = APIRouter(prefix="/api/storage", tags=["storage"])

# ------------------------------------------------------------------ #
# Constants                                                            #
# ------------------------------------------------------------------ #

B2_BUCKET = _settings.B2_BUCKET_NAME  # "zendbx"

ALLOWED_MIME_PREFIXES = [
    "image/", "video/", "text/",
    "application/pdf", "application/json",
    "application/zip", "application/x-zip-compressed",
]

BLOCKED_EXTENSIONS = {".exe", ".bat", ".cmd", ".sh", ".apk", ".iso", ".dmg", ".msi", ".ps1"}

PLAN_UPLOAD_LIMITS = {
    "free": 10 * 1024 * 1024,       # 10 MB
    "pro": 100 * 1024 * 1024,       # 100 MB
    "enterprise": 500 * 1024 * 1024, # 500 MB
}

SIGNED_URL_EXPIRY_OPTIONS = {
    "5m": 300,
    "15m": 900,
    "1h": 3600,
    "24h": 86400,
    "7d": 604800,
}

# ------------------------------------------------------------------ #
# Pydantic models                                                      #
# ------------------------------------------------------------------ #

class CreateBucketRequest(BaseModel):
    name: str
    description: Optional[str] = None
    is_public: bool = False

class UpdateBucketRequest(BaseModel):
    name: Optional[str] = None
    description: Optional[str] = None
    is_public: Optional[bool] = None

class UpdateFileRequest(BaseModel):
    file_name: str

class SignedUrlRequest(BaseModel):
    expiry: str = "1h"  # 5m | 15m | 1h | 24h | 7d

class BulkDeleteRequest(BaseModel):
    file_ids: List[str]

# ------------------------------------------------------------------ #
# Helpers                                                              #
# ------------------------------------------------------------------ #

def slugify(name: str) -> str:
    slug = name.lower().strip()
    slug = re.sub(r"[^a-z0-9\-]", "-", slug)
    slug = re.sub(r"-+", "-", slug).strip("-")
    return slug or "bucket"


def _is_mime_allowed(mime_type: str) -> bool:
    for prefix in ALLOWED_MIME_PREFIXES:
        if mime_type.startswith(prefix):
            return True
    return False


def _has_blocked_extension(filename: str) -> bool:
    ext = "." + filename.rsplit(".", 1)[-1].lower() if "." in filename else ""
    return ext in BLOCKED_EXTENSIONS


async def _get_project_for_user(project_id: str, user_id: str, pool):
    """Verify user has access to the project and return it."""
    row = await pool.fetchrow(
        """
        SELECT p.id, p.storage_used, p.max_storage, u.plan
        FROM projects p
        JOIN users u ON u.id = p.user_id
        WHERE p.id = $1 AND p.user_id = $2
        """,
        uuid.UUID(project_id),
        uuid.UUID(user_id),
    )
    if not row:
        raise HTTPException(status_code=404, detail="Project not found")
    return row


async def _get_bucket(bucket_id: str, project_id: str, pool):
    row = await pool.fetchrow(
        "SELECT * FROM storage_buckets WHERE id = $1 AND project_id = $2 AND deleted_at IS NULL",
        uuid.UUID(bucket_id),
        uuid.UUID(project_id),
    )
    if not row:
        raise HTTPException(status_code=404, detail="Bucket not found")
    return row


async def _get_file(file_id: str, project_id: str, pool):
    row = await pool.fetchrow(
        "SELECT * FROM storage_objects WHERE id = $1 AND project_id = $2 AND deleted_at IS NULL",
        uuid.UUID(file_id),
        uuid.UUID(project_id),
    )
    if not row:
        raise HTTPException(status_code=404, detail="File not found")
    return row


def _get_user_id(current_user) -> str:
    return str(current_user.id if hasattr(current_user, "id") else current_user["id"])


def _get_user_plan(current_user) -> str:
    return str(current_user.plan if hasattr(current_user, "plan") else current_user.get("plan", "free"))


# ------------------------------------------------------------------ #
# Bucket endpoints                                                     #
# ------------------------------------------------------------------ #

@router.post("/buckets")
async def create_bucket(
    body: CreateBucketRequest,
    project_id: str = Query(...),
    current_user=Depends(get_current_user),
):
    user_id = _get_user_id(current_user)
    pool = await get_main_db_pool()
    
    # Check if storage provider is available
    storage_provider = get_storage_provider()
    if storage_provider is None:
        raise HTTPException(
            status_code=503,
            detail="Storage feature is currently unavailable. Configure B2_KEY_ID and B2_APPLICATION_KEY environment variables.",
        )
    
    async with pool.acquire() as conn:
        await _get_project_for_user(project_id, user_id, conn)

        slug = slugify(body.name)
        # Ensure slug uniqueness within project
        existing = await conn.fetchrow(
            "SELECT id FROM storage_buckets WHERE project_id = $1 AND slug = $2 AND deleted_at IS NULL",
            uuid.UUID(project_id), slug,
        )
        if existing:
            raise HTTPException(status_code=409, detail="A bucket with this name already exists")

        bucket_id = uuid.uuid4()
        await conn.execute(
            """
            INSERT INTO storage_buckets (id, project_id, name, slug, description, is_public, created_by)
            VALUES ($1, $2, $3, $4, $5, $6, $7)
            """,
            bucket_id, uuid.UUID(project_id), body.name, slug,
            body.description, body.is_public, uuid.UUID(user_id),
        )

        # Ensure top-level B2 bucket exists
        await storage_provider.create_bucket(B2_BUCKET)

        return {"id": str(bucket_id), "name": body.name, "slug": slug, "is_public": body.is_public}


@router.get("/buckets")
async def list_buckets(
    project_id: str = Query(...),
    current_user=Depends(get_current_user),
):
    user_id = _get_user_id(current_user)
    pool = await get_main_db_pool()
    async with pool.acquire() as conn:
        await _get_project_for_user(project_id, user_id, conn)
        rows = await conn.fetch(
            """
            SELECT id, name, slug, description, is_public, storage_used, file_count, created_at, updated_at
            FROM storage_buckets
            WHERE project_id = $1 AND deleted_at IS NULL
            ORDER BY created_at DESC
            """,
            uuid.UUID(project_id),
        )
    return [dict(r) for r in rows]


@router.patch("/buckets/{bucket_id}")
async def update_bucket(
    bucket_id: str,
    body: UpdateBucketRequest,
    project_id: str = Query(...),
    current_user=Depends(get_current_user),
):
    user_id = _get_user_id(current_user)
    pool = await get_main_db_pool()
    async with pool.acquire() as conn:
        await _get_project_for_user(project_id, user_id, conn)
        bucket = await _get_bucket(bucket_id, project_id, conn)

        new_name = body.name if body.name is not None else bucket["name"]
        new_slug = slugify(new_name) if body.name else bucket["slug"]
        new_desc = body.description if body.description is not None else bucket["description"]
        new_public = body.is_public if body.is_public is not None else bucket["is_public"]

        await conn.execute(
            """
            UPDATE storage_buckets
            SET name = $1, slug = $2, description = $3, is_public = $4, updated_at = NOW()
            WHERE id = $5
            """,
            new_name, new_slug, new_desc, new_public, uuid.UUID(bucket_id),
        )
    return {"success": True, "name": new_name, "slug": new_slug}


@router.delete("/buckets/{bucket_id}")
async def delete_bucket(
    bucket_id: str,
    project_id: str = Query(...),
    current_user=Depends(get_current_user),
):
    user_id = _get_user_id(current_user)
    pool = await get_main_db_pool()
    async with pool.acquire() as conn:
        await _get_project_for_user(project_id, user_id, conn)
        bucket = await _get_bucket(bucket_id, project_id, conn)

        # Soft-delete all files in bucket
        files = await conn.fetch(
            "SELECT storage_key FROM storage_objects WHERE bucket_id = $1 AND deleted_at IS NULL",
            uuid.UUID(bucket_id),
        )
        for f in files:
            await get_storage_provider().delete_file(f["storage_key"], B2_BUCKET)

        await conn.execute(
            "UPDATE storage_objects SET deleted_at = NOW() WHERE bucket_id = $1 AND deleted_at IS NULL",
            uuid.UUID(bucket_id),
        )
        await conn.execute(
            "UPDATE storage_buckets SET deleted_at = NOW() WHERE id = $1",
            uuid.UUID(bucket_id),
        )

        # Reclaim storage from project
        await conn.execute(
            "UPDATE projects SET storage_used = GREATEST(0, storage_used - $1) WHERE id = $2",
            bucket["storage_used"], uuid.UUID(project_id),
        )

    return {"success": True}


@router.get("/buckets/{bucket_id}/stats")
async def bucket_stats(
    bucket_id: str,
    project_id: str = Query(...),
    current_user=Depends(get_current_user),
):
    user_id = _get_user_id(current_user)
    pool = await get_main_db_pool()
    async with pool.acquire() as conn:
        await _get_project_for_user(project_id, user_id, conn)
        bucket = await _get_bucket(bucket_id, project_id, conn)
        largest = await conn.fetch(
            """
            SELECT id, original_name, file_size, mime_type, created_at
            FROM storage_objects
            WHERE bucket_id = $1 AND deleted_at IS NULL
            ORDER BY file_size DESC LIMIT 5
            """,
            uuid.UUID(bucket_id),
        )
    return {
        "bucket_id": bucket_id,
        "name": bucket["name"],
        "storage_used": bucket["storage_used"],
        "file_count": bucket["file_count"],
        "largest_files": [dict(r) for r in largest],
    }


# ------------------------------------------------------------------ #
# File upload                                                          #
# ------------------------------------------------------------------ #

@router.post("/buckets/{bucket_id}/upload")
async def upload_file_to_bucket(
    bucket_id: str,
    project_id: str = Form(...),
    file: UploadFile = File(...),
    current_user=Depends(get_current_user),
):
    """SDK-compatible upload endpoint: POST /api/storage/buckets/{bucket_id}/upload"""
    return await _do_upload(bucket_id, project_id, file, current_user)


@router.get("/buckets/{bucket_id}/objects")
async def list_objects(
    bucket_id: str,
    project_id: str = Query(...),
    prefix: Optional[str] = Query(None),
    current_user=Depends(get_current_user),
):
    """SDK-compatible list endpoint: GET /api/storage/buckets/{bucket_id}/objects"""
    user_id = _get_user_id(current_user)
    pool = await get_main_db_pool()
    async with pool.acquire() as conn:
        await _get_project_for_user(project_id, user_id, conn)
        await _get_bucket(bucket_id, project_id, conn)
        if prefix:
            rows = await conn.fetch(
                """SELECT id, file_name, original_name, file_size, mime_type, storage_key, created_at
                   FROM storage_objects
                   WHERE bucket_id = $1 AND deleted_at IS NULL AND storage_key LIKE $2
                   ORDER BY created_at DESC""",
                uuid.UUID(bucket_id), f"%{prefix}%",
            )
        else:
            rows = await conn.fetch(
                """SELECT id, file_name, original_name, file_size, mime_type, storage_key, created_at
                   FROM storage_objects
                   WHERE bucket_id = $1 AND deleted_at IS NULL
                   ORDER BY created_at DESC""",
                uuid.UUID(bucket_id),
            )
    return [dict(r) for r in rows]


@router.post("/upload")
async def upload_file(
    project_id: str = Form(...),
    bucket_id: str = Form(...),
    file: UploadFile = File(...),
    current_user=Depends(get_current_user),
):
    """Dashboard upload endpoint: POST /api/storage/upload"""
    return await _do_upload(bucket_id, project_id, file, current_user)


async def _do_upload(bucket_id: str, project_id: str, file: UploadFile, current_user):
    user_id = _get_user_id(current_user)
    user_plan = _get_user_plan(current_user)

    # Validate extension
    if _has_blocked_extension(file.filename or ""):
        raise HTTPException(status_code=400, detail="File type not allowed")

    # Read file
    file_data = await file.read()
    file_size = len(file_data)

    # Validate upload size limit by plan
    upload_limit = PLAN_UPLOAD_LIMITS.get(user_plan, PLAN_UPLOAD_LIMITS["free"])
    if file_size > upload_limit:
        raise HTTPException(
            status_code=413,
            detail=f"File too large. Your plan allows up to {upload_limit // 1024 // 1024} MB per file.",
        )

    # Validate MIME type
    mime_type = file.content_type or "application/octet-stream"
    if not _is_mime_allowed(mime_type):
        raise HTTPException(status_code=400, detail=f"MIME type '{mime_type}' is not allowed")

    pool = await get_main_db_pool()
    async with pool.acquire() as conn:
        project = await _get_project_for_user(project_id, user_id, conn)
        bucket = await _get_bucket(bucket_id, project_id, conn)

        # Enforce storage quota
        if project["storage_used"] + file_size > project["max_storage"]:
            raise HTTPException(
                status_code=413,
                detail="Storage quota exceeded. Upgrade your plan or delete files.",
            )

        # Build storage key: {project_id}/{bucket_slug}/{uuid}/{filename}
        file_uuid = uuid.uuid4()
        safe_name = re.sub(r"[^a-zA-Z0-9._\-]", "_", file.filename or "file")
        storage_key = f"{project_id}/{bucket['slug']}/{file_uuid}/{safe_name}"

        # Upload to B2
        success = await get_storage_provider().upload_file(storage_key, file_data, mime_type, B2_BUCKET)
        if not success:
            raise HTTPException(status_code=500, detail="Failed to upload file to storage")

        # Persist metadata
        file_id = uuid.uuid4()
        await conn.execute(
            """
            INSERT INTO storage_objects
                (id, project_id, bucket_id, file_name, original_name, file_size, mime_type, storage_key, uploaded_by)
            VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9)
            """,
            file_id, uuid.UUID(project_id), uuid.UUID(bucket_id),
            safe_name, file.filename, file_size, mime_type, storage_key, uuid.UUID(user_id),
        )

        # Update bucket counters
        await conn.execute(
            """
            UPDATE storage_buckets
            SET storage_used = storage_used + $1, file_count = file_count + 1, updated_at = NOW()
            WHERE id = $2
            """,
            file_size, uuid.UUID(bucket_id),
        )

        # Update project storage
        await conn.execute(
            "UPDATE projects SET storage_used = storage_used + $1 WHERE id = $2",
            file_size, uuid.UUID(project_id),
        )

    return {
        "id": str(file_id),
        "file_name": safe_name,
        "original_name": file.filename,
        "file_size": file_size,
        "mime_type": mime_type,
        "storage_key": storage_key,
    }


# ------------------------------------------------------------------ #
# File listing & metadata                                              #
# ------------------------------------------------------------------ #

@router.get("/buckets/{bucket_id}/files")
async def list_files(
    bucket_id: str,
    project_id: str = Query(...),
    search: Optional[str] = Query(None),
    sort_by: str = Query("created_at"),
    sort_dir: str = Query("desc"),
    current_user=Depends(get_current_user),
):
    user_id = _get_user_id(current_user)
    pool = await get_main_db_pool()
    async with pool.acquire() as conn:
        await _get_project_for_user(project_id, user_id, conn)
        await _get_bucket(bucket_id, project_id, conn)

        allowed_sort = {"created_at", "file_size", "original_name", "download_count"}
        sort_col = sort_by if sort_by in allowed_sort else "created_at"
        direction = "DESC" if sort_dir.lower() == "desc" else "ASC"

        if search:
            rows = await conn.fetch(
                f"""
                SELECT id, file_name, original_name, file_size, mime_type, storage_key,
                       download_count, last_downloaded_at, created_at, updated_at
                FROM storage_objects
                WHERE bucket_id = $1 AND deleted_at IS NULL
                  AND (original_name ILIKE $2 OR file_name ILIKE $2)
                ORDER BY {sort_col} {direction}
                """,
                uuid.UUID(bucket_id), f"%{search}%",
            )
        else:
            rows = await conn.fetch(
                f"""
                SELECT id, file_name, original_name, file_size, mime_type, storage_key,
                       download_count, last_downloaded_at, created_at, updated_at
                FROM storage_objects
                WHERE bucket_id = $1 AND deleted_at IS NULL
                ORDER BY {sort_col} {direction}
                """,
                uuid.UUID(bucket_id),
            )
    return [dict(r) for r in rows]


@router.get("/files/{file_id}")
async def get_file_metadata(
    file_id: str,
    project_id: str = Query(...),
    current_user=Depends(get_current_user),
):
    user_id = _get_user_id(current_user)
    pool = await get_main_db_pool()
    async with pool.acquire() as conn:
        await _get_project_for_user(project_id, user_id, conn)
        row = await _get_file(file_id, project_id, conn)
    return dict(row)


@router.patch("/files/{file_id}")
async def rename_file(
    file_id: str,
    body: UpdateFileRequest,
    project_id: str = Query(...),
    current_user=Depends(get_current_user),
):
    user_id = _get_user_id(current_user)
    pool = await get_main_db_pool()
    async with pool.acquire() as conn:
        await _get_project_for_user(project_id, user_id, conn)
        file_row = await _get_file(file_id, project_id, conn)
        bucket = await _get_bucket(str(file_row["bucket_id"]), project_id, conn)

        safe_name = re.sub(r"[^a-zA-Z0-9._\-]", "_", body.file_name)
        old_key = file_row["storage_key"]
        # Build new key preserving the uuid segment
        parts = old_key.rsplit("/", 1)
        new_key = parts[0] + "/" + safe_name if len(parts) == 2 else old_key

        success = await get_storage_provider().rename_file(old_key, new_key, B2_BUCKET)
        if not success:
            raise HTTPException(status_code=500, detail="Failed to rename file in storage")

        await conn.execute(
            "UPDATE storage_objects SET file_name = $1, original_name = $2, storage_key = $3, updated_at = NOW() WHERE id = $4",
            safe_name, body.file_name, new_key, uuid.UUID(file_id),
        )
    return {"success": True, "file_name": safe_name, "storage_key": new_key}


@router.delete("/files/{file_id}")
async def delete_file(
    file_id: str,
    project_id: str = Query(...),
    current_user=Depends(get_current_user),
):
    user_id = _get_user_id(current_user)
    pool = await get_main_db_pool()
    async with pool.acquire() as conn:
        await _get_project_for_user(project_id, user_id, conn)
        file_row = await _get_file(file_id, project_id, conn)

        # Delete from B2 immediately
        await get_storage_provider().delete_file(file_row["storage_key"], B2_BUCKET)

        # Soft-delete metadata
        await conn.execute(
            "UPDATE storage_objects SET deleted_at = NOW() WHERE id = $1",
            uuid.UUID(file_id),
        )

        # Update counters
        await conn.execute(
            """
            UPDATE storage_buckets
            SET storage_used = GREATEST(0, storage_used - $1), file_count = GREATEST(0, file_count - 1), updated_at = NOW()
            WHERE id = $2
            """,
            file_row["file_size"] or 0, file_row["bucket_id"],
        )
        await conn.execute(
            "UPDATE projects SET storage_used = GREATEST(0, storage_used - $1) WHERE id = $2",
            file_row["file_size"] or 0, uuid.UUID(project_id),
        )

    return {"success": True}


@router.post("/files/bulk-delete")
async def bulk_delete_files(
    body: BulkDeleteRequest,
    project_id: str = Query(...),
    current_user=Depends(get_current_user),
):
    user_id = _get_user_id(current_user)
    pool = await get_main_db_pool()
    deleted = 0
    async with pool.acquire() as conn:
        await _get_project_for_user(project_id, user_id, conn)
        for file_id in body.file_ids:
            try:
                file_row = await _get_file(file_id, project_id, conn)
                await get_storage_provider().delete_file(file_row["storage_key"], B2_BUCKET)
                await conn.execute(
                    "UPDATE storage_objects SET deleted_at = NOW() WHERE id = $1",
                    uuid.UUID(file_id),
                )
                await conn.execute(
                    """
                    UPDATE storage_buckets
                    SET storage_used = GREATEST(0, storage_used - $1),
                        file_count = GREATEST(0, file_count - 1), updated_at = NOW()
                    WHERE id = $2
                    """,
                    file_row["file_size"] or 0, file_row["bucket_id"],
                )
                await conn.execute(
                    "UPDATE projects SET storage_used = GREATEST(0, storage_used - $1) WHERE id = $2",
                    file_row["file_size"] or 0, uuid.UUID(project_id),
                )
                deleted += 1
            except Exception:
                pass
    return {"success": True, "deleted": deleted}


# ------------------------------------------------------------------ #
# Download & Preview                                                   #
# ------------------------------------------------------------------ #

@router.get("/files/{file_id}/download")
async def download_file(
    file_id: str,
    project_id: str = Query(...),
    current_user=Depends(get_current_user),
):
    user_id = _get_user_id(current_user)
    pool = await get_main_db_pool()
    async with pool.acquire() as conn:
        await _get_project_for_user(project_id, user_id, conn)
        file_row = await _get_file(file_id, project_id, conn)

        data = await get_storage_provider().get_file(file_row["storage_key"], B2_BUCKET)
        if data is None:
            raise HTTPException(status_code=404, detail="File not found in storage")

        # Track download
        await conn.execute(
            """
            UPDATE storage_objects
            SET download_count = download_count + 1, last_downloaded_at = NOW()
            WHERE id = $1
            """,
            uuid.UUID(file_id),
        )

    import io
    return StreamingResponse(
        io.BytesIO(data),
        media_type=file_row["mime_type"] or "application/octet-stream",
        headers={"Content-Disposition": f'attachment; filename="{file_row["original_name"]}"'},
    )


@router.get("/files/{file_id}/preview")
async def preview_file(
    file_id: str,
    project_id: str = Query(...),
    current_user=Depends(get_current_user),
):
    user_id = _get_user_id(current_user)
    pool = await get_main_db_pool()
    async with pool.acquire() as conn:
        await _get_project_for_user(project_id, user_id, conn)
        file_row = await _get_file(file_id, project_id, conn)

        # For private files, stream directly; for public files, redirect
        bucket_row = await conn.fetchrow(
            "SELECT is_public FROM storage_buckets WHERE id = $1",
            file_row["bucket_id"],
        )

    if bucket_row and bucket_row["is_public"]:
        url = await get_storage_provider().get_file_url(file_row["storage_key"], B2_BUCKET)
        from fastapi.responses import RedirectResponse
        return RedirectResponse(url=url)

    data = await get_storage_provider().get_file(file_row["storage_key"], B2_BUCKET)
    if data is None:
        raise HTTPException(status_code=404, detail="File not found in storage")

    import io
    return StreamingResponse(
        io.BytesIO(data),
        media_type=file_row["mime_type"] or "application/octet-stream",
    )


# ------------------------------------------------------------------ #
# Signed URLs                                                          #
# ------------------------------------------------------------------ #

@router.post("/files/{file_id}/signed-url")
async def generate_signed_url(
    file_id: str,
    body: SignedUrlRequest,
    project_id: str = Query(...),
    current_user=Depends(get_current_user),
):
    user_id = _get_user_id(current_user)
    expires_seconds = SIGNED_URL_EXPIRY_OPTIONS.get(body.expiry, 3600)

    pool = await get_main_db_pool()
    async with pool.acquire() as conn:
        await _get_project_for_user(project_id, user_id, conn)
        file_row = await _get_file(file_id, project_id, conn)

    url = await get_storage_provider().generate_signed_url(
        file_row["storage_key"], expires_seconds, B2_BUCKET
    )
    if not url:
        raise HTTPException(status_code=500, detail="Failed to generate signed URL")

    return {"url": url, "expires_in": expires_seconds, "expiry": body.expiry}


# ------------------------------------------------------------------ #
# Analytics                                                            #
# ------------------------------------------------------------------ #

@router.get("/analytics")
async def storage_analytics(
    project_id: str = Query(...),
    current_user=Depends(get_current_user),
):
    user_id = _get_user_id(current_user)
    pool = await get_main_db_pool()
    async with pool.acquire() as conn:
        project = await _get_project_for_user(project_id, user_id, conn)

        totals = await conn.fetchrow(
            """
            SELECT
                COUNT(DISTINCT sb.id) AS bucket_count,
                COUNT(so.id) AS file_count,
                COALESCE(SUM(so.file_size), 0) AS storage_used,
                COALESCE(SUM(so.download_count), 0) AS download_count
            FROM storage_buckets sb
            LEFT JOIN storage_objects so ON so.bucket_id = sb.id AND so.deleted_at IS NULL
            WHERE sb.project_id = $1 AND sb.deleted_at IS NULL
            """,
            uuid.UUID(project_id),
        )

        largest = await conn.fetch(
            """
            SELECT id, original_name, file_size, mime_type, created_at
            FROM storage_objects
            WHERE project_id = $1 AND deleted_at IS NULL
            ORDER BY file_size DESC LIMIT 10
            """,
            uuid.UUID(project_id),
        )

        recent = await conn.fetch(
            """
            SELECT id, original_name, file_size, mime_type, created_at
            FROM storage_objects
            WHERE project_id = $1 AND deleted_at IS NULL
            ORDER BY created_at DESC LIMIT 10
            """,
            uuid.UUID(project_id),
        )

        # Storage growth: uploads per day for last 30 days
        growth = await conn.fetch(
            """
            SELECT DATE(created_at) AS day, COUNT(*) AS uploads, COALESCE(SUM(file_size), 0) AS bytes_added
            FROM storage_objects
            WHERE project_id = $1 AND deleted_at IS NULL
              AND created_at >= NOW() - INTERVAL '30 days'
            GROUP BY DATE(created_at)
            ORDER BY day ASC
            """,
            uuid.UUID(project_id),
        )

    return {
        "storage_used": totals["storage_used"],
        "max_storage": project["max_storage"],
        "storage_used_percent": round(
            (totals["storage_used"] / project["max_storage"] * 100) if project["max_storage"] else 0, 2
        ),
        "file_count": totals["file_count"],
        "bucket_count": totals["bucket_count"],
        "download_count": totals["download_count"],
        "largest_files": [dict(r) for r in largest],
        "recent_uploads": [dict(r) for r in recent],
        "storage_growth": [dict(r) for r in growth],
    }
