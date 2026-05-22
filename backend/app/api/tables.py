from fastapi import APIRouter, HTTPException, Depends, status
from app.models.schemas import (
    TableCreate, TableUpdate, TableSchema, TableRow, TableRowUpdate,
    MessageResponse
)
from app.api.auth import get_current_user
from app.core.database import execute_on_main_db, execute_on_project_db
from typing import List, Dict, Any
from uuid import UUID
import json

router = APIRouter()

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
# HELPER: SQL Type Mapping
# ============================================

def map_column_type(col_type: str) -> str:
    """Map user-friendly types to PostgreSQL types"""
    type_map = {
        "text": "TEXT",
        "string": "VARCHAR(255)",
        "number": "INTEGER",
        "decimal": "DECIMAL(10,2)",
        "boolean": "BOOLEAN",
        "date": "DATE",
        "datetime": "TIMESTAMPTZ",
        "timestamp": "TIMESTAMPTZ",
        "json": "JSONB",
        "uuid": "UUID"
    }
    return type_map.get(col_type.lower(), col_type.upper())

# ============================================
# LIST TABLES
# ============================================

@router.get("/{project_id}/tables", response_model=List[TableSchema])
async def list_tables(
    project_id: UUID,
    current_user: dict = Depends(get_current_user)
):
    """List all tables in project schema"""
    
    project = await verify_project_access(project_id, current_user["id"])
    schema_name = project["database_name"]  # Schema name is same as database_name
    
    # Query actual database for tables in the project schema
    result = await execute_on_project_db(
        project["database_name"],
        f"""
        SELECT 
            t.table_name,
            COUNT(c.column_name) as column_count
        FROM information_schema.tables t
        LEFT JOIN information_schema.columns c 
            ON t.table_name = c.table_name 
            AND c.table_schema = '{schema_name}'
        WHERE t.table_schema = '{schema_name}'
        AND t.table_type = 'BASE TABLE'
        AND t.table_name NOT LIKE '_zendbx_%'
        AND t.table_name NOT LIKE '_nexora_%'
        GROUP BY t.table_name
        ORDER BY t.table_name
        """
    )
    
    tables = []
    for row in result:
        # Get row count for each table (with schema prefix)
        count_result = await execute_on_project_db(
            project["database_name"],
            f'SELECT COUNT(*) as count FROM "{schema_name}"."{row["table_name"]}"'
        )
        row_count = count_result[0]["count"] if count_result else 0
        
        tables.append({
            "table_name": row["table_name"],
            "columns": [],
            "row_count": row_count,
            "column_count": row["column_count"],
            "size_bytes": 0,
            "created_at": None
        })
    
    return tables

# ============================================
# CREATE TABLE
# ============================================

@router.post("/{project_id}/tables", response_model=TableSchema, status_code=status.HTTP_201_CREATED)
async def create_table(
    project_id: UUID,
    table_data: TableCreate,
    current_user: dict = Depends(get_current_user)
):
    """Create a new table in project database"""
    
    project = await verify_project_access(project_id, current_user["id"])
    
    # Check if table already exists
    existing = await execute_on_main_db(
        "SELECT id FROM user_tables WHERE project_id = $1 AND table_name = $2",
        project_id,
        table_data.table_name
    )
    
    if existing:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=f"Table '{table_data.table_name}' already exists"
        )
    
    # Build CREATE TABLE SQL
    column_defs = []
    for col in table_data.columns:
        col_sql = f"{col.name} {map_column_type(col.type)}"
        
        if col.primary_key:
            col_sql += " PRIMARY KEY"
        elif not col.nullable:
            col_sql += " NOT NULL"
        
        if col.unique and not col.primary_key:
            col_sql += " UNIQUE"
        
        if col.default:
            col_sql += f" DEFAULT {col.default}"
        
        column_defs.append(col_sql)
    
    # Add timestamps
    column_defs.append("created_at TIMESTAMPTZ DEFAULT NOW()")
    column_defs.append("updated_at TIMESTAMPTZ DEFAULT NOW()")
    
    create_sql = f"""
        CREATE TABLE {table_data.table_name} (
            {', '.join(column_defs)}
        )
    """
    
    try:
        # Execute in project database
        await execute_on_project_db(project["database_name"], create_sql)
        
        # Create trigger for updated_at
        await execute_on_project_db(
            project["database_name"],
            f"""
            CREATE TRIGGER update_{table_data.table_name}_updated_at
            BEFORE UPDATE ON {table_data.table_name}
            FOR EACH ROW EXECUTE FUNCTION update_updated_at_column()
            """
        )
        
        # Store metadata
        schema_json = {
            "columns": [col.dict() for col in table_data.columns]
        }
        
        await execute_on_main_db(
            """
            INSERT INTO user_tables (project_id, table_name, schema_definition)
            VALUES ($1, $2, $3)
            """,
            project_id,
            table_data.table_name,
            json.dumps(schema_json)
        )
        
        return TableSchema(
            table_name=table_data.table_name,
            columns=table_data.columns,
            row_count=0,
            size_bytes=0,
            created_at=None
        )
        
    except Exception as e:
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Failed to create table: {str(e)}"
        )

