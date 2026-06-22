"""
Database Router - Schema-per-project architecture
Single shared PostgreSQL pool. Project isolation via search_path.
"""
import asyncpg
from typing import Dict, Optional
from fastapi import HTTPException
import logging
import jwt as pyjwt
from urllib.parse import urlparse

logger = logging.getLogger(__name__)

_main_pool: Optional[asyncpg.Pool] = None

# Bad hostnames that will never resolve in production
_INVALID_HOSTS = {"postgres", "db", "localhost", "127.0.0.1", "::1", ""}


def _diagnose_database_url(url: str) -> None:
    """Parse and log DATABASE_URL details (no password logged)."""
    try:
        parsed = urlparse(url)
        host = parsed.hostname or ""
        port = parsed.port or 5432
        dbname = (parsed.path or "").lstrip("/")
        user = parsed.username or ""

        print("\n" + "=" * 60)
        print("DATABASE_URL DIAGNOSTICS")
        print("=" * 60)
        print(f"  hostname : {host}")
        print(f"  port     : {port}")
        print(f"  database : {dbname}")
        print(f"  username : {user}")
        print(f"  scheme   : {parsed.scheme}")
        print("=" * 60 + "\n")

        if host in _INVALID_HOSTS:
            # Only fail hard in production — localhost is fine for local dev
            import os as _os
            env = _os.getenv("ENVIRONMENT", "development")
            if env == "production":
                raise ValueError(
                    f"\n🚨 DATABASE_URL has an invalid hostname: '{host}'\n"
                    f"   This hostname cannot be resolved in production.\n"
                    f"   Expected a Render PostgreSQL hostname like:\n"
                    f"   dpg-xxxxxxxxxxxxxxx-a.oregon-postgres.render.com\n"
                    f"\n   Fix: Set DATABASE_URL in the Render Dashboard → Environment\n"
                    f"   Use the EXTERNAL Database URL from your Render PostgreSQL service."
                )
            else:
                print(f"⚠️  DATABASE_URL uses localhost — OK for local development")

        if host == parsed.hostname and "." not in host:
            # Short hostname with no dots — this is a Render internal hostname.
            # It only resolves from within the same Render region.
            print(
                f"⚠️  WARNING: DATABASE_URL uses a short internal hostname '{host}'\n"
                f"   This only resolves from within the same Render region.\n"
                f"   If the service is in a different region, use the EXTERNAL URL."
            )
    except ValueError:
        raise
    except Exception as e:
        logger.warning(f"Could not parse DATABASE_URL for diagnostics: {e}")


async def get_main_db_pool() -> asyncpg.Pool:
    """Get or create the single shared database pool."""
    global _main_pool

    if _main_pool is None:
        from .config import settings

        if not settings.DATABASE_URL:
            raise ValueError(
                "DATABASE_URL environment variable is not set.\n"
                "Set it in Render Dashboard → Environment with the External Database URL."
            )

        # Log diagnostics and validate hostname before attempting connection
        _diagnose_database_url(settings.DATABASE_URL)

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
