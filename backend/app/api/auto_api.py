"""
Auto-Generated REST API with RLS Enforcement

All endpoints respect PostgreSQL Row Level Security policies.
Service role API keys can bypass RLS when needed.
"""
from fastapi import APIRouter, HTTPException, Depends, Request, Header, status
from app.core.database import execute_on_main_db, execute_on_project_db
from app.core.rls_enforcer import RLSEnforcer, get_rls_enforcer
from app.middleware.rls_context import set_rls_context
from typing import Optional, Dict, Any
from uuid import UUID
import json
import logging

logger = logging.getLogger(__name__)

router = APIRouter()

# ============================================
# HELPER: Verify API Key
# ============================================

async def verify_api_key(api_key: str, project_id: UUID) -> dict:
    """Verify API key and return project"""
    if not api_key:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="API key required"
        )
    
    # Hash the provided API key for comparison
    import hashlib
    key_hash = hashlib.sha256(api_key.encode()).hexdigest()
    
    # Get API key from database
    result = await execute_on_main_db(
        """
        SELECT ak.*, p.database_name, p.user_id
        FROM api_keys ak
        JOIN projects p ON ak.project_id = p.id
        WHERE ak.key_hash = $1 AND ak.project_id = $2 AND ak.is_active = TRUE
        """,
        key_hash,  # Compare hashed key
        project_id
    )
    
    if not result:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Invalid API key"
        )
    
    # Update last_used_at
    await execute_on_main_db(
        "UPDATE api_keys SET last_used_at = NOW() WHERE id = $1",
        result[0]["id"]
    )
    
    return dict(result[0])

# ============================================
# HELPER: Parse Query Filters
# ============================================

def parse_filters(query_params: dict) -> Dict[str, Any]:
    """Parse query parameters into SQL filters"""
    filters = {}
    operators = {}
    
    for key, value in query_params.items():
        if key in ['limit', 'offset', 'sort', 'order']:
            continue
        
        # Handle operators: column__operator=value
        if '__' in key:
            column, operator = key.split('__', 1)
            filters[column] = value
            operators[column] = operator
        else:
            filters[key] = value
            operators[key] = 'eq'
    
    return filters, operators

# ============================================
# AUTO API: LIST ROWS
# ============================================

@router.get("/v1/{project_id}/{table_name}")
async def auto_api_list(
    project_id: UUID,
    table_name: str,
    request: Request,
    enforcer: RLSEnforcer = Depends(get_rls_enforcer),
    x_api_key: Optional[str] = Header(None)
):
    """
    Auto-generated API: List rows with filtering
    
    RLS: Respects SELECT policies on the table
    """
    
    api_key_data = await verify_api_key(x_api_key, project_id)
    
    # Parse query parameters
    limit = int(request.query_params.get('limit', 100))
    offset = int(request.query_params.get('offset', 0))
    sort = request.query_params.get('sort', 'id')
    order = request.query_params.get('order', 'asc').upper()
    
    # Parse filters
    filters, operators = parse_filters(dict(request.query_params))
    
    logger.info(f"GET /v1/{project_id}/{table_name} - User: {enforcer.user_id}, Role: {enforcer.role}")
    
    try:
        # Build query
        query = f"SELECT * FROM {table_name}"
        conditions = []
        params = []
        param_count = 1
        
        # Add filters
        for column, value in filters.items():
            operator = operators.get(column, 'eq')
            
            if operator == 'eq':
                conditions.append(f"{column} = ${param_count}")
                params.append(value)
            elif operator == 'ne':
                conditions.append(f"{column} != ${param_count}")
                params.append(value)
            elif operator == 'gt':
                conditions.append(f"{column} > ${param_count}")
                params.append(value)
            elif operator == 'gte':
                conditions.append(f"{column} >= ${param_count}")
                params.append(value)
            elif operator == 'lt':
                conditions.append(f"{column} < ${param_count}")
                params.append(value)
            elif operator == 'lte':
                conditions.append(f"{column} <= ${param_count}")
                params.append(value)
            elif operator == 'like':
                conditions.append(f"{column} LIKE ${param_count}")
                params.append(f"%{value}%")
            elif operator == 'in':
                values = value.split(',')
                placeholders = [f"${param_count + i}" for i in range(len(values))]
                conditions.append(f"{column} IN ({', '.join(placeholders)})")
                params.extend(values)
                param_count += len(values) - 1
            
            param_count += 1
        
        if conditions:
            query += " WHERE " + " AND ".join(conditions)
        
        # Add sorting
        query += f" ORDER BY {sort} {order}"
        
        # Add pagination
        query += f" LIMIT ${param_count} OFFSET ${param_count + 1}"
        params.extend([limit, offset])
        
        # Get project database pool
        from ..core.db_router import get_project_db_direct
        pool = await get_project_db_direct(str(project_id))
        
        # Execute with RLS enforcement
        rows = await enforcer.execute(pool, query, *params)
        
        return {
            "data": [dict(row) for row in rows],
            "count": len(rows),
            "limit": limit,
            "offset": offset
        }
        
    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Query failed: {str(e)}")
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Query failed: {str(e)}"
        )

