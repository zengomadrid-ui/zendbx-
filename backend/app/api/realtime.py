"""
Realtime API Endpoints
Manage realtime triggers and monitor realtime status
"""
from fastapi import APIRouter, HTTPException, Depends
from typing import List, Dict, Any
from app.core.database import execute_on_main_db, execute_on_project_db
from app.core.security import get_current_user
from app.services.realtime_listener import realtime_listener

router = APIRouter()

@router.get("/realtime/status")
async def get_realtime_status(current_user: dict = Depends(get_current_user)):
    """Get realtime listener status"""
    status = realtime_listener.get_status()
    return {
        "success": True,
        "status": status
    }

@router.get("/projects/{project_id}/realtime/triggers")
async def list_realtime_triggers(
    project_id: str,
    current_user: dict = Depends(get_current_user)
):
    """List all tables with realtime triggers enabled"""
    try:
        # Get project database name
        project_result = await execute_on_main_db(
            "SELECT database_name FROM projects WHERE id = $1",
            project_id
        )
        
        if not project_result:
            raise HTTPException(status_code=404, detail="Project not found")
            
        database_name = project_result[0]['database_name']
        
        # List realtime triggers
        result = await execute_on_project_db(
            database_name,
            "SELECT * FROM list_realtime_triggers()"
        )
        
        triggers = [dict(row) for row in result]
        
        return {
            "success": True,
            "project_id": project_id,
            "triggers": triggers,
            "count": len(triggers)
        }
        
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))

@router.post("/projects/{project_id}/realtime/triggers")
async def add_realtime_trigger(
    project_id: str,
    table_name: str,
    schema_name: str = "public",
    current_user: dict = Depends(get_current_user)
):
    """Enable realtime on a specific table"""
    try:
        # Get project database name
        project_result = await execute_on_main_db(
            "SELECT database_name FROM projects WHERE id = $1",
            project_id
        )
        
        if not project_result:
            raise HTTPException(status_code=404, detail="Project not found")
            
        database_name = project_result[0]['database_name']
        
        # Add realtime trigger
        result = await execute_on_project_db(
            database_name,
            f"SELECT add_realtime_trigger('{schema_name}', '{table_name}')"
        )
        
        return {
            "success": True,
            "message": f"Realtime enabled on {schema_name}.{table_name}",
            "project_id": project_id,
            "table": table_name,
            "schema": schema_name
        }
        
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))

@router.delete("/projects/{project_id}/realtime/triggers")
async def remove_realtime_trigger(
    project_id: str,
    table_name: str,
    schema_name: str = "public",
    current_user: dict = Depends(get_current_user)
):
    """Disable realtime on a specific table"""
    try:
        # Get project database name
        project_result = await execute_on_main_db(
            "SELECT database_name FROM projects WHERE id = $1",
            project_id
        )
        
        if not project_result:
            raise HTTPException(status_code=404, detail="Project not found")
            
        database_name = project_result[0]['database_name']
        
        # Remove realtime trigger
        result = await execute_on_project_db(
            database_name,
            f"SELECT remove_realtime_trigger('{schema_name}', '{table_name}')"
        )
        
        return {
            "success": True,
            "message": f"Realtime disabled on {schema_name}.{table_name}",
            "project_id": project_id,
            "table": table_name,
            "schema": schema_name
        }
        
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))

@router.post("/projects/{project_id}/realtime/enable-all")
async def enable_realtime_all_tables(
    project_id: str,
    current_user: dict = Depends(get_current_user)
):
    """Enable realtime on all user tables in the project"""
    try:
        # Get project database name
        project_result = await execute_on_main_db(
            "SELECT database_name FROM projects WHERE id = $1",
            project_id
        )
        
        if not project_result:
            raise HTTPException(status_code=404, detail="Project not found")
            
        database_name = project_result[0]['database_name']
        
        # Get all user tables
        tables_result = await execute_on_project_db(
            database_name,
            """
            SELECT table_name 
            FROM information_schema.tables 
            WHERE table_schema = 'public' 
            AND table_type = 'BASE TABLE'
            AND table_name NOT LIKE '_nexora_%'
            """
        )
        
        enabled_tables = []
        for row in tables_result:
            table_name = row['table_name']
            try:
                await execute_on_project_db(
                    database_name,
                    f"SELECT add_realtime_trigger('public', '{table_name}')"
                )
                enabled_tables.append(table_name)
            except Exception as e:
                print(f"Failed to enable realtime on {table_name}: {e}")
        
        return {
            "success": True,
            "message": f"Realtime enabled on {len(enabled_tables)} tables",
            "project_id": project_id,
            "tables": enabled_tables
        }
        
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))
