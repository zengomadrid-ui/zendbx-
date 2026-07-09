"""
Project Resolution Service - Central slug-to-UUID resolver
Single source of truth for project lookups
"""
from typing import Optional, Dict
from uuid import UUID
from fastapi import HTTPException, status
import asyncpg
from functools import lru_cache
import logging

logger = logging.getLogger(__name__)

class ProjectResolver:
    """
    Centralized project resolution service.
    Converts public project_slug to internal project_id (UUID).
    Provides caching and consistent error handling.
    """
    
    def __init__(self):
        self._cache: Dict[str, dict] = {}
    
    async def resolve_project(
        self, 
        slug: str, 
        pool: asyncpg.Pool,
        required_fields: Optional[list] = None
    ) -> dict:
        """
        Resolve project slug to project data.
        
        Args:
            slug: Public project slug
            pool: Database connection pool
            required_fields: Additional fields to fetch
        
        Returns:
            dict with: id, slug, database_name, jwt_secret, etc.
        
        Raises:
            HTTPException: 404 if project not found
        """
        # Check cache
        cache_key = f"project:{slug}"
        if cache_key in self._cache:
            cached = self._cache[cache_key]
            logger.debug(f"Cache hit for project: {slug}")
            return cached
        
        # Build query
        fields = ["id", "slug", "database_name", "jwt_secret", "name", "status"]
        if required_fields:
            fields.extend(required_fields)
        
        field_list = ", ".join(set(fields))
        
        # Query database
        async with pool.acquire() as conn:
            row = await conn.fetchrow(
                f"SELECT {field_list} FROM projects WHERE slug = $1",
                slug
            )
        
        if not row:
            logger.warning(f"Project not found: {slug}")
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND,
                detail=f"Project '{slug}' not found"
            )
        
        project = dict(row)
        
        # Validate required data
        if not project.get('jwt_secret'):
            logger.error(f"Project missing jwt_secret: {slug}")
            raise HTTPException(
                status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
                detail="Project configuration incomplete"
            )
        
        # Cache result
        self._cache[cache_key] = project
        logger.debug(f"Cached project: {slug} -> {project['id']}")
        
        return project
    
    def invalidate_cache(self, slug: str):
        """Invalidate cached project data"""
        cache_key = f"project:{slug}"
        if cache_key in self._cache:
            del self._cache[cache_key]
            logger.debug(f"Cache invalidated for: {slug}")
    
    def clear_cache(self):
        """Clear entire cache"""
        self._cache.clear()
        logger.info("Project cache cleared")


# Global singleton instance
_project_resolver = ProjectResolver()


def get_project_resolver() -> ProjectResolver:
    """Get the global project resolver instance"""
    return _project_resolver
