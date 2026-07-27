import asyncio
from datetime import datetime, timedelta
from typing import Dict, Any, List
import uuid
from app.core.database import get_main_db_pool
from app.services.backup_service import BackupService


class BackupScheduler:
    def __init__(self):
        self.backup_service = BackupService()
        self.running = False
        self._task = None
    
    async def start(self):
        """Start the backup scheduler"""
        if self.running:
            print("⚠️  Backup scheduler is already running")
            return
        
        self.running = True
        self._task = asyncio.create_task(self._schedule_loop())
        print("✅ Backup scheduler started")
    
    async def stop(self):
        """Stop the backup scheduler"""
        self.running = False
        if self._task:
            self._task.cancel()
            try:
                await self._task
            except asyncio.CancelledError:
                pass
        print("🛑 Backup scheduler stopped")
    
    async def _schedule_loop(self):
        """Main scheduling loop - checks every minute"""
        while self.running:
            try:
                await self._check_and_run_due_backups()
            except Exception as e:
                print(f"❌ Error in backup scheduler: {e}")
            
            # Sleep for 1 minute before next check
            await asyncio.sleep(60)
    
    async def _check_and_run_due_backups(self):
        """Check for due backup schedules and run them"""
        now = datetime.now()
        
        pool = await get_main_db_pool()
        async with pool.acquire() as conn:
            # Get all enabled schedules that are due
            schedules = await conn.fetch(
                """
                SELECT 
                    s.id,
                    s.project_id,
                    s.frequency,
                    s.retention_days,
                    s.next_run_at,
                    p.database_name,
                    p.name as project_name
                FROM backup_schedules s
                JOIN projects p ON s.project_id = p.id
                WHERE s.enabled = true
                AND s.next_run_at <= $1
                ORDER BY s.next_run_at ASC
                """,
                now
            )
            
            if not schedules:
                return
            
            print(f"\n📅 Found {len(schedules)} scheduled backup(s) to run")
            
            for schedule in schedules:
                try:
                    await self._run_scheduled_backup(schedule)
                except Exception as e:
                    print(f"❌ Failed to run backup for schedule {schedule['id']}: {e}")
    
    async def _run_scheduled_backup(self, schedule: Dict[str, Any]):
        """Run a scheduled backup"""
        schedule_id = schedule['id']
        project_id = str(schedule['project_id'])
        db_name = schedule['database_name']
        project_name = schedule['project_name']
        frequency = schedule['frequency']
        
        print(f"🚀 Running scheduled backup for project '{project_name}' ({frequency})")
        
        # Create backup name with timestamp
        timestamp = datetime.now().strftime("%Y%m%d_%H%M%S")
        backup_name = f"{project_name}_scheduled_{frequency}_{timestamp}"
        
        try:
            # Create the backup
            backup = await self.backup_service.create_backup(
                project_id=project_id,
                db_name=db_name,
                backup_name=backup_name,
                backup_type="scheduled",
                user_id=None  # System-generated backup
            )
            
            print(f"✅ Scheduled backup completed: {backup['name']}")
            
            # Update schedule with next run time
            next_run = self._calculate_next_run(frequency)
            await self._update_schedule_next_run(schedule_id, next_run, success=True)
            
            # Cleanup old backups based on retention policy
            await self._cleanup_old_scheduled_backups(
                project_id,
                schedule['retention_days']
            )
            
        except Exception as e:
            print(f"❌ Scheduled backup failed: {e}")
            # Still update next run time even on failure
            next_run = self._calculate_next_run(frequency)
            await self._update_schedule_next_run(schedule_id, next_run, success=False, error=str(e))
    
    def _calculate_next_run(self, frequency: str) -> datetime:
        """Calculate the next run time based on frequency"""
        now = datetime.now()
        
        if frequency == "hourly":
            return now + timedelta(hours=1)
        elif frequency == "daily":
            # Run at midnight
            next_day = now + timedelta(days=1)
            return datetime(next_day.year, next_day.month, next_day.day, 0, 0, 0)
        elif frequency == "weekly":
            # Run every Sunday at midnight
            days_until_sunday = (6 - now.weekday()) % 7
            if days_until_sunday == 0:
                days_until_sunday = 7
            next_run = now + timedelta(days=days_until_sunday)
            return datetime(next_run.year, next_run.month, next_run.day, 0, 0, 0)
        elif frequency == "monthly":
            # Run on the 1st of next month at midnight
            if now.month == 12:
                return datetime(now.year + 1, 1, 1, 0, 0, 0)
            else:
                return datetime(now.year, now.month + 1, 1, 0, 0, 0)
        else:
            # Default to daily if unknown frequency
            return now + timedelta(days=1)
    
    async def _update_schedule_next_run(
        self, 
        schedule_id: uuid.UUID, 
        next_run: datetime, 
        success: bool,
        error: str = None
    ):
        """Update the schedule's next run time and last run info"""
        pool = await get_main_db_pool()
        async with pool.acquire() as conn:
            if success:
                await conn.execute(
                    """
                    UPDATE backup_schedules
                    SET next_run_at = $1,
                        last_run_at = NOW(),
                        last_backup_status = 'success'
                    WHERE id = $2
                    """,
                    next_run, schedule_id
                )
            else:
                await conn.execute(
                    """
                    UPDATE backup_schedules
                    SET next_run_at = $1,
                        last_run_at = NOW(),
                        last_backup_status = 'failed'
                    WHERE id = $2
                    """,
                    next_run, schedule_id
                )
    
    async def _cleanup_old_scheduled_backups(self, project_id: str, retention_days: int):
        """Clean up old scheduled backups based on retention policy"""
        if retention_days <= 0:
            return  # Retention disabled
        
        try:
            deleted_count = await self.backup_service.cleanup_old_backups(
                project_id, retention_days
            )
            if deleted_count > 0:
                print(f"🧹 Cleaned up {deleted_count} old backup(s)")
        except Exception as e:
            print(f"⚠️  Failed to cleanup old backups: {e}")
    
    async def run_schedule_now(self, schedule_id: str):
        """Manually trigger a scheduled backup immediately"""
        pool = await get_main_db_pool()
        async with pool.acquire() as conn:
            schedule = await conn.fetchrow(
                """
                SELECT 
                    s.id,
                    s.project_id,
                    s.frequency,
                    s.retention_days,
                    s.next_run_at,
                    p.database_name,
                    p.name as project_name
                FROM backup_schedules s
                JOIN projects p ON s.project_id = p.id
                WHERE s.id = $1
                """,
                uuid.UUID(schedule_id)
            )
            
            if not schedule:
                raise Exception("Schedule not found")
            
            if not schedule.get('enabled', True):
                raise Exception("Schedule is disabled")
            
            await self._run_scheduled_backup(dict(schedule))


# Global scheduler instance
_scheduler = None


async def get_scheduler() -> BackupScheduler:
    """Get or create the global scheduler instance"""
    global _scheduler
    if _scheduler is None:
        _scheduler = BackupScheduler()
    return _scheduler
