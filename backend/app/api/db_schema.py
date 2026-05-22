"""
Database Schema API
Endpoints for schema visualization
"""
from fastapi import APIRouter, Depends, HTTPException, Header
from uuid import UUID
from app.core.database import get_project_db_pool
from app.services.schema_parser import SchemaParser
from app.api.auth import get_current_user

router = APIRouter(prefix="/db/schema", tags=["Database Schema"])


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
async def get_schema(
    db_info = Depends(get_project_db_from_header),
    current_user: dict = Depends(get_current_user)
):
    """Get complete database schema for visualization"""
    try:
        schema = await SchemaParser.get_full_schema(db_info["pool"], db_info["schema_name"])
        return schema
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))


@router.get("/relationships")
async def get_relationships(
    db_info = Depends(get_project_db_from_header),
    current_user: dict = Depends(get_current_user)
):
    """Get all foreign key relationships"""
    try:
        relationships = await SchemaParser.get_relationships(db_info["pool"], db_info["schema_name"])
        return {"relationships": relationships}
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))
