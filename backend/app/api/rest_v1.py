"""
Universal REST API (Supabase-style)
Automatically works for any table without manual endpoint creation

RLS ENFORCEMENT:
- All queries respect PostgreSQL Row Level Security policies
- User context extracted from JWT token
- Service role can bypass RLS when needed
"""
from fastapi import APIRouter, Request, HTTPException, Query, Depends
from typing import Optional, Dict, Any, List
import logging
from uuid import UUID

from ..services.auto_table import ensure_table_exists
from ..core.rls_enforcer import RLSEnforcer, get_rls_enforcer
from ..middleware.rls_context import set_rls_context

logger = logging.getLogger(__name__)

router = APIRouter(prefix="/rest/v1", tags=["REST API"])


@router.post("/{table_name}")
async def create_record(
    table_name: str,
    data: Dict[str, Any],
    request: Request,
    enforcer: RLSEnforcer = Depends(get_rls_enforcer)
):
    """
    Universal POST endpoint - creates a record in any table
    Automatically creates table if it doesn't exist
    
    RLS: Respects INSERT policies on the table
    """
    pool = request.state.project_db
    project_id = request.state.project_id
    
    logger.info(f"POST /rest/v1/{table_name} - Project: {project_id}, User: {enforcer.user_id}, Role: {enforcer.role}")
    
    try:
        # Ensure table exists (create if not) - service role only
        if enforcer.is_service_role:
            await ensure_table_exists(pool, table_name, data)
        
        # Prepare insert query
        columns = list(data.keys())
        values = list(data.values())
        placeholders = [f"${i+1}" for i in range(len(values))]
        
        query = f"""
            INSERT INTO {table_name} ({', '.join(columns)})
            VALUES ({', '.join(placeholders)})
            RETURNING *
        """
        
        # Insert data with RLS enforcement
        result = await enforcer.execute_one(pool, query, *values)
        
        if not result:
            raise HTTPException(
                status_code=403,
                detail="Insert blocked by row level security policy"
            )
        
        logger.info(f"Record created in {table_name}: {dict(result).get('id')}")
        return dict(result)
        
    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Error creating record in {table_name}: {str(e)}")
        raise HTTPException(status_code=500, detail=str(e))


@router.get("/{table_name}")
async def get_records(
    table_name: str,
    request: Request,
    enforcer: RLSEnforcer = Depends(get_rls_enforcer),
    id: Optional[str] = Query(None, description="Filter by ID (eq.{uuid})"),
    select: Optional[str] = Query("*", description="Columns to select"),
    limit: Optional[int] = Query(100, description="Limit results"),
    offset: Optional[int] = Query(0, description="Offset results"),
    order: Optional[str] = Query(None, description="Order by column")
):
    """
    Universal GET endpoint - retrieves records from any table
    Supports Supabase-style query parameters
    
    RLS: Respects SELECT policies on the table
    """
    pool = request.state.project_db
    project_id = request.state.project_id
    
    logger.info(f"GET /rest/v1/{table_name} - Project: {project_id}, User: {enforcer.user_id}, Role: {enforcer.role}")
    
    try:
        # Build query
        query = f"SELECT {select} FROM {table_name}"
        params = []
        
        # Add WHERE clause
        if id:
            # Support Supabase-style: ?id=eq.{uuid}
            if id.startswith("eq."):
                id_value = id[3:]
                query += " WHERE id = $1"
                params.append(id_value)
            else:
                query += " WHERE id = $1"
                params.append(id)
        
        # Add ORDER BY
        if order:
            # Support: ?order=created_at.desc
            if "." in order:
                col, direction = order.split(".")
                query += f" ORDER BY {col} {direction.upper()}"
            else:
                query += f" ORDER BY {order}"
        
        # Add LIMIT and OFFSET
        query += f" LIMIT {limit} OFFSET {offset}"
        
        # Execute query with RLS enforcement
        records = await enforcer.execute(pool, query, *params)
        result = [dict(r) for r in records]
        
        logger.info(f"Retrieved {len(result)} records from {table_name}")
        return result
        
    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Error retrieving records from {table_name}: {str(e)}")
        raise HTTPException(status_code=500, detail=str(e))


@router.patch("/{table_name}")
async def update_record(
    table_name: str,
    data: Dict[str, Any],
    request: Request,
    enforcer: RLSEnforcer = Depends(get_rls_enforcer),
    id: Optional[str] = Query(None, description="Filter by ID (eq.{uuid})")
):
    """
    Universal PATCH endpoint - updates a record in any table
    
    RLS: Respects UPDATE policies on the table
    """
    pool = request.state.project_db
    project_id = request.state.project_id
    
    logger.info(f"PATCH /rest/v1/{table_name} - Project: {project_id}, User: {enforcer.user_id}, Role: {enforcer.role}")
    
    if not id:
        raise HTTPException(status_code=400, detail="Missing id parameter")
    
    try:
        # Parse ID
        if id.startswith("eq."):
            id_value = id[3:]
        else:
            id_value = id
        
        # Build SET clause
        set_parts = []
        values = [id_value]
        
        for i, (key, value) in enumerate(data.items(), start=2):
            set_parts.append(f"{key} = ${i}")
            values.append(value)
        
        # Add updated_at
        set_parts.append(f"updated_at = NOW()")
        
        query = f"""
            UPDATE {table_name}
            SET {', '.join(set_parts)}
            WHERE id = $1
            RETURNING *
        """
        
        # Execute update with RLS enforcement
        result = await enforcer.execute_one(pool, query, *values)
        
        if not result:
            raise HTTPException(
                status_code=404,
                detail="Record not found or update blocked by row level security policy"
            )
        
        logger.info(f"Record updated in {table_name}: {id_value}")
        return dict(result)
        
    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Error updating record in {table_name}: {str(e)}")
        raise HTTPException(status_code=500, detail=str(e))


@router.delete("/{table_name}")
async def delete_record(
    table_name: str,
    request: Request,
    enforcer: RLSEnforcer = Depends(get_rls_enforcer),
    id: Optional[str] = Query(None, description="Filter by ID (eq.{uuid})")
):
    """
    Universal DELETE endpoint - deletes a record from any table
    
    RLS: Respects DELETE policies on the table
    """
    pool = request.state.project_db
    project_id = request.state.project_id
    
    logger.info(f"DELETE /rest/v1/{table_name} - Project: {project_id}, User: {enforcer.user_id}, Role: {enforcer.role}")
    
    if not id:
        raise HTTPException(status_code=400, detail="Missing id parameter")
    
    try:
        # Parse ID
        if id.startswith("eq."):
            id_value = id[3:]
        else:
            id_value = id
        
        # Execute delete with RLS enforcement
        result = await enforcer.execute_command(
            pool,
            f"DELETE FROM {table_name} WHERE id = $1",
            id_value
        )
        
        # Check if record was deleted
        if result == "DELETE 0":
            raise HTTPException(
                status_code=404,
                detail="Record not found or delete blocked by row level security policy"
            )
        
        logger.info(f"Record deleted from {table_name}: {id_value}")
        return {"message": "Record deleted successfully", "id": id_value}
        
    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Error deleting record from {table_name}: {str(e)}")
        raise HTTPException(status_code=500, detail=str(e))
