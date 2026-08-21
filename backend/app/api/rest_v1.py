"""
Universal REST API (Supabase-style) - Slug-Based Routing
Pattern: /p/{project_slug}/v1/rest/{table}

RLS ENFORCEMENT:
- All queries respect PostgreSQL Row Level Security policies
- User context extracted from JWT token
- Service role can bypass RLS when needed

TYPE CONVERSION:
- Automatic PostgreSQL type mapping via PostgreSQLTypeMapper
- Converts Python values (dict/list) to correct PostgreSQL types
- Supports JSONB, arrays, UUID, dates, and all PostgreSQL types

AUTH TABLE PROTECTION:
- ZendBX Auth system tables are protected from direct CRUD
- Use auth endpoints instead: POST /p/{slug}/auth/signup, etc.

BULK INSERT SUPPORT:
- Single insert: POST with {"name": "John"} → returns single object
- Bulk insert: POST with [{"name": "John"}, {"name": "Jane"}] → returns array
- Bulk inserts are transactional (all or nothing)
- Both formats respect RLS, constraints, and security policies
"""
from fastapi import APIRouter, Request, HTTPException, Query, Depends
from typing import Optional, Dict, Any, List, Union
import logging
from uuid import UUID

from ..core.rls_enforcer import RLSEnforcer, get_rls_enforcer
from ..core.routes import Routes
from ..services.project_resolver import get_project_resolver
from ..core.db_router import get_main_db_pool
from ..middleware.rls_context import set_rls_context
from ..services.postgres_type_mapper import get_type_mapper
from ..core.auth_registry import (
    is_protected_auth_table,
    is_readonly_auth_table,
    resolve_virtual_schema,
    get_protection_message,
    filter_sensitive_fields
)

logger = logging.getLogger(__name__)

router = APIRouter(tags=["REST API"])


def check_auth_table_protection(
    schema_name: str,
    table_name: str,
    operation: str,
    project_schema: str
) -> None:
    """
    Check if operation on table is allowed
    
    Raises HTTPException if table is protected
    
    Args:
        schema_name: Schema name (may be virtual like "public")
        table_name: Table name
        operation: Operation type (SELECT, INSERT, UPDATE, DELETE)
        project_schema: Physical project schema name (e.g., proj_abc123)
    """
    # Resolve virtual schema to physical
    resolved_schema = resolve_virtual_schema(schema_name, project_schema)
    
    # Check if this is a protected auth table
    if is_protected_auth_table(resolved_schema, table_name):
        raise HTTPException(
            status_code=403,
            detail=get_protection_message(resolved_schema, table_name)
        )
    
    # Check if this is a read-only auth table and operation is write
    if operation in {'INSERT', 'UPDATE', 'DELETE'}:
        if is_readonly_auth_table(resolved_schema, table_name):
            raise HTTPException(
                status_code=403,
                detail=get_protection_message(resolved_schema, table_name)
            )


