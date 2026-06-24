"""
Project Settings API
Manage project-wide settings like RLS and Realtime
"""
from fastapi import APIRouter, HTTPException, Depends
from pydantic import BaseModel
from typing import Optional
from app.core.database import execute_on_main_db, execute_on_project_db
from app.api.auth import get_current_user
import logging

router = APIRouter(prefix="/api/projects", tags=["project-settings"])
logger = logging.getLogger(__name__)

class ProjectSettingsResponse(BaseModel):
    project_id: str
    rls_enabled: bool
    realtime_enabled: bool
    rls_table_count: int
    realtime_table_count: int

class ToggleSettingRequest(BaseModel):
    enabled: bool

@router.get("/{project_id}/settings", response_model=ProjectSettingsResponse)
async def get_project_settings(
    project_id: str,
    current_user: dict = Depends(get_current_user)
):
    """Get project settings including RLS and Realtime status"""
    try:
        # Get project database name
        project_result = await execute_on_main_db(
            "SELECT database_name FROM projects WHERE id = $1",
            project_id
        )
        
        if not project_result:
            raise HTTPException(status_code=404, detail="Project not found")
            
        database_name = project_result[0]['database_name']
        
        # Check RLS status across all user tables
        rls_query = """
        SELECT 
            COUNT(*) as total_tables,
            COUNT(CASE WHEN rowsecurity THEN 1 END) as rls_enabled_tables
        FROM pg_tables 
        WHERE schemaname = 'public' 
        AND tablename NOT LIKE '_nexora_%'
        AND tablename NOT LIKE 'pg_%'
        AND tablename NOT LIKE 'information_schema_%'
        """
        
        rls_result = await execute_on_project_db(database_name, rls_query)
        rls_stats = rls_result[0] if rls_result else {"total_tables": 0, "rls_enabled_tables": 0}
        
        # Check Realtime status (if realtime functions exist)
        try:
            realtime_query = """
            SELECT COUNT(*) as realtime_tables
            FROM information_schema.triggers 
            WHERE trigger_name LIKE '%realtime%' 
            AND event_object_schema = 'public'
            """
            realtime_result = await execute_on_project_db(database_name, realtime_query)
            realtime_count = realtime_result[0]["realtime_tables"] if realtime_result else 0
        except Exception as e:
            logger.warning(f"Could not check realtime status: {e}")
            realtime_count = 0
        
        # Determine overall settings
        total_tables = rls_stats.get("total_tables", 0)
        rls_enabled_tables = rls_stats.get("rls_enabled_tables", 0)
        
        return ProjectSettingsResponse(
            project_id=project_id,
            rls_enabled=total_tables > 0 and rls_enabled_tables == total_tables,
            realtime_enabled=realtime_count > 0,
            rls_table_count=rls_enabled_tables,
            realtime_table_count=realtime_count
        )
        
    except Exception as e:
        logger.error(f"Failed to get project settings: {e}")
        raise HTTPException(status_code=500, detail=str(e))

@router.post("/{project_id}/settings/rls")
async def toggle_project_rls(
    project_id: str,
    request: ToggleSettingRequest,
    current_user: dict = Depends(get_current_user)
):
    """Enable or disable RLS on all user tables in the project"""
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
        tables_query = """
        SELECT table_name 
        FROM information_schema.tables 
        WHERE table_schema = 'public' 
        AND table_type = 'BASE TABLE'
        AND table_name NOT LIKE '_nexora_%'
        AND table_name NOT LIKE 'pg_%'
        """
        
        tables_result = await execute_on_project_db(database_name, tables_query)
        
        affected_tables = []
        for row in tables_result:
            table_name = row['table_name']
            try:
                if request.enabled:
                    await execute_on_project_db(
                        database_name,
                        f"ALTER TABLE \"{table_name}\" ENABLE ROW LEVEL SECURITY"
                    )
                else:
                    await execute_on_project_db(
                        database_name,
                        f"ALTER TABLE \"{table_name}\" DISABLE ROW LEVEL SECURITY"
                    )
                affected_tables.append(table_name)
            except Exception as e:
                logger.warning(f"Failed to toggle RLS on {table_name}: {e}")
        
        action = "enabled" if request.enabled else "disabled"
        return {
            "success": True,
            "message": f"RLS {action} on {len(affected_tables)} tables",
            "project_id": project_id,
            "affected_tables": affected_tables,
            "rls_enabled": request.enabled
        }
        
    except Exception as e:
        logger.error(f"Failed to toggle project RLS: {e}")
        raise HTTPException(status_code=500, detail=str(e))

