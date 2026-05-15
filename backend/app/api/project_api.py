"""
Hybrid Project API System
Supports both path-based and subdomain-based routing
"""

from fastapi import APIRouter, HTTPException, Depends, Request, Header, status
from app.core.database import execute_on_main_db, execute_on_project_db
from typing import Optional, Dict, Any, Tuple
from uuid import UUID
import re

router = APIRouter()

# ============================================
# INFO ENDPOINT: Show API Usage
# ============================================

@router.get("/p/{slug}")
async def project_api_info(slug: str):
    """Show API info - always returns same response"""
    return {
        "message": "Zendbx API",
        "version": "1.0.0",
        "health": "/health",
        "documentation": "http://localhost:8000/docs"
    }

# ============================================
# HELPER: Extract Project Slug
# ============================================

async def extract_project_slug(request: Request, slug: Optional[str] = None) -> str:
    """
    Extract project slug from either:
    1. Path parameter (/p/{slug}/...)
    2. Subdomain (slug.localhost:8000)
    """
    if slug:
        # Path-based routing
        return slug
    
    # Try subdomain-based routing
    host = request.headers.get("host", "")
    
    # Extract subdomain from host
    # Examples:
    # - "todo-app-a18a05a0.localhost:8000" -> "todo-app-a18a05a0"
    # - "todo-app-a18a05a0.zendbx.com" -> "todo-app-a18a05a0"
    # - "localhost:8000" -> None
    
    # Remove port
    host_without_port = host.split(':')[0]
    
    # Split by dots
    parts = host_without_port.split('.')
    
    # If we have subdomain.localhost or subdomain.domain.com
    if len(parts) >= 2 and parts[0] not in ['localhost', 'www', 'api']:
        return parts[0]
    
    raise HTTPException(
        status_code=status.HTTP_400_BAD_REQUEST,
        detail="Could not determine project from URL"
    )

# ============================================
# HELPER: Get Project by Slug
# ============================================

async def get_project_by_slug(slug: str) -> dict:
    """Get project details by slug"""
    result = await execute_on_main_db(
        """
        SELECT id, user_id, name, slug, database_name, status
        FROM projects
        WHERE slug = $1 AND status = 'active'
        """,
        slug
    )
    
    if not result:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=f"Project '{slug}' not found"
        )
    
    return dict(result[0])

# ============================================
# HELPER: Verify API Key
# ============================================

async def verify_api_key_for_project(api_key: str, project_id: UUID) -> dict:
    """Verify API key and return project + key info"""
    if not api_key:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="API key required. Include 'x-api-key' header."
        )
    
    # Try JWT key first (check encrypted_key column)
    result = await execute_on_main_db(
        """
        SELECT ak.*, p.database_name, p.user_id, p.slug
        FROM api_keys ak
        JOIN projects p ON ak.project_id = p.id
        WHERE ak.encrypted_key = $1 AND ak.project_id = $2 AND ak.is_active = TRUE
        """,
        api_key,  # Direct comparison for JWT keys
        project_id
    )
    
    # If not found, try legacy hash-based key
    if not result:
        import hashlib
        key_hash = hashlib.sha256(api_key.encode()).hexdigest()
        
        result = await execute_on_main_db(
            """
            SELECT ak.*, p.database_name, p.user_id, p.slug
            FROM api_keys ak
            JOIN projects p ON ak.project_id = p.id
            WHERE ak.key_hash = $1 AND ak.project_id = $2 AND ak.is_active = TRUE
            """,
            key_hash,
            project_id
        )
    
    if not result:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Invalid or inactive API key"
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

def parse_filters(query_params: dict) -> Tuple[Dict[str, Any], Dict[str, str]]:
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
# SHARED API HANDLER: LIST ROWS
# ============================================

async def handle_list_rows(
    project_slug: str,
    table_name: str,
    request: Request,
    api_key: str
) -> dict:
    """Shared handler for listing rows"""
    
    # Get project
    project = await get_project_by_slug(project_slug)
    
    # Verify API key
    api_key_data = await verify_api_key_for_project(api_key, project["id"])
    
    # Get primary key column for this table
    pk_result = await execute_on_project_db(
        api_key_data["database_name"],
        """
        SELECT a.attname
        FROM pg_index i
        JOIN pg_attribute a ON a.attrelid = i.indrelid AND a.attnum = ANY(i.indkey)
        WHERE i.indrelid = $1::regclass AND i.indisprimary
        """,
        table_name
    )
    
    default_sort = pk_result[0]["attname"] if pk_result else "created_at"
    
    # Parse query parameters
    limit = int(request.query_params.get('limit', 100))
    offset = int(request.query_params.get('offset', 0))
    sort = request.query_params.get('sort', default_sort)
    order = request.query_params.get('order', 'asc').upper()
    
    # Parse filters
    filters, operators = parse_filters(dict(request.query_params))
    
    try:
        # Build query
        query = f"SELECT * FROM {table_name}"
        conditions = []
        params = []
        param_count = 1
        
        # Add filters
        for column, value in filters.items():
            operator = operators.get(column, 'eq')
            
            # Convert string booleans to actual booleans
            if isinstance(value, str) and value.lower() in ('true', 'false'):
                value = value.lower() == 'true'
            
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
        
        # Execute
        rows = await execute_on_project_db(
            api_key_data["database_name"],
            query,
            *params
        )
        
        return {
            "data": [dict(row) for row in rows],
            "count": len(rows),
            "limit": limit,
            "offset": offset
        }
        
    except Exception as e:
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Query failed: {str(e)}"
        )

