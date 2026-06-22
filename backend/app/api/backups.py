from fastapi import APIRouter, Depends, HTTPException, BackgroundTasks
from typing import List, Optional
from pydantic import BaseModel
from app.core.security import get_current_user
from app.services.backup_service import BackupService
from app.core.database import get_main_db_pool
import uuid

router = APIRouter(prefix="/api/backups", tags=["backups"])

class CreateBackupRequest(BaseModel):
    project_id: str
    backup_name: Optional[str] = None
    backup_type: str = "manual"

class RestoreBackupRequest(BaseModel):
    backup_id: str
    target_db_name: Optional[str] = None
    confirm: bool = False

class BackupResponse(BaseModel):
    id: str
    backup_name: str
    backup_type: str
    status: str
    file_size: Optional[int] = None
    created_at: str
    completed_at: Optional[str] = None
    error_message: Optional[str] = None

@router.post("/create")
async def create_backup(
    request: CreateBackupRequest,
    background_tasks: BackgroundTasks,
    current_user: dict = Depends(get_current_user)
):
    """Create a new backup"""
    
    # Get user ID - handle both dict and object formats
    user_id = current_user.id if hasattr(current_user, 'id') else current_user["id"]
    # Convert to UUID if it's a string
    if isinstance(user_id, str):
        user_id = uuid.UUID(user_id)
    
    # Verify user has access to project
    pool = await get_main_db_pool()
    async with pool.acquire() as conn:
        project = await conn.fetchrow(
            """
            SELECT id, database_name, name
            FROM projects
            WHERE id = $1 AND user_id = $2
            """,
            uuid.UUID(request.project_id), user_id
        )
        
        if not project:
            raise HTTPException(status_code=404, detail="Project not found")
    
    # Create backup
    try:
        backup_service = BackupService()
        backup = await backup_service.create_backup(
            project_id=request.project_id,
            db_name=project["database_name"],
            backup_name=request.backup_name,
            backup_type=request.backup_type,
            user_id=str(user_id)
        )
        
        return {
            "success": True,
            "message": f"Backup '{backup['name']}' created successfully",
            "backup": backup
        }
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))

@router.get("/list/{project_id}")
async def list_backups(
    project_id: str,
    limit: int = 50,
    offset: int = 0,
    current_user: dict = Depends(get_current_user)
):
    """List all backups for a project"""
    
    # Get user ID - handle both dict and object formats
    user_id = current_user.id if hasattr(current_user, 'id') else current_user["id"]
    # Convert to UUID if it's a string
    if isinstance(user_id, str):
        user_id = uuid.UUID(user_id)
    
    # Verify user has access to project
    pool = await get_main_db_pool()
    async with pool.acquire() as conn:
        project = await conn.fetchrow(
            "SELECT id FROM projects WHERE id = $1 AND user_id = $2",
            uuid.UUID(project_id), user_id
        )
        
        if not project:
            raise HTTPException(status_code=404, detail="Project not found")
    
    # Get backups
    backup_service = BackupService()
    backups = await backup_service.list_backups(project_id, limit, offset)
    
    # Format dates
    for backup in backups:
        if backup.get("created_at"):
            backup["created_at"] = backup["created_at"].isoformat()
        if backup.get("completed_at"):
            backup["completed_at"] = backup["completed_at"].isoformat()
        # Convert UUID to string
        backup["id"] = str(backup["id"])
    
    return {
        "success": True,
        "backups": backups,
        "total": len(backups)
    }

@router.post("/restore")
async def restore_backup(
    request: RestoreBackupRequest,
    current_user: dict = Depends(get_current_user)
):
    """Restore database from backup"""
    
    if not request.confirm:
        raise HTTPException(
            status_code=400,
            detail="Confirmation required. Set 'confirm' to true to proceed with restore."
        )
    
    # Get user ID - handle both dict and object formats
    user_id = current_user.id if hasattr(current_user, 'id') else current_user["id"]
    
    # Verify user owns the backup
    pool = await get_main_db_pool()
    async with pool.acquire() as conn:
        backup = await conn.fetchrow(
            """
            SELECT b.id, b.project_id, p.user_id
            FROM backups b
            JOIN projects p ON b.project_id = p.id
            WHERE b.id = $1
            """,
            uuid.UUID(request.backup_id)
        )
        
        if not backup:
            raise HTTPException(status_code=404, detail="Backup not found")
        
        if str(backup["user_id"]) != str(user_id):
            raise HTTPException(status_code=403, detail="Access denied")
    
    # Restore backup
    try:
        backup_service = BackupService()
        result = await backup_service.restore_backup(
            backup_id=request.backup_id,
            target_db_name=request.target_db_name
        )
        
        return {
            "success": True,
            "message": result["message"]
        }
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))

