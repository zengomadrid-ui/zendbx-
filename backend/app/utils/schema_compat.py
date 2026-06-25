"""
Schema Compatibility Utilities
Handles backward compatibility for database schema evolution
"""
import asyncpg
from typing import Optional
import logging

logger = logging.getLogger(__name__)

# Cache for column existence checks (avoids repeated queries)
_column_cache = {}


async def check_column_exists(
    conn: asyncpg.Connection, 
    table_name: str, 
    column_name: str
) -> bool:
    """
    Check if a column exists in a table
    Results are cached to avoid repeated queries
    """
    cache_key = f"{table_name}.{column_name}"
    
    if cache_key in _column_cache:
        return _column_cache[cache_key]
    
    try:
        result = await conn.fetchval("""
            SELECT EXISTS (
                SELECT FROM information_schema.columns 
                WHERE table_name = $1 AND column_name = $2
            );
        """, table_name, column_name)
        
        _column_cache[cache_key] = bool(result)
        return bool(result)
        
    except Exception as e:
        logger.error(f"Error checking column existence: {e}")
        # Assume column doesn't exist on error
        return False


def build_slug_query(has_legacy_slug: bool) -> tuple[str, str]:
    """
    Build SQL query for slug resolution based on schema capabilities
    
    Returns:
        (select_clause, where_clause)
    
    Example with legacy_slug:
        SELECT id, jwt_secret, slug, legacy_slug FROM projects 
        WHERE (slug = $1 OR legacy_slug = $1) AND status = 'active'
        ORDER BY CASE WHEN slug = $1 THEN 1 ELSE 2 END
    
    Example without legacy_slug:
        SELECT id, jwt_secret, slug FROM projects 
        WHERE slug = $1 AND status = 'active'
    """
    if has_legacy_slug:
        select_clause = "SELECT id, jwt_secret, slug, legacy_slug FROM projects"
        where_clause = "WHERE (slug = $1 OR legacy_slug = $1) AND status = 'active' ORDER BY CASE WHEN slug = $1 THEN 1 ELSE 2 END LIMIT 1"
    else:
        select_clause = "SELECT id, jwt_secret, slug FROM projects"
        where_clause = "WHERE slug = $1 AND status = 'active' LIMIT 1"
    
    return select_clause, where_clause


async def resolve_project_by_slug(
    conn: asyncpg.Connection,
    slug: str,
    additional_columns: str = "*"
) -> Optional[asyncpg.Record]:
    """
    Resolve project by slug with automatic backward compatibility
    Handles both databases with and without legacy_slug column
    
    Args:
        conn: Database connection
        slug: Project slug to resolve
        additional_columns: Additional columns to SELECT (default: *)
    
    Returns:
        Project record or None if not found
    """
    # Check if legacy_slug column exists
    has_legacy_slug = await check_column_exists(conn, "projects", "legacy_slug")
    
    if has_legacy_slug:
        # Modern schema: try both slug and legacy_slug
        query = f"""
            SELECT {additional_columns}
            FROM projects
            WHERE (slug = $1 OR legacy_slug = $1) AND status = 'active'
            ORDER BY CASE WHEN slug = $1 THEN 1 ELSE 2 END
            LIMIT 1
        """
    else:
        # Legacy schema: only use slug
        query = f"""
            SELECT {additional_columns}
            FROM projects
            WHERE slug = $1 AND status = 'active'
            LIMIT 1
        """
    
    try:
        return await conn.fetchrow(query, slug)
    except Exception as e:
        logger.error(f"Error resolving project by slug '{slug}': {e}")
        return None


def clear_column_cache():
    """Clear the column existence cache (useful for testing)"""
    global _column_cache
    _column_cache = {}
