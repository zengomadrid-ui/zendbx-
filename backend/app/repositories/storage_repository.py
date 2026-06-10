"""
Storage Repository Layer
All SQL queries for storage operations are centralized here.
No business logic — pure database operations only.
"""
import uuid
from typing import Optional, List, Dict, Any
from asyncpg import Connection


class StorageRepository:
    """Repository for all storage-related database operations."""

    # ── Project Resolution ──────────────────────────────────────────────

    @staticmethod
    async def get_project_by_slug_or_id(
        identifier: str,
        conn: Connection,
    ) -> Optional[Dict[str, Any]]:
        """
        Resolve project by slug or UUID.
        Returns project with storage info and user plan.
        """
        # Try UUID first
        try:
            uid = uuid.UUID(identifier)
            row = await conn.fetchrow(
                """
                SELECT p.id, p.slug, p.storage_used, p.max_storage, u.plan
                FROM projects p
                JOIN users u ON u.id = p.user_id
                WHERE p.id = $1
                """,
                uid,
            )
            if row:
                return dict(row)
        except ValueError:
            pass

        # Try slug
        row = await conn.fetchrow(
            """
            SELECT p.id, p.slug, p.storage_used, p.max_storage, u.plan
            FROM projects p
            JOIN users u ON u.id = p.user_id
            WHERE p.slug = $1
            """,
            identifier,
        )
        return dict(row) if row else None

    @staticmethod
    async def get_project_by_slug_or_id_for_user(
        identifier: str,
        user_id: uuid.UUID,
        conn: Connection,
    ) -> Optional[Dict[str, Any]]:
        # Try UUID first
        try:
            uid = uuid.UUID(identifier)
            row = await conn.fetchrow(
                """
                SELECT p.id, p.slug, p.storage_used, p.max_storage, u.plan
                FROM projects p
                JOIN users u ON u.id = p.user_id
                WHERE p.id = $1 AND p.user_id = $2
                """,
                uid,
                user_id,
            )
            if row:
                return dict(row)
        except ValueError:
            pass

        # Try slug
        row = await conn.fetchrow(
            """
            SELECT p.id, p.slug, p.storage_used, p.max_storage, u.plan
            FROM projects p
            JOIN users u ON u.id = p.user_id
            WHERE p.slug = $1 AND p.user_id = $2
            """,
            identifier,
            user_id,
        )
        return dict(row) if row else None

    # ── Bucket Resolution ──────────────────────────────────────────────

    @staticmethod
    async def get_bucket_by_slug_or_id(
        identifier: str,
        project_id: uuid.UUID,
        conn: Connection,
    ) -> Optional[Dict[str, Any]]:
        """
        Resolve bucket by slug or UUID within a project.
        Uses composite index (project_id, slug) for efficient lookup.
        """
        row = await conn.fetchrow(
            """
            SELECT *
            FROM storage_buckets
            WHERE project_id = $1
              AND deleted_at IS NULL
              AND (slug = $2 OR id::text = $2)
            LIMIT 1
            """,
            project_id,
            identifier,
        )
        return dict(row) if row else None

    @staticmethod
    async def get_bucket_by_id(
        bucket_id: uuid.UUID,
        conn: Connection,
    ) -> Optional[Dict[str, Any]]:
        """Get bucket by UUID only (for internal operations)."""
        row = await conn.fetchrow(
            """
            SELECT *
            FROM storage_buckets
            WHERE id = $1 AND deleted_at IS NULL
            """,
            bucket_id,
        )
        return dict(row) if row else None

    # ── Bucket CRUD ──────────────────────────────────────────────────

    @staticmethod
    async def list_buckets(
        project_id: uuid.UUID,
        conn: Connection,
    ) -> List[Dict[str, Any]]:
        """List all active buckets for a project."""
        rows = await conn.fetch(
            """
            SELECT id, name, slug, description, is_public,
                   storage_used, file_count, created_at, updated_at
            FROM storage_buckets
            WHERE project_id = $1 AND deleted_at IS NULL
            ORDER BY created_at DESC
            """,
            project_id,
        )
        return [dict(r) for r in rows]

    @staticmethod
    async def bucket_exists_by_slug(
        project_id: uuid.UUID,
        slug: str,
        conn: Connection,
    ) -> bool:
        """Check if a bucket with this slug already exists in the project."""
        row = await conn.fetchrow(
            """
            SELECT id
            FROM storage_buckets
            WHERE project_id = $1 AND slug = $2 AND deleted_at IS NULL
            """,
            project_id,
            slug,
        )
        return row is not None

    @staticmethod
    async def create_bucket(
        bucket_id: uuid.UUID,
        project_id: uuid.UUID,
        name: str,
        slug: str,
        description: Optional[str],
        is_public: bool,
        user_id: uuid.UUID,
        conn: Connection,
    ) -> Dict[str, Any]:
        """Create a new storage bucket."""
        await conn.execute(
            """
            INSERT INTO storage_buckets
                (id, project_id, name, slug, description, is_public, created_by)
            VALUES ($1, $2, $3, $4, $5, $6, $7)
            """,
            bucket_id,
            project_id,
            name,
            slug,
            description,
            is_public,
            user_id,
        )
        return {
            "id": str(bucket_id),
            "name": name,
            "slug": slug,
            "is_public": is_public,
        }

    @staticmethod
    async def update_bucket(
        bucket_id: uuid.UUID,
        name: str,
        slug: str,
        description: Optional[str],
        is_public: bool,
        conn: Connection,
    ) -> None:
        """Update bucket metadata."""
        await conn.execute(
            """
            UPDATE storage_buckets
            SET name = $1, slug = $2, description = $3, is_public = $4, updated_at = NOW()
            WHERE id = $5
            """,
            name,
            slug,
            description,
            is_public,
            bucket_id,
        )

    @staticmethod
    async def soft_delete_bucket(
        bucket_id: uuid.UUID,
        conn: Connection,
    ) -> None:
        """Soft delete a bucket."""
        await conn.execute(
            """
            UPDATE storage_buckets
            SET deleted_at = NOW()
            WHERE id = $1
            """,
            bucket_id,
        )

    @staticmethod
    async def update_bucket_stats(
        bucket_id: uuid.UUID,
        storage_delta: int,
        file_count_delta: int,
        conn: Connection,
    ) -> None:
        """Update bucket storage and file count."""
        await conn.execute(
            """
            UPDATE storage_buckets
            SET storage_used = GREATEST(0, storage_used + $1),
                file_count = GREATEST(0, file_count + $2),
                updated_at = NOW()
            WHERE id = $3
            """,
            storage_delta,
            file_count_delta,
            bucket_id,
        )

    # ── Object CRUD ──────────────────────────────────────────────────

    @staticmethod
    async def create_object(
        object_id: uuid.UUID,
        project_id: uuid.UUID,
        bucket_id: uuid.UUID,
        file_name: str,
        original_name: str,
        file_size: int,
        mime_type: str,
        storage_key: str,
        user_id: uuid.UUID,
        conn: Connection,
    ) -> Dict[str, Any]:
        """Create a storage object record."""
        await conn.execute(
            """
            INSERT INTO storage_objects
                (id, project_id, bucket_id, file_name, original_name, file_size,
                 mime_type, storage_key, uploaded_by)
            VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9)
            """,
            object_id,
            project_id,
            bucket_id,
            file_name,
            original_name,
            file_size,
            mime_type,
            storage_key,
            user_id,
        )
        return {
            "id": str(object_id),
            "file_name": file_name,
            "original_name": original_name,
            "file_size": file_size,
            "mime_type": mime_type,
            "storage_key": storage_key,
        }

    @staticmethod
    async def get_object_by_id(
        object_id: uuid.UUID,
        project_id: uuid.UUID,
        conn: Connection,
    ) -> Optional[Dict[str, Any]]:
        """Get storage object by ID within project."""
        row = await conn.fetchrow(
            """
            SELECT *
            FROM storage_objects
            WHERE id = $1 AND project_id = $2 AND deleted_at IS NULL
            """,
            object_id,
            project_id,
        )
        return dict(row) if row else None

    @staticmethod
    async def list_objects(
        bucket_id: uuid.UUID,
        prefix: Optional[str],
        conn: Connection,
    ) -> List[Dict[str, Any]]:
        """List objects in a bucket with optional prefix filter."""
        if prefix:
            rows = await conn.fetch(
                """
                SELECT id, file_name, original_name, file_size, mime_type,
                       storage_key, created_at
                FROM storage_objects
                WHERE bucket_id = $1 AND deleted_at IS NULL
                  AND storage_key LIKE $2
                ORDER BY created_at DESC
                """,
                bucket_id,
                f"%{prefix}%",
            )
        else:
            rows = await conn.fetch(
                """
                SELECT id, file_name, original_name, file_size, mime_type,
                       storage_key, created_at
                FROM storage_objects
                WHERE bucket_id = $1 AND deleted_at IS NULL
                ORDER BY created_at DESC
                """,
                bucket_id,
            )
        return [dict(r) for r in rows]

    @staticmethod
    async def list_files_with_search(
        bucket_id: uuid.UUID,
        search: Optional[str],
        sort_by: str,
        sort_dir: str,
        conn: Connection,
    ) -> List[Dict[str, Any]]:
        """List files with search and sorting."""
        direction = "DESC" if sort_dir.lower() == "desc" else "ASC"
        
        if search:
            rows = await conn.fetch(
                f"""
                SELECT id, file_name, original_name, file_size, mime_type, storage_key,
                       download_count, last_downloaded_at, created_at, updated_at
                FROM storage_objects
                WHERE bucket_id = $1 AND deleted_at IS NULL
                  AND (original_name ILIKE $2 OR file_name ILIKE $2)
                ORDER BY {sort_by} {direction}
                """,
                bucket_id,
                f"%{search}%",
            )
        else:
            rows = await conn.fetch(
                f"""
                SELECT id, file_name, original_name, file_size, mime_type, storage_key,
                       download_count, last_downloaded_at, created_at, updated_at
                FROM storage_objects
                WHERE bucket_id = $1 AND deleted_at IS NULL
                ORDER BY {sort_by} {direction}
                """,
                bucket_id,
            )
        return [dict(r) for r in rows]

    @staticmethod
    async def soft_delete_object(
        object_id: uuid.UUID,
        conn: Connection,
    ) -> None:
        """Soft delete a storage object."""
        await conn.execute(
            """
            UPDATE storage_objects
            SET deleted_at = NOW()
            WHERE id = $1
            """,
            object_id,
        )

    @staticmethod
    async def soft_delete_all_objects_in_bucket(
        bucket_id: uuid.UUID,
        conn: Connection,
    ) -> None:
        """Soft delete all objects in a bucket."""
        await conn.execute(
            """
            UPDATE storage_objects
            SET deleted_at = NOW()
            WHERE bucket_id = $1 AND deleted_at IS NULL
            """,
            bucket_id,
        )

    @staticmethod
    async def get_bucket_objects_keys(
        bucket_id: uuid.UUID,
        conn: Connection,
    ) -> List[str]:
        """Get all storage keys for objects in a bucket."""
        rows = await conn.fetch(
            """
            SELECT storage_key
            FROM storage_objects
            WHERE bucket_id = $1 AND deleted_at IS NULL
            """,
            bucket_id,
        )
        return [r["storage_key"] for r in rows]

    @staticmethod
    async def increment_download_count(
        object_id: uuid.UUID,
        conn: Connection,
    ) -> None:
        """Increment download counter for an object."""
        await conn.execute(
            """
            UPDATE storage_objects
            SET download_count = download_count + 1,
                last_downloaded_at = NOW()
            WHERE id = $1
            """,
            object_id,
        )

    # ── Project Storage Updates ──────────────────────────────────────

    @staticmethod
    async def update_project_storage(
        project_id: uuid.UUID,
        storage_delta: int,
        conn: Connection,
    ) -> None:
        """Update project storage usage."""
        await conn.execute(
            """
            UPDATE projects
            SET storage_used = GREATEST(0, storage_used + $1)
            WHERE id = $2
            """,
            storage_delta,
            project_id,
        )

    # ── Analytics ──────────────────────────────────────────────────

    @staticmethod
    async def get_storage_totals(
        project_id: uuid.UUID,
        conn: Connection,
    ) -> Dict[str, Any]:
        """Get aggregate storage statistics for a project."""
        row = await conn.fetchrow(
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
            project_id,
        )
        return dict(row) if row else {}

    @staticmethod
    async def get_largest_files(
        project_id: uuid.UUID,
        limit: int,
        conn: Connection,
    ) -> List[Dict[str, Any]]:
        """Get largest files in a project."""
        rows = await conn.fetch(
            """
            SELECT id, original_name, file_size, mime_type, created_at
            FROM storage_objects
            WHERE project_id = $1 AND deleted_at IS NULL
            ORDER BY file_size DESC
            LIMIT $2
            """,
            project_id,
            limit,
        )
        return [dict(r) for r in rows]

    @staticmethod
    async def get_recent_uploads(
        project_id: uuid.UUID,
        limit: int,
        conn: Connection,
    ) -> List[Dict[str, Any]]:
        """Get most recent uploads in a project."""
        rows = await conn.fetch(
            """
            SELECT id, original_name, file_size, mime_type, created_at
            FROM storage_objects
            WHERE project_id = $1 AND deleted_at IS NULL
            ORDER BY created_at DESC
            LIMIT $2
            """,
            project_id,
            limit,
        )
        return [dict(r) for r in rows]

    @staticmethod
    async def get_storage_growth(
        project_id: uuid.UUID,
        days: int,
        conn: Connection,
    ) -> List[Dict[str, Any]]:
        """Get daily storage growth for the past N days."""
        rows = await conn.fetch(
            """
            SELECT
                DATE(created_at) AS day,
                COUNT(*) AS uploads,
                COALESCE(SUM(file_size), 0) AS bytes_added
            FROM storage_objects
            WHERE project_id = $1 AND deleted_at IS NULL
              AND created_at >= NOW() - ($2 * INTERVAL '1 day')
            GROUP BY DATE(created_at)
            ORDER BY day ASC
            """,
            project_id,
            days,
        )
        return [dict(r) for r in rows]

    @staticmethod
    async def get_bucket_stats(
        bucket_id: uuid.UUID,
        conn: Connection,
    ) -> Optional[Dict[str, Any]]:
        """Get detailed stats for a specific bucket."""
        bucket = await conn.fetchrow(
            """
            SELECT id, name, storage_used, file_count
            FROM storage_buckets
            WHERE id = $1 AND deleted_at IS NULL
            """,
            bucket_id,
        )
        if not bucket:
            return None

        largest = await conn.fetch(
            """
            SELECT id, original_name, file_size, mime_type, created_at
            FROM storage_objects
            WHERE bucket_id = $1 AND deleted_at IS NULL
            ORDER BY file_size DESC
            LIMIT 5
            """,
            bucket_id,
        )

        return {
            "bucket_id": str(bucket["id"]),
            "name": bucket["name"],
            "storage_used": bucket["storage_used"],
            "file_count": bucket["file_count"],
            "largest_files": [dict(r) for r in largest],
        }