@router.post(Routes.REST_CREATE)
async def create_record(
    project_slug: str,
    table: str,
    data: Union[Dict[str, Any], List[Dict[str, Any]]],  # Accept both single and bulk
    request: Request,
    enforcer: RLSEnforcer = Depends(get_rls_enforcer)
):
    """
    Universal POST endpoint - creates record(s) in any table
    Uses project_slug (public identifier)
    
    Supports:
    - Single insert: {"name": "John"} → returns single object
    - Bulk insert: [{"name": "John"}, {"name": "Jane"}] → returns array
    
    Bulk inserts are atomic (all or nothing) and respect RLS policies
    
    RLS: Respects INSERT policies on the table
    """
    # Resolve project using slug
    pool = await get_main_db_pool()
    resolver = get_project_resolver()
    project = await resolver.resolve_project(project_slug, pool)
    project_id = project['id']
    
    # Get project database pool
    pool = request.state.project_db
    table_name = table
    
    # Get schema from enforcer or fall back to request.state directly
    schema = enforcer.schema or getattr(request.state, 'project_schema', None)
    
    # Determine if bulk or single insert
    is_bulk = isinstance(data, list)
    
    # Validate request payload
    if is_bulk:
        # Bulk insert validation
        if not data:
            raise HTTPException(
                status_code=400,
                detail="Bulk insert requires at least one record. Empty array not allowed."
            )
        
        # Validate all items are dictionaries
        for idx, item in enumerate(data):
            if not isinstance(item, dict):
                raise HTTPException(
                    status_code=422,
                    detail=f"Bulk insert item at index {idx} must be an object, got {type(item).__name__}"
                )
            if not item:
                raise HTTPException(
                    status_code=422,
                    detail=f"Bulk insert item at index {idx} cannot be an empty object"
                )
        
        records = data
        logger.info(f"POST /rest/v1/{table_name} (BULK: {len(records)} records) - Project: {project_id}, User: {enforcer.user_id}, Role: {enforcer.role}, Schema: {schema}")
    else:
        # Single insert validation
        if not isinstance(data, dict):
            raise HTTPException(
                status_code=422,
                detail=f"Single insert requires an object, got {type(data).__name__}"
            )
        if not data:
            raise HTTPException(
                status_code=422,
                detail="Insert requires at least one field. Empty object not allowed."
            )
        
        records = [data]
        logger.info(f"POST /rest/v1/{table_name} (SINGLE) - Project: {project_id}, User: {enforcer.user_id}, Role: {enforcer.role}, Schema: {schema}")
    
    try:
        # Parse schema.table notation (e.g. "auth.users" → schema=auth, table=users)
        if '.' in table_name:
            schema_part, bare_table = table_name.split('.', 1)
            qualified_table = f'"{schema_part}"."{bare_table}"'
        else:
            bare_table = table_name
            schema_part = schema
            qualified_table = f'"{schema}"."{bare_table}"' if schema else f'"{bare_table}"'

        # 🔒 SECURITY: Check auth table protection
        if not schema_part and schema:
            schema_part = schema
        if schema_part:
            check_auth_table_protection(schema_part, bare_table, 'INSERT', schema)

        # Initialize type mapper
        type_mapper = get_type_mapper(pool)
        
        # Use schema_part (from table name) or enforcer schema
        if not schema_part:
            if not schema:
                raise HTTPException(
                    status_code=400,
                    detail="Project schema is required. Table name must be qualified (schema.table) or project context must be set."
                )
            schema_part = schema
        
        # For bulk insert, collect all unique columns across all records
        # This allows heterogeneous records (different optional columns)
        all_columns = set()
        for record in records:
            all_columns.update(record.keys())
        
        all_columns = sorted(all_columns)  # Consistent order
        
        if not all_columns:
            raise HTTPException(
                status_code=422,
                detail="No columns provided for insert"
            )
        
        # Convert all records' values using PostgreSQL type mapper
        # Store as dict for safe column-to-value mapping
        converted_records = []
        for idx, record in enumerate(records):
            try:
                # Get column types for type conversion
                column_types = await type_mapper.get_column_types(bare_table, schema_part)
                
                # Convert each value and store in dict (not list)
                converted_dict = {}
                for column_name, value in record.items():
                    pg_type = column_types.get(column_name)
                    if pg_type:
                        converted_dict[column_name] = type_mapper.convert_value(value, pg_type)
                    else:
                        # Column not found in metadata - pass through as-is
                        converted_dict[column_name] = value
                
                converted_records.append(converted_dict)
            except Exception as e:
                raise HTTPException(
                    status_code=422,
                    detail=f"Type conversion failed for record {idx}: {str(e)}"
                )
        
        # Build multi-row INSERT query
        # Use consistent column order for all rows
        placeholders_list = []
        all_values = []
        value_idx = 1
        
        for converted_dict in converted_records:
            # For this record, build placeholders matching all_columns
            # Use NULL for missing columns
            record_placeholders = []
            for col in all_columns:
                if col in converted_dict:
                    record_placeholders.append(f"${value_idx}")
                    # Safe: get converted value by column name from dict
                    all_values.append(converted_dict[col])
                    value_idx += 1
                else:
                    # Column not in this record, use NULL
                    record_placeholders.append("NULL")
            
            placeholders_list.append(f"({', '.join(record_placeholders)})")
        
        # Build final INSERT query
        query = f"""
            INSERT INTO {qualified_table} ({', '.join(f'"{c}"' for c in all_columns)})
            VALUES {', '.join(placeholders_list)}
            RETURNING *
        """
        
        logger.info(f"🔍 Bulk INSERT: {len(records)} record(s), {len(all_columns)} column(s), {len(all_values)} value(s)")
        logger.info(f"🔍 Columns: {all_columns}")

        # Execute INSERT with RLS enforcement
        # Use execute() for bulk to get all rows
        results = await enforcer.execute(pool, query, *all_values)
        
        if not results:
            raise HTTPException(
                status_code=403,
                detail="Insert blocked by row level security policy"
            )
        
        # Verify all records were inserted
        if len(results) != len(records):
            logger.error(f"❌ Bulk insert mismatch: expected {len(records)}, got {len(results)}")
            raise HTTPException(
                status_code=500,
                detail=f"Bulk insert partial failure: {len(results)} of {len(records)} records inserted"
            )
        
        logger.info(f"✅ {len(results)} record(s) created in {table_name}")
        
        # Filter sensitive fields from all results
        filtered_results = [filter_sensitive_fields(dict(r), schema_part) for r in results]
        
        # Return format matches request format
        if is_bulk:
            return filtered_results
        else:
            return filtered_results[0]
        
    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Error creating record(s) in {table_name}: {str(e)}")
        raise HTTPException(status_code=500, detail=str(e))


