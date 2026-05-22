"""
Database Functions API
Endpoints for managing database functions
"""
from fastapi import APIRouter, Depends, HTTPException, Header
from pydantic import BaseModel
from uuid import UUID
from app.core.database import get_project_db_pool
from app.services.db_manager import FunctionManager
from app.api.auth import get_current_user

router = APIRouter(prefix="/db/functions", tags=["Database Functions"])


class CreateFunctionRequest(BaseModel):
    function_sql: str


async def get_project_db_from_header(x_project_id: str = Header(...)):
    """Get project database pool and schema name from header"""
    try:
        from app.core.database import get_main_db_pool
        main_pool = await get_main_db_pool()
        async with main_pool.acquire() as conn:
            result = await conn.fetchrow(
                "SELECT database_name FROM projects WHERE id = $1",
                UUID(x_project_id)
            )
            if not result:
                raise HTTPException(status_code=404, detail="Project not found")
            
            db_name = result["database_name"]
            pool = await get_project_db_pool(db_name)
            return {"pool": pool, "schema_name": db_name}
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))


@router.get("/")
async def list_functions(
    db_info = Depends(get_project_db_from_header),
    current_user: dict = Depends(get_current_user)
):
    """List all database functions"""
    try:
        functions = await FunctionManager.list_functions(db_info["pool"], db_info["schema_name"])
        return {"functions": functions}
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))


@router.post("/")
async def create_function(
    request: CreateFunctionRequest,
    db_info = Depends(get_project_db_from_header),
    current_user: dict = Depends(get_current_user)
):
    """Create a new database function"""
    try:
        result = await FunctionManager.create_function(db_info["pool"], request.function_sql)
        return result
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))


@router.delete("/{function_name}")
async def drop_function(
    function_name: str,
    db_info = Depends(get_project_db_from_header),
    current_user: dict = Depends(get_current_user)
):
    """Drop a database function"""
    try:
        result = await FunctionManager.drop_function(db_info["pool"], function_name)
        return result
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))
