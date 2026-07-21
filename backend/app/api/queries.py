from fastapi import APIRouter, HTTPException, Depends, status
from app.models.schemas import (
    QueryExecute, QueryResult, QueryHistoryResponse,
    SavedQueryCreate, SavedQueryUpdate, SavedQueryResponse,
    MessageResponse
)
from app.api.auth import get_current_user
from app.core.database import execute_on_main_db, execute_on_project_db
from app.services.sql_autofix_service_v2 import sql_autofix_v2 as sql_autofix
from typing import List
from uuid import UUID
import time
import re

router = APIRouter()

# Maximum SQL query length to store in database (to avoid asyncpg parameter limits)
MAX_SQL_QUERY_LENGTH = 50000  # 50KB should be reasonable


def truncate_sql_for_storage(sql: str) -> tuple[str, bool]:
    """
    Truncate SQL query if it exceeds maximum storage length.
    
    Args:
        sql: The SQL query string
        
    Returns:
        tuple: (truncated_sql, was_truncated)
    """
    if sql is None:
        return None, False
        
    if len(sql) <= MAX_SQL_QUERY_LENGTH:
        return sql, False
    
    # Truncate and add indicator
    truncated = sql[:MAX_SQL_QUERY_LENGTH] + "\n\n-- [TRUNCATED: Query too long for storage]"
    return truncated, True

# ============================================
# HELPER: Get Project Schema for Auto-Fix
# ============================================

async def get_project_schema(project_id: UUID) -> dict:
    """Get project schema for auto-fix service"""
    try:
        # Get table schemas from user_tables
        result = await execute_on_main_db(
            """
            SELECT table_name, schema_definition
            FROM user_tables
            WHERE project_id = $1
            """,
            project_id
        )
        
        tables = {}
        for row in result:
            table_name = row["table_name"]
            schema_def = row["schema_definition"]
            
            # Handle both string and dict formats
            if isinstance(schema_def, str):
                try:
                    import json
                    schema_def = json.loads(schema_def)
                except (json.JSONDecodeError, TypeError):
                    schema_def = {}
            elif schema_def is None:
                schema_def = {}
            
            tables[table_name] = {
                "columns": schema_def.get("columns", []) if isinstance(schema_def, dict) else []
            }
        
        return {"tables": tables}
    except Exception:
        # If user_tables doesn't exist or has issues, return empty schema
        return {"tables": {}}

# ============================================
# HELPER: Verify Project Ownership
# ============================================

async def verify_project_access(project_id: UUID, user_id: UUID) -> dict:
    """Verify user has access to project"""
    result = await execute_on_main_db(
        "SELECT * FROM projects WHERE id = $1 AND user_id = $2",
        project_id,
        user_id
    )
    
    if not result:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Project not found"
        )
    
    return dict(result[0])

# ============================================
# HELPER: Validate SQL Query
# ============================================

def validate_sql_query(sql: str) -> tuple[bool, str]:
    """Validate SQL query for security - allows multiple statements"""
    
    if not sql or not sql.strip():
        return False, "Empty query"
    
    # Remove comments but preserve the original structure for validation
    lines = sql.split('\n')
    cleaned_lines = []
    has_sql_content = False
    
    for line in lines:
        original_line = line
        # Remove single-line comments but keep the line structure
        if '--' in line:
            line = line.split('--')[0]
        line = line.strip()
        if line:
            cleaned_lines.append(line)
            has_sql_content = True
        elif original_line.strip().startswith('--'):
            # Keep comment lines for structure but don't count as SQL content
            cleaned_lines.append('')
    
    if not has_sql_content:
        return False, "No SQL statements found (only comments)"
    
    cleaned_sql = ' '.join(cleaned_lines).strip()
    
    if not cleaned_sql:
        return False, "Empty query after removing comments"
    
    sql_upper = cleaned_sql.upper()
    
    # 🔒 SECURITY: Block direct access to auth schema tables
    # Auth tables contain sensitive multi-tenant data and MUST be accessed via Auth API only
    auth_table_patterns = [
        'FROM AUTH.USERS',
        'FROM "AUTH"."USERS"',
        'JOIN AUTH.USERS',
        'JOIN "AUTH"."USERS"',
        'INTO AUTH.USERS',
        'INTO "AUTH"."USERS"',
        'UPDATE AUTH.USERS',
        'UPDATE "AUTH"."USERS"',
        'DELETE FROM AUTH.USERS',
        'DELETE FROM "AUTH"."USERS"',
        'FROM AUTH.SESSIONS',
        'FROM "AUTH"."SESSIONS"',
        'FROM AUTH.REFRESH_TOKENS',
        'FROM "AUTH"."REFRESH_TOKENS"',
        'FROM AUTH.IDENTITIES',
        'FROM "AUTH"."IDENTITIES"',
        'FROM AUTH.PASSWORD_RESET_TOKENS',
        'FROM "AUTH"."PASSWORD_RESET_TOKENS"'
    ]
    
    for pattern in auth_table_patterns:
        if pattern in sql_upper:
            return False, (
                "Direct SQL access to auth schema tables is not allowed for security reasons. "
                "Auth tables contain sensitive multi-tenant authentication data. "
                "Use the Auth API endpoints instead: POST /p/{slug}/v1/auth/signup, etc."
            )
    
    # Block dangerous operations
    dangerous_keywords = [
        'DROP DATABASE',
        'CREATE DATABASE',
        'DROP USER',
        'CREATE USER',
        'ALTER USER',
        'GRANT',
        'REVOKE',
        'DROP SCHEMA'
        # Note: CREATE SCHEMA is allowed for RLS setup
    ]
    
    for keyword in dangerous_keywords:
        if keyword in sql_upper:
            return False, f"Operation '{keyword}' is not allowed"
    
    return True, ""

