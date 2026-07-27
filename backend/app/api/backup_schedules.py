from fastapi import APIRouter, Depends, HTTPException
from typing import Optional
from pydantic import BaseModel
from app.core.security import get_current_user
from app.core.database import get_main_db_pool
from app.services.backup_scheduler import get_scheduler
import uuid
from datetime import datetime

router = APIRouter(prefix="/api/backup-schedules", tags=["backup-schedules"])


class CreateScheduleRequest(BaseModel):
    project_id: str
    frequency: str  # hourly, daily, weekly, monthly
    retention_days: int = 30
    enabled: bool = True


class UpdateScheduleRequest(BaseModel):
    frequency: Optional[str] = None
    retention_days: Optional[int] = None
    enabled: Optional[bool] = None


@router.post("/create")
async def create_backup_schedule(
    request: CreateScheduleRequest,
    current_user: dict = Depends(get_current_user)
):
    """Create a new backup schedule"""
    
    user_id = current_user.id if hasattr(current_user, 'id') else current_user["id"]
    if isinstance(user_id, str):
        user_id = uuid.UUID(user_id)
    
    # Verify user owns the project
    pool = await get_main_db_pool()
    async with pool.acquire() as conn:
        project = await conn.fetchrow(
            "SELECT id, name FROM projects WHERE id = $1 AND user_id = $2",
            uuid.UUID(request.project_id), user_id
        )
        
        if not project:
            raise HTTPException(status_code=404, detail="Project not found")
        
        # Check if schedule already exists
        existing = await conn.fetchrow(
            "SELECT id FROM backup_schedules WHERE project_id = $1",
            uuid.UUID(request.project_id)
        )
        
        if existing:
            raise HTTPException(
                status_code=400,
                detail="Backup schedule already exists for this project. Use update endpoint instead."
            )
        
        # Calculate next run time based on frequency
        if request.frequency == "hourly":
            next_run = datetime.now()
        elif request.frequency == "daily":
            next_run = datetime.now().replace(hour=0, minute=0, second=0, microsecond=0)
        elif request.frequency == "weekly":
            next_run = datetime.now().replace(hour=0, minute=0, second=0, microsecond=0)
        elif request.frequency == "monthly":
            next_run = datetime.now().replace(day=1, hour=0, minute=0, second=0, microsecond=0)
        else:
            raise HTTPException(status_code=400, detail="Invalid frequency")
        
        # Create schedule
        schedule = await conn.fetchrow(
            """
            INSERT INTO backup_schedules 
            (project_id, frequency, retention_days, enabled, next_run_at)
            VALUES ($1, $2, $3, $4, $5)
            RETURNING id, project_id, frequency, retention_days, enabled, 
                      next_run_at, created_at
            """,
            uuid.UUID(request.project_id),
            request.frequency,
            request.retention_days,
            request.enabled,
            next_run
        )
        
        return {
            "success": True,
            "message": f"Backup schedule created for {request.frequency} backups",
            "schedule": {
                "id": str(schedule["id"]),
                "project_id": str(schedule["project_id"]),
                "frequency": schedule["frequency"],
                "retention_days": schedule["retention_days"],
                "enabled": schedule["enabled"],
                "next_run_at": schedule["next_run_at"].isoformat(),
                "created_at": schedule["created_at"].isoformat()
            }
        }


@router.get("/list/{project_id}")
async def get_backup_schedule(
    project_id: str,
    current_user: dict = Depends(get_current_user)
):
    """Get backup schedule for a project"""
    
    user_id = current_user.id if hasattr(current_user, 'id') else current_user["id"]
    if isinstance(user_id, str):
        user_id = uuid.UUID(user_id)
    
    pool = await get_main_db_pool()
    async with pool.acquire() as conn:
        # Verify user owns the project
        project = await conn.fetchrow(
            "SELECT id FROM projects WHERE id = $1 AND user_id = $2",
            uuid.UUID(project_id), user_id
        )
        
        if not project:
            raise HTTPException(status_code=404, detail="Project not found")
        
        # Get schedule
        schedule = await conn.fetchrow(
            """
            SELECT id, project_id, frequency, retention_days, enabled,
                   next_run_at, last_run_at, last_backup_status, created_at
            FROM backup_schedules
            WHERE project_id = $1
            """,
            uuid.UUID(project_id)
        )
        
        if not schedule:
            return {
                "success": True,
                "schedule": None
            }
        
        return {
            "success": True,
            "schedule": {
                "id": str(schedule["id"]),
                "project_id": str(schedule["project_id"]),
                "frequency": schedule["frequency"],
                "retention_days": schedule["retention_days"],
                "enabled": schedule["enabled"],
                "next_run_at": schedule["next_run_at"].isoformat() if schedule["next_run_at"] else None,
                "last_run_at": schedule["last_run_at"].isoformat() if schedule["last_run_at"] else None,
                "last_backup_status": schedule["last_backup_status"],
                "created_at": schedule["created_at"].isoformat()
            }
        }


