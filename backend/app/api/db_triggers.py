"""
Database Triggers API
Endpoints for managing database triggers
"""
from fastapi import APIRouter, Depends, HTTPException, Header
from pydantic import BaseModel
from typing import Optional
from uuid import UUID
from app.core.database import get_project_db_pool
from app.services.db_manager import TriggerManager
from app.api.auth import get_current_user

router = APIRouter(prefix="/db/triggers", tags=["Database Triggers"])


class CreateTriggerRequest(BaseModel):
    trigger_name: str
    table_name: str
    event: str  # INSERT, UPDATE, DELETE
    function_name: str
    timing: str = "AFTER"  # BEFORE or AFTER


async def get_project_db_from_header(x_project_id: str = Header(...)):
    """Get project database pool from header"""
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
            return await get_project_db_pool(db_name)
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))


@router.get("/")
async def list_triggers(
    table_name: Optional[str] = None,
    db = Depends(get_project_db_from_header),
    current_user: dict = Depends(get_current_user)
):
    """List all triggers, optionally filtered by table"""
    try:
        triggers = await TriggerManager.list_triggers(db, table_name)
        return {"triggers": triggers}
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))


@router.post("/")
async def create_trigger(
    request: CreateTriggerRequest,
    db = Depends(get_project_db_from_header),
    current_user: dict = Depends(get_current_user)
):
    """Create a new trigger"""
    try:
        result = await TriggerManager.create_trigger(
            db,
            request.trigger_name,
            request.table_name,
            request.event,
            request.function_name,
            request.timing
        )
        return result
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))


@router.delete("/{trigger_name}")
async def drop_trigger(
    trigger_name: str,
    table_name: str,
    db = Depends(get_project_db_from_header),
    current_user: dict = Depends(get_current_user)
):
    """Drop a trigger"""
    try:
        result = await TriggerManager.drop_trigger(db, trigger_name, table_name)
        return result
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))
