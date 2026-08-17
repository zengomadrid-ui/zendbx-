"""
Data Visualizer API
Turn raw database data into interactive charts and dashboards
"""
from fastapi import APIRouter, HTTPException, Depends, status
from app.models.visualizer_schemas import (
    VisualizerQueryRequest,
    VisualizerQueryResponse,
    VisualizerSchemaResponse,
    TableInfo,
    ColumnInfo,
    DashboardCreate,
    DashboardUpdate,
    DashboardResponse,
    DashboardListResponse,
    ChartCreate,
    ChartUpdate,
    ChartResponse
)
from app.api.auth import get_current_user
from app.core.database import execute_on_main_db, execute_on_project_db
from app.services.visualizer_query_builder import VisualizerQueryBuilder
from app.services.schema_parser import SchemaParser
from uuid import UUID
from datetime import datetime
from typing import List
import time
import logging
import json

logger = logging.getLogger(__name__)

router = APIRouter(prefix="/visualizer", tags=["Data Visualizer"])


# ============================================
# HELPER: Verify Project Access
# ============================================

async def verify_project_access(project_id: UUID, user_id: UUID) -> dict:
    """Verify user has access to project"""
    result = await execute_on_main_db(
        """
        SELECT 
            p.*,
            EXISTS(
                SELECT 1 FROM project_db_credentials pdc 
                WHERE pdc.project_id = p.id
            ) as has_credentials
        FROM projects p
        WHERE p.id = $1 AND p.user_id = $2
        """,
        project_id,
        user_id
    )
    
    if not result:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Project not found"
        )
    
    project = dict(result[0])
    
    # Verify credentials exist
    if not project.get('has_credentials'):
        raise HTTPException(
            status_code=status.HTTP_503_SERVICE_UNAVAILABLE,
            detail="Project credentials not provisioned"
        )
    
    return project


# ============================================
# SCHEMA DISCOVERY
# ============================================

@router.get("/projects/{project_id}/schema")
async def get_visualizer_schema(
    project_id: UUID,
    current_user: dict = Depends(get_current_user)
) -> VisualizerSchemaResponse:
    """
    Get database schema for visualization.
    Returns all user tables with column metadata.
    """
    project = await verify_project_access(project_id, current_user["id"])
    
    try:
        # Get project schema name
        project_schema = project["database_name"]
        
        logger.info(f"[VISUALIZER] Loading schema for project {project_id}")
        logger.info(f"[VISUALIZER] Project schema: {project_schema}")
        
        # Get tables using existing SchemaParser
        # Execute on project database to get real-time schema
        tables_query = """
        SELECT 
            t.table_name,
            json_agg(
                json_build_object(
                    'name', c.column_name,
                    'type', c.data_type,
                    'nullable', c.is_nullable = 'YES',
                    'default', c.column_default,
                    'primary_key', (
                        SELECT COUNT(*) > 0
                        FROM information_schema.table_constraints tc
                        JOIN information_schema.key_column_usage kcu 
                            ON tc.constraint_name = kcu.constraint_name
                        WHERE tc.table_schema = t.table_schema
                        AND tc.table_name = t.table_name
                        AND tc.constraint_type = 'PRIMARY KEY'
                        AND kcu.column_name = c.column_name
                    )
                ) ORDER BY c.ordinal_position
            ) as columns
        FROM information_schema.tables t
        JOIN information_schema.columns c 
            ON t.table_name = c.table_name 
            AND t.table_schema = c.table_schema
        WHERE t.table_type = 'BASE TABLE'
        AND t.table_schema = $1
        AND t.table_name NOT LIKE '_zendbx_%'
        AND t.table_name NOT LIKE '_nexora_%'
        GROUP BY t.table_schema, t.table_name
        ORDER BY t.table_name
        """
        
        tables_result = await execute_on_project_db(
            project_id,
            project["database_name"],
            tables_query,
            project_schema
        )
        
        tables = []
        for row in tables_result:
            table_name = row["table_name"]
            columns_data = row["columns"]
            
            # Parse columns JSON
            if isinstance(columns_data, str):
                columns_data = json.loads(columns_data)
            
            columns = [
                ColumnInfo(
                    name=col["name"],
                    type=col["type"],
                    nullable=col["nullable"],
                    default=col.get("default"),
                    primary_key=col.get("primary_key", False)
                )
                for col in columns_data
            ]
            
            tables.append(TableInfo(name=table_name, columns=columns))
        
        logger.info(f"[VISUALIZER] Found {len(tables)} tables")
        
        return VisualizerSchemaResponse(tables=tables)
        
    except Exception as e:
        logger.error(f"[VISUALIZER] Schema discovery error: {e}")
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Failed to load schema: {str(e)}"
        )