# ============================================
# EXECUTE QUERY
# ============================================

@router.post("/{project_id}/query", response_model=QueryResult)
async def execute_query(
    project_id: UUID,
    query_data: QueryExecute,
    current_user: dict = Depends(get_current_user)
):
    """Execute SQL query on project database - supports multiple statements with AUTO-FIX"""
    
    project = await verify_project_access(project_id, current_user["id"])
    
    # Validate query
    is_valid, error_msg = validate_sql_query(query_data.sql)
    if not is_valid:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=error_msg
        )
    
    start_time = time.time()
    logs = []
    original_sql = query_data.sql
    current_sql = query_data.sql
    auto_fixed = False
    
    # Detect if this is a DDL operation that should trigger metadata refresh
    ddl_operations = ['CREATE TABLE', 'ALTER TABLE', 'DROP TABLE', 'CREATE INDEX', 
                      'DROP INDEX', 'CREATE SCHEMA', 'DROP SCHEMA']
    sql_upper = current_sql.upper()
    is_ddl_operation = any(op in sql_upper for op in ddl_operations)
    
    try:
        # Execute query using ISOLATED PROJECT POOL (Phase 5.0)
        result = await execute_on_project_db(
            project_id,  # PHASE 5.0: Pass project_id for credential lookup
            project["database_name"],
            current_sql
        )
        
        execution_time_ms = int((time.time() - start_time) * 1000)
        
        # Handle both dict response (multi-statement with logs) and list response (single statement)
        if isinstance(result, dict):
            rows_data = result.get('result', [])
            logs = result.get('logs', [])
        else:
            rows_data = result
            # Generate log for single statement
            logs = [{
                'statement': current_sql[:100] + ('...' if len(current_sql) > 100 else ''),
                'status': 'success',
                'message': f'Query executed successfully. {len(rows_data)} rows returned.',
                'rows_affected': len(rows_data),
                'execution_time_ms': execution_time_ms
            }]
        
        # Convert to list of dicts and handle special types
        rows = []
        if rows_data:
            for row in rows_data:
                row_dict = dict(row)
                # Convert IPv4Address/IPv6Address to strings for JSON serialization
                for key, value in row_dict.items():
                    if hasattr(value, '__class__') and value.__class__.__name__ in ['IPv4Address', 'IPv6Address', 'IPv4Network', 'IPv6Network']:
                        row_dict[key] = str(value)
                rows.append(row_dict)
        columns = list(rows[0].keys()) if rows else []
        
        # Log query history
        await execute_on_main_db(
            """
            INSERT INTO query_history 
            (user_id, project_id, question, sql_query, status, execution_time_ms, rows_returned)
            VALUES ($1, $2, $3, $4, $5, $6, $7)
            """,
            current_user["id"],
            project_id,
            query_data.question,
            current_sql,  # Log the final SQL (potentially auto-fixed)
            "success",
            execution_time_ms,
            len(rows)
        )
        
        # Add auto-fix info to response if query was fixed
        result_data = QueryResult(
            columns=columns,
            rows=rows,
            row_count=len(rows),
            execution_time_ms=execution_time_ms,
            logs=logs
        )
        
        # Add auto-fix metadata if applicable
        if auto_fixed:
            # Add auto-fix log entry
            logs.append({
                'statement': 'AUTO-FIX',
                'status': 'info',
                'message': f'✅ Query auto-fixed: {original_sql[:50]}... → {current_sql[:50]}...',
                'rows_affected': 0,
                'execution_time_ms': 0
            })
            result_data.logs = logs
            # Set auto-fix metadata
            result_data.auto_fixed = True
            result_data.original_sql = original_sql
            result_data.fixed_sql = current_sql
        
        # Add metadata_refresh flag if this was a DDL operation
        if is_ddl_operation:
            result_data.metadata_refresh = True
        
        return result_data
        
    except Exception as e:
        error_message = str(e)
        
        # 🚀 AUTO-FIX ATTEMPT - Try to fix the SQL automatically
        # Only attempt auto-fix if enabled and there's a real error (not success)
        if query_data.enable_autofix and not auto_fixed and error_message and "successfully" not in error_message.lower():  # Only try auto-fix once and on real errors
            try:
                print(f"🔧 AUTO-FIX: Attempting to fix SQL error...")
                print(f"   Original SQL (first 200 chars): {current_sql[:200]}...")
                print(f"   Error: {error_message}")
                print(f"   SQL Length: {len(current_sql)} characters")
                
                # Get project schema for context
                schema = await get_project_schema(project_id)
                print(f"   Schema: {len(schema.get('tables', {}))} tables available")
                
                # Attempt auto-fix
                fixed_sql = await sql_autofix.auto_fix_sql(
                    sql=current_sql,
                    error_message=error_message,
                    schema=schema
                )
                
                print(f"   Auto-fix result: {'SUCCESS' if fixed_sql else 'NO FIX FOUND'}")
                if fixed_sql:
                    print(f"   Fixed SQL (first 200 chars): {fixed_sql[:200]}...")
                
                if fixed_sql and fixed_sql != current_sql:
                    print(f"✅ AUTO-FIX: Attempting to execute fixed SQL...")
                    print(f"   Fixed SQL length: {len(fixed_sql)}")
                    
                    # Validate the fixed SQL before executing
                    is_valid_fixed, validation_error = validate_sql_query(fixed_sql)
                    print(f"   Fixed SQL validation: {'✅ PASS' if is_valid_fixed else '❌ FAIL'}")
                    if not is_valid_fixed:
                        print(f"   Validation error: {validation_error}")
                        # Continue with original error instead of auto-fix
                        pass
                    else:
                        # Try executing the fixed SQL
                        try:
                            auto_fix_start = time.time()
                            result = await execute_on_project_db(
                                project_id,  # PHASE 5.0
                                project["database_name"],
                                fixed_sql
                            )
                            
                            auto_fix_time = int((time.time() - auto_fix_start) * 1000)
                            total_time = int((time.time() - start_time) * 1000)
                            
                            # SUCCESS! Auto-fix worked
                            if isinstance(result, dict):
                                rows_data = result.get('result', [])
                                logs = result.get('logs', [])
                            else:
                                rows_data = result
                                logs = []
                            
                            # Convert to list of dicts and handle special types
                            rows = []
                            if rows_data:
                                for row in rows_data:
                                    row_dict = dict(row)
                                    # Convert IPv4Address/IPv6Address to strings for JSON serialization
                                    for key, value in row_dict.items():
                                        if hasattr(value, '__class__') and value.__class__.__name__ in ['IPv4Address', 'IPv6Address', 'IPv4Network', 'IPv6Network']:
                                            row_dict[key] = str(value)
                                    rows.append(row_dict)
                            columns = list(rows[0].keys()) if rows else []
                            
                            # Add auto-fix success log
                            logs.append({
                                'statement': 'AUTO-FIX SUCCESS',
                                'status': 'success',
                                'message': f'✅ SQL auto-fixed and executed successfully!',
                                'rows_affected': len(rows),
                                'execution_time_ms': auto_fix_time
                            })
                            
                            # Log successful auto-fix
                            await execute_on_main_db(
                                """
                                INSERT INTO query_history 
                                (user_id, project_id, question, sql_query, status, execution_time_ms, rows_returned, error_message)
                                VALUES ($1, $2, $3, $4, $5, $6, $7, $8)
                                """,
                                current_user["id"],
                                project_id,
                                query_data.question,
                                fixed_sql,
                                "auto_fixed",
                                total_time,
                                len(rows),
                                f"Original error: {error_message}"
                                )
                            
                            return QueryResult(
                                columns=columns,
                                rows=rows,
                                row_count=len(rows),
                                execution_time_ms=total_time,
                                logs=logs,
                                # Add metadata about the fix
                                auto_fixed=True,
                                original_sql=original_sql,
                                fixed_sql=fixed_sql
                            )
                            
                        except Exception as fix_error:
                            # Auto-fix failed to execute, but still show what was attempted
                            print(f"❌ AUTO-FIX: Fixed SQL failed to execute: {str(fix_error)}")
                            
                            # Still log the attempt and show the auto-fix UI
                            await execute_on_main_db(
                                """
                                INSERT INTO query_history 
                                (user_id, project_id, question, sql_query, status, execution_time_ms, rows_returned, error_message)
                                VALUES ($1, $2, $3, $4, $5, $6, $7, $8)
                                """,
                                current_user["id"],
                                project_id,
                                query_data.question,
                                fixed_sql,
                                "auto_fix_failed",
                                int((time.time() - start_time) * 1000),
                                0,
                                f"Auto-fix attempted but failed: {str(fix_error)}"
                            )
                            
                            # Show the auto-fix attempt even if it failed
                            return QueryResult(
                                columns=[],
                                rows=[],
                                row_count=0,
                                execution_time_ms=int((time.time() - start_time) * 1000),
                                logs=[{
                                    'statement': 'AUTO-FIX ATTEMPT',
                                    'status': 'warning',
                                    'message': f'⚠️ Auto-fix attempted but the fixed query still has errors: {str(fix_error)}',
                                    'rows_affected': 0,
                                    'execution_time_ms': 0
                                }],
                                # Show the auto-fix attempt
                                auto_fixed=True,
                                original_sql=original_sql,
                                fixed_sql=fixed_sql
                            )
                else:
                    print(f"❌ AUTO-FIX: No fix found or same SQL returned")
                
            except Exception as autofix_error:
                # Auto-fix service failed, continue with original error
                print(f"❌ AUTO-FIX: Service failed: {str(autofix_error)}")
                pass
        
        # Original error handling (auto-fix failed or not attempted)
        execution_time_ms = int((time.time() - start_time) * 1000)
        
        # Log failed query
        await execute_on_main_db(
            """
            INSERT INTO query_history 
            (user_id, project_id, question, sql_query, status, execution_time_ms, error_message)
            VALUES ($1, $2, $3, $4, $5, $6, $7)
            """,
            current_user["id"],
            project_id,
            query_data.question,
            current_sql,
            "failed",
            execution_time_ms,
            error_message
        )
        
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=f"Query execution failed: {error_message}"
        )

