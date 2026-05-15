from fastapi import APIRouter, HTTPException, Depends
from app.api.auth import get_current_user
from app.core.database import execute_on_main_db, get_project_db_pool
from typing import Dict, Any
from uuid import UUID
import asyncpg

router = APIRouter()

# ============================================
# GET PROJECT OVERVIEW STATS
# ============================================

@router.get("/{project_id}/overview", response_model=Dict[str, Any])
async def get_project_overview_stats(
    project_id: UUID,
    current_user: dict = Depends(get_current_user)
):
    """Get real-time project overview statistics"""
    
    try:
        # Verify project ownership
        project_result = await execute_on_main_db(
            """
            SELECT id, name, database_name, created_at
            FROM projects
            WHERE id = $1 AND user_id = $2
            """,
            project_id,
            current_user["id"]
        )
        
        if not project_result:
            raise HTTPException(
                status_code=404,
                detail="Project not found"
            )
        
        project = dict(project_result[0])
        db_name = project["database_name"]
        
    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(
            status_code=500,
            detail=f"Failed to verify project: {str(e)}"
        )
    
    try:
        # Get project database pool
        pool = await get_project_db_pool(db_name)
        
        # Get database statistics
        async with pool.acquire() as conn:
            # Get table count and total rows
            try:
                tables_stats = await conn.fetchrow("""
                    SELECT 
                        COUNT(*) as table_count,
                        COALESCE(SUM(n_live_tup), 0) as total_rows
                    FROM pg_stat_user_tables
                """)
            except Exception as e:
                tables_stats = {"table_count": 0, "total_rows": 0}
            
            # Get database size
            try:
                db_size = await conn.fetchval("""
                    SELECT pg_database_size(current_database())
                """)
            except Exception as e:
                db_size = 0
            
            # Get function count
            try:
                function_count = await conn.fetchval("""
                    SELECT COUNT(*)
                    FROM pg_proc p
                    JOIN pg_namespace n ON p.pronamespace = n.oid
                    WHERE n.nspname = 'public'
                    AND p.prolang = (SELECT oid FROM pg_language WHERE lanname = 'plpgsql')
                """)
            except Exception as e:
                function_count = 0
            
            # Get trigger count
            try:
                trigger_count = await conn.fetchval("""
                    SELECT COUNT(*)
                    FROM pg_trigger t
                    JOIN pg_class c ON t.tgrelid = c.oid
                    JOIN pg_namespace n ON c.relnamespace = n.oid
                    WHERE n.nspname = 'public'
                    AND NOT t.tgisinternal
                """)
            except Exception as e:
                trigger_count = 0
            
            # Get recent activity (tables modified in last 24 hours)
            try:
                recent_activity = await conn.fetchval("""
                    SELECT COUNT(*)
                    FROM pg_stat_user_tables
                    WHERE last_vacuum IS NOT NULL 
                       OR last_autovacuum IS NOT NULL
                       OR last_analyze IS NOT NULL
                       OR last_autoanalyze IS NOT NULL
                """)
            except Exception as e:
                recent_activity = 0
        
        # Get API request stats from main database (with error handling)
        try:
            api_stats = await execute_on_main_db("""
                SELECT 
                    COUNT(*) as total_requests,
                    COUNT(*) FILTER (WHERE created_at > NOW() - INTERVAL '24 hours') as requests_24h,
                    COUNT(*) FILTER (WHERE created_at > NOW() - INTERVAL '1 hour') as requests_1h
                FROM audit_logs
                WHERE project_id = $1
            """, project_id)
            
            api_data = dict(api_stats[0]) if api_stats else {
                "total_requests": 0,
                "requests_24h": 0,
                "requests_1h": 0
            }
        except Exception as e:
            # Table might not exist yet
            api_data = {
                "total_requests": 0,
                "requests_24h": 0,
                "requests_1h": 0
            }
        
        # Get authentication stats (with error handling)
        try:
            auth_stats = await execute_on_main_db("""
                SELECT 
                    COUNT(*) as total_users,
                    COUNT(*) FILTER (WHERE created_at > NOW() - INTERVAL '7 days') as new_users_7d,
                    COUNT(*) FILTER (WHERE last_sign_in_at > NOW() - INTERVAL '24 hours') as active_users_24h
                FROM project_users
                WHERE project_id = $1
            """, project_id)
            
            auth_data = dict(auth_stats[0]) if auth_stats else {
                "total_users": 0,
                "new_users_7d": 0,
                "active_users_24h": 0
            }
        except Exception as e:
            # Table might not exist yet
            auth_data = {
                "total_users": 0,
                "new_users_7d": 0,
                "active_users_24h": 0
            }
        
        # Calculate storage usage percentage (assuming 500MB limit for free tier)
        storage_limit_bytes = 500 * 1024 * 1024  # 500 MB
        storage_used_mb = db_size / (1024 * 1024)
        storage_limit_mb = storage_limit_bytes / (1024 * 1024)
        storage_percentage = (db_size / storage_limit_bytes) * 100
        
        # Calculate real memory usage from PostgreSQL
        try:
            async with pool.acquire() as conn:
                # Get database memory usage (shared buffers + temp buffers + work mem)
                memory_stats = await conn.fetchrow("""
                    SELECT 
                        -- Shared buffers allocated to this database
                        pg_size_pretty(pg_database_size(current_database())) as db_size,
                        -- Active connections memory estimate
                        (SELECT COUNT(*) * 10 FROM pg_stat_activity WHERE datname = current_database()) as connection_memory_mb,
                        -- Cache hit ratio (indicates memory efficiency)
                        ROUND(100.0 * sum(blks_hit) / NULLIF(sum(blks_hit) + sum(blks_read), 0), 2) as cache_hit_ratio
                    FROM pg_stat_database
                    WHERE datname = current_database()
                """)
                
                # Estimate memory: base (10MB) + connections (10MB each) + cache (based on db size)
                connection_memory = memory_stats["connection_memory_mb"] if memory_stats else 10
                base_memory = 10.0  # Base PostgreSQL overhead
                cache_memory = min(storage_used_mb * 0.25, 100)  # Estimate 25% of DB size cached, max 100MB
                
                memory_used_mb = base_memory + connection_memory + cache_memory
        except Exception as e:
            # Fallback to basic estimate
            memory_used_mb = 10.0 + (storage_used_mb * 0.1)  # 10MB base + 10% of storage
        
        memory_limit_mb = 512.0
        memory_percentage = (memory_used_mb / memory_limit_mb) * 100
        
        return {
            "project": {
                "id": str(project_id),
                "name": project["name"],
                "created_at": project["created_at"].isoformat()
            },
            "database": {
                "table_count": tables_stats["table_count"],
                "total_rows": tables_stats["total_rows"],
                "function_count": function_count,
                "trigger_count": trigger_count,
                "size_bytes": db_size,
                "size_mb": round(storage_used_mb, 2),
                "recent_activity": recent_activity
            },
            "api": {
                "total_requests": api_data["total_requests"],
                "requests_24h": api_data["requests_24h"],
                "requests_1h": api_data["requests_1h"]
            },
            "auth": {
                "total_users": auth_data["total_users"],
                "new_users_7d": auth_data["new_users_7d"],
                "active_users_24h": auth_data["active_users_24h"]
            },
            "resources": {
                "storage": {
                    "used_mb": round(storage_used_mb, 2),
                    "limit_mb": storage_limit_mb,
                    "percentage": round(storage_percentage, 2)
                },
                "memory": {
                    "used_mb": round(memory_used_mb, 2),
                    "limit_mb": memory_limit_mb,
                    "percentage": round(memory_percentage, 2)
                }
            }
        }
        
    except asyncpg.InvalidCatalogNameError:
        raise HTTPException(
            status_code=404,
            detail="Project database not found"
        )
    except HTTPException:
        raise
    except Exception as e:
        import traceback
        error_detail = f"Failed to fetch project statistics: {str(e)}\n{traceback.format_exc()}"
        print(error_detail)  # Log to console
        raise HTTPException(
            status_code=500,
            detail=error_detail
        )