# ============================================
# QUERY EXECUTION
# ============================================

@router.post("/projects/{project_id}/query")
async def execute_visualizer_query(
    project_id: UUID,
    request: VisualizerQueryRequest,
    current_user: dict = Depends(get_current_user)
) -> VisualizerQueryResponse:
    """
    Execute visualization query and return results.
    Generates safe SQL from configuration.
    """
    project = await verify_project_access(project_id, current_user["id"])
    
    try:
        # Get project schema
        project_schema = project["database_name"]
        
        logger.info(f"[VISUALIZER] Executing query for project {project_id}")
        logger.info(f"[VISUALIZER] Table: {request.table}")
        logger.info(f"[VISUALIZER] Dimensions: {len(request.dimensions)}")
        logger.info(f"[VISUALIZER] Metrics: {len(request.metrics)}")
        logger.info(f"[VISUALIZER] Filters: {len(request.filters)}")
        
        # Build SQL query
        sql_query, parameters = VisualizerQueryBuilder.build_query(request, project_schema)
        
        # Validate query safety
        VisualizerQueryBuilder.validate_query_safety(sql_query)
        
        logger.info(f"[VISUALIZER] Generated SQL:\n{sql_query}")
        logger.info(f"[VISUALIZER] Parameters: {parameters}")
        
        # Execute query with timing
        start_time = time.time()
        
        result = await execute_on_project_db(
            project_id,
            project["database_name"],
            sql_query,
            *parameters
        )
        
        execution_time_ms = int((time.time() - start_time) * 1000)
        
        # Convert result to response format
        rows = []
        columns = []
        
        if result:
            # Get column names from first row
            columns = list(result[0].keys())
            
            # Convert rows to dicts
            for row in result:
                row_dict = {}
                for col in columns:
                    value = row[col]
                    # Convert datetime objects to ISO strings
                    if isinstance(value, datetime):
                        value = value.isoformat()
                    row_dict[col] = value
                rows.append(row_dict)
        
        logger.info(f"[VISUALIZER] Query executed successfully")
        logger.info(f"[VISUALIZER] Rows returned: {len(rows)}")
        logger.info(f"[VISUALIZER] Execution time: {execution_time_ms}ms")
        
        return VisualizerQueryResponse(
            columns=columns,
            rows=rows,
            row_count=len(rows),
            execution_time_ms=execution_time_ms,
            generated_sql=sql_query,
            timestamp=datetime.utcnow()
        )
        
    except ValueError as e:
        # Validation errors
        logger.error(f"[VISUALIZER] Validation error: {e}")
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=str(e)
        )
    except Exception as e:
        logger.error(f"[VISUALIZER] Query execution error: {e}")
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Query execution failed: {str(e)}"
        )


# ============================================
# DASHBOARD CRUD
# ============================================

@router.get("/projects/{project_id}/dashboards")
async def list_dashboards(
    project_id: UUID,
    current_user: dict = Depends(get_current_user)
) -> DashboardListResponse:
    """List all dashboards for a project"""
    await verify_project_access(project_id, current_user["id"])
    
    result = await execute_on_main_db(
        """
        SELECT 
            id, project_id, name, description, 
            created_by, created_at, updated_at
        FROM visualizer_dashboards
        WHERE project_id = $1
        ORDER BY updated_at DESC
        """,
        project_id
    )
    
    dashboards = [DashboardResponse(**dict(row)) for row in result]
    
    return DashboardListResponse(
        dashboards=dashboards,
        total=len(dashboards)
    )


@router.post("/projects/{project_id}/dashboards")
async def create_dashboard(
    project_id: UUID,
    dashboard: DashboardCreate,
    current_user: dict = Depends(get_current_user)
) -> DashboardResponse:
    """Create new dashboard"""
    await verify_project_access(project_id, current_user["id"])
    
    result = await execute_on_main_db(
        """
        INSERT INTO visualizer_dashboards 
        (project_id, name, description, created_by)
        VALUES ($1, $2, $3, $4)
        RETURNING id, project_id, name, description, 
                  created_by, created_at, updated_at
        """,
        project_id,
        dashboard.name,
        dashboard.description,
        current_user["id"]
    )
    
    return DashboardResponse(**dict(result[0]))