# ============================================
# GET QUERY HISTORY
# ============================================

@router.get("/{project_id}/query/history", response_model=List[QueryHistoryResponse])
async def get_query_history(
    project_id: UUID,
    limit: int = 50,
    current_user: dict = Depends(get_current_user)
):
    """Get query history for project"""
    
    await verify_project_access(project_id, current_user["id"])
    
    result = await execute_on_main_db(
        """
        SELECT id, question, sql_query, status, execution_time_ms, 
               rows_returned, error_message, created_at
        FROM query_history
        WHERE project_id = $1 AND user_id = $2
        ORDER BY created_at DESC
        LIMIT $3
        """,
        project_id,
        current_user["id"],
        limit
    )
    
    return [QueryHistoryResponse(**dict(row)) for row in result]

# ============================================
# SAVE QUERY
# ============================================

@router.post("/{project_id}/query/save", response_model=SavedQueryResponse, status_code=status.HTTP_201_CREATED)
async def save_query(
    project_id: UUID,
    query_data: SavedQueryCreate,
    current_user: dict = Depends(get_current_user)
):
    """Save a query for later use"""
    
    await verify_project_access(project_id, current_user["id"])
    
    result = await execute_on_main_db(
        """
        INSERT INTO saved_queries 
        (user_id, project_id, name, description, question, sql_query, tags)
        VALUES ($1, $2, $3, $4, $5, $6, $7)
        RETURNING id, user_id, project_id, name, description, question, 
                  sql_query, tags, is_favorite, run_count, created_at, updated_at
        """,
        current_user["id"],
        project_id,
        query_data.name,
        query_data.description,
        query_data.question,
        query_data.sql_query,
        query_data.tags or []
    )
    
    return SavedQueryResponse(**dict(result[0]))

