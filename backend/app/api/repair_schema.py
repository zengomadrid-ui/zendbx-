"""
Schema Repair API - Fix missing project schemas
Automatically detects and repairs projects with missing schemas
"""
from fastapi import APIRouter, HTTPException, Depends
from pydantic import BaseModel
from typing import Optional, List
from uuid import UUID
import logging

from app.core.rbac import require_admin
from app.core.database import get_main_db_pool

logger = logging.getLogger(__name__)

router = APIRouter()


class SchemaRepairRequest(BaseModel):
    project_id: Optional[str] = None  # If None, repair ALL projects
    force: bool = False  # Force recreation even if schema exists


class SchemaRepairResult(BaseModel):
    project_id: str
    project_name: str
    slug: str
    schema_name: str
    status: str  # "created", "exists", "failed"
    message: str


class SchemaRepairResponse(BaseModel):
    total_projects: int
    repaired: int
    failed: int
    skipped: int
    results: List[SchemaRepairResult]


@router.post("/api/admin/repair-schemas", response_model=SchemaRepairResponse)
async def repair_project_schemas(
    request: SchemaRepairRequest,
    _current_user: dict = Depends(require_admin),
):
    """
    Repair missing project schemas.
    
    This endpoint:
    1. Scans all projects (or a specific project)
    2. Checks if their schema exists
    3. Creates missing schemas with metadata table and functions
    4. Returns detailed results
    
    Security: Admin-only endpoint
    """
    pool = await get_main_db_pool()
    results = []
    repaired = 0
    failed = 0
    skipped = 0
    
    try:
        # Get projects to repair
        if request.project_id:
            # Repair specific project
            try:
                project_uuid = UUID(request.project_id)
            except ValueError:
                raise HTTPException(status_code=400, detail="Invalid project ID format")
            
            async with pool.acquire() as conn:
                projects = await conn.fetch("""
                    SELECT id, name, slug, database_name, schema_name
                    FROM projects
                    WHERE id = $1
                """, project_uuid)
        else:
            # Repair all projects
            async with pool.acquire() as conn:
                projects = await conn.fetch("""
                    SELECT id, name, slug, database_name, schema_name
                    FROM projects
                    ORDER BY created_at DESC
                """)
        
        if not projects:
            raise HTTPException(status_code=404, detail="No projects found")
        
        # Process each project
        for project in projects:
            project_id = str(project['id'])
            project_name = project['name']
            slug = project['slug'] or 'unknown'
            
            # Determine schema name (prefer schema_name, fallback to database_name)
            schema_name = project['schema_name'] or project['database_name']
            
            if not schema_name:
                results.append(SchemaRepairResult(
                    project_id=project_id,
                    project_name=project_name,
                    slug=slug,
                    schema_name="null",
                    status="failed",
                    message="Project has no schema_name or database_name"
                ))
                failed += 1
                continue
            
            try:
                async with pool.acquire() as conn:
                    # Check if schema exists
                    schema_exists = await conn.fetchval("""
                        SELECT EXISTS (
                            SELECT 1 FROM information_schema.schemata 
                            WHERE schema_name = $1
                        )
                    """, schema_name)
                    
                    if schema_exists and not request.force:
                        results.append(SchemaRepairResult(
                            project_id=project_id,
                            project_name=project_name,
                            slug=slug,
                            schema_name=schema_name,
                            status="exists",
                            message=f"Schema '{schema_name}' already exists"
                        ))
                        skipped += 1
                        continue
                    
                    # Create schema
                    await conn.execute(f'CREATE SCHEMA IF NOT EXISTS "{schema_name}"')
                    
                    # Create update_updated_at_column function
                    await conn.execute(f'''
                        CREATE OR REPLACE FUNCTION "{schema_name}".update_updated_at_column()
                        RETURNS TRIGGER AS $$
                        BEGIN
                            NEW.updated_at = NOW();
                            RETURN NEW;
                        END;
                        $$ LANGUAGE plpgsql;
                    ''')
                    
                    # Create metadata table
                    await conn.execute(f'''
                        CREATE TABLE IF NOT EXISTS "{schema_name}"._zendbx_metadata (
                            id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
                            table_name VARCHAR(255) UNIQUE NOT NULL,
                            created_by VARCHAR(255),
                            created_at TIMESTAMPTZ DEFAULT NOW(),
                            updated_at TIMESTAMPTZ DEFAULT NOW()
                        )
                    ''')
                    
                    # Update projects table if schema_name was null
                    if not project['schema_name']:
                        await conn.execute("""
                            UPDATE projects 
                            SET schema_name = $1, updated_at = NOW()
                            WHERE id = $2
                        """, schema_name, project['id'])
                    
                    results.append(SchemaRepairResult(
                        project_id=project_id,
                        project_name=project_name,
                        slug=slug,
                        schema_name=schema_name,
                        status="created",
                        message=f"Schema '{schema_name}' created successfully"
                    ))
                    repaired += 1
                    logger.info(f"✅ Repaired schema for project {project_name} ({schema_name})")
                    
            except Exception as e:
                error_msg = str(e)
                results.append(SchemaRepairResult(
                    project_id=project_id,
                    project_name=project_name,
                    slug=slug,
                    schema_name=schema_name,
                    status="failed",
                    message=f"Failed to create schema: {error_msg}"
                ))
                failed += 1
                logger.error(f"❌ Failed to repair schema for {project_name}: {error_msg}")
        
        return SchemaRepairResponse(
            total_projects=len(projects),
            repaired=repaired,
            failed=failed,
            skipped=skipped,
            results=results
        )
        
    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Schema repair failed: {str(e)}")
        raise HTTPException(
            status_code=500,
            detail=f"Schema repair failed: {str(e)}"
        )


@router.get("/api/admin/check-schemas")
async def check_project_schemas(
    _current_user: dict = Depends(require_admin),
):
    """
    Check all projects for missing schemas without repairing them.
    Returns a report of schema status for all projects.
    
    Security: Admin-only endpoint
    """
    pool = await get_main_db_pool()
    
    try:
        async with pool.acquire() as conn:
            # Get all projects
            projects = await conn.fetch("""
                SELECT id, name, slug, database_name, schema_name, created_at
                FROM projects
                ORDER BY created_at DESC
            """)
            
            report = []
            missing_count = 0
            
            for project in projects:
                schema_name = project['schema_name'] or project['database_name']
                
                if not schema_name:
                    report.append({
                        "project_id": str(project['id']),
                        "project_name": project['name'],
                        "slug": project['slug'],
                        "schema_name": None,
                        "schema_exists": False,
                        "issue": "No schema_name or database_name configured"
                    })
                    missing_count += 1
                    continue
                
                # Check if schema exists
                schema_exists = await conn.fetchval("""
                    SELECT EXISTS (
                        SELECT 1 FROM information_schema.schemata 
                        WHERE schema_name = $1
                    )
                """, schema_name)
                
                if not schema_exists:
                    missing_count += 1
                
                report.append({
                    "project_id": str(project['id']),
                    "project_name": project['name'],
                    "slug": project['slug'],
                    "schema_name": schema_name,
                    "schema_exists": schema_exists,
                    "issue": None if schema_exists else f"Schema '{schema_name}' does not exist"
                })
            
            return {
                "total_projects": len(projects),
                "schemas_exist": len(projects) - missing_count,
                "schemas_missing": missing_count,
                "projects": report
            }
            
    except Exception as e:
        logger.error(f"Schema check failed: {str(e)}")
        raise HTTPException(
            status_code=500,
            detail=f"Schema check failed: {str(e)}"
        )
