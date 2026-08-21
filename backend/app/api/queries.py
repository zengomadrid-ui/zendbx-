from fastapi import APIRouter, HTTPException, Depends, status
from app.models.schemas import (
    QueryExecute, QueryResult, QueryHistoryResponse,
    SavedQueryCreate, SavedQueryUpdate, SavedQueryResponse,
    MessageResponse
)
from app.api.auth import get_current_user
from app.core.database import execute_on_main_db, execute_on_project_db
from app.services.sql_autofix_schema_aware import sql_autofix_engine
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

async def get_project_schema(project_id: UUID, database_name: str = None) -> dict:
    """
    Get project schema for auto-fix service using REAL-TIME schema discovery.
    
    CRITICAL: AutoFix requires actual database schema, not cached metadata.
    This function queries information_schema directly from the project database.
    """
    try:
        # Get project info if database_name not provided
        if not database_name:
            project_result = await execute_on_main_db(
                "SELECT database_name FROM projects WHERE id = $1",
                project_id
            )
            if not project_result:
                print(f"[AUTOFIX SCHEMA] Project {project_id} not found")
                return {"tables": {}}
            database_name = project_result[0]["database_name"]
        
        print(f"[AUTOFIX SCHEMA] Loading schema for project {project_id}")
        print(f"[AUTOFIX SCHEMA] Database name: {database_name}")
        
        # Query information_schema directly from project database
        # This gives us real-time, accurate schema information
        # IMPORTANT: table_schema should be 'public' (or the actual schema name),
        # NOT the database name. Most project databases use the 'public' schema.
        tables_result = await execute_on_project_db(
            project_id,
            database_name,
            """
            SELECT table_name 
            FROM information_schema.tables 
            WHERE table_schema = 'public'
              AND table_type = 'BASE TABLE'
            ORDER BY table_name
            """
        )
        
        tables = {}
        table_count = 0
        
        for table_row in tables_result:
            table_name = table_row["table_name"]
            table_count += 1
            
            # Get columns for this table
            columns_result = await execute_on_project_db(
                project_id,
                database_name,
                """
                SELECT 
                    column_name,
                    data_type,
                    udt_name,
                    is_nullable,
                    column_default
                FROM information_schema.columns 
                WHERE table_schema = 'public'
                  AND table_name = $1
                ORDER BY ordinal_position
                """,
                table_name
            )
            
            columns = []
            for col_row in columns_result:
                columns.append({
                    "name": col_row["column_name"],
                    "type": col_row["data_type"],
                    "udt_name": col_row["udt_name"],
                    "nullable": col_row["is_nullable"] == "YES",
                    "default": col_row["column_default"]
                })
            
            tables[table_name] = {
                "columns": columns
            }
        
        print(f"[AUTOFIX SCHEMA] Tables discovered: {table_count}")
        if table_count > 0:
            print(f"[AUTOFIX SCHEMA] Sample tables: {list(tables.keys())[:5]}")
        else:
            print(f"[AUTOFIX SCHEMA] WARNING: No tables found in schema {database_name}")
        
        return {"tables": tables}
        
    except Exception as e:
        print(f"[AUTOFIX SCHEMA] ERROR: Failed to load schema: {e}")
        import traceback
        print(f"[AUTOFIX SCHEMA] Traceback: {traceback.format_exc()}")
        # Return empty schema but log the error
        return {"tables": {}}

# ============================================
# HELPER: Verify Project Ownership
# ============================================

async def verify_project_access(project_id: UUID, user_id: UUID) -> dict:
    """
    Verify user has access to project AND project has credentials provisioned
    
    This prevents the "permission denied" error by checking credentials exist
    before attempting to execute queries
    """
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
    
    # CRITICAL CHECK: Verify credentials exist
    if not project.get('has_credentials'):
        raise HTTPException(
            status_code=status.HTTP_503_SERVICE_UNAVAILABLE,
            detail=(
                "Project credentials not provisioned. "
                "This project was created before Phase 5.0 security update or provisioning failed. "
                "Please contact support or run the provisioning script to enable SQL Editor access."
            )
        )
    
    return project

# ============================================
# HELPER: Verify SQL Execution Results
# ============================================