# ============================================
# GET TABLE SCHEMA
# ============================================

@router.get("/{project_id}/tables/{table_name}", response_model=TableSchema)
async def get_table_schema(
    project_id: UUID,
    table_name: str,
    current_user: dict = Depends(get_current_user)
):
    """Get table schema"""
    
    await verify_project_access(project_id, current_user["id"])
    
    result = await execute_on_main_db(
        """
        SELECT table_name, schema_definition, row_count, size_bytes, created_at
        FROM user_tables
        WHERE project_id = $1 AND table_name = $2
        """,
        project_id,
        table_name
    )
    
    if not result:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=f"Table '{table_name}' not found"
        )
    
    row = dict(result[0])
    schema_def = row["schema_definition"]
    
    return TableSchema(
        table_name=row["table_name"],
        columns=schema_def.get("columns", []),
        row_count=row["row_count"],
        size_bytes=row["size_bytes"],
        created_at=row["created_at"]
    )

# ============================================
# DELETE TABLE
# ============================================

@router.delete("/{project_id}/tables/{table_name}", response_model=MessageResponse)
async def delete_table(
    project_id: UUID,
    table_name: str,
    current_user: dict = Depends(get_current_user)
):
    """Delete a table"""
    
    project = await verify_project_access(project_id, current_user["id"])
    
    # Check if table exists
    result = await execute_on_main_db(
        "SELECT id FROM user_tables WHERE project_id = $1 AND table_name = $2",
        project_id,
        table_name
    )
    
    if not result:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=f"Table '{table_name}' not found"
        )
    
    try:
        # Drop table in project database
        await execute_on_project_db(
            project["database_name"],
            f"DROP TABLE IF EXISTS {table_name} CASCADE"
        )
        
        # Delete metadata
        await execute_on_main_db(
            "DELETE FROM user_tables WHERE project_id = $1 AND table_name = $2",
            project_id,
            table_name
        )
        
        return MessageResponse(
            message=f"Table '{table_name}' deleted successfully",
            success=True
        )
        
    except Exception as e:
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Failed to delete table: {str(e)}"
        )

# ============================================
# GET TABLE ROWS (Enhanced with filters, sorting, pagination)
# ============================================

