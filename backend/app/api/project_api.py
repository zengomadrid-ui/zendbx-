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

# ---------------------------------------------------------------------------
# Identifier safety helpers
# ---------------------------------------------------------------------------

_SAFE_IDENTIFIER_RE = re.compile(r'^[a-zA-Z_][a-zA-Z0-9_]{0,62}$')
_SAFE_ORDER_RE = re.compile(r'^(ASC|DESC)$', re.IGNORECASE)

def _safe_ident(name: str, label: str = "identifier") -> str:
    """Validate and double-quote a SQL identifier. Raises HTTP 400 on failure."""
    if not name or not _SAFE_IDENTIFIER_RE.match(name):
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=f"Invalid {label}: '{name}'. Must match ^[a-zA-Z_][a-zA-Z0-9_]{{0,62}}$",
        )
    return f'"{name}"'

def _safe_order(order: str) -> str:
    return "ASC" if not _SAFE_ORDER_RE.match(order) else order.upper()

# ============================================
# INFO ENDPOINT: Show API Usage
# ============================================

@router.get("/p/{slug}")
async def project_api_info(slug: str):
    """Public project info endpoint — no API key required"""
    try:
        result = await execute_on_main_db(
            """
            SELECT name, slug, status, created_at
            FROM projects
            WHERE slug = $1
            """,
            slug
        )
        if not result:
            raise HTTPException(status_code=404, detail=f"Project '{slug}' not found")
        
        project = dict(result[0])
        return {
            "project": project["name"],
            "slug": project["slug"],
            "status": project["status"],
            "api_url": f"https://api.zendbx.in/p/{project['slug']}",
            "docs": "https://docs.zendbx.in",
            "usage": {
                "list_rows":   f"GET  /p/{project['slug']}/{{table}}",
                "get_row":     f"GET  /p/{project['slug']}/{{table}}/{{id}}",
                "create_row":  f"POST /p/{project['slug']}/{{table}}",
                "update_row":  f"PUT  /p/{project['slug']}/{{table}}/{{id}}",
                "delete_row":  f"DELETE /p/{project['slug']}/{{table}}/{{id}}",
            },
            "auth": "Include 'apikey: <your-anon-key>' header for data access",
        }
    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))

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
    
    # Validate table name before any SQL use
    safe_table = _safe_ident(table_name, "table name")

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
    sort_raw  = request.query_params.get('sort', default_sort)
    order_raw = request.query_params.get('order', 'asc')

    safe_sort  = _safe_ident(sort_raw, "sort column")
    safe_order = _safe_order(order_raw)
    
    # Parse filters
    filters, operators = parse_filters(dict(request.query_params))
    
    try:
        # 🔒 SECURITY: Exclude password_hash for auth.users
        if table_name == "users" and api_key_data["database_name"] == "auth":
            # Safe columns for auth.users (show "Protected" placeholder for password_hash)
            select_columns = """
                id, email, username, 'Protected' as password_hash, provider, email_verified, is_active, 
                avatar_url, metadata, last_login_at, created_at, updated_at, project_id
            """
            query = f"SELECT {select_columns} FROM {safe_table}"
        else:
            # Build query — all identifiers are quoted and validated
            query = f"SELECT * FROM {safe_table}"
        
        conditions = []
        params = []
        param_count = 1
        
        # Add filters
        for column, value in filters.items():
            safe_col = _safe_ident(column, "filter column")
            operator = operators.get(column, 'eq')
            
            # Convert string booleans to actual booleans
            if isinstance(value, str) and value.lower() in ('true', 'false'):
                value = value.lower() == 'true'
            
            if operator == 'eq':
                conditions.append(f"{safe_col} = ${param_count}")
                params.append(value)
            elif operator == 'ne':
                conditions.append(f"{safe_col} != ${param_count}")
                params.append(value)
            elif operator == 'gt':
                conditions.append(f"{safe_col} > ${param_count}")
                params.append(value)
            elif operator == 'gte':
                conditions.append(f"{safe_col} >= ${param_count}")
                params.append(value)
            elif operator == 'lt':
                conditions.append(f"{safe_col} < ${param_count}")
                params.append(value)
            elif operator == 'lte':
                conditions.append(f"{safe_col} <= ${param_count}")
                params.append(value)
            elif operator == 'like':
                conditions.append(f"{safe_col} LIKE ${param_count}")
                params.append(f"%{value}%")
            elif operator == 'in':
                values = value.split(',')
                placeholders = [f"${param_count + i}" for i in range(len(values))]
                conditions.append(f"{safe_col} IN ({', '.join(placeholders)})")
                params.extend(values)
                param_count += len(values) - 1
            
            param_count += 1
        
        if conditions:
            query += " WHERE " + " AND ".join(conditions)
        
        # Validated sort and order
        query += f" ORDER BY {safe_sort} {safe_order}"
        
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
        safe_table = _safe_ident(table_name, "table name")
        
        # 🔒 SECURITY: Exclude password_hash for auth.users
        if table_name == "users" and api_key_data["database_name"] == "auth":
            # Safe columns for auth.users (show "Protected" placeholder for password_hash)
            select_columns = """
                id, email, username, 'Protected' as password_hash, provider, email_verified, is_active, 
                avatar_url, metadata, last_login_at, created_at, updated_at, project_id
            """
            query = f"SELECT {select_columns} FROM {safe_table} WHERE id = $1"
        else:
            query = f"SELECT * FROM {safe_table} WHERE id = $1"
        
        result = await execute_on_project_db(
            api_key_data["database_name"],
            query,
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
        safe_table = _safe_ident(table_name, "table name")
        columns = list(data.keys())
        safe_columns = [_safe_ident(c, "column name") for c in columns]
        placeholders = [f"${i+1}" for i in range(len(columns))]
        values = list(data.values())
        
        insert_sql = f"""
            INSERT INTO {safe_table} ({', '.join(safe_columns)})
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
        safe_table = _safe_ident(table_name, "table name")
        updates = [f"{_safe_ident(col, 'column name')} = ${i+1}" for i, col in enumerate(data.keys())]
        values = list(data.values())
        values.append(row_id)
        
        update_sql = f"""
            UPDATE {safe_table}
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
        safe_table = _safe_ident(table_name, "table name")
        result = await execute_on_project_db(
            api_key_data["database_name"],
            f"DELETE FROM {safe_table} WHERE id = $1 RETURNING id",
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