# ============================================
# AUTO API: GET SINGLE ROW
# ============================================

@router.get("/v1/{project_id}/{table_name}/{row_id}")
async def auto_api_get(
    project_id: UUID,
    table_name: str,
    row_id: str,
    x_api_key: Optional[str] = Header(None)
):
    """Auto-generated API: Get single row"""
    
    api_key_data = await verify_api_key(x_api_key, project_id)
    
    try:
        result = await execute_on_project_db(
            api_key_data["database_name"],
            f"SELECT * FROM {table_name} WHERE id = $1",
            row_id
        )
        
        if not result:
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND,
                detail="Row not found"
            )
        
        return dict(result[0])
        
    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Query failed: {str(e)}"
        )

# ============================================
# AUTO API: CREATE ROW
# ============================================

@router.post("/v1/{project_id}/{table_name}")
async def auto_api_create(
    project_id: UUID,
    table_name: str,
    data: dict,
    x_api_key: Optional[str] = Header(None)
):
    """Auto-generated API: Create new row"""
    
    api_key_data = await verify_api_key(x_api_key, project_id)
    
    # Check permissions
    if api_key_data["role"] == "read":
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Read-only API key cannot create rows"
        )
    
    try:
        columns = list(data.keys())
        placeholders = [f"${i+1}" for i in range(len(columns))]
        values = list(data.values())
        
        insert_sql = f"""
            INSERT INTO {table_name} ({', '.join(columns)})
            VALUES ({', '.join(placeholders)})
            RETURNING *
        """
        
        result = await execute_on_project_db(
            api_key_data["database_name"],
            insert_sql,
            *values
        )
        
        return dict(result[0])
        
    except Exception as e:
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Insert failed: {str(e)}"
        )

# ============================================
# AUTO API: UPDATE ROW
# ============================================

@router.put("/v1/{project_id}/{table_name}/{row_id}")
async def auto_api_update(
    project_id: UUID,
    table_name: str,
    row_id: str,
    data: dict,
    x_api_key: Optional[str] = Header(None)
):
    """Auto-generated API: Update row"""
    
    api_key_data = await verify_api_key(x_api_key, project_id)
    
    if api_key_data["role"] == "read":
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Read-only API key cannot update rows"
        )
    
    try:
        updates = [f"{col} = ${i+1}" for i, col in enumerate(data.keys())]
        values = list(data.values())
        values.append(row_id)
        
        update_sql = f"""
            UPDATE {table_name}
            SET {', '.join(updates)}
            WHERE id = ${len(values)}
            RETURNING *
        """
        
        result = await execute_on_project_db(
            api_key_data["database_name"],
            update_sql,
            *values
        )
        
        if not result:
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND,
                detail="Row not found"
            )
        
        return dict(result[0])
        
    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Update failed: {str(e)}"
        )

# ============================================
# AUTO API: DELETE ROW
# ============================================

@router.delete("/v1/{project_id}/{table_name}/{row_id}")
async def auto_api_delete(
    project_id: UUID,
    table_name: str,
    row_id: str,
    x_api_key: Optional[str] = Header(None)
):
    """Auto-generated API: Delete row"""
    
    api_key_data = await verify_api_key(x_api_key, project_id)
    
    if api_key_data["role"] == "read":
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Read-only API key cannot delete rows"
        )
    
    try:
        result = await execute_on_project_db(
            api_key_data["database_name"],
            f"DELETE FROM {table_name} WHERE id = $1 RETURNING id",
            row_id
        )
        
        if not result:
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND,
                detail="Row not found"
            )
        
        return {"message": "Row deleted successfully", "id": dict(result[0])["id"]}
        
    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Delete failed: {str(e)}"
        )