# ============================================
# LIST SAVED QUERIES
# ============================================

@router.get("/{project_id}/query/saved", response_model=List[SavedQueryResponse])
async def list_saved_queries(
    project_id: UUID,
    current_user: dict = Depends(get_current_user)
):
    """List all saved queries for project"""
    
    await verify_project_access(project_id, current_user["id"])
    
    result = await execute_on_main_db(
        """
        SELECT id, user_id, project_id, name, description, question, 
               sql_query, tags, is_favorite, run_count, created_at, updated_at
        FROM saved_queries
        WHERE project_id = $1 AND user_id = $2
        ORDER BY is_favorite DESC, updated_at DESC
        """,
        project_id,
        current_user["id"]
    )
    
    return [SavedQueryResponse(**dict(row)) for row in result]

# ============================================
# GET SAVED QUERY
# ============================================

@router.get("/{project_id}/query/saved/{query_id}", response_model=SavedQueryResponse)
async def get_saved_query(
    project_id: UUID,
    query_id: UUID,
    current_user: dict = Depends(get_current_user)
):
    """Get a specific saved query"""
    
    await verify_project_access(project_id, current_user["id"])
    
    result = await execute_on_main_db(
        """
        SELECT id, user_id, project_id, name, description, question, 
               sql_query, tags, is_favorite, run_count, created_at, updated_at
        FROM saved_queries
        WHERE id = $1 AND project_id = $2 AND user_id = $3
        """,
        query_id,
        project_id,
        current_user["id"]
    )
    
    if not result:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Saved query not found"
        )
    
    return SavedQueryResponse(**dict(result[0]))