@router.get(Routes.REST_LIST)
async def get_records(
    project_slug: str,
    table: str,
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
    Uses project_slug (public identifier)
    Supports Supabase-style query parameters
    
    RLS: Respects SELECT policies on the table
    """
    # Resolve project using slug
    pool = await get_main_db_pool()
    resolver = get_project_resolver()
    project = await resolver.resolve_project(project_slug, pool)
    project_id = project['id']
    
    # Get project database pool
    pool = request.state.project_db
    table_name = table
    
    # Get schema
    schema = enforcer.schema or getattr(request.state, 'project_schema', None)
    
    logger.info(f"GET /rest/v1/{table_name} - Project: {project_id}, User: {enforcer.user_id}, Role: {enforcer.role}")
    
    # Debug logging for schema resolution
    logger.info(f"🔍 SCHEMA RESOLUTION DEBUG:")
    logger.info(f"   enforcer.schema: {enforcer.schema}")
    logger.info(f"   request.state.project_schema: {getattr(request.state, 'project_schema', 'NOT SET')}")
    logger.info(f"   table parameter: {table_name}")
    
    try:
        # Parse schema.table notation ONCE
        if '.' in table_name:
            schema_part, bare_table = table_name.split('.', 1)
            qualified_table = f'"{schema_part}"."{bare_table}"'
            logger.info(f"✅ Qualified table name detected: schema={schema_part}, table={bare_table}")
        else:
            bare_table = table_name
            schema_part = schema  # Use enforcer schema
            
            if not schema_part:
                logger.error(f"❌ CRITICAL: Project schema is NULL/None")
                logger.error(f"   enforcer.schema: {enforcer.schema}")
                logger.error(f"   request.state has project_schema: {hasattr(request.state, 'project_schema')}")
                raise HTTPException(
                    status_code=500,
                    detail="Project schema could not be resolved. Check project context middleware."
                )
            
            qualified_table = f'"{schema_part}"."{bare_table}"'
            logger.info(f"✅ Unqualified table resolved: schema={schema_part}, table={bare_table}")

        logger.info(f"   Final qualified_table: {qualified_table}")
        
        # 🔒 SECURITY: Check auth table protection
        check_auth_table_protection(schema_part, bare_table, 'SELECT', schema)

        # Initialize type mapper for filter type conversion
        type_mapper = get_type_mapper(pool)
        column_types = await type_mapper.get_column_types(bare_table, schema_part)

        # Build WHERE conditions from ALL query params (Supabase-style)
        where_parts = []
        params = []
        param_idx = 1
        skip_keys = {'select', 'limit', 'offset', 'order'}

        logger.info(f"🔍 FILTER PARSING DEBUG:")
        for key, val in request.query_params.items():
            if key in skip_keys:
                continue
            
            # Parse operator prefix (eq., neq., gt., gte., lt., lte., in., contains., match., not.)
            operator = '='
            actual_val = val
            
            if val.startswith('eq.'):
                operator = '='
                actual_val = val[3:]
            elif val.startswith('neq.'):
                operator = '!='
                actual_val = val[4:]
            elif val.startswith('gt.'):
                operator = '>'
                actual_val = val[3:]
            elif val.startswith('gte.'):
                operator = '>='
                actual_val = val[4:]
            elif val.startswith('lt.'):
                operator = '<'
                actual_val = val[3:]
            elif val.startswith('lte.'):
                operator = '<='
                actual_val = val[4:]
            elif val.startswith('in.'):
                operator = 'IN'
                actual_val = val[3:]
                # Parse comma-separated list for IN operator
                if '(' in actual_val and ')' in actual_val:
                    actual_val = actual_val.strip('()')
                actual_val = tuple(v.strip() for v in actual_val.split(','))
            elif val.startswith('contains.'):
                operator = 'LIKE'
                actual_val = f"%{val[9:]}%"
            elif val.startswith('match.'):
                operator = '~'  # PostgreSQL regex match
                actual_val = val[6:]
            elif val.startswith('not.'):
                operator = '!='
                actual_val = val[4:]
            
            # Convert value to proper PostgreSQL type
            pg_type = column_types.get(key)
            if pg_type:
                if operator == 'IN' and isinstance(actual_val, tuple):
                    # Convert each value in the tuple
                    converted_val = tuple(type_mapper.convert_value(v, pg_type) for v in actual_val)
                else:
                    converted_val = type_mapper.convert_value(actual_val, pg_type)
            else:
                converted_val = actual_val
            
            logger.info(f"   Filter: {key} {operator} {actual_val} (type={pg_type}, converted={converted_val}, python_type={type(converted_val).__name__})")
            
            # Build WHERE clause
            if operator == 'IN':
                placeholders = ', '.join(f'${param_idx + i}' for i in range(len(converted_val)))
                where_parts.append(f'"{key}" IN ({placeholders})')
                params.extend(converted_val)
                param_idx += len(converted_val)
            else:
                where_parts.append(f'"{key}" {operator} ${param_idx}')
                params.append(converted_val)
                param_idx += 1

        # Validate and sanitize SELECT columns
        if select != "*":
            # Split columns and trim whitespace
            columns = [col.strip() for col in select.split(',')]
            # Quote each column identifier
            select = ', '.join(f'"{col}"' for col in columns if col)
        
        query = f"SELECT {select} FROM {qualified_table}"
        if where_parts:
            query += " WHERE " + " AND ".join(where_parts)

        # Fix ORDER BY - properly quote column identifier
        if order:
            if "." in order:
                col, direction = order.split(".", 1)
                query += f' ORDER BY "{col}" {direction.upper()}'
            else:
                query += f' ORDER BY "{order}"'

        query += f" LIMIT {limit} OFFSET {offset}"

        logger.info(f"🔍 GENERATED SQL: {query}")
        logger.info(f"🔍 BOUND PARAMS: {params} (types: {[type(p).__name__ for p in params]})")

        records = await enforcer.execute(pool, query, *params)
        result = [dict(r) for r in records]

        logger.info(f"Retrieved {len(result)} records from {table_name}")
        return result
        
    except HTTPException:
        raise
    except Exception as e:
        error_msg = str(e)
        # Table doesn't exist — return empty array instead of 500
        if 'does not exist' in error_msg or 'relation' in error_msg:
            logger.info(f"Table '{table_name}' not found, returning empty array")
            return []
        logger.error(f"Error retrieving records from {table_name}: {error_msg}")
        raise HTTPException(status_code=500, detail=error_msg)


@router.patch(Routes.REST_UPDATE)
async def update_record(
    project_slug: str,
    table: str,
    data: Dict[str, Any],
    request: Request,
    enforcer: RLSEnforcer = Depends(get_rls_enforcer),
    id: Optional[str] = Query(None, description="Filter by ID (eq.{uuid})"),
    user_id: Optional[str] = Query(None, description="Filter by user_id (eq.{uuid})")
):
    """
    Universal PATCH endpoint - updates records in any table
    Uses project_slug (public identifier)
    Supports filtering by id or user_id
    RLS: Respects UPDATE policies on the table
    """
    # Resolve project using slug
    pool = await get_main_db_pool()
    resolver = get_project_resolver()
    project = await resolver.resolve_project(project_slug, pool)
    project_id = project['id']
    
    # Get project database pool
    pool = request.state.project_db
    table_name = table
    
    logger.info(f"PATCH /rest/v1/{table_name} - Project: {project_id}, User: {enforcer.user_id}, Role: {enforcer.role}")
    
    if not id and not user_id:
        raise HTTPException(status_code=400, detail="Missing filter parameter (id or user_id required)")
    
    try:
        # Parse schema.table notation
        schema = enforcer.schema or getattr(request.state, 'project_schema', None)
        if '.' in table_name:
            schema_part, bare_table = table_name.split('.', 1)
            qualified_table = f'"{schema_part}"."{bare_table}"'
            bare_table_name = bare_table
        else:
            qualified_table = f'"{schema}"."{table_name}"' if schema else f'"{table_name}"'
            bare_table_name = table_name
            schema_part = schema

        # Determine filter
        if id:
            filter_col = "id"
            filter_val_raw = id[3:] if id.startswith("eq.") else id
        else:
            filter_col = "user_id"
            filter_val_raw = user_id[3:] if user_id.startswith("eq.") else user_id
        
        # Initialize type mapper
        type_mapper = get_type_mapper(pool)
        
        # 🔧 FIX: Use schema_part (from table name) or enforcer schema, never fallback to 'public'
        if not schema_part:
            if not schema:
                raise HTTPException(
                    status_code=400,
                    detail="Project schema is required. Table name must be qualified (schema.table) or project context must be set."
                )
            schema_part = schema
        
        # Get column types for type conversion
        column_types = await type_mapper.get_column_types(bare_table_name, schema_part)
        
        # Convert filter value to proper type
        filter_col_type = column_types.get(filter_col)
        if filter_col_type:
            filter_val = type_mapper.convert_value(filter_val_raw, filter_col_type)
            logger.info(f"🔍 UPDATE FILTER: {filter_col} = {filter_val_raw} → {filter_val} (type={filter_col_type}, python_type={type(filter_val).__name__})")
        else:
            filter_val = filter_val_raw
            logger.info(f"⚠️ UPDATE FILTER: {filter_col} type unknown, using raw value {filter_val_raw}")
        
        # Convert data values using PostgreSQL type mapper
        converted_data = await type_mapper.convert_dict(
            table_name=bare_table_name,
            data=data,
            schema=schema_part
        )
        
        # Build SET clause with converted values
        set_parts = []
        values = [filter_val]
        
        for i, (key, value) in enumerate(converted_data.items(), start=2):
            if key in (filter_col,):  # skip the filter column itself
                continue
            set_parts.append(f"{key} = ${i}")
            values.append(value)
        
        if not set_parts:
            raise HTTPException(status_code=400, detail="No fields to update")
        
        # Only add updated_at if column exists in THIS project's schema
        # CRITICAL: Must check project schema to prevent cross-project false positives
        async with pool.acquire() as conn:
            has_updated_at = await conn.fetchval("""
                SELECT EXISTS (
                    SELECT 1 FROM information_schema.columns
                    WHERE table_schema = $1 
                      AND table_name = $2 
                      AND column_name = 'updated_at'
                )
            """, schema, bare_table_name)
        
        if has_updated_at:
            set_parts.append("updated_at = NOW()")
        
        query = f"""
            UPDATE {qualified_table}
            SET {', '.join(set_parts)}
            WHERE {filter_col} = $1
            RETURNING *
        """
        
        # Execute update with RLS enforcement
        result = await enforcer.execute_one(pool, query, *values)
        
        if not result:
            raise HTTPException(
                status_code=404,
                detail="Record not found or update blocked by row level security policy"
            )
        
        logger.info(f"Record updated in {qualified_table}: {filter_val}")
        return dict(result)
        
    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Error updating record in {table_name}: {str(e)}")
        raise HTTPException(status_code=500, detail=str(e))


@router.delete(Routes.REST_DELETE)
async def delete_record(
    project_slug: str,
    table: str,
    request: Request,
    enforcer: RLSEnforcer = Depends(get_rls_enforcer),
    id: Optional[str] = Query(None, description="Filter by ID (eq.{uuid})")
):
    """
    Universal DELETE endpoint - deletes a record from any table
    Uses project_slug (public identifier)
    
    RLS: Respects DELETE policies on the table
    """
    # Resolve project using slug
    pool = await get_main_db_pool()
    resolver = get_project_resolver()
    project = await resolver.resolve_project(project_slug, pool)
    project_id = project['id']
    
    # Get project database pool
    pool = request.state.project_db
    table_name = table
    
    logger.info(f"DELETE /rest/v1/{table_name} - Project: {project_id}, User: {enforcer.user_id}, Role: {enforcer.role}")
    
    if not id:
        raise HTTPException(status_code=400, detail="Missing id parameter")
    
    try:
        # Parse schema.table notation
        schema = enforcer.schema or getattr(request.state, 'project_schema', None)
        if '.' in table_name:
            schema_part, bare_table = table_name.split('.', 1)
            qualified_table = f'"{schema_part}"."{bare_table}"'
        else:
            bare_table = table_name
            schema_part = schema
            qualified_table = f'"{schema}"."{table_name}"' if schema else f'"{table_name}"'

        # Parse ID
        id_value_raw = id[3:] if id.startswith("eq.") else id
        
        # Initialize type mapper for id type conversion
        type_mapper = get_type_mapper(pool)
        column_types = await type_mapper.get_column_types(bare_table, schema_part)
        
        # Convert id value to proper type
        id_col_type = column_types.get('id')
        if id_col_type:
            id_value = type_mapper.convert_value(id_value_raw, id_col_type)
            logger.info(f"🔍 DELETE FILTER: id = {id_value_raw} → {id_value} (type={id_col_type}, python_type={type(id_value).__name__})")
        else:
            id_value = id_value_raw
            logger.info(f"⚠️ DELETE FILTER: id type unknown, using raw value {id_value_raw}")
        
        # Execute delete with RLS enforcement
        result = await enforcer.execute_command(
            pool,
            f"DELETE FROM {qualified_table} WHERE id = $1",
            id_value
        )
        
        if result == "DELETE 0":
            raise HTTPException(
                status_code=404,
                detail="Record not found or delete blocked by row level security policy"
            )
        
        logger.info(f"Record deleted from {qualified_table}: {id_value}")
        return {"message": "Record deleted successfully", "id": id_value}
        
    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Error deleting record from {table_name}: {str(e)}")
        raise HTTPException(status_code=500, detail=str(e))
