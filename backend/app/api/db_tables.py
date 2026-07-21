"""
Database Tables API
Endpoints for managing database tables
"""
from fastapi import APIRouter, Depends, HTTPException, Header, Request
from pydantic import BaseModel
from typing import List, Optional
from uuid import UUID
import time
import logging
from app.services.db_manager import TableManager
from app.services.schema_parser import SchemaParser
from app.api.auth import get_current_user

logger = logging.getLogger(__name__)
router = APIRouter(prefix="/db/tables", tags=["Database Tables"])


class ColumnSchema(BaseModel):
    name: str
    type: str
    primary_key: bool = False
    unique: bool = False
    not_null: bool = False
    default: Optional[str] = None


class CreateTableRequest(BaseModel):
    table_name: str
    columns: List[ColumnSchema]


class AddColumnRequest(BaseModel):
    name: str
    type: str
    not_null: bool = False
    default: Optional[str] = None


async def get_project_db_from_header(x_project_id: str = Header(...)):
    """Get project database pool and schema name from header"""
    try:
        logger.info(f"🔍 db_tables.py: Received X-Project-Id header: {x_project_id}")
        
        from app.core.db_router import get_main_db_pool
        main_pool = await get_main_db_pool()
        async with main_pool.acquire() as conn:
            result = await conn.fetchrow(
                "SELECT database_name FROM projects WHERE id = $1",
                UUID(x_project_id)
            )
            if not result:
                logger.error(f"❌ db_tables.py: Project not found for ID: {x_project_id}")
                raise HTTPException(status_code=404, detail="Project not found")

            db_name = result["database_name"]
            logger.info(f"✅ db_tables.py: Resolved project schema: '{db_name}' for project {x_project_id}")
            # Return the SAME shared pool — search_path is set per-connection in queries
            return {"pool": main_pool, "schema": db_name}
    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"❌ db_tables.py: Error resolving project DB: {str(e)}")
        raise HTTPException(status_code=500, detail=str(e))


@router.get("/")
async def list_tables(
    db_info = Depends(get_project_db_from_header),
    current_user: dict = Depends(get_current_user)
):
    """List all tables in the project schema"""
    try:
        schema = db_info["schema"]
        logger.info(f"\n{'='*80}")
        logger.info(f"📋 db_tables.py: list_tables() API ENDPOINT CALLED")
        logger.info(f"{'='*80}")
        logger.info(f"📋 db_tables.py: schema = '{schema}'")
        logger.info(f"📋 db_tables.py: Calling SchemaParser.get_tables(pool, '{schema}')")
        
        tables = await SchemaParser.get_tables(db_info["pool"], schema)
        
        logger.info(f"\n{'='*80}")
        logger.info(f"📋 db_tables.py: RESPONSE FROM SchemaParser")
        logger.info(f"{'='*80}")
        logger.info(f"✅ db_tables.py: SchemaParser returned {len(tables)} tables")
        
        if tables:
            logger.info(f"\n📋 ALL TABLES returned by SchemaParser:")
            for idx, table in enumerate(tables, 1):
                logger.info(f"   {idx}. {table.get('table_schema', 'N/A')}.{table.get('table_name', 'N/A')}")
                if table.get('table_name') == 'users':
                    logger.info(f"      🎯 'users' table present in SchemaParser response!")
            
            # Check for 'users' table
            users_table = [t for t in tables if t.get('table_name') == 'users']
            if users_table:
                logger.info(f"\n✅✅✅ 'users' table PRESENT in SchemaParser response!")
            else:
                logger.info(f"\n❌❌❌ 'users' table MISSING from SchemaParser response!")
        
        # Prepare final response
        response_data = {"tables": tables}
        
        logger.info(f"\n{'='*80}")
        logger.info(f"📤 db_tables.py: FINAL JSON RESPONSE TO FRONTEND")
        logger.info(f"{'='*80}")
        logger.info(f"📤 Response contains {len(tables)} tables")
        
        # Check final response for 'users' table
        users_in_response = [t for t in tables if t.get('table_name') == 'users']
        if users_in_response:
            logger.info(f"✅✅✅ 'users' table IS IN final JSON response to frontend!")
            logger.info(f"✅✅✅ Sample: {users_in_response[0]}")
        else:
            logger.info(f"❌❌❌ 'users' table NOT IN final JSON response to frontend!")
        
        logger.info(f"{'='*80}\n")
        
        return response_data
    except Exception as e:
        logger.error(f"❌ db_tables.py: Error listing tables: {str(e)}")
        import traceback
        logger.error(f"❌ Traceback: {traceback.format_exc()}")
        raise HTTPException(status_code=500, detail=str(e))


@router.get("/{table_name}")
async def get_table_details(
    table_name: str,
    db_info = Depends(get_project_db_from_header),
    current_user: dict = Depends(get_current_user)
):
    """Get detailed information about a table"""
    try:
        # Prepend schema name if not already included
        if '.' not in table_name:
            table_name = f"{db_info['schema']}.{table_name}"
        details = await SchemaParser.get_table_details(db_info["pool"], table_name)
        return details
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))


@router.post("/")
async def create_table(
    request: CreateTableRequest,
    db_info = Depends(get_project_db_from_header),
    current_user: dict = Depends(get_current_user)
):
    """Create a new table"""
    try:
        columns = [col.dict() for col in request.columns]
        result = await TableManager.create_table(db_info["pool"], request.table_name, columns, db_info["schema"])
        return result
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))


@router.delete("/{table_name}")
async def drop_table(
    table_name: str,
    db_info = Depends(get_project_db_from_header),
    current_user: dict = Depends(get_current_user)
):
    """Drop a table"""
    try:
        result = await TableManager.drop_table(db_info["pool"], table_name, db_info["schema"])
        return result
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))


@router.post("/{table_name}/columns")
async def add_column(
    table_name: str,
    request: AddColumnRequest,
    db_info = Depends(get_project_db_from_header),
    current_user: dict = Depends(get_current_user)
):
    """Add a column to an existing table"""
    try:
        result = await TableManager.add_column(db_info["pool"], table_name, request.dict(), db_info["schema"])
        return result
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))


@router.delete("/{table_name}/columns/{column_name}")
async def drop_column(
    table_name: str,
    column_name: str,
    db_info = Depends(get_project_db_from_header),
    current_user: dict = Depends(get_current_user)
):
    """Drop a column from a table"""
    try:
        result = await TableManager.drop_column(db_info["pool"], table_name, column_name, db_info["schema"])
        return result
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))


@router.post("/metadata/refresh")
async def refresh_metadata(
    db_info = Depends(get_project_db_from_header),
    current_user: dict = Depends(get_current_user)
):
    """Refresh cached table metadata after DDL operations"""
    try:
        # For now, this endpoint signals success
        # In the future, we can add actual caching and invalidation logic here
        return {
            "success": True,
            "message": "Metadata refresh triggered successfully",
            "timestamp": time.time()
        }
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))