@router.get("/{project_id}/tables/{table_name}/rows")
async def get_table_rows(
    project_id: UUID,
    table_name: str,
    page: int = 1,
    limit: int = 50,
    sort_by: str = None,
    sort_order: str = "asc",
    search: str = None,
    filters: str = None,  # JSON string of filters
    current_user: dict = Depends(get_current_user)
):
    """Get table data with advanced filtering, sorting, and pagination"""
    
    project = await verify_project_access(project_id, current_user["id"])
    
    try:
        # Calculate offset
        offset = (page - 1) * limit
        
        # Build base query
        query = f"SELECT * FROM {table_name}"
        conditions = []
        params = []
        param_count = 1
        
        # Add search filter
        if search:
            # Get table columns
            col_query = f"""
                SELECT column_name 
                FROM information_schema.columns 
                WHERE table_name = '{table_name}'
            """
            columns = await execute_on_project_db(project["database_name"], col_query)
            
            search_conditions = []
            for col in columns:
                search_conditions.append(f"{col['column_name']}::text ILIKE ${param_count}")
                params.append(f"%{search}%")
                param_count += 1
            
            if search_conditions:
                conditions.append(f"({' OR '.join(search_conditions)})")
        
        # Add custom filters
        if filters:
            import json
            filter_dict = json.loads(filters)
            for column, value in filter_dict.items():
                conditions.append(f"{column} = ${param_count}")
                params.append(value)
                param_count += 1
        
        # Add WHERE clause
        if conditions:
            query += " WHERE " + " AND ".join(conditions)
        
        # Add sorting
        if sort_by:
            query += f" ORDER BY {sort_by} {sort_order.upper()}"
        
        # Add pagination
        query += f" LIMIT ${param_count} OFFSET ${param_count + 1}"
        params.extend([limit, offset])
        
        # Execute query
        rows = await execute_on_project_db(project["database_name"], query, *params)
        
        # Get total count
        count_query = f"SELECT COUNT(*) as count FROM {table_name}"
        if conditions:
            count_query += " WHERE " + " AND ".join(conditions[:len(conditions) - (2 if filters else 0)])
        
        count_result = await execute_on_project_db(
            project["database_name"], 
            count_query,
            *params[:len(params) - 2]
        )
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

# ============================================
# INSERT ROW
# ============================================

@router.post("/{project_id}/tables/{table_name}/rows", status_code=status.HTTP_201_CREATED)
async def insert_row(
    project_id: UUID,
    table_name: str,
    row_data: TableRow,
    current_user: dict = Depends(get_current_user)
):
    """Insert a new row"""
    
    project = await verify_project_access(project_id, current_user["id"])
    
    if not row_data.data:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="No data provided"
        )
    
    try:
        # Build INSERT query
        columns = list(row_data.data.keys())
        placeholders = [f"${i+1}" for i in range(len(columns))]
        values = list(row_data.data.values())
        
        insert_sql = f"""
            INSERT INTO {table_name} ({', '.join(columns)})
            VALUES ({', '.join(placeholders)})
            RETURNING *
        """
        
        result = await execute_on_project_db(
            project["database_name"],
            insert_sql,
            *values
        )
        
        return dict(result[0]) if result else {}
        
    except Exception as e:
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Failed to insert row: {str(e)}"
        )

# ============================================
# UPDATE ROW
# ============================================

@router.put("/{project_id}/tables/{table_name}/rows/{row_id}")
async def update_row(
    project_id: UUID,
    table_name: str,
    row_id: str,
    row_data: TableRowUpdate,
    current_user: dict = Depends(get_current_user)
):
    """Update a row"""
    
    project = await verify_project_access(project_id, current_user["id"])
    
    if not row_data.data:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="No data provided"
        )
    
    try:
        # Build UPDATE query
        updates = [f"{col} = ${i+1}" for i, col in enumerate(row_data.data.keys())]
        values = list(row_data.data.values())
        values.append(row_id)
        
        update_sql = f"""
            UPDATE {table_name}
            SET {', '.join(updates)}
            WHERE id = ${len(values)}
            RETURNING *
        """
        
        result = await execute_on_project_db(
            project["database_name"],
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
            detail=f"Failed to update row: {str(e)}"
        )

# ============================================
# UPDATE SINGLE CELL
# ============================================

@router.patch("/{project_id}/tables/{table_name}/rows/{row_id}/cell")
async def update_cell(
    project_id: UUID,
    table_name: str,
    row_id: str,
    cell_data: dict,
    current_user: dict = Depends(get_current_user)
):
    """Update a single cell value"""
    
    project = await verify_project_access(project_id, current_user["id"])
    
    column = cell_data.get("column")
    value = cell_data.get("value")
    
    if not column:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Column name is required"
        )
    
    try:
        update_sql = f"""
            UPDATE {table_name}
            SET {column} = $1
            WHERE id = $2
            RETURNING *
        """
        
        result = await execute_on_project_db(
            project["database_name"],
            update_sql,
            value,
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
            detail=f"Failed to update cell: {str(e)}"
        )

