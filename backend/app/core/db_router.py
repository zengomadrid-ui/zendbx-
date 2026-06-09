"""
Database Router - Schema-per-project architecture
Single shared PostgreSQL pool. Project isolation via search_path.
"""
import asyncpg
from typing import Dict, Optional
from fastapi import HTTPException
import logging
import jwt as pyjwt

logger = logging.getLogger(__name__)

_main_pool: Optional[asyncpg.Pool] = None


async def get_main_db_pool() -> asyncpg.Pool:
    """Get or create the single shared database pool."""
    global _main_pool

    if _main_pool is None:
        from .config import settings

        if not settings.DATABASE_URL:
            raise ValueError("DATABASE_URL environment variable is required")

        logger.info("🔄 Creating main database pool")
        try:
            _main_pool = await asyncpg.create_pool(
                dsn=settings.DATABASE_URL,
                min_size=5,
                max_size=20,
                command_timeout=60,
                timeout=30,
            )
            logger.info(f"✅ Pool ready: size={_main_pool.get_size()}")
        except Exception as e:
            logger.error(f"❌ Pool creation failed: {e}")
            raise

    return _main_pool


async def initialize_main_pool():
    """Call at startup to warm up the pool."""
    global _main_pool
    if _main_pool is not None:
        return _main_pool
    return await get_main_db_pool()


async def get_project_info(project_id: str) -> dict:
    """Fetch project record. Raises 404 if not found."""
    pool = await get_main_db_pool()
    async with pool.acquire() as conn:
        row = await conn.fetchrow(
            "SELECT id, name, database_name, jwt_secret, slug FROM projects WHERE id = $1",
            project_id,
        )
    if not row:
        raise HTTPException(status_code=404, detail="Project not found")
    return dict(row)


async def validate_project_key(project_id: str, api_key: str) -> dict:
    """
    Validate an API key against a project.
    Keys are JWTs signed with the project's jwt_secret.
    Falls back to DB lookup for legacy keys.
    Returns: dict with keys: project_id, schema, role, jwt_secret
    """
    pool = await get_main_db_pool()
    async with pool.acquire() as conn:
        project = await conn.fetchrow(
            "SELECT id, name, database_name, jwt_secret, slug FROM projects WHERE id = $1",
            project_id,
        )

    if not project:
        raise HTTPException(status_code=404, detail="Project not found")

    jwt_secret = project["jwt_secret"]
    if not jwt_secret:
        raise HTTPException(status_code=500, detail="Project not configured (missing jwt_secret)")

    # Try JWT decode first (new-style keys)
    key_role = None
    try:
        payload = pyjwt.decode(api_key, jwt_secret, algorithms=["HS256"])
        key_role = payload.get("role", "anon")
        logger.info(f"✅ JWT key validated: role={key_role} project={project_id}")
    except Exception:
        # Fall back to legacy DB string match
        async with pool.acquire() as conn:
            rows = await conn.fetch(
                "SELECT encrypted_key, key_type FROM api_keys WHERE project_id = $1 AND is_active = true",
                project_id,
            )
        match = next((r for r in rows if (r["encrypted_key"] or "").strip() == api_key.strip()), None)
        if not match:
            raise HTTPException(status_code=403, detail="Invalid API key")
        key_role = match["key_type"]  # 'anon' or 'service_role'
        logger.info(f"✅ Legacy key validated: role={key_role} project={project_id}")

    return {
        "project_id": str(project["id"]),
        "schema": project["database_name"],
        "slug": project["slug"],
        "role": key_role,
        "jwt_secret": jwt_secret,
        "pool": await get_main_db_pool(),
    }


async def get_project_db(project_id: str, api_key: str) -> asyncpg.Pool:
    """
    Backward-compatible shim. Returns the shared pool after validating the key.
    Callers must SET search_path themselves.
    """
    info = await validate_project_key(project_id, api_key)
    return info["pool"]


async def get_project_db_direct(project_id: str) -> asyncpg.Pool:
    """Return shared pool without key validation (internal use only)."""
    project = await get_project_info(project_id)
    _ = project  # just validates the project exists
    return await get_main_db_pool()


async def close_all_pools():
    """Graceful shutdown."""
    global _main_pool
    if _main_pool:
        await _main_pool.close()
        _main_pool = None
        logger.info("Database pool closed")
