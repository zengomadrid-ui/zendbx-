"""
Database Tables API
Endpoints for managing database tables
"""
from fastapi import APIRouter, Depends, HTTPException, Header, Request
from pydantic import BaseModel
from typing import List, Optional
from uuid import UUID
from app.services.db_manager import TableManager
from app.services.schema_parser import SchemaParser
from app.api.auth import get_current_user

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
        from app.core.db_router import get_main_db_pool
        main_pool = await get_main_db_pool()
        async with main_pool.acquire() as conn:
            result = await conn.fetchrow(
                "SELECT database_name FROM projects WHERE id = $1",
                UUID(x_project_id)
            )
            if not result:
                raise HTTPException(status_code=404, detail="Project not found")

            db_name = result["database_name"]
            # Return the SAME shared pool — search_path is set per-connection in queries
            return {"pool": main_pool, "schema": db_name}
    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))


@router.get("/")
async def list_tables(
    db_info = Depends(get_project_db_from_header),
    current_user: dict = Depends(get_current_user)
):
    """List all tables in the project schema"""
    try:
        tables = await SchemaParser.get_tables(db_info["pool"], db_info["schema"])
        return {"tables": tables}
    except Exception as e:
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
