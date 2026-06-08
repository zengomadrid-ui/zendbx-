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
        from .config import settings
        
        if not settings.DATABASE_URL:
            logger.error("DATABASE_URL is not configured!")
            raise ValueError("DATABASE_URL environment variable is required")
        
        logger.info(f"🔄 Creating main database pool from DATABASE_URL")
        logger.info(f"   DATABASE_URL length: {len(settings.DATABASE_URL)}")
        logger.info(f"   DATABASE_URL starts with: {settings.DATABASE_URL[:30]}...")
        
        try:
            _main_pool = await asyncpg.create_pool(
                dsn=settings.DATABASE_URL,
                min_size=5,
                max_size=20,
                command_timeout=60,
                timeout=30  # Add explicit connection timeout
            )
            logger.info("✅ Main database pool created successfully")
            logger.info(f"   Pool size: {_main_pool.get_size()}, Available: {_main_pool.get_idle_size()}")
        except Exception as e:
            logger.error(f"❌ Failed to create database pool: {type(e).__name__}: {str(e)}")
            logger.error(f"   DATABASE_URL (first 100 chars): {settings.DATABASE_URL[:100]}")
            raise
    
    return _main_pool


async def initialize_main_pool():
    """Initialize the main database pool at application startup"""
    global _main_pool
    
    if _main_pool is not None:
        logger.info("Main database pool already initialized")
        return _main_pool
    
    logger.info("🚀 Initializing main database pool at startup...")
    pool = await get_main_db_pool()
    logger.info(f"✅ Main pool initialized: size={pool.get_size()}, idle={pool.get_idle_size()}")
    return pool


async def get_project_db(project_id: str, api_key: str) -> asyncpg.Pool:
    """
    Validates project and returns database connection pool
    
    Args:
        project_id: UUID of the project
        api_key: API key (anon or service_role) for authentication
    
    Returns:
        asyncpg.Pool: Connection pool for the project database
    
    Raises:
        HTTPException: If project not found or invalid key
    """
    # Check cache first
    cache_key = f"{project_id}:{api_key}"
    if cache_key in _connection_pools:
        logger.debug(f"Using cached connection pool for project {project_id}")
        return _connection_pools[cache_key]
    
    # Query main DB for project
    main_pool = await get_main_db_pool()
    
    async with main_pool.acquire() as conn:
        # Get project and check BOTH anon and service_role keys
        project = await conn.fetchrow("""
            SELECT 
                p.id, 
                p.name,
                p.database_name, 
                p.jwt_secret
            FROM projects p
            WHERE p.id = $1
        """, project_id)
        
        if not project:
            logger.error(f"Project not found: {project_id}")
            raise HTTPException(status_code=404, detail="Project not found")
        
        # Check if the provided key matches either anon or service_role key
        api_keys = await conn.fetch("""
            SELECT encrypted_key, key_type, role
            FROM api_keys
            WHERE project_id = $1 AND is_active = true
        """, project_id)
        
        if not api_keys:
            logger.error(f"No API keys configured for project {project_id}")
            raise HTTPException(status_code=500, detail="Project not configured with API keys")
        
        # Validate the provided key
        key_valid = False
        for key_record in api_keys:
            if key_record['encrypted_key'] == api_key:
                key_valid = True
                logger.info(f"Valid {key_record['key_type']} key ({key_record['role']}) for project {project_id}")
                break
        
        if not key_valid:
            logger.error(f"Invalid API key for project {project_id}")
            raise HTTPException(status_code=403, detail="Invalid API key")
        
        # Get database name
        db_name = project['database_name']
        
        if not db_name:
            logger.error(f"No database configured for project {project_id}")
            raise HTTPException(status_code=500, detail="Project database not configured")
        
        logger.info(f"Creating connection pool for project {project['name']} (DB: {db_name})")
        
        # Create connection pool for project DB
        try:
            from .config import settings
            
            # Parse main DATABASE_URL to extract connection params
            import re
            match = re.match(r'postgresql://([^:]+):([^@]+)@([^:/]+)(?::(\d+))?/(.+)', settings.DATABASE_URL)
            if not match:
                raise ValueError(f"Invalid DATABASE_URL format: {settings.DATABASE_URL}")
            
            db_user, db_password, db_host, db_port, _ = match.groups()
            db_port = db_port or "5432"
            
            logger.info(f"Creating pool for project DB '{db_name}' on {db_host}:{db_port}")
            
            pool = await asyncpg.create_pool(
                host=db_host,
                port=int(db_port),
                database=db_name,
                user=db_user,
                password=db_password,
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
        
        # Parse DATABASE_URL for connection params
        from .config import settings
        import re
        match = re.match(r'postgresql://([^:]+):([^@]+)@([^:/]+)(?::(\d+))?/(.+)', settings.DATABASE_URL)
        if not match:
            raise ValueError(f"Invalid DATABASE_URL format")
        
        db_user, db_password, db_host, db_port, _ = match.groups()
        db_port = db_port or "5432"
        
        # Create pool
        pool = await asyncpg.create_pool(
            host=db_host,
            port=int(db_port),
            database=db_name,
            user=db_user,
            password=db_password,
            min_size=2,
            max_size=10
        )
        
        _connection_pools[cache_key] = pool
        return pool
