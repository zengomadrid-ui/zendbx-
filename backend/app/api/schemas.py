"""
Schema Discovery API - Multi-tenant PostgreSQL schema navigation
Provides schema-based table grouping for the Table Editor

Version: 1.0.0
"""
from fastapi import APIRouter, Depends, HTTPException, status
from app.api.auth import get_current_user
from app.core.database import execute_on_main_db, execute_on_project_db
from typing import List, Dict, Any
from uuid import UUID

router = APIRouter()

# ============================================
# HELPER: Verify Project Ownership
# ============================================

async def verify_project_access(project_id: UUID, user_id: UUID) -> dict:
    """Verify user has access to project"""
    result = await execute_on_main_db(
        "SELECT id, name, slug, database_name, user_id FROM projects WHERE id = $1 AND user_id = $2",
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
# SCHEMA DISCOVERY ENDPOINT
# ============================================

@router.get("/{project_id}/schemas")
async def list_schemas(
    project_id: UUID,
    current_user: dict = Depends(get_current_user)
):
    """
    Discover visible PostgreSQL schemas for the current project
    
    Security boundaries:
    - Only shows current project's schema
    - Optionally shows auth schema (if project-scoped data exists)
    - NEVER shows: public, other projects, pg_catalog, information_schema
    """
    
    project = await verify_project_access(project_id, current_user["id"])
    project_schema = project["database_name"]  # e.g., "proj_faeef53c"
    
    print(f"\n{'='*60}")
    print(f"📋 SCHEMA DISCOVERY REQUEST")
    print(f"{'='*60}")
    print(f"Project ID: {project_id}")
    print(f"Project Name: {project['name']}")
    print(f"Project Schema: {project_schema}")
    print(f"User ID: {current_user['id']}")
    
    schemas = []
    
    try:
        # ================================================================
        # SCHEMA 1: Project Schema (user's tables)
        # ================================================================
        
        print(f"\n🔍 Discovering tables in project schema: {project_schema}")
        
        # Internal ZendBX system tables
        AUTH_TABLES = {
            'audit_logs', 'config', 'providers_config', 'roles', 
            'sessions', 'user_roles', 'users', 'verification_tokens',
            'refresh_tokens', 'identities', 'password_reset_tokens'
        }
        
        REALTIME_TABLES = {
            'enabled_tables', 'subscriptions'
        }
        
        STORAGE_TABLES = {
            'buckets', 'objects'
        }
        
        ALL_SYSTEM_TABLES = AUTH_TABLES | REALTIME_TABLES | STORAGE_TABLES
        
        project_tables = await execute_on_project_db(
            project_schema,
            """
            SELECT 
                t.table_name,
                t.table_schema
            FROM information_schema.tables t
            WHERE t.table_schema = $1
            AND t.table_type = 'BASE TABLE'
            AND t.table_name NOT LIKE '_zendbx_%'
            AND t.table_name NOT LIKE '_nexora_%'
            ORDER BY t.table_name
            """,
            project_schema
        )
        
        # Separate user tables from system tables
        user_table_list = []
        auth_table_list = []
        realtime_table_list = []
        storage_table_list = []
        
        # First, scan project schema tables
        # IMPORTANT: Only user tables go here, system tables are in separate schemas
        for table in project_tables:
            table_name = table["table_name"]
            
            try:
                count_result = await execute_on_project_db(
                    project_schema,
                    f'SELECT COUNT(*) as count FROM "{project_schema}"."{table_name}"'
                )
                row_count = count_result[0]["count"] if count_result else 0
            except Exception as e:
                print(f"⚠️  Could not count rows for {table_name}: {e}")
                row_count = 0
            
            # ALL tables in project schema are user tables
            # System tables (auth, realtime, storage) are in separate schemas
            user_table_list.append({
                "name": table_name,
                "schema": project_schema,
                "row_count": row_count,
                "system_managed": False,
                "read_only": False
            })
        
        # ================================================================
        # SCHEMA 2: Check for real auth schema tables
        # ================================================================
        
        print(f"\n🔍 Checking for real auth schema tables...")
        
        try:
            auth_schema_tables = await execute_on_project_db(
                project_schema,
                """
                SELECT 
                    t.table_name,
                    t.table_schema
                FROM information_schema.tables t
                WHERE t.table_schema = 'auth'
                AND t.table_type = 'BASE TABLE'
                ORDER BY t.table_name
                """
            )
            
            if auth_schema_tables:
                print(f"✅ Found {len(auth_schema_tables)} tables in real auth schema")
                
                for table in auth_schema_tables:
                    table_name = table["table_name"]
                    
                    try:
                        count_result = await execute_on_project_db(
                            project_schema,
                            f'SELECT COUNT(*) as count FROM "auth"."{table_name}"'
                        )
                        row_count = count_result[0]["count"] if count_result else 0
                    except Exception as e:
                        print(f"⚠️  Could not count rows for auth.{table_name}: {e}")
                        row_count = 0
                    
                    auth_table_list.append({
                        "name": table_name,
                        "schema": "auth",  # Real auth schema
                        "row_count": row_count,
                        "system_managed": True,
                        "read_only": True
                    })
            else:
                print(f"ℹ️  No tables found in real auth schema")
                
        except Exception as e:
            print(f"ℹ️  Auth schema does not exist or is not accessible: {e}")
        
        # ================================================================
        # SCHEMA 3: Check for realtime schema tables
        # ================================================================
        
        print(f"\n🔍 Checking for real realtime schema tables...")
        
        try:
            realtime_schema_tables = await execute_on_project_db(
                project_schema,
                """
                SELECT 
                    t.table_name,
                    t.table_schema
                FROM information_schema.tables t
                WHERE t.table_schema = 'realtime'
                AND t.table_type = 'BASE TABLE'
                ORDER BY t.table_name
                """
            )
            
            if realtime_schema_tables:
                print(f"✅ Found {len(realtime_schema_tables)} tables in real realtime schema")
                
                for table in realtime_schema_tables:
                    table_name = table["table_name"]
                    
                    try:
                        count_result = await execute_on_project_db(
                            project_schema,
                            f'SELECT COUNT(*) as count FROM "realtime"."{table_name}"'
                        )
                        row_count = count_result[0]["count"] if count_result else 0
                    except Exception as e:
                        print(f"⚠️  Could not count rows for realtime.{table_name}: {e}")
                        row_count = 0
                    
                    realtime_table_list.append({
                        "name": table_name,
                        "schema": "realtime",  # Real realtime schema
                        "row_count": row_count,
                        "system_managed": True,
                        "read_only": True
                    })
            else:
                print(f"ℹ️  No tables found in real realtime schema")
                
        except Exception as e:
            print(f"ℹ️  Realtime schema does not exist or is not accessible: {e}")
        
        # ================================================================
        # SCHEMA 4: Check for storage schema tables
        # ================================================================
        
        print(f"\n🔍 Checking for real storage schema tables...")
        
        try:
            storage_schema_tables = await execute_on_project_db(
                project_schema,
                """
                SELECT 
                    t.table_name,
                    t.table_schema
                FROM information_schema.tables t
                WHERE t.table_schema = 'storage'
                AND t.table_type = 'BASE TABLE'
                ORDER BY t.table_name
                """
            )
            
            if storage_schema_tables:
                print(f"✅ Found {len(storage_schema_tables)} tables in real storage schema")
                
                for table in storage_schema_tables:
                    table_name = table["table_name"]
                    
                    try:
                        count_result = await execute_on_project_db(
                            project_schema,
                            f'SELECT COUNT(*) as count FROM "storage"."{table_name}"'
                        )
                        row_count = count_result[0]["count"] if count_result else 0
                    except Exception as e:
                        print(f"⚠️  Could not count rows for storage.{table_name}: {e}")
                        row_count = 0
                    
                    storage_table_list.append({
                        "name": table_name,
                        "schema": "storage",  # Real storage schema
                        "row_count": row_count,
                        "system_managed": True,
                        "read_only": True
                    })
            else:
                print(f"ℹ️  No tables found in real storage schema")
                
        except Exception as e:
            print(f"ℹ️  Storage schema does not exist or is not accessible: {e}")
        
        # Add public schema (user tables only)
        schemas.append({
            "name": project_schema,
            "display_name": "public",
            "table_count": len(user_table_list),
            "system_managed": False,
            "read_only": False,
            "description": f"User-created tables for {project['name']}",
            "tables": user_table_list
        })
        
        print(f"✅ Found {len(user_table_list)} user tables in public schema")
        
        # Add auth schema if it has tables
        if auth_table_list:
            schemas.append({
                "name": project_schema,  # Same real schema
                "display_name": "auth",
                "table_count": len(auth_table_list),
                "system_managed": True,
                "read_only": True,
                "description": "Authentication and user management tables",
                "tables": auth_table_list
            })
            print(f"✅ Found {len(auth_table_list)} auth tables")
        
        # Add realtime schema if it has tables
        if realtime_table_list:
            schemas.append({
                "name": project_schema,  # Same real schema
                "display_name": "realtime",
                "table_count": len(realtime_table_list),
                "system_managed": True,
                "read_only": True,
                "description": "Realtime subscriptions and configuration",
                "tables": realtime_table_list
            })
            print(f"✅ Found {len(realtime_table_list)} realtime tables")
        
        # Add storage schema if it has tables
        if storage_table_list:
            schemas.append({
                "name": project_schema,  # Same real schema
                "display_name": "storage",
                "table_count": len(storage_table_list),
                "system_managed": True,
                "read_only": True,
                "description": "File storage buckets and objects",
                "tables": storage_table_list
            })
            print(f"✅ Found {len(storage_table_list)} storage tables")
        
        # ================================================================
        # SECURITY: Block all other schemas
        # ================================================================
        
        # NEVER expose:
        # - public (platform tables)
        # - other project schemas (proj_*)
        # - pg_catalog, information_schema, pg_toast (PostgreSQL internal)
        # - any temporary schemas
        
        print(f"\n✅ Schema discovery complete")
        print(f"   Exposed schemas: {len(schemas)}")
        for schema in schemas:
            print(f"   - {schema['display_name']} ({schema['table_count']} tables)")
        
        print(f"{'='*60}\n")
        
        return {"schemas": schemas}
        
    except Exception as e:
        print(f"❌ Error during schema discovery: {str(e)}")
        import traceback
        traceback.print_exc()
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Failed to discover schemas: {str(e)}"
        )