# ============================================
# SHARED API HANDLER: GET SINGLE ROW
# ============================================

async def handle_get_row(
    project_slug: str,
    table_name: str,
    row_id: str,
    api_key: str
) -> dict:
    """Shared handler for getting single row"""
    
    project = await get_project_by_slug(project_slug)
    api_key_data = await verify_api_key_for_project(api_key, project["id"])
    
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
# SHARED API HANDLER: CREATE ROW
# ============================================

async def handle_create_row(
    project_slug: str,
    table_name: str,
    data: dict,
    api_key: str
) -> dict:
    """Shared handler for creating row"""
    
    project = await get_project_by_slug(project_slug)
    api_key_data = await verify_api_key_for_project(api_key, project["id"])
    
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
# SHARED API HANDLER: UPDATE ROW
# ============================================

async def handle_update_row(
    project_slug: str,
    table_name: str,
    row_id: str,
    data: dict,
    api_key: str
) -> dict:
    """Shared handler for updating row"""
    
    project = await get_project_by_slug(project_slug)
    api_key_data = await verify_api_key_for_project(api_key, project["id"])
    
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
# SHARED API HANDLER: DELETE ROW
# ============================================

async def handle_delete_row(
    project_slug: str,
    table_name: str,
    row_id: str,
    api_key: str
) -> dict:
    """Shared handler for deleting row"""
    
    project = await get_project_by_slug(project_slug)
    api_key_data = await verify_api_key_for_project(api_key, project["id"])
    
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

# ============================================
# PATH-BASED ROUTES: /p/{slug}/{table}
# ============================================

@router.get("/p/{slug}/{table_name}")
async def path_based_list(
    slug: str,
    table_name: str,
    request: Request,
    x_api_key: Optional[str] = Header(None)
):
    """Path-based API: List rows"""
    return await handle_list_rows(slug, table_name, request, x_api_key)

@router.get("/p/{slug}/{table_name}/{row_id}")
async def path_based_get(
    slug: str,
    table_name: str,
    row_id: str,
    x_api_key: Optional[str] = Header(None)
):
    """Path-based API: Get single row"""
    return await handle_get_row(slug, table_name, row_id, x_api_key)

@router.post("/p/{slug}/{table_name}")
async def path_based_create(
    slug: str,
    table_name: str,
    data: dict,
    x_api_key: Optional[str] = Header(None)
):
    """Path-based API: Create row"""
    return await handle_create_row(slug, table_name, data, x_api_key)

@router.put("/p/{slug}/{table_name}/{row_id}")
async def path_based_update(
    slug: str,
    table_name: str,
    row_id: str,
    data: dict,
    x_api_key: Optional[str] = Header(None)
):
    """Path-based API: Update row"""
    return await handle_update_row(slug, table_name, row_id, data, x_api_key)

@router.delete("/p/{slug}/{table_name}/{row_id}")
async def path_based_delete(
    slug: str,
    table_name: str,
    row_id: str,
    x_api_key: Optional[str] = Header(None)
):
    """Path-based API: Delete row"""
    return await handle_delete_row(slug, table_name, row_id, x_api_key)

# ============================================
# SUBDOMAIN-BASED ROUTES: {slug}.localhost/{table}
# ============================================

@router.get("/{table_name}")
async def subdomain_based_list(
    table_name: str,
    request: Request,
    x_api_key: Optional[str] = Header(None)
):
    """Subdomain-based API: List rows"""
    slug = await extract_project_slug(request)
    return await handle_list_rows(slug, table_name, request, x_api_key)

@router.get("/{table_name}/{row_id}")
async def subdomain_based_get(
    table_name: str,
    row_id: str,
    request: Request,
    x_api_key: Optional[str] = Header(None)
):
    """Subdomain-based API: Get single row"""
    slug = await extract_project_slug(request)
    return await handle_get_row(slug, table_name, row_id, x_api_key)

@router.post("/{table_name}")
async def subdomain_based_create(
    table_name: str,
    data: dict,
    request: Request,
    x_api_key: Optional[str] = Header(None)
):
    """Subdomain-based API: Create row"""
    slug = await extract_project_slug(request)
    return await handle_create_row(slug, table_name, data, x_api_key)

@router.put("/{table_name}/{row_id}")
async def subdomain_based_update(
    table_name: str,
    row_id: str,
    data: dict,
    request: Request,
    x_api_key: Optional[str] = Header(None)
):
    """Subdomain-based API: Update row"""
    slug = await extract_project_slug(request)
    return await handle_update_row(slug, table_name, row_id, data, x_api_key)

@router.delete("/{table_name}/{row_id}")
async def subdomain_based_delete(
    table_name: str,
    row_id: str,
    request: Request,
    x_api_key: Optional[str] = Header(None)
):
    """Subdomain-based API: Delete row"""
    slug = await extract_project_slug(request)
    return await handle_delete_row(slug, table_name, row_id, x_api_key)
