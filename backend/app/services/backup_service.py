import subprocess
import os
import gzip
import shutil
import json
from datetime import datetime, timedelta
from pathlib import Path
from typing import Optional, Dict, Any, List
from urllib.parse import unquote
import asyncpg
from app.core.database import get_main_db_pool, get_project_db_pool
from app.core.config import settings
import uuid
import platform

class BackupService:
    def __init__(self, backup_dir: str = "./backups"):
        self.backup_dir = Path(backup_dir)
        self.backup_dir.mkdir(exist_ok=True)
        self.pg_dump_path = self._find_pg_dump()
        self.psql_path = self._find_psql()
    
    def _find_pg_dump(self) -> str:
        """Find pg_dump executable on the system"""
        
        # Try to find in PATH first
        if shutil.which("pg_dump"):
            return "pg_dump"
        
        # Windows-specific search
        if platform.system() == "Windows":
            common_paths = [
                r"C:\Program Files\PostgreSQL\16\bin\pg_dump.exe",
                r"C:\Program Files\PostgreSQL\15\bin\pg_dump.exe",
                r"C:\Program Files\PostgreSQL\14\bin\pg_dump.exe",
                r"C:\Program Files\PostgreSQL\13\bin\pg_dump.exe",
                r"C:\Program Files (x86)\PostgreSQL\16\bin\pg_dump.exe",
                r"C:\Program Files (x86)\PostgreSQL\15\bin\pg_dump.exe",
                r"C:\Program Files (x86)\PostgreSQL\14\bin\pg_dump.exe",
            ]
            
            for path in common_paths:
                if os.path.exists(path):
                    return path
        
        # If not found, return default and let it fail with helpful error
        return "pg_dump"
    
    def _find_psql(self) -> str:
        """Find psql executable on the system"""
        
        # Try to find in PATH first
        if shutil.which("psql"):
            return "psql"
        
        # Windows-specific search
        if platform.system() == "Windows":
            common_paths = [
                r"C:\Program Files\PostgreSQL\16\bin\psql.exe",
                r"C:\Program Files\PostgreSQL\15\bin\psql.exe",
                r"C:\Program Files\PostgreSQL\14\bin\psql.exe",
                r"C:\Program Files\PostgreSQL\13\bin\psql.exe",
                r"C:\Program Files (x86)\PostgreSQL\16\bin\psql.exe",
                r"C:\Program Files (x86)\PostgreSQL\15\bin\psql.exe",
                r"C:\Program Files (x86)\PostgreSQL\14\bin\psql.exe",
            ]
            
            for path in common_paths:
                if os.path.exists(path):
                    return path
        
        # If not found, return default and let it fail with helpful error
        return "psql"
    
    async def create_backup(
        self,
        project_id: str,
        db_name: str,
        backup_name: Optional[str] = None,
        backup_type: str = "manual",
        user_id: Optional[str] = None
    ) -> Dict[str, Any]:
        """Create a database backup using pg_dump"""
        
        # Generate backup name if not provided
        if not backup_name:
            timestamp = datetime.now().strftime("%Y%m%d_%H%M%S")
            backup_name = f"{db_name}_{timestamp}"
        
        # Create backup record
        backup_id = await self._create_backup_record(
            project_id, backup_name, backup_type, user_id
        )
        
        try:
            # Update status to in_progress
            await self._update_backup_status(backup_id, "in_progress")
            
            # Execute pg_dump
            file_path = await self._execute_pg_dump(
                db_name, backup_name, backup_id
            )
            
            # Compress backup
            compressed_path = await self._compress_backup(file_path)
            
            # Get file size
            file_size = os.path.getsize(compressed_path)
            
            # Get metadata
            metadata = await self._get_backup_metadata(db_name)
            
            # Update backup record
            await self._update_backup_record(
                backup_id,
                status="completed",
                file_path=str(compressed_path),
                file_size=file_size,
                metadata=metadata
            )
            
            return {
                "id": backup_id,
                "name": backup_name,
                "status": "completed",
                "file_size": file_size,
                "file_path": str(compressed_path),
                "metadata": metadata
            }
            
        except Exception as e:
            await self._update_backup_status(
                backup_id, "failed", error_message=str(e)
            )
            raise Exception(f"Backup failed: {str(e)}")
    
    async def _execute_pg_dump(
        self, db_name: str, backup_name: str, backup_id: str
    ) -> Path:
        """Execute pg_dump command"""
        
        file_path = self.backup_dir / f"{backup_id}.sql"
        
        # Verify database exists and is accessible
        print(f"🔍 Verifying database access: {db_name}")
        validation = await self._validate_database_access(db_name)
        if not validation.get("accessible"):
            raise Exception(f"Cannot access database '{db_name}': {validation.get('error')}")
        
        if validation.get("table_count", 0) == 0:
            print(f"⚠️  Warning: Database '{db_name}' has no tables")
        else:
            print(f"✓ Database has {validation['table_count']} tables, {validation['row_count']} rows")
        
        # Parse database connection details
        db_url = settings.DATABASE_URL
        # Extract components from URL: postgresql://user:pass@host:port/dbname
        parts = db_url.replace("postgresql://", "").split("@")
        user_pass = parts[0].split(":")
        host_port_db = parts[1].split("/")
        host_port = host_port_db[0].split(":")
        
        db_user = user_pass[0]
        # URL-decode the password (e.g., %40 -> @)
        db_password = unquote(user_pass[1]) if len(user_pass) > 1 else ""
        db_host = host_port[0]
        db_port = host_port[1] if len(host_port) > 1 else "5432"
        
        print(f"🔧 Connection: {db_user}@{db_host}:{db_port}/{db_name}")
        
        # pg_dump command with data
        cmd = [
            self.pg_dump_path,
            "-h", db_host,
            "-p", db_port,
            "-U", db_user,
            "-d", db_name,
            "-f", str(file_path),
            "--format=plain",
            "--no-owner",
            "--no-acl",
            "--clean",
            "--if-exists",
            "--verbose",
            "--data-only" if validation.get("table_count", 0) == 0 else "--inserts"  # Use inserts for better compatibility
        ]
        
        # Set password via environment
        env = os.environ.copy()
        env["PGPASSWORD"] = db_password
        
        # Execute
        print(f"🚀 Executing pg_dump...")
        try:
            result = subprocess.run(
                cmd, env=env, capture_output=True, text=True, timeout=300
            )
        except FileNotFoundError:
            raise Exception(
                f"pg_dump not found. Please install PostgreSQL or add it to PATH.\n"
                f"Searched for: {self.pg_dump_path}\n"
                f"Windows: Download from https://www.postgresql.org/download/windows/\n"
                f"Add to PATH: C:\\Program Files\\PostgreSQL\\15\\bin"
            )
        except subprocess.TimeoutExpired:
            raise Exception("Backup operation timed out after 5 minutes")
        
        # Check for errors
        if result.returncode != 0:
            error_msg = result.stderr
            # Parse common errors
            if "does not exist" in error_msg:
                raise Exception(f"Database '{db_name}' does not exist or is not accessible")
            elif "authentication failed" in error_msg:
                raise Exception("Database authentication failed - check credentials")
            elif "could not connect" in error_msg:
                raise Exception(f"Could not connect to database server: {error_msg}")
            else:
                raise Exception(f"pg_dump failed: {error_msg}")
        
        # Verify backup file was created
        if not file_path.exists():
            raise Exception("Backup file was not created")
        
        # Check file size
        file_size = os.path.getsize(file_path)
        if file_size < 100:  # Less than 100 bytes
            raise Exception(f"Backup file is too small ({file_size} bytes) - likely empty or failed")
        
        # Log success
        print(f"✓ Backup created: {file_path.name} ({file_size:,} bytes)")
        if result.stdout:
            print(f"✓ pg_dump output: {result.stdout[:200]}")
        
        return file_path
    
    async def _compress_backup(self, file_path: Path) -> Path:
        """Compress backup file with gzip"""
        
        compressed_path = file_path.with_suffix(".sql.gz")
        
        with open(file_path, 'rb') as f_in:
            with gzip.open(compressed_path, 'wb', compresslevel=6) as f_out:
                shutil.copyfileobj(f_in, f_out)
        
        # Remove uncompressed file
        file_path.unlink()
        
        return compressed_path
    
    async def _decompress_backup(self, compressed_path: str) -> Path:
        """Decompress gzipped backup"""
        
        compressed_path = Path(compressed_path)
        sql_path = compressed_path.with_suffix("")
        
        with gzip.open(compressed_path, 'rb') as f_in:
            with open(sql_path, 'wb') as f_out:
                shutil.copyfileobj(f_in, f_out)
        
        return sql_path
    
    async def restore_backup(
        self, backup_id: str, target_db_name: Optional[str] = None
    ) -> Dict[str, Any]:
        """Restore database from backup"""
        
        # Get backup info
        backup = await self._get_backup_info(backup_id)
        
        if not backup:
            raise Exception("Backup not found")
        
        if backup["status"] != "completed":
            raise Exception(f"Backup is not completed (status: {backup['status']})")
        
        # Use original database name if target not specified
        if not target_db_name:
            # Get project database name
            pool = await get_main_db_pool()
            async with pool.acquire() as conn:
                result = await conn.fetchrow(
                    "SELECT database_name FROM projects WHERE id = $1",
                    uuid.UUID(backup["project_id"])
                )
                if not result:
                    raise Exception("Project not found")
                target_db_name = result["database_name"]
        
        try:
            # Decompress backup
            sql_file = await self._decompress_backup(backup["file_path"])
            
            # Execute restore
            await self._execute_pg_restore(sql_file, target_db_name)
            
            # Cleanup decompressed file
            sql_file.unlink()
            
            return {
                "status": "success",
                "message": f"Database '{target_db_name}' restored from backup '{backup['backup_name']}'"
            }
            
        except Exception as e:
            # Cleanup on error
            if sql_file and sql_file.exists():
                sql_file.unlink()
            raise Exception(f"Restore failed: {str(e)}")
    
    async def _execute_pg_restore(
        self, sql_file: Path, db_name: str
    ) -> None:
        """Execute psql to restore database"""
        
        # Parse database connection details
        db_url = settings.DATABASE_URL
        parts = db_url.replace("postgresql://", "").split("@")
        user_pass = parts[0].split(":")
        host_port_db = parts[1].split("/")
        host_port = host_port_db[0].split(":")
        
        db_user = user_pass[0]
        # URL-decode the password (e.g., %40 -> @)
        db_password = unquote(user_pass[1]) if len(user_pass) > 1 else ""
        db_host = host_port[0]
        db_port = host_port[1] if len(host_port) > 1 else "5432"
        
        cmd = [
            self.psql_path,
            "-h", db_host,
            "-p", db_port,
            "-U", db_user,
            "-d", db_name,
            "-f", str(sql_file),
            "-v", "ON_ERROR_STOP=1"
        ]
        
        env = os.environ.copy()
        env["PGPASSWORD"] = db_password
        
        try:
            result = subprocess.run(
                cmd, env=env, capture_output=True, text=True, timeout=300
            )
        except FileNotFoundError:
            raise Exception(
                f"psql not found. Please install PostgreSQL or add it to PATH.\n"
                f"Searched for: {self.psql_path}\n"
                f"See INSTALL_POSTGRESQL_TOOLS.md for installation instructions."
            )
        except subprocess.TimeoutExpired:
            raise Exception("Restore operation timed out after 5 minutes")
        
        if result.returncode != 0:
            raise Exception(f"Restore failed: {result.stderr}")
    
    async def list_backups(
        self, project_id: str, limit: int = 50, offset: int = 0
    ) -> List[Dict[str, Any]]:
        """List all backups for a project"""
        
        pool = await get_main_db_pool()
        async with pool.acquire() as conn:
            rows = await conn.fetch(
                """
                SELECT 
                    b.id, b.backup_name, b.backup_type, b.status,
                    b.file_path, b.file_size, b.compressed,
                    b.created_at, b.completed_at, b.error_message,
                    b.metadata, u.email as created_by_email
                FROM backups b
                LEFT JOIN users u ON b.created_by = u.id
                WHERE b.project_id = $1
                ORDER BY b.created_at DESC
                LIMIT $2 OFFSET $3
                """,
                uuid.UUID(project_id), limit, offset
            )
            
            return [dict(row) for row in rows]
    
    async def delete_backup(self, backup_id: str) -> None:
        """Delete a backup"""
        
        # Get backup info
        backup = await self._get_backup_info(backup_id)
        
        if not backup:
            raise Exception("Backup not found")
        
        # Delete file if exists
        if backup["file_path"]:
            file_path = Path(backup["file_path"])
            if file_path.exists():
                file_path.unlink()
        
        # Delete database record
        pool = await get_main_db_pool()
        async with pool.acquire() as conn:
            await conn.execute(
                "DELETE FROM backups WHERE id = $1",
                uuid.UUID(backup_id)
            )
    
    async def cleanup_old_backups(
        self, project_id: str, retention_days: int
    ) -> int:
        """Delete backups older than retention period"""
        
        cutoff_date = datetime.now() - timedelta(days=retention_days)
        
        pool = await get_main_db_pool()
        async with pool.acquire() as conn:
            # Get old backups
            old_backups = await conn.fetch(
                """
                SELECT id, file_path
                FROM backups
                WHERE project_id = $1 AND created_at < $2
                """,
                uuid.UUID(project_id), cutoff_date
            )
            
            # Delete files and records
            deleted_count = 0
            for backup in old_backups:
                try:
                    # Delete file
                    if backup["file_path"]:
                        file_path = Path(backup["file_path"])
                        if file_path.exists():
                            file_path.unlink()
                    
                    # Delete record
                    await conn.execute(
                        "DELETE FROM backups WHERE id = $1",
                        backup["id"]
                    )
                    deleted_count += 1
                except Exception as e:
                    print(f"Error deleting backup {backup['id']}: {e}")
            
            return deleted_count
    
    async def _create_backup_record(
        self, project_id: str, backup_name: str, backup_type: str, user_id: Optional[str]
    ) -> str:
        """Create a backup record in database"""
        
        pool = await get_main_db_pool()
        async with pool.acquire() as conn:
            row = await conn.fetchrow(
                """
                INSERT INTO backups (project_id, backup_name, backup_type, status, created_by)
                VALUES ($1, $2, $3, 'pending', $4)
                RETURNING id
                """,
                uuid.UUID(project_id), backup_name, backup_type,
                uuid.UUID(user_id) if user_id else None
            )
            return str(row["id"])
    
    async def _update_backup_status(
        self, backup_id: str, status: str, error_message: Optional[str] = None
    ) -> None:
        """Update backup status"""
        
        pool = await get_main_db_pool()
        async with pool.acquire() as conn:
            if error_message:
                await conn.execute(
                    """
                    UPDATE backups
                    SET status = $1, error_message = $2, completed_at = NOW()
                    WHERE id = $3
                    """,
                    status, error_message, uuid.UUID(backup_id)
                )
            else:
                await conn.execute(
                    """
                    UPDATE backups
                    SET status = $1, completed_at = NOW()
                    WHERE id = $2
                    """,
                    status, uuid.UUID(backup_id)
                )
    
    async def _update_backup_record(
        self, backup_id: str, status: str, file_path: str, file_size: int, metadata: Dict
    ) -> None:
        """Update backup record with completion details"""
        
        pool = await get_main_db_pool()
        async with pool.acquire() as conn:
            await conn.execute(
                """
                UPDATE backups
                SET status = $1, file_path = $2, file_size = $3, 
                    metadata = $4, completed_at = NOW()
                WHERE id = $5
                """,
                status, file_path, file_size, json.dumps(metadata), uuid.UUID(backup_id)
            )
    
    async def _get_backup_info(self, backup_id: str) -> Optional[Dict[str, Any]]:
        """Get backup information"""
        
        pool = await get_main_db_pool()
        async with pool.acquire() as conn:
            row = await conn.fetchrow(
                """
                SELECT id, project_id, backup_name, backup_type, status,
                       file_path, file_size, compressed, created_at,
                       completed_at, error_message, metadata
                FROM backups
                WHERE id = $1
                """,
                uuid.UUID(backup_id)
            )
            
            return dict(row) if row else None
    
    async def _validate_database_access(self, db_name: str) -> Dict[str, Any]:
        """Validate we can access the database and get basic info"""
        try:
            pool = await get_project_db_pool(db_name)
            async with pool.acquire() as conn:
                # Test connection
                current_db = await conn.fetchval("SELECT current_database()")
                
                # Get table count
                table_count = await conn.fetchval(
                    """
                    SELECT COUNT(*)
                    FROM information_schema.tables
                    WHERE table_schema = 'public'
                    """
                )
                
                # Get row count
                row_count = await conn.fetchval(
                    """
                    SELECT SUM(n_live_tup)
                    FROM pg_stat_user_tables
                    """
                )
                
                # Get database size
                db_size = await conn.fetchval(
                    "SELECT pg_database_size(current_database())"
                )
                
                return {
                    "accessible": True,
                    "current_database": current_db,
                    "table_count": int(table_count) if table_count else 0,
                    "row_count": int(row_count) if row_count else 0,
                    "database_size": int(db_size) if db_size else 0
                }
        except Exception as e:
            return {
                "accessible": False,
                "error": str(e)
            }
    
    async def _get_backup_metadata(self, db_name: str) -> Dict[str, Any]:
        """Get metadata about the database being backed up"""
        
        try:
            pool = await get_project_db_pool(db_name)
            async with pool.acquire() as conn:
                # Get table count
                table_count = await conn.fetchval(
                    """
                    SELECT COUNT(*)
                    FROM information_schema.tables
                    WHERE table_schema = 'public'
                    """
                )
                
                # Get total row count (approximate)
                row_count = await conn.fetchval(
                    """
                    SELECT SUM(n_live_tup)
                    FROM pg_stat_user_tables
                    """
                )
                
                # Get database size
                db_size = await conn.fetchval(
                    "SELECT pg_database_size(current_database())"
                )
                
                # Get table list with row counts
                tables = await conn.fetch(
                    """
                    SELECT 
                        schemaname,
                        tablename,
                        n_live_tup as row_count
                    FROM pg_stat_user_tables
                    ORDER BY n_live_tup DESC
                    LIMIT 10
                    """
                )
                
                return {
                    "table_count": int(table_count) if table_count else 0,
                    "row_count": int(row_count) if row_count else 0,
                    "database_size": int(db_size) if db_size else 0,
                    "database_name": db_name,
                    "top_tables": [
                        {
                            "schema": t["schemaname"],
                            "table": t["tablename"],
                            "rows": int(t["row_count"]) if t["row_count"] else 0
                        }
                        for t in tables
                    ]
                }
        except Exception as e:
            return {
                "error": str(e),
                "database_name": db_name
            }