# ============================================
# BULK INSERT ROWS
# ============================================

@router.post("/{project_id}/tables/{table_name}/bulk-insert")
async def bulk_insert_rows(
    project_id: UUID,
    table_name: str,
    rows_data: dict,
    current_user: dict = Depends(get_current_user)
):
    """Insert multiple rows at once"""
    
    project = await verify_project_access(project_id, current_user["id"])
    
    rows = rows_data.get("rows", [])
    
    if not rows:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="No rows provided"
        )
    
    try:
        inserted_rows = []
        
        for row_data in rows:
            columns = list(row_data.keys())
            placeholders = [f"${i+1}" for i in range(len(columns))]
            values = list(row_data.values())
            
            insert_sql = f"""
                INSERT INTO {table_name} ({', '.join(columns)})
                VALUES ({', '.join(placeholders)})
                RETURNING *
            """
            
            result = await execute_on_project_db(
                project["database_name"],
                insert_sql,
                *values
            )
            
            if result:
                inserted_rows.append(dict(result[0]))
        
        return {
            "inserted": len(inserted_rows),
            "rows": inserted_rows
        }
        
    except Exception as e:
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Failed to bulk insert: {str(e)}"
        )

# ============================================
# BULK DELETE ROWS
# ============================================

@router.delete("/{project_id}/tables/{table_name}/bulk-delete")
async def bulk_delete_rows(
    project_id: UUID,
    table_name: str,
    row_ids: dict,
    current_user: dict = Depends(get_current_user)
):
    """Delete multiple rows at once"""
    
    project = await verify_project_access(project_id, current_user["id"])
    
    ids = row_ids.get("ids", [])
    
    if not ids:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="No row IDs provided"
        )
    
    try:
        placeholders = [f"${i+1}" for i in range(len(ids))]
        delete_sql = f"""
            DELETE FROM {table_name}
            WHERE id IN ({', '.join(placeholders)})
            RETURNING id
        """
        
        result = await execute_on_project_db(
            project["database_name"],
            delete_sql,
            *ids
        )
        
        return {
            "deleted": len(result),
            "ids": [dict(row)["id"] for row in result]
        }
        
    except Exception as e:
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Failed to bulk delete: {str(e)}"
        )

# ============================================
# EXPORT TABLE DATA
# ============================================

@router.get("/{project_id}/tables/{table_name}/export")
async def export_table_data(
    project_id: UUID,
    table_name: str,
    format: str = "csv",
    current_user: dict = Depends(get_current_user)
):
    """Export table data to CSV or JSON"""
    
    project = await verify_project_access(project_id, current_user["id"])
    
    try:
        # Get all rows
        rows = await execute_on_project_db(
            project["database_name"],
            f"SELECT * FROM {table_name}"
        )
        
        data = [dict(row) for row in rows]
        
        if format == "csv":
            import csv
            import io
            from fastapi.responses import StreamingResponse
            
            if not data:
                return StreamingResponse(
                    iter(["No data to export"]),
                    media_type="text/csv",
                    headers={"Content-Disposition": f"attachment; filename={table_name}.csv"}
                )
            
            output = io.StringIO()
            writer = csv.DictWriter(output, fieldnames=data[0].keys())
            writer.writeheader()
            writer.writerows(data)
            
            output.seek(0)
            return StreamingResponse(
                iter([output.getvalue()]),
                media_type="text/csv",
                headers={"Content-Disposition": f"attachment; filename={table_name}.csv"}
            )
        
        elif format == "json":
            from fastapi.responses import JSONResponse
            import json
            
            return JSONResponse(
                content=data,
                headers={"Content-Disposition": f"attachment; filename={table_name}.json"}
            )
        
        else:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail="Invalid format. Use 'csv' or 'json'"
            )
        
    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Failed to export data: {str(e)}"
        )
