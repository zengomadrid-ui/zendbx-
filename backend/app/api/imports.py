from fastapi import APIRouter, HTTPException, Depends, UploadFile, File, status
from app.api.auth import get_current_user
from app.core.database import execute_on_main_db, execute_on_project_db
from app.models.schemas import MessageResponse
from typing import List
from uuid import UUID
import pandas as pd
import chardet
import io
import json

router = APIRouter()

# ============================================
# HELPER: Verify Project Access
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
# HELPER: Infer Column Types
# ============================================

def infer_column_type(series):
    """Infer PostgreSQL type from pandas series"""
    dtype = series.dtype
    
    if dtype == 'int64':
        return 'INTEGER'
    elif dtype == 'float64':
        return 'DECIMAL'
    elif dtype == 'bool':
        return 'BOOLEAN'
    elif dtype == 'datetime64[ns]':
        return 'TIMESTAMPTZ'
    else:
        # Check if it looks like a date
        try:
            pd.to_datetime(series.dropna().head(10))
            return 'TIMESTAMPTZ'
        except:
            pass
        
        # Default to TEXT
        max_length = series.astype(str).str.len().max()
        if max_length and max_length < 255:
            return f'VARCHAR({max(max_length, 50)})'
        return 'TEXT'

# ============================================
# UPLOAD CSV FILE
# ============================================

@router.post("/{project_id}/import/csv/upload")
async def upload_csv(
    project_id: UUID,
    file: UploadFile = File(...),
    current_user: dict = Depends(get_current_user)
):
    """Upload and analyze CSV file"""
    
    project = await verify_project_access(project_id, current_user["id"])
    
    if not file.filename.endswith('.csv'):
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="File must be a CSV"
        )
    
    try:
        # Read file content
        content = await file.read()
        
        # Detect encoding
        detected = chardet.detect(content)
        encoding = detected['encoding'] or 'utf-8'
        
        # Parse CSV
        df = pd.read_csv(io.BytesIO(content), encoding=encoding)
        
        # Infer schema
        schema = []
        for col in df.columns:
            col_type = infer_column_type(df[col])
            nullable = df[col].isnull().any()
            
            schema.append({
                'name': col.strip().lower().replace(' ', '_'),
                'original_name': col,
                'type': col_type,
                'nullable': nullable,
                'sample_values': df[col].dropna().head(3).tolist()
            })
        
        # Get preview data
        preview = df.head(10).to_dict('records')
        
        # Store file temporarily (in production, use S3 or similar)
        file_id = str(UUID(int=hash(file.filename) % (10 ** 32)))
        
        return {
            'file_id': file_id,
            'filename': file.filename,
            'row_count': len(df),
            'column_count': len(df.columns),
            'schema': schema,
            'preview': preview,
            'encoding': encoding
        }
        
    except Exception as e:
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Failed to process CSV: {str(e)}"
        )

# ============================================
# IMPORT CSV DATA
# ============================================

@router.post("/{project_id}/import/csv/execute")
async def execute_csv_import(
    project_id: UUID,
    import_data: dict,
    file: UploadFile = File(...),
    current_user: dict = Depends(get_current_user)
):
    """Execute CSV import with user-defined schema"""
    
    project = await verify_project_access(project_id, current_user["id"])
    
    table_name = import_data.get('table_name')
    schema = import_data.get('schema')
    create_table = import_data.get('create_table', True)
    
    if not table_name or not schema:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="table_name and schema are required"
        )
    
    try:
        # Read CSV
        content = await file.read()
        detected = chardet.detect(content)
        encoding = detected['encoding'] or 'utf-8'
        df = pd.read_csv(io.BytesIO(content), encoding=encoding)
        
        # Create table if needed
        if create_table:
            # Build CREATE TABLE statement
            column_defs = []
            column_defs.append("id SERIAL PRIMARY KEY")
            
            for col in schema:
                col_def = f"{col['name']} {col['type']}"
                if not col.get('nullable', True):
                    col_def += " NOT NULL"
                if col.get('unique', False):
                    col_def += " UNIQUE"
                column_defs.append(col_def)
            
            column_defs.append("created_at TIMESTAMPTZ DEFAULT NOW()")
            column_defs.append("updated_at TIMESTAMPTZ DEFAULT NOW()")
            
            create_sql = f"""
                CREATE TABLE {table_name} (
                    {', '.join(column_defs)}
                )
            """
            
            await execute_on_project_db(project["database_name"], create_sql)
            
            # Create trigger
            await execute_on_project_db(
                project["database_name"],
                f"""
                CREATE TRIGGER update_{table_name}_updated_at
                BEFORE UPDATE ON {table_name}
                FOR EACH ROW EXECUTE FUNCTION update_updated_at_column()
                """
            )
            
            # Store metadata
            schema_json = {'columns': schema}
            await execute_on_main_db(
                """
                INSERT INTO user_tables (project_id, table_name, schema_definition)
                VALUES ($1, $2, $3)
                """,
                project_id,
                table_name,
                json.dumps(schema_json)
            )
        
        # Map CSV columns to table columns
        column_mapping = {col['original_name']: col['name'] for col in schema}
        
        # Insert data
        inserted_count = 0
        errors = []
        
        for idx, row in df.iterrows():
            try:
                # Map columns
                mapped_row = {}
                for csv_col, table_col in column_mapping.items():
                    if csv_col in row and pd.notna(row[csv_col]):
                        mapped_row[table_col] = row[csv_col]
                
                if not mapped_row:
                    continue
                
                # Build INSERT
                columns = list(mapped_row.keys())
                placeholders = [f"${i+1}" for i in range(len(columns))]
                values = list(mapped_row.values())
                
                insert_sql = f"""
                    INSERT INTO {table_name} ({', '.join(columns)})
                    VALUES ({', '.join(placeholders)})
                """
                
                await execute_on_project_db(
                    project["database_name"],
                    insert_sql,
                    *values
                )
                
                inserted_count += 1
                
            except Exception as e:
                errors.append({
                    'row': idx + 1,
                    'error': str(e)
                })
        
        return {
            'success': True,
            'table_name': table_name,
            'inserted': inserted_count,
            'total_rows': len(df),
            'errors': errors[:10]  # Return first 10 errors
        }
        
    except Exception as e:
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Failed to import CSV: {str(e)}"
        )

