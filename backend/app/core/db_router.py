"""
Dynamic Database Router
Manages per-project database connections with pooling and caching
"""
import asyncpg
from typing import Dict, Optional
from fastapi import HTTPException
import logging

logger = logging.getLogger(__name__)

# Connection pools per project (cached)
_connection_pools: Dict[str, asyncpg.Pool] = {}

# Main database pool (for project metadata)
_main_pool: Optional[asyncpg.Pool] = None


async def get_main_db_pool() -> asyncpg.Pool:
    """Get or create main database connection pool"""
    global _main_pool
    
    if _main_pool is None:
        _main_pool = await asyncpg.create_pool(
            host="localhost",
            port=5432,
            database="nexora_main",
            user="postgres",
            password="Pawan@121",
            min_size=5,
            max_size=20
        )
        logger.info("Main database pool created")
    
    return _main_pool


async def get_project_db(project_id: str, anon_key: str) -> asyncpg.Pool:
    """
    Validates project and returns database connection pool
    
    Args:
        project_id: UUID of the project
        anon_key: ANON_KEY for authentication
    
    Returns:
        asyncpg.Pool: Connection pool for the project database
    
    Raises:
        HTTPException: If project not found or invalid key
    """
    # Check cache first
    cache_key = f"{project_id}:{anon_key}"
    if cache_key in _connection_pools:
        logger.debug(f"Using cached connection pool for project {project_id}")
        return _connection_pools[cache_key]
    
    # Query main DB for project
    main_pool = await get_main_db_pool()
    
    async with main_pool.acquire() as conn:
        project = await conn.fetchrow("""
            SELECT 
                p.id, 
                p.name,
                p.database_name, 
                p.jwt_secret, 
                ak.encrypted_key
            FROM projects p
            LEFT JOIN api_keys ak ON ak.project_id = p.id AND ak.key_type = 'anon'
            WHERE p.id = $1
        """, project_id)
        
        if not project:
            logger.error(f"Project not found: {project_id}")
            raise HTTPException(status_code=404, detail="Project not found")
        
        # Validate ANON_KEY
        if not project['encrypted_key']:
            logger.error(f"No ANON_KEY configured for project {project_id}")
            raise HTTPException(status_code=500, detail="Project not configured with ANON_KEY")
        
        if project['encrypted_key'] != anon_key:
            logger.error(f"Invalid ANON_KEY for project {project_id}")
            raise HTTPException(status_code=403, detail="Invalid ANON_KEY")
        
        # Get database name
        db_name = project['database_name']
        
        if not db_name:
            logger.error(f"No database configured for project {project_id}")
            raise HTTPException(status_code=500, detail="Project database not configured")
        
        logger.info(f"Creating connection pool for project {project['name']} (DB: {db_name})")
        
        # Create connection pool for project DB
        try:
            pool = await asyncpg.create_pool(
                host="localhost",
                port=5432,
                database=db_name,
                user="postgres",
                password="Pawan@121",
                min_size=2,
                max_size=10,
                command_timeout=60
            )
            
            # Cache it
            _connection_pools[cache_key] = pool
            
            logger.info(f"Connection pool created for project {project_id}")
            return pool
            
        except Exception as e:
            logger.error(f"Failed to create connection pool for project {project_id}: {e}")
            raise HTTPException(status_code=500, detail=f"Failed to connect to project database: {str(e)}")


async def close_all_pools():
    """Close all connection pools (for graceful shutdown)"""
    global _main_pool, _connection_pools
    
    logger.info("Closing all database connection pools...")
    
    # Close project pools
    for project_id, pool in _connection_pools.items():
        await pool.close()
        logger.info(f"Closed pool for project {project_id}")
    
    _connection_pools.clear()
    
    # Close main pool
    if _main_pool:
        await _main_pool.close()
        _main_pool = None
        logger.info("Closed main database pool")


async def get_project_db_direct(project_id: str) -> asyncpg.Pool:
    """
    Get project database without ANON_KEY validation
    Used for internal operations (admin endpoints)
    """
    main_pool = await get_main_db_pool()
    
    async with main_pool.acquire() as conn:
        project = await conn.fetchrow("""
            SELECT database_name, name
            FROM projects
            WHERE id = $1
        """, project_id)
        
        if not project:
            raise HTTPException(status_code=404, detail="Project not found")
        
        db_name = project['database_name']
        
        # Check cache
        cache_key = f"direct:{project_id}"
        if cache_key in _connection_pools:
            return _connection_pools[cache_key]
        
        # Create pool
        pool = await asyncpg.create_pool(
            host="localhost",
            port=5432,
            database=db_name,
            user="postgres",
            password="Pawan@121",
            min_size=2,
            max_size=10
        )
        
        _connection_pools[cache_key] = pool
        return pool