@router.post("/{project_id}/settings/realtime")
async def toggle_project_realtime(
    project_id: str,
    request: ToggleSettingRequest,
    current_user: dict = Depends(get_current_user)
):
    """Enable or disable Realtime on all user tables in the project"""
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
        tables_query = """
        SELECT table_name 
        FROM information_schema.tables 
        WHERE table_schema = 'public' 
        AND table_type = 'BASE TABLE'
        AND table_name NOT LIKE '_nexora_%'
        AND table_name NOT LIKE 'pg_%'
        """
        
        tables_result = await execute_on_project_db(database_name, tables_query)
        
        affected_tables = []
        for row in tables_result:
            table_name = row['table_name']
            try:
                if request.enabled:
                    # Check if realtime trigger function exists
                    function_check = """
                    SELECT EXISTS (
                        SELECT 1 FROM information_schema.routines 
                        WHERE routine_name = 'add_realtime_trigger'
                        AND routine_schema = 'public'
                    )
                    """
                    function_exists = await execute_on_project_db(database_name, function_check)
                    
                    if function_exists and function_exists[0].get('exists', False):
                        await execute_on_project_db(
                            database_name,
                            f"SELECT add_realtime_trigger('public', '{table_name}')"
                        )
                    else:
                        # Create basic realtime trigger if function doesn't exist
                        trigger_sql = f"""
                        CREATE OR REPLACE FUNCTION notify_realtime_{table_name}()
                        RETURNS trigger AS $$
                        BEGIN
                            PERFORM pg_notify('realtime', json_build_object(
                                'table', '{table_name}',
                                'action', TG_OP,
                                'data', row_to_json(COALESCE(NEW, OLD))
                            )::text);
                            RETURN COALESCE(NEW, OLD);
                        END;
                        $$ LANGUAGE plpgsql;
                        
                        DROP TRIGGER IF EXISTS realtime_trigger_{table_name} ON "{table_name}";
                        CREATE TRIGGER realtime_trigger_{table_name}
                        AFTER INSERT OR UPDATE OR DELETE ON "{table_name}"
                        FOR EACH ROW EXECUTE FUNCTION notify_realtime_{table_name}();
                        """
                        await execute_on_project_db(database_name, trigger_sql)
                else:
                    # Remove realtime triggers
                    try:
                        await execute_on_project_db(
                            database_name,
                            f"DROP TRIGGER IF EXISTS realtime_trigger_{table_name} ON \"{table_name}\""
                        )
                        await execute_on_project_db(
                            database_name,
                            f"DROP FUNCTION IF EXISTS notify_realtime_{table_name}()"
                        )
                    except Exception:
                        pass  # Ignore errors when removing non-existent triggers
                
                affected_tables.append(table_name)
            except Exception as e:
                logger.warning(f"Failed to toggle realtime on {table_name}: {e}")
        
        action = "enabled" if request.enabled else "disabled"
        return {
            "success": True,
            "message": f"Realtime {action} on {len(affected_tables)} tables",
            "project_id": project_id,
            "affected_tables": affected_tables,
            "realtime_enabled": request.enabled
        }
        
    except Exception as e:
        logger.error(f"Failed to toggle project realtime: {e}")
        raise HTTPException(status_code=500, detail=str(e))