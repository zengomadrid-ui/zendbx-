"""
Functions Context Collector
Collects database functions and stored procedures for AI understanding
"""

from typing import Dict, Any, List, Optional
import logging
from app.core.db_router import get_main_db_pool

logger = logging.getLogger(__name__)


class FunctionsCollector:
    """
    Collects functions context for a project
    Provides AI with understanding of:
    - Database functions
    - Stored procedures
    - Triggers
    - Function metadata
    """
    
    async def collect(self, project_id: str, database_name: str) -> Dict[str, Any]:
        """
        Collect complete functions context for a project
        
        Args:
            project_id: Project UUID
            database_name: Project database name
            
        Returns:
            Dict with functions context information
        """
        try:
            # Get functions from main database pool
            pool = await get_main_db_pool()
            
            async with pool.acquire() as conn:
                # Set search path to project schema
                await conn.execute(f"SET search_path TO {database_name}, public")
                
                # Get database functions
                functions = await self._get_functions(conn)
                
                # Get triggers
                triggers = await self._get_triggers(conn)
                
                # Get function statistics
                stats = await self._get_function_stats(conn)
                
                return {
                    "functions": functions,
                    "triggers": triggers,
                    "statistics": stats,
                    "status": "active",
                    "_collected_at": "now()"
                }
                
        except Exception as e:
            logger.error(f"Error collecting functions context: {str(e)}")
            return {
                "error": str(e),
                "status": "error",
                "_collected_at": "now()"
            }
    
    async def _get_functions(self, conn) -> List[Dict[str, Any]]:
        """Get database functions and procedures"""
        try:
            rows = await conn.fetch(
                """
                SELECT 
                    p.proname as name,
                    pg_catalog.pg_get_function_identity_arguments(p.oid) as arguments,
                    pg_catalog.pg_get_function_result(p.oid) as return_type,
                    l.lanname as language,
                    CASE p.prokind
                        WHEN 'f' THEN 'function'
                        WHEN 'p' THEN 'procedure'
                        WHEN 'a' THEN 'aggregate'
                        WHEN 'w' THEN 'window'
                    END as kind,
                    p.provolatile as volatility,
                    pg_catalog.obj_description(p.oid, 'pg_proc') as description
                FROM pg_catalog.pg_proc p
                LEFT JOIN pg_catalog.pg_language l ON p.prolang = l.oid
                WHERE pg_catalog.pg_function_is_visible(p.oid)
                  AND p.pronamespace = (SELECT oid FROM pg_namespace WHERE nspname = 'public')
                ORDER BY p.proname
                """
            )
            
            functions = []
            for row in rows:
                functions.append({
                    "name": row["name"],
                    "arguments": row["arguments"],
                    "return_type": row["return_type"],
                    "language": row["language"],
                    "kind": row["kind"],
                    "volatility": self._parse_volatility(row["volatility"]),
                    "description": row["description"]
                })
            
            return functions
            
        except Exception as e:
            logger.warning(f"Could not fetch functions: {str(e)}")
            return []
    
    async def _get_triggers(self, conn) -> List[Dict[str, Any]]:
        """Get database triggers"""
        try:
            rows = await conn.fetch(
                """
                SELECT 
                    t.tgname as trigger_name,
                    c.relname as table_name,
                    p.proname as function_name,
                    CASE 
                        WHEN t.tgtype & 2 = 2 THEN 'BEFORE'
                        WHEN t.tgtype & 64 = 64 THEN 'INSTEAD OF'
                        ELSE 'AFTER'
                    END as timing,
                    CASE
                        WHEN t.tgtype & 4 = 4 THEN 'INSERT'
                        WHEN t.tgtype & 8 = 8 THEN 'DELETE'
                        WHEN t.tgtype & 16 = 16 THEN 'UPDATE'
                    END as event,
                    t.tgenabled as enabled,
                    pg_catalog.obj_description(t.oid, 'pg_trigger') as description
                FROM pg_catalog.pg_trigger t
                JOIN pg_catalog.pg_class c ON t.tgrelid = c.oid
                JOIN pg_catalog.pg_proc p ON t.tgfoid = p.oid
                WHERE NOT t.tgisinternal
                  AND c.relnamespace = (SELECT oid FROM pg_namespace WHERE nspname = 'public')
                ORDER BY c.relname, t.tgname
                """
            )
            
            triggers = []
            for row in rows:
                triggers.append({
                    "name": row["trigger_name"],
                    "table": row["table_name"],
                    "function": row["function_name"],
                    "timing": row["timing"],
                    "event": row["event"],
                    "enabled": row["enabled"] == 'O',  # 'O' means enabled
                    "description": row["description"]
                })
            
            return triggers
            
        except Exception as e:
            logger.warning(f"Could not fetch triggers: {str(e)}")
            return []
    
    async def _get_function_stats(self, conn) -> Dict[str, Any]:
        """Get function statistics"""
        try:
            # Count total functions
            function_count = await conn.fetchval(
                """
                SELECT COUNT(*)
                FROM pg_catalog.pg_proc p
                WHERE pg_catalog.pg_function_is_visible(p.oid)
                  AND p.pronamespace = (SELECT oid FROM pg_namespace WHERE nspname = 'public')
                """
            )
            
            # Count triggers
            trigger_count = await conn.fetchval(
                """
                SELECT COUNT(*)
                FROM pg_catalog.pg_trigger t
                JOIN pg_catalog.pg_class c ON t.tgrelid = c.oid
                WHERE NOT t.tgisinternal
                  AND c.relnamespace = (SELECT oid FROM pg_namespace WHERE nspname = 'public')
                """
            )
            
            # Count by language
            by_language = await conn.fetch(
                """
                SELECT 
                    l.lanname as language,
                    COUNT(*) as count
                FROM pg_catalog.pg_proc p
                LEFT JOIN pg_catalog.pg_language l ON p.prolang = l.oid
                WHERE pg_catalog.pg_function_is_visible(p.oid)
                  AND p.pronamespace = (SELECT oid FROM pg_namespace WHERE nspname = 'public')
                GROUP BY l.lanname
                """
            )
            
            languages = {row["language"]: row["count"] for row in by_language}
            
            return {
                "total_functions": function_count or 0,
                "total_triggers": trigger_count or 0,
                "by_language": languages
            }
            
        except Exception as e:
            logger.warning(f"Could not fetch function stats: {str(e)}")
            return {
                "total_functions": 0,
                "total_triggers": 0,
                "by_language": {}
            }
    
    def _parse_volatility(self, code: str) -> str:
        """Parse function volatility code"""
        if code == 'i':
            return 'immutable'
        elif code == 's':
            return 'stable'
        elif code == 'v':
            return 'volatile'
        else:
            return 'unknown'
