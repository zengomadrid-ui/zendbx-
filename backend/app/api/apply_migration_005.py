"""
Apply Migration 005: MCP Audit Tables
Creates tables for logging MCP requests, tool executions, and errors
"""

from fastapi import APIRouter, HTTPException
from app.core.database import get_main_db_pool
import logging
import os

router = APIRouter()
logger = logging.getLogger(__name__)


@router.post("/api/admin/migrations/005/apply")
async def apply_migration_005():
    """
    Apply migration 005: Create MCP audit tables
    """
    try:
        # Read migration SQL file
        migration_file = os.path.join(
            os.path.dirname(__file__), 
            '..', '..', 'migrations', 
            '005_create_mcp_audit_tables.sql'
        )
        
        with open(migration_file, 'r') as f:
            migration_sql = f.read()
        
        pool = await get_main_db_pool()
        
        async with pool.acquire() as conn:
            # Execute migration in a transaction
            async with conn.transaction():
                await conn.execute(migration_sql)
                logger.info("Migration 005 applied successfully")
        
        return {
            "success": True,
            "message": "Migration 005 applied successfully",
            "migration": "005_create_mcp_audit_tables",
            "tables_created": [
                "mcp_audit_logs",
                "mcp_tool_executions", 
                "mcp_errors"
            ]
        }
        
    except Exception as e:
        logger.error(f"Error applying migration 005: {str(e)}")
        raise HTTPException(status_code=500, detail=f"Migration failed: {str(e)}")


@router.post("/api/admin/migrations/005/rollback")
async def rollback_migration_005():
    """
    Rollback migration 005: Drop MCP audit tables
    """
    try:
        # Read rollback SQL file
        rollback_file = os.path.join(
            os.path.dirname(__file__), 
            '..', '..', 'migrations', 
            '005_rollback_mcp_audit_tables.sql'
        )
        
        with open(rollback_file, 'r') as f:
            rollback_sql = f.read()
        
        pool = await get_main_db_pool()
        
        async with pool.acquire() as conn:
            # Execute rollback in a transaction
            async with conn.transaction():
                await conn.execute(rollback_sql)
                logger.info("Migration 005 rolled back successfully")
        
        return {
            "success": True,
            "message": "Migration 005 rolled back successfully",
            "migration": "005_create_mcp_audit_tables",
            "tables_dropped": [
                "mcp_audit_logs",
                "mcp_tool_executions",
                "mcp_errors"
            ]
        }
        
    except Exception as e:
        logger.error(f"Error rolling back migration 005: {str(e)}")
        raise HTTPException(status_code=500, detail=f"Rollback failed: {str(e)}")


@router.get("/api/admin/migrations/005/status")
async def check_migration_005_status():
    """
    Check if migration 005 has been applied
    """
    try:
        pool = await get_main_db_pool()
        
        async with pool.acquire() as conn:
            # Check if tables exist
            tables = await conn.fetch("""
                SELECT table_name 
                FROM information_schema.tables 
                WHERE table_schema = 'public' 
                AND table_name IN ('mcp_audit_logs', 'mcp_tool_executions', 'mcp_errors')
            """)
            
            table_names = [row['table_name'] for row in tables]
            
            return {
                "applied": len(table_names) == 3,
                "tables_found": table_names,
                "missing_tables": [
                    t for t in ['mcp_audit_logs', 'mcp_tool_executions', 'mcp_errors'] 
                    if t not in table_names
                ]
            }
            
    except Exception as e:
        logger.error(f"Error checking migration 005 status: {str(e)}")
        raise HTTPException(status_code=500, detail=f"Status check failed: {str(e)}")
