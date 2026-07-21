"""
Admin API for Project Repair and Diagnostics

Provides endpoints for:
- Running diagnostic scans
- Viewing project health reports
- Finding orphaned resources
- Checking specific projects
"""

from fastapi import APIRouter, HTTPException, Depends
from uuid import UUID
from app.core.rbac import require_admin
from app.services.project_repair import (
    ProjectDiagnostic,
    generate_diagnostic_report
)
from app.core.config import settings
import logging

logger = logging.getLogger(__name__)

router = APIRouter()


@router.get("/api/admin/projects/diagnostic/scan-all")
async def scan_all_projects(_current_user: dict = Depends(require_admin)):
    """
    Scan all projects and return diagnostic report.
    
    Returns:
        - total_projects: int
        - healthy_projects: int
        - projects_with_issues: int
        - issues: List of issues found
        - issue_summary: Issue counts by type
        - severity_summary: Issue counts by severity
    """
    try:
        diagnostic = ProjectDiagnostic(settings.DATABASE_URL)
        result = await diagnostic.scan_all_projects()
        
        logger.info(
            f"Diagnostic scan completed: {result['total_projects']} projects, "
            f"{result['projects_with_issues']} with issues"
        )
        
        return result
        
    except Exception as e:
        logger.error(f"Diagnostic scan failed: {e}")
        raise HTTPException(
            status_code=500,
            detail=f"Diagnostic scan failed: {str(e)}"
        )


@router.get("/api/admin/projects/diagnostic/scan/{project_id}")
async def scan_project(
    project_id: UUID,
    _current_user: dict = Depends(require_admin)
):
    """
    Scan a specific project for issues.
    
    Returns:
        - project: Project details
        - issues: List of issues found
        - status: 'healthy' or 'has_issues'
    """
    try:
        diagnostic = ProjectDiagnostic(settings.DATABASE_URL)
        result = await diagnostic.scan_project_by_id(project_id)
        
        if 'error' in result:
            raise HTTPException(status_code=404, detail=result['error'])
        
        return result
        
    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Project scan failed for {project_id}: {e}")
        raise HTTPException(
            status_code=500,
            detail=f"Project scan failed: {str(e)}"
        )


@router.get("/api/admin/projects/diagnostic/orphaned-schemas")
async def find_orphaned_schemas(_current_user: dict = Depends(require_admin)):
    """
    Find schemas that exist in database but have no project row.
    
    Returns:
        List of orphaned schema names
    """
    try:
        diagnostic = ProjectDiagnostic(settings.DATABASE_URL)
        orphaned = await diagnostic.find_orphaned_schemas()
        
        return {
            "orphaned_schemas": orphaned,
            "count": len(orphaned)
        }
        
    except Exception as e:
        logger.error(f"Orphaned schema search failed: {e}")
        raise HTTPException(
            status_code=500,
            detail=f"Orphaned schema search failed: {str(e)}"
        )


@router.get("/api/admin/projects/diagnostic/report")
async def get_diagnostic_report(_current_user: dict = Depends(require_admin)):
    """
    Generate human-readable diagnostic report.
    
    Returns:
        Text report with full diagnostic details
    """
    try:
        report = await generate_diagnostic_report(settings.DATABASE_URL)
        
        return {
            "report": report,
            "format": "text"
        }
        
    except Exception as e:
        logger.error(f"Report generation failed: {e}")
        raise HTTPException(
            status_code=500,
            detail=f"Report generation failed: {str(e)}"
        )