@router.delete("/{backup_id}")
async def delete_backup(
    backup_id: str,
    current_user: dict = Depends(get_current_user)
):
    """Delete a backup"""
    
    # Get user ID - handle both dict and object formats
    user_id = current_user.id if hasattr(current_user, 'id') else current_user["id"]
    
    # Verify user owns the backup
    pool = await get_main_db_pool()
    async with pool.acquire() as conn:
        backup = await conn.fetchrow(
            """
            SELECT b.id, p.user_id
            FROM backups b
            JOIN projects p ON b.project_id = p.id
            WHERE b.id = $1
            """,
            uuid.UUID(backup_id)
        )
        
        if not backup:
            raise HTTPException(status_code=404, detail="Backup not found")
        
        if str(backup["user_id"]) != str(user_id):
            raise HTTPException(status_code=403, detail="Access denied")
    
    # Delete backup
    try:
        backup_service = BackupService()
        await backup_service.delete_backup(backup_id)
        
        return {
            "success": True,
            "message": "Backup deleted successfully"
        }
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))

@router.post("/cleanup/{project_id}")
async def cleanup_old_backups(
    project_id: str,
    retention_days: int = 30,
    current_user: dict = Depends(get_current_user)
):
    """Delete backups older than retention period"""
    
    # Verify user has access to project
    pool = await get_main_db_pool()
    async with pool.acquire() as conn:
        project = await conn.fetchrow(
            "SELECT id FROM projects WHERE id = $1 AND user_id = $2",
            uuid.UUID(project_id), uuid.UUID(current_user["id"])
        )
        
        if not project:
            raise HTTPException(status_code=404, detail="Project not found")
    
    # Cleanup old backups
    try:
        backup_service = BackupService()
        deleted_count = await backup_service.cleanup_old_backups(
            project_id, retention_days
        )
        
        return {
            "success": True,
            "message": f"Deleted {deleted_count} old backup(s)",
            "deleted_count": deleted_count
        }
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))

@router.get("/{backup_id}/download")
async def download_backup(
    backup_id: str,
    current_user: dict = Depends(get_current_user)
):
    """Download backup file"""
    from fastapi.responses import FileResponse
    import os

    # Get user ID - handle both dict and object formats
    user_id = current_user.id if hasattr(current_user, 'id') else current_user["id"]
    
    # Verify user owns the backup
    pool = await get_main_db_pool()
    async with pool.acquire() as conn:
        backup = await conn.fetchrow(
            """
            SELECT b.id, b.file_path, b.backup_name, p.user_id
            FROM backups b
            JOIN projects p ON b.project_id = p.id
            WHERE b.id = $1
            """,
            uuid.UUID(backup_id)
        )
        
        if not backup:
            raise HTTPException(status_code=404, detail="Backup not found")
        
        if str(backup["user_id"]) != str(user_id):
            raise HTTPException(status_code=403, detail="Access denied")
    
    # Check if file exists
    file_path = backup["file_path"]
    if not file_path:
        raise HTTPException(status_code=404, detail="Backup file not found on disk")

    # HIGH-7 FIX: Prevent path traversal by resolving the real path and
    # confirming it sits inside the designated backup directory.
    BACKUP_BASE = os.path.realpath("./backups")
    real_path = os.path.realpath(file_path)
    if not real_path.startswith(BACKUP_BASE + os.sep) and real_path != BACKUP_BASE:
        raise HTTPException(status_code=403, detail="Invalid backup path")

    if not os.path.exists(real_path):
        raise HTTPException(status_code=404, detail="Backup file not found on disk")
    
    # Return file for download
    filename = f"{backup['backup_name']}.sql.gz"
    return FileResponse(
        path=real_path,
        filename=filename,
        media_type="application/gzip",
        headers={
            "Content-Disposition": f'attachment; filename="{filename}"'
        }
    )