@router.put("/{schedule_id}")
async def update_backup_schedule(
    schedule_id: str,
    request: UpdateScheduleRequest,
    current_user: dict = Depends(get_current_user)
):
    """Update backup schedule"""
    
    user_id = current_user.id if hasattr(current_user, 'id') else current_user["id"]
    if isinstance(user_id, str):
        user_id = uuid.UUID(user_id)
    
    pool = await get_main_db_pool()
    async with pool.acquire() as conn:
        # Verify user owns the schedule
        schedule = await conn.fetchrow(
            """
            SELECT s.id, p.user_id
            FROM backup_schedules s
            JOIN projects p ON s.project_id = p.id
            WHERE s.id = $1
            """,
            uuid.UUID(schedule_id)
        )
        
        if not schedule:
            raise HTTPException(status_code=404, detail="Schedule not found")
        
        if schedule["user_id"] != user_id:
            raise HTTPException(status_code=403, detail="Access denied")
        
        # Build update query
        updates = []
        values = []
        param_count = 1
        
        if request.frequency is not None:
            updates.append(f"frequency = ${param_count}")
            values.append(request.frequency)
            param_count += 1
        
        if request.retention_days is not None:
            updates.append(f"retention_days = ${param_count}")
            values.append(request.retention_days)
            param_count += 1
        
        if request.enabled is not None:
            updates.append(f"enabled = ${param_count}")
            values.append(request.enabled)
            param_count += 1
        
        if not updates:
            raise HTTPException(status_code=400, detail="No fields to update")
        
        # Add schedule_id as last parameter
        values.append(uuid.UUID(schedule_id))
        
        query = f"""
            UPDATE backup_schedules
            SET {', '.join(updates)}
            WHERE id = ${param_count}
            RETURNING id, project_id, frequency, retention_days, enabled,
                      next_run_at, last_run_at, last_backup_status
        """
        
        updated = await conn.fetchrow(query, *values)
        
        return {
            "success": True,
            "message": "Schedule updated successfully",
            "schedule": {
                "id": str(updated["id"]),
                "project_id": str(updated["project_id"]),
                "frequency": updated["frequency"],
                "retention_days": updated["retention_days"],
                "enabled": updated["enabled"],
                "next_run_at": updated["next_run_at"].isoformat() if updated["next_run_at"] else None,
                "last_run_at": updated["last_run_at"].isoformat() if updated["last_run_at"] else None,
                "last_backup_status": updated["last_backup_status"]
            }
        }


@router.delete("/{schedule_id}")
async def delete_backup_schedule(
    schedule_id: str,
    current_user: dict = Depends(get_current_user)
):
    """Delete backup schedule"""
    
    user_id = current_user.id if hasattr(current_user, 'id') else current_user["id"]
    if isinstance(user_id, str):
        user_id = uuid.UUID(user_id)
    
    pool = await get_main_db_pool()
    async with pool.acquire() as conn:
        # Verify user owns the schedule
        schedule = await conn.fetchrow(
            """
            SELECT s.id, p.user_id
            FROM backup_schedules s
            JOIN projects p ON s.project_id = p.id
            WHERE s.id = $1
            """,
            uuid.UUID(schedule_id)
        )
        
        if not schedule:
            raise HTTPException(status_code=404, detail="Schedule not found")
        
        if schedule["user_id"] != user_id:
            raise HTTPException(status_code=403, detail="Access denied")
        
        # Delete schedule
        await conn.execute(
            "DELETE FROM backup_schedules WHERE id = $1",
            uuid.UUID(schedule_id)
        )
        
        return {
            "success": True,
            "message": "Schedule deleted successfully"
        }


@router.post("/{schedule_id}/run-now")
async def run_schedule_now(
    schedule_id: str,
    current_user: dict = Depends(get_current_user)
):
    """Manually trigger a scheduled backup immediately"""
    
    user_id = current_user.id if hasattr(current_user, 'id') else current_user["id"]
    if isinstance(user_id, str):
        user_id = uuid.UUID(user_id)
    
    pool = await get_main_db_pool()
    async with pool.acquire() as conn:
        # Verify user owns the schedule
        schedule = await conn.fetchrow(
            """
            SELECT s.id, p.user_id
            FROM backup_schedules s
            JOIN projects p ON s.project_id = p.id
            WHERE s.id = $1
            """,
            uuid.UUID(schedule_id)
        )
        
        if not schedule:
            raise HTTPException(status_code=404, detail="Schedule not found")
        
        if schedule["user_id"] != user_id:
            raise HTTPException(status_code=403, detail="Access denied")
    
    try:
        # Get scheduler and run the backup
        scheduler = await get_scheduler()
        await scheduler.run_schedule_now(schedule_id)
        
        return {
            "success": True,
            "message": "Backup started successfully"
        }
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))