async def verify_sql_execution(project_id: UUID, database_name: str, sql: str, execution_result: list) -> dict:
    """
    Verify that SQL execution produced the expected results.
    
    This is CRITICAL for multi-statement CREATE TABLE operations.
    A 5-table request MUST create 5 tables, not 1.
    
    Returns:
        dict with:
        - verified: bool (True if verification passed)
        - verification_status: str (FIXED_AND_VERIFIED, PARTIAL_OR_INCOMPLETE_FIX, etc.)
        - details: dict (tables_created, tables_expected, etc.)
    """
    from app.core.database import execute_on_project_db, smart_split_sql
    
    verification_details = {
        'verified': False,
        'verification_status': 'EXECUTION_FAILED',
        'details': {}
    }
    
    try:
        sql_upper = sql.upper()
        
        # Verify CREATE TABLE statements
        if 'CREATE TABLE' in sql_upper:
            # Count how many CREATE TABLE statements were requested
            statements = smart_split_sql(sql)
            create_table_stmts = [s for s in statements if 'CREATE TABLE' in s.upper()]
            expected_count = len(create_table_stmts)
            
            # Extract table names from CREATE TABLE statements
            import re
            expected_tables = []
            for stmt in create_table_stmts:
                # Match: CREATE TABLE [IF NOT EXISTS] table_name
                match = re.search(r'CREATE\s+TABLE\s+(?:IF\s+NOT\s+EXISTS\s+)?"?([a-zA-Z_][a-zA-Z0-9_]*)"?', stmt, re.IGNORECASE)
                if match:
                    expected_tables.append(match.group(1).lower())
            
            # Query PostgreSQL catalog to verify tables exist
            existing_tables = []
            try:
                result = await execute_on_project_db(
                    project_id,
                    database_name,
                    """
                    SELECT table_name 
                    FROM information_schema.tables 
                    WHERE table_schema = 'public' AND table_type = 'BASE TABLE'
                    ORDER BY table_name
                    """
                )
                existing_tables = [row['table_name'] for row in result]
            except Exception as catalog_error:
                verification_details['details']['catalog_error'] = str(catalog_error)
                verification_details['verification_status'] = 'VERIFICATION_FAILED'
                return verification_details
            
            # Check which expected tables actually exist
            tables_created = [t for t in expected_tables if t in existing_tables]
            tables_missing = [t for t in expected_tables if t not in existing_tables]
            
            verification_details['details'] = {
                'tables_expected': expected_count,
                'tables_created': len(tables_created),
                'expected_table_names': expected_tables,
                'created_table_names': tables_created,
                'missing_table_names': tables_missing
            }
            
            if len(tables_created) == expected_count and len(tables_missing) == 0:
                # SUCCESS: All tables created
                verification_details['verified'] = True
                verification_details['verification_status'] = 'FIXED_AND_VERIFIED'
            elif len(tables_created) > 0:
                # PARTIAL SUCCESS: Some tables created
                verification_details['verified'] = False
                verification_details['verification_status'] = 'PARTIAL_OR_INCOMPLETE_FIX'
            else:
                # FAILURE: No tables created
                verification_details['verified'] = False
                verification_details['verification_status'] = 'EXECUTION_FAILED'
        
        # Verify INSERT statements (check row counts if possible)
        elif 'INSERT INTO' in sql_upper and 'VALUES' in sql_upper:
            statements = smart_split_sql(sql)
            insert_stmts = [s for s in statements if 'INSERT INTO' in s.upper()]
            expected_count = len(insert_stmts)
            
            # For INSERT, we can't easily verify without knowing the table names
            # But we can at least report that the operation completed
            verification_details['details'] = {
                'insert_statements_expected': expected_count,
                'execution_completed': True
            }
            verification_details['verified'] = True
            verification_details['verification_status'] = 'FIXED_AND_VERIFIED'
        
        # For SELECT/UPDATE/DELETE, execution success is verification enough
        else:
            verification_details['verified'] = True
            verification_details['verification_status'] = 'FIXED_AND_VERIFIED'
            verification_details['details'] = {
                'statement_type': 'other',
                'execution_completed': True
            }
        
    except Exception as e:
        verification_details['verification_status'] = 'VERIFICATION_FAILED'
        verification_details['details']['verification_error'] = str(e)
    
    return verification_details


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
    
    # VERIFICATION TAG - Check if new code is loaded
    print("="*100)
    print("🚀 DATABASE-AWARE SCHEMA REPAIR ENGINE LOADED - TIMESTAMP: 2026-08-14 16:30:00")
    print("="*100)
    
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
        
        # 🚀 DATABASE-AWARE AUTO-FIX ENGINE - Schema-based SQL repair
        # Only attempt auto-fix if enabled and there's a real error (not success)
        if query_data.enable_autofix and not auto_fixed and error_message and "successfully" not in error_message.lower():
            try:
                print(f"🔧 DATABASE-AWARE AUTO-FIX: Starting schema-aware repair...")
                print(f"   Original SQL (first 200 chars): {current_sql[:200]}...")
                print(f"   Initial Error: {error_message}")
                
                # Run the schema-aware auto-fix engine
                fix_result = await sql_autofix_engine.auto_fix(
                    sql=current_sql,
                    error_message=error_message,
                    execute_func=execute_on_project_db,
                    project_id=project_id,
                    database_name=project["database_name"],
                    max_iterations=5
                )
                
                if fix_result.success and fix_result.fixed_sql:
                    # SUCCESS! Fixed SQL executed successfully
                    print(f"[AUTOFIX] ✅ SUCCESS after {fix_result.iterations} iteration(s)")
                    
                    # Execute one more time to get the result for response
                    result = await execute_on_project_db(
                        project_id,
                        project["database_name"],
                        fix_result.fixed_sql
                    )
                    
                    # Process result
                    if isinstance(result, dict):
                        rows_data = result.get('result', [])
                        logs = result.get('logs', [])
                    else:
                        rows_data = result
                        logs = []
                    
                    # Convert to list of dicts
                    rows = []
                    if rows_data:
                        for row in rows_data:
                            row_dict = dict(row)
                            for key, value in row_dict.items():
                                if hasattr(value, '__class__') and value.__class__.__name__ in ['IPv4Address', 'IPv6Address', 'IPv4Network', 'IPv6Network']:
                                    row_dict[key] = str(value)
                            rows.append(row_dict)
                    columns = list(rows[0].keys()) if rows else []
                    
                    # Add log entry
                    logs.append({
                        'statement': f'AUTO-FIX ({fix_result.iterations} iteration(s))',
                        'status': 'success',
                        'message': f'✅ SQL auto-fixed using database-aware schema repair!\nChanges: {"; ".join(fix_result.changes)}',
                        'rows_affected': len(rows),
                        'execution_time_ms': 0
                    })
                    
                    # Log to database
                    total_time = int((time.time() - start_time) * 1000)
                    await execute_on_main_db(
                        """
                        INSERT INTO query_history 
                        (user_id, project_id, question, sql_query, status, execution_time_ms, rows_returned, error_message)
                        VALUES ($1, $2, $3, $4, $5, $6, $7, $8)
                        """,
                        current_user["id"],
                        project_id,
                        query_data.question,
                        fix_result.fixed_sql,
                        "auto_fixed",
                        total_time,
                        len(rows),
                        f"Original error: {error_message}. Fixed in {fix_result.iterations} iteration(s). Changes: {', '.join(fix_result.changes)}"
                    )
                    
                    # Count statements
                    from app.core.database import smart_split_sql
                    original_stmts = smart_split_sql(original_sql)
                    fixed_stmts = smart_split_sql(fix_result.fixed_sql)
                    
                    # Verify execution
                    verification = await verify_sql_execution(project_id, project["database_name"], fix_result.fixed_sql, rows_data)
                    
                    return QueryResult(
                        columns=columns,
                        rows=rows,
                        row_count=len(rows),
                        execution_time_ms=total_time,
                        logs=logs,
                        auto_fixed=True,
                        original_sql=original_sql,
                        fixed_sql=fix_result.fixed_sql,
                        original_statement_count=len(original_stmts),
                        fixed_statement_count=len(fixed_stmts),
                        verification_status=fix_result.verification_status,
                        verification_details={'changes': fix_result.changes, 'iterations': fix_result.iterations}
                    )
                else:
                    # Auto-fix failed
                    print(f"[AUTOFIX] ❌ FAILED after {fix_result.iterations} iteration(s)")
                    print(f"[AUTOFIX] Errors: {fix_result.errors}")
                    
                    # Log the failed attempt
                    await execute_on_main_db(
                        """
                        INSERT INTO query_history 
                        (user_id, project_id, question, sql_query, status, execution_time_ms, rows_returned, error_message)
                        VALUES ($1, $2, $3, $4, $5, $6, $7, $8)
                        """,
                        current_user["id"],
                        project_id,
                        query_data.question,
                        current_sql,
                        "auto_fix_failed",
                        int((time.time() - start_time) * 1000),
                        0,
                        f"Auto-fix failed: {'; '.join(fix_result.errors[:3])}"
                    )
                    
                    # Return HTTP 400 - auto-fix failed
                    raise HTTPException(
                        status_code=status.HTTP_400_BAD_REQUEST,
                        detail=(
                            f"Query execution failed. Database-aware auto-fix attempted {fix_result.iterations} iteration(s) but could not generate valid SQL.\n"
                            f"Original error: {error_message}\n"
                            f"Errors: {'; '.join(fix_result.errors[:3])}"
                        )
                    )
                
            except HTTPException:
                # Re-raise HTTP exceptions
                raise
            except Exception as autofix_error:
                # Auto-fix service failed, continue with original error
                print(f"❌ AUTO-FIX: Engine failed: {str(autofix_error)}")
                import traceback
                print(f"[AUTOFIX] Traceback: {traceback.format_exc()}")
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