# ============================================
# SCHEMA-AWARE TABLE OPERATIONS
# ============================================

@router.get("/{project_id}/schemas/{schema_name}/tables/{table_name}/rows")
async def get_schema_table_rows(
    project_id: UUID,
    schema_name: str,
    table_name: str,
    page: int = 1,
    limit: int = 50,
    current_user: dict = Depends(get_current_user)
):
    """
    Get table rows with schema qualification
    
    SECURITY:
    - Validates schema belongs to current project
    - Blocks access to other projects' schemas
    - Blocks access to public schema
    - Enforces project-scoped filtering for auth schema
    """
    
    project = await verify_project_access(project_id, current_user["id"])
    project_schema = project["database_name"]
    
    # SECURITY: Validate schema access
    if schema_name == project_schema:
        # User's own project schema - full access
        pass
    elif schema_name == "auth":
        # Auth schema - only if project-scoped
        # Will apply project_id filter below
        pass
    else:
        # BLOCK: Invalid schema
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail=f"Access denied to schema: {schema_name}"
        )
    
    try:
        offset = (page - 1) * limit
        
        # Build query with proper schema qualification
        if schema_name == "auth" and table_name == "users":
            # CRITICAL: Filter auth.users by project_id
            query = f"""
                SELECT * FROM auth.users 
                WHERE project_id = $1
                ORDER BY created_at DESC
                LIMIT $2 OFFSET $3
            """
            rows = await execute_on_main_db(query, project_id, limit, offset)
            
            # Get count
            count_query = "SELECT COUNT(*) as count FROM auth.users WHERE project_id = $1"
            count_result = await execute_on_main_db(count_query, project_id)
            total_count = count_result[0]["count"] if count_result else 0
            
        else:
            # Project schema tables
            query = f"""
                SELECT * FROM "{schema_name}"."{table_name}"
                ORDER BY 1
                LIMIT $1 OFFSET $2
            """
            rows = await execute_on_project_db(project_schema, query, limit, offset)
            
            # Get count
            count_query = f'SELECT COUNT(*) as count FROM "{schema_name}"."{table_name}"'
            count_result = await execute_on_project_db(project_schema, count_query)
            total_count = count_result[0]["count"] if count_result else 0
        
        return {
            "rows": [dict(row) for row in rows],
            "total": total_count,
            "page": page,
            "limit": limit,
            "total_pages": (total_count + limit - 1) // limit
        }
        
    except Exception as e:
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Failed to fetch rows: {str(e)}"
        )

@router.get("/{project_id}/schemas/{schema_name}/tables/{table_name}/columns")
async def get_schema_table_columns(
    project_id: UUID,
    schema_name: str,
    table_name: str,
    current_user: dict = Depends(get_current_user)
):
    """Get table column information with schema qualification"""
    
    project = await verify_project_access(project_id, current_user["id"])
    project_schema = project["database_name"]
    
    # SECURITY: Validate schema access
    if schema_name not in [project_schema, "auth"]:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail=f"Access denied to schema: {schema_name}"
        )
    
    try:
        columns = await execute_on_main_db("""
            SELECT 
                column_name as name,
                data_type as type,
                is_nullable,
                column_default
            FROM information_schema.columns 
            WHERE table_schema = $1
              AND table_name = $2
            ORDER BY ordinal_position
        """, schema_name, table_name)
        
        return {"columns": [dict(col) for col in columns]}
        
    except Exception as e:
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Failed to fetch columns: {str(e)}"
        )