@router.get("/projects/{project_id}/dashboards/{dashboard_id}")
async def get_dashboard(
    project_id: UUID,
    dashboard_id: UUID,
    current_user: dict = Depends(get_current_user)
) -> DashboardResponse:
    """Get dashboard with all charts"""
    await verify_project_access(project_id, current_user["id"])
    
    # Get dashboard
    dashboard_result = await execute_on_main_db(
        """
        SELECT 
            id, project_id, name, description, 
            created_by, created_at, updated_at
        FROM visualizer_dashboards
        WHERE id = $1 AND project_id = $2
        """,
        dashboard_id,
        project_id
    )
    
    if not dashboard_result:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Dashboard not found"
        )
    
    dashboard = DashboardResponse(**dict(dashboard_result[0]))
    
    # Get charts
    charts_result = await execute_on_main_db(
        """
        SELECT 
            id, dashboard_id, project_id, name, chart_type,
            configuration, position, created_at, updated_at
        FROM visualizer_charts
        WHERE dashboard_id = $1
        ORDER BY created_at
        """,
        dashboard_id
    )
    
    # Parse JSON fields for each chart
    charts = []
    for row in charts_result:
        chart_dict = dict(row)
        if isinstance(chart_dict['configuration'], str):
            chart_dict['configuration'] = json.loads(chart_dict['configuration'])
        if chart_dict.get('position') and isinstance(chart_dict['position'], str):
            chart_dict['position'] = json.loads(chart_dict['position'])
        charts.append(ChartResponse(**chart_dict))
    
    dashboard.charts = charts
    
    return dashboard


@router.put("/projects/{project_id}/dashboards/{dashboard_id}")
async def update_dashboard(
    project_id: UUID,
    dashboard_id: UUID,
    dashboard: DashboardUpdate,
    current_user: dict = Depends(get_current_user)
) -> DashboardResponse:
    """Update dashboard"""
    await verify_project_access(project_id, current_user["id"])
    
    # Build update query dynamically
    updates = []
    params = []
    param_idx = 1
    
    if dashboard.name is not None:
        updates.append(f"name = ${param_idx}")
        params.append(dashboard.name)
        param_idx += 1
    
    if dashboard.description is not None:
        updates.append(f"description = ${param_idx}")
        params.append(dashboard.description)
        param_idx += 1
    
    if not updates:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="No fields to update"
        )
    
    updates.append(f"updated_at = NOW()")
    
    params.extend([dashboard_id, project_id])
    
    query = f"""
        UPDATE visualizer_dashboards
        SET {', '.join(updates)}
        WHERE id = ${param_idx} AND project_id = ${param_idx + 1}
        RETURNING id, project_id, name, description, 
                  created_by, created_at, updated_at
    """
    
    result = await execute_on_main_db(query, *params)
    
    if not result:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Dashboard not found"
        )
    
    return DashboardResponse(**dict(result[0]))


@router.delete("/projects/{project_id}/dashboards/{dashboard_id}")
async def delete_dashboard(
    project_id: UUID,
    dashboard_id: UUID,
    current_user: dict = Depends(get_current_user)
):
    """Delete dashboard and all its charts"""
    await verify_project_access(project_id, current_user["id"])
    
    result = await execute_on_main_db(
        """
        DELETE FROM visualizer_dashboards
        WHERE id = $1 AND project_id = $2
        """,
        dashboard_id,
        project_id
    )
    
    if result == "DELETE 0":
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Dashboard not found"
        )
    
    return {"message": "Dashboard deleted successfully"}


# ============================================
# CHART CRUD
# ============================================