# ============================================
# UPDATE SAVED QUERY
# ============================================

@router.put("/{project_id}/query/saved/{query_id}", response_model=SavedQueryResponse)
async def update_saved_query(
    project_id: UUID,
    query_id: UUID,
    update_data: SavedQueryUpdate,
    current_user: dict = Depends(get_current_user)
):
    """Update a saved query"""
    
    await verify_project_access(project_id, current_user["id"])
    
    # Check if query exists
    existing = await execute_on_main_db(
        "SELECT id FROM saved_queries WHERE id = $1 AND project_id = $2 AND user_id = $3",
        query_id,
        project_id,
        current_user["id"]
    )
    
    if not existing:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Saved query not found"
        )
    
    # Build update query
    updates = []
    values = []
    param_count = 1
    
    if update_data.name is not None:
        updates.append(f"name = ${param_count}")
        values.append(update_data.name)
        param_count += 1
    
    if update_data.description is not None:
        updates.append(f"description = ${param_count}")
        values.append(update_data.description)
        param_count += 1
    
    if update_data.tags is not None:
        updates.append(f"tags = ${param_count}")
        values.append(update_data.tags)
        param_count += 1
    
    if update_data.is_favorite is not None:
        updates.append(f"is_favorite = ${param_count}")
        values.append(update_data.is_favorite)
        param_count += 1
    
    if not updates:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="No fields to update"
        )
    
    values.append(query_id)
    
    query = f"""
        UPDATE saved_queries 
        SET {', '.join(updates)}, updated_at = NOW()
        WHERE id = ${param_count}
        RETURNING id, user_id, project_id, name, description, question, 
                  sql_query, tags, is_favorite, run_count, created_at, updated_at
    """
    
    result = await execute_on_main_db(query, *values)
    
    return SavedQueryResponse(**dict(result[0]))

# ============================================
# DELETE SAVED QUERY
# ============================================

@router.delete("/{project_id}/query/saved/{query_id}", response_model=MessageResponse)
async def delete_saved_query(
    project_id: UUID,
    query_id: UUID,
    current_user: dict = Depends(get_current_user)
):
    """Delete a saved query"""
    
    await verify_project_access(project_id, current_user["id"])
    
    result = await execute_on_main_db(
        "DELETE FROM saved_queries WHERE id = $1 AND project_id = $2 AND user_id = $3 RETURNING id",
        query_id,
        project_id,
        current_user["id"]
    )
    
    if not result:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Saved query not found"
        )
    
    return MessageResponse(
        message="Query deleted successfully",
        success=True
    )

# ============================================
# RUN SAVED QUERY
# ============================================

@router.post("/{project_id}/query/saved/{query_id}/run", response_model=QueryResult)
async def run_saved_query(
    project_id: UUID,
    query_id: UUID,
    current_user: dict = Depends(get_current_user)
):
    """Run a saved query"""
    
    project = await verify_project_access(project_id, current_user["id"])
    
    # Get saved query
    result = await execute_on_main_db(
        "SELECT sql_query, question FROM saved_queries WHERE id = $1 AND project_id = $2 AND user_id = $3",
        query_id,
        project_id,
        current_user["id"]
    )
    
    if not result:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Saved query not found"
        )
    
    saved_query = dict(result[0])
    
    # Increment run count
    await execute_on_main_db(
        "UPDATE saved_queries SET run_count = run_count + 1 WHERE id = $1",
        query_id
    )
    
    # Execute query
    query_data = QueryExecute(
        sql=saved_query["sql_query"],
        question=saved_query["question"]
    )
    
    return await execute_query(project_id, query_data, current_user)
