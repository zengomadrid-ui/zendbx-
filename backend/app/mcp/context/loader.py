"""
Context Loader - Complete Implementation with 3-Tier Caching
Loads full project context using all collectors
"""

import time
import asyncio
from typing import Dict, Any
from uuid import UUID
import logging

from app.core.db_router import get_main_db_pool
from app.services.schema_parser import SchemaParser
from ..core.exceptions import ContextLoadError
from ..core.cache import get_mcp_cache
from .collectors import (
    AuthCollector,
    StorageCollector,
    RealtimeCollector,
    FunctionsCollector,
    DeploymentCollector
)

logger = logging.getLogger(__name__)


class ContextLoader:
    """
    Complete context loader
    Loads all subsystems in parallel for maximum performance
    """
    
    def __init__(self):
        # Initialize all collectors
        self.auth_collector = AuthCollector()
        self.storage_collector = StorageCollector()
        self.realtime_collector = RealtimeCollector()
        self.functions_collector = FunctionsCollector()
        self.deployment_collector = DeploymentCollector()
    
    async def load(self, project_id: str, database_name: str, use_cache: bool = True) -> Dict[str, Any]:
        """
        Load complete project context with 3-tier caching
        
        Args:
            project_id: Project UUID
            database_name: Database/schema name
            use_cache: Whether to use cache (default: True)
            
        Returns:
            Context dict with ALL project information
        """
        start_time = time.time()
        
        # Try cache first
        if use_cache:
            cache = await get_mcp_cache()
            cached_context = await cache.get_context(
                project_id,
                loader=lambda: self._load_fresh_context(project_id, database_name)
            )
            
            if cached_context:
                # Update metadata with cache info
                load_time_ms = int((time.time() - start_time) * 1000)
                cached_context["metadata"]["from_cache"] = True
                cached_context["metadata"]["cache_load_time_ms"] = load_time_ms
                logger.info(f"Context loaded from cache in {load_time_ms}ms for project: {project_id}")
                return cached_context
        
        # Load fresh if cache disabled or miss
        return await self._load_fresh_context(project_id, database_name)
    
    async def _load_fresh_context(self, project_id: str, database_name: str) -> Dict[str, Any]:
        """
        Load complete project context
        
        Args:
            project_id: Project UUID
            database_name: Database/schema name
            
        Returns:
            Context dict with ALL project information
        """
        start_time = time.time()
        
        try:
            pool = await get_main_db_pool()
            
            # Get project info
            async with pool.acquire() as conn:
                project = await conn.fetchrow(
                    """
                    SELECT id, name, slug, description, database_name, 
                           status, created_at, user_id
                    FROM projects
                    WHERE id = $1
                    """,
                    UUID(project_id)
                )
                
                if not project:
                    raise ContextLoadError(f"Project not found: {project_id}")
            
            logger.info(f"Loading context for project: {project['name']}")
            
            # Parallel loading for performance - THE BRAIN THINKS FAST
            database_task = self._load_database_context(pool, database_name)
            auth_task = self.auth_collector.collect(project_id)
            storage_task = self.storage_collector.collect(project_id)
            realtime_task = self.realtime_collector.collect(project_id)
            functions_task = self.functions_collector.collect(project_id, database_name)
            deployment_task = self.deployment_collector.collect(project_id)
            
            # Execute all in parallel
            (database_context, auth_context, storage_context, 
             realtime_context, functions_context, deployment_context) = await asyncio.gather(
                database_task,
                auth_task,
                storage_task,
                realtime_task,
                functions_task,
                deployment_task,
                return_exceptions=True
            )
            
            # Handle any errors in collectors (don't fail entire context load)
            database_context = self._safe_context(database_context, "database")
            auth_context = self._safe_context(auth_context, "auth")
            storage_context = self._safe_context(storage_context, "storage")
            realtime_context = self._safe_context(realtime_context, "realtime")
            functions_context = self._safe_context(functions_context, "functions")
            deployment_context = self._safe_context(deployment_context, "deployment")
            
            # Build complete context - THE BRAIN
            context = {
                "project": {
                    "id": str(project["id"]),
                    "name": project["name"],
                    "slug": project["slug"],
                    "description": project["description"],
                    "database_name": project["database_name"],
                    "status": project["status"],
                    "created_at": project["created_at"].isoformat() if project["created_at"] else None,
                    "owner_id": str(project["user_id"]) if project["user_id"] else None
                },
                "database": database_context,
                "auth": auth_context,
                "storage": storage_context,
                "realtime": realtime_context,
                "functions": functions_context,
                "deployment": deployment_context,
                "metadata": {
                    "context_version": 2,  # Upgraded to v2 with full collectors
                    "generated_at": time.time(),
                    "generation_time_ms": int((time.time() - start_time) * 1000),
                    "from_cache": False,
                    "collectors": {
                        "database": database_context.get("status", "unknown"),
                        "auth": auth_context.get("status", "unknown"),
                        "storage": storage_context.get("status", "unknown"),
                        "realtime": realtime_context.get("status", "unknown"),
                        "functions": functions_context.get("status", "unknown"),
                        "deployment": deployment_context.get("status", "unknown")
                    }
                }
            }
            
            load_time_ms = int((time.time() - start_time) * 1000)
            logger.info(f"Fresh context loaded in {load_time_ms}ms for project: {project['name']}")
            
            return context
            
        except Exception as e:
            logger.error(f"Failed to load context: {str(e)}")
            raise ContextLoadError(
                f"Failed to load context: {str(e)}",
                details={"project_id": project_id, "error": str(e)}
            )
    
    async def invalidate_cache(self, project_id: str):
        """Invalidate context cache for a project"""
        cache = await get_mcp_cache()
        await cache.invalidate_context(project_id)
        logger.info(f"Invalidated context cache for project: {project_id}")
    
    async def _load_database_context(
        self, 
        pool, 
        database_name: str
    ) -> Dict[str, Any]:
        """Load database schema context"""
        try:
            schema_info = await SchemaParser.get_full_schema(pool, database_name)
            
            return {
                "tables": schema_info.get("tables", []),
                "relationships": schema_info.get("relationships", []),
                "indexes": schema_info.get("indexes", []),
                "constraints": schema_info.get("constraints", []),
                "status": "active"
            }
        except Exception as e:
            logger.error(f"Database context collection failed: {str(e)}")
            return {
                "error": str(e),
                "status": "error"
            }
    
    def _safe_context(
        self, 
        result: Any, 
        collector_name: str
    ) -> Dict[str, Any]:
        """
        Safely handle collector results
        If collector failed, return error context instead of failing everything
        """
        if isinstance(result, Exception):
            logger.error(f"{collector_name} collector failed: {str(result)}")
            return {
                "error": str(result),
                "status": "error"
            }
        elif isinstance(result, dict):
            return result
        else:
            logger.warning(f"{collector_name} collector returned unexpected type: {type(result)}")
            return {
                "error": "Invalid collector response",
                "status": "error"
            }
