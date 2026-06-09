from fastapi import APIRouter, HTTPException, Depends, status
from app.api.auth import get_current_user
from app.core.db_router import get_main_db_pool
from uuid import UUID
import logging

logger = logging.getLogger(__name__)
router = APIRouter()


@router.get("/projects/{project_id}/keys-new", response_model=dict)
async def get_project_keys_new(
    project_id: UUID,
    current_user: dict = Depends(get_current_user)
):
    """Get project API keys (anon and service_role) with full keys visible."""
    try:
        pool = await get_main_db_pool()
        async with pool.acquire() as conn:
            # Verify ownership
            project = await conn.fetchrow(
                "SELECT id FROM projects WHERE id = $1 AND user_id = $2",
                project_id, current_user["id"]
            )
            if not project:
                raise HTTPException(status_code=404, detail="Project not found")

            rows = await conn.fetch(
                """
                SELECT id, name, key_prefix, encrypted_key, key_type, role, is_active, created_at
                FROM api_keys
                WHERE project_id = $1 AND key_type IN ('anon', 'service_role')
                ORDER BY key_type
                """,
                project_id
            )

        keys = {}
        for row in rows:
            full_key = row["encrypted_key"] or row["key_prefix"]
            key_data = {
                "id": str(row["id"]),
                "name": row["name"],
                "key_prefix": row["key_prefix"],
                "full_key": full_key,
                "role": row["role"],
                "is_active": row["is_active"],
                "created_at": row["created_at"].isoformat(),
            }
            if row["key_type"] == "anon":
                keys["anon"] = key_data
            elif row["key_type"] == "service_role":
                keys["service_role"] = key_data

        return {"project_id": str(project_id), "keys": keys}

    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"get_project_keys_new error: {e}", exc_info=True)
        raise HTTPException(status_code=500, detail=f"Failed to fetch keys: {str(e)}")