# ============================================
# GET IMPORT HISTORY
# ============================================

@router.get("/{project_id}/import/history")
async def get_import_history(
    project_id: UUID,
    current_user: dict = Depends(get_current_user)
):
    """Get CSV import history"""
    
    await verify_project_access(project_id, current_user["id"])
    
    result = await execute_on_main_db(
        """
        SELECT id, filename, original_filename, file_size, status, 
               table_name, error_message, created_at
        FROM file_uploads
        WHERE project_id = $1 AND user_id = $2
        ORDER BY created_at DESC
        LIMIT 50
        """,
        project_id,
        current_user["id"]
    )
    
    return [dict(row) for row in result]


# ============================================
# SIMPLE CSV IMPORT (No Project Context)
# ============================================

@router.post("/import")
async def simple_csv_import(
    import_data: dict,
    current_user: dict = Depends(get_current_user)
):
    """Simple CSV import endpoint for direct uploads"""
    
    table_name = import_data.get('tableName')
    headers = import_data.get('headers', [])
    rows = import_data.get('rows', [])
    remove_duplicates = import_data.get('removeDuplicates', True)
    skip_empty_rows = import_data.get('skipEmptyRows', True)
    
    if not table_name or not headers or not rows:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="tableName, headers, and rows are required"
        )
    
    try:
        # Get user's default project or create one
        project_result = await execute_on_main_db(
            "SELECT * FROM projects WHERE user_id = $1 ORDER BY created_at DESC LIMIT 1",
            current_user["id"]
        )
        
        if not project_result:
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND,
                detail="No project found. Please create a project first."
            )
        
        project = dict(project_result[0])
        
        # Clean data
        cleaned_rows = rows
        if skip_empty_rows:
            cleaned_rows = [row for row in cleaned_rows if any(cell for cell in row)]
        
        if remove_duplicates:
            seen = set()
            unique_rows = []
            for row in cleaned_rows:
                row_key = '|'.join(str(cell) for cell in row)
                if row_key not in seen:
                    seen.add(row_key)
                    unique_rows.append(row)
            cleaned_rows = unique_rows
        
        # Infer column types
        df = pd.DataFrame(cleaned_rows, columns=headers)
        schema = []
        for col in df.columns:
            col_type = infer_column_type(df[col])
            schema.append({
                'name': col.strip().lower().replace(' ', '_'),
                'original_name': col,
                'type': col_type,
                'nullable': True
            })
        
        # Create table
        column_defs = ["id SERIAL PRIMARY KEY"]
        for col in schema:
            column_defs.append(f"{col['name']} {col['type']}")
        column_defs.append("created_at TIMESTAMPTZ DEFAULT NOW()")
        column_defs.append("updated_at TIMESTAMPTZ DEFAULT NOW()")
        
        create_sql = f"""
            CREATE TABLE IF NOT EXISTS {table_name} (
                {', '.join(column_defs)}
            )
        """
        
        await execute_on_project_db(project["database_name"], create_sql)
        
        # Insert data
        inserted_count = 0
        for row in cleaned_rows:
            try:
                columns = [col['name'] for col in schema]
                placeholders = [f"${i+1}" for i in range(len(columns))]
                
                insert_sql = f"""
                    INSERT INTO {table_name} ({', '.join(columns)})
                    VALUES ({', '.join(placeholders)})
                """
                
                await execute_on_project_db(
                    project["database_name"],
                    insert_sql,
                    *row
                )
                inserted_count += 1
            except Exception as e:
                print(f"Error inserting row: {e}")
                continue
        
        return {
            'success': True,
            'table_name': table_name,
            'inserted': inserted_count,
            'total_rows': len(rows),
            'cleaned_rows': len(cleaned_rows)
        }
        
    except Exception as e:
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Failed to import data: {str(e)}"
        )