@router.post("/projects/{project_id}/charts")
async def create_chart(
    project_id: UUID,
    chart: ChartCreate,
    current_user: dict = Depends(get_current_user)
) -> ChartResponse:
    """Create new chart"""
    await verify_project_access(project_id, current_user["id"])
    
    # Verify dashboard exists if provided
    if chart.dashboard_id:
        dashboard_check = await execute_on_main_db(
            "SELECT id FROM visualizer_dashboards WHERE id = $1 AND project_id = $2",
            chart.dashboard_id,
            project_id
        )
        if not dashboard_check:
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND,
                detail="Dashboard not found"
            )
    
    # Convert configuration to JSON string for JSONB column
    config_json = json.dumps(chart.configuration.model_dump())
    position_json = json.dumps(chart.position.model_dump()) if chart.position else None
    
    result = await execute_on_main_db(
        """
        INSERT INTO visualizer_charts 
        (dashboard_id, project_id, name, chart_type, configuration, position)
        VALUES ($1, $2, $3, $4, $5::jsonb, $6::jsonb)
        RETURNING id, dashboard_id, project_id, name, chart_type,
                  configuration, position, created_at, updated_at
        """,
        chart.dashboard_id,
        project_id,
        chart.name,
        chart.configuration.chart_type,
        config_json,
        position_json
    )
    
    # Parse JSON fields back to dicts for Pydantic
    result_dict = dict(result[0])
    if isinstance(result_dict['configuration'], str):
        result_dict['configuration'] = json.loads(result_dict['configuration'])
    if result_dict.get('position') and isinstance(result_dict['position'], str):
        result_dict['position'] = json.loads(result_dict['position'])
    
    return ChartResponse(**result_dict)


@router.get("/projects/{project_id}/charts/{chart_id}")
async def get_chart(
    project_id: UUID,
    chart_id: UUID,
    current_user: dict = Depends(get_current_user)
) -> ChartResponse:
    """Get chart by ID"""
    await verify_project_access(project_id, current_user["id"])
    
    result = await execute_on_main_db(
        """
        SELECT 
            id, dashboard_id, project_id, name, chart_type,
            configuration, position, created_at, updated_at
        FROM visualizer_charts
        WHERE id = $1 AND project_id = $2
        """,
        chart_id,
        project_id
    )
    
    if not result:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Chart not found"
        )
    
    # Parse JSON fields
    result_dict = dict(result[0])
    if isinstance(result_dict['configuration'], str):
        result_dict['configuration'] = json.loads(result_dict['configuration'])
    if result_dict.get('position') and isinstance(result_dict['position'], str):
        result_dict['position'] = json.loads(result_dict['position'])
    
    return ChartResponse(**result_dict)


@router.put("/projects/{project_id}/charts/{chart_id}")
async def update_chart(
    project_id: UUID,
    chart_id: UUID,
    chart: ChartUpdate,
    current_user: dict = Depends(get_current_user)
) -> ChartResponse:
    """Update chart"""
    await verify_project_access(project_id, current_user["id"])
    
    # Build update query
    updates = []
    params = []
    param_idx = 1
    
    if chart.name is not None:
        updates.append(f"name = ${param_idx}")
        params.append(chart.name)
        param_idx += 1
    
    if chart.configuration is not None:
        updates.append(f"configuration = ${param_idx}::jsonb")
        updates.append(f"chart_type = ${param_idx + 1}")
        params.append(json.dumps(chart.configuration.model_dump()))
        params.append(chart.configuration.chart_type)
        param_idx += 2
    
    if chart.position is not None:
        updates.append(f"position = ${param_idx}::jsonb")
        params.append(json.dumps(chart.position.model_dump()))
        param_idx += 1
    
    if not updates:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="No fields to update"
        )
    
    updates.append(f"updated_at = NOW()")
    
    params.extend([chart_id, project_id])
    
    query = f"""
        UPDATE visualizer_charts
        SET {', '.join(updates)}
        WHERE id = ${param_idx} AND project_id = ${param_idx + 1}
        RETURNING id, dashboard_id, project_id, name, chart_type,
                  configuration, position, created_at, updated_at
    """
    
    result = await execute_on_main_db(query, *params)
    
    if not result:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Chart not found"
        )
    
    # Parse JSON fields
    result_dict = dict(result[0])
    if isinstance(result_dict['configuration'], str):
        result_dict['configuration'] = json.loads(result_dict['configuration'])
    if result_dict.get('position') and isinstance(result_dict['position'], str):
        result_dict['position'] = json.loads(result_dict['position'])
    
    return ChartResponse(**result_dict)


@router.delete("/projects/{project_id}/charts/{chart_id}")
async def delete_chart(
    project_id: UUID,
    chart_id: UUID,
    current_user: dict = Depends(get_current_user)
):
    """Delete chart"""
    await verify_project_access(project_id, current_user["id"])
    
    result = await execute_on_main_db(
        """
        DELETE FROM visualizer_charts
        WHERE id = $1 AND project_id = $2
        """,
        chart_id,
        project_id
    )
    
    if result == "DELETE 0":
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Chart not found"
        )
    
    return {"message": "Chart deleted successfully"}
