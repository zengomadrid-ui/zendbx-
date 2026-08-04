"""Migration Manager - Handle database migrations"""

from pathlib import Path
from typing import List, Dict, Any
from dataclasses import dataclass


@dataclass
class Migration:
    """Represents a database migration"""
    name: str
    version: str
    up_sql: str
    down_sql: str
    applied: bool = False


class MigrationManager:
    """Manages database migrations"""
    
    def __init__(self):
        self.migrations_dir = Path("./migrations")
        self.migrations_dir.mkdir(exist_ok=True)
    
    def get_pending_migrations(self) -> List[Migration]:
        """Get pending migrations"""
        all_migrations = self._load_migrations()
        applied_versions = self._get_applied_versions()
        
        return [m for m in all_migrations if m.version not in applied_versions]
    
    def apply_migration(self, migration: Migration):
        """Apply a single migration"""
        from .database_manager import DatabaseManager
        from ..config import config_manager
        
        db_manager = DatabaseManager(config_manager.get_connection_string())
        
        # Execute up migration
        db_manager.execute_script_sync(migration.up_sql)
        
        # Record migration
        self._record_migration(migration)
    
    def rollback(self) -> Migration:
        """Rollback last migration"""
        applied = self._get_applied_versions()
        
        if not applied:
            raise Exception("No migrations to rollback")
        
        last_version = applied[-1]
        migration = self._get_migration(last_version)
        
        from .database_manager import DatabaseManager
        from ..config import config_manager
        
        db_manager = DatabaseManager(config_manager.get_connection_string())
        
        # Execute down migration
        db_manager.execute_script_sync(migration.down_sql)
        
        # Remove migration record
        self._unrecord_migration(migration)
        
        return migration
    
    def migrate_to(self, version: str) -> List[Migration]:
        """Migrate to specific version"""
        results = []
        pending = self.get_pending_migrations()
        
        for migration in pending:
            if migration.version <= version:
                self.apply_migration(migration)
                results.append(migration)
        
        return results
    
    def migrate_all(self):
        """Apply all pending migrations"""
        pending = self.get_pending_migrations()
        
        for migration in pending:
            self.apply_migration(migration)
    
    def _load_migrations(self) -> List[Migration]:
        """Load all migration files"""
        migrations = []
        
        for migration_file in sorted(self.migrations_dir.glob("*.sql")):
            # Parse migration file
            content = migration_file.read_text()
            
            # Split into up/down (simplified)
            parts = content.split("-- DOWN")
            up_sql = parts[0].replace("-- UP", "").strip()
            down_sql = parts[1].strip() if len(parts) > 1 else ""
            
            migrations.append(Migration(
                name=migration_file.stem,
                version=migration_file.stem.split('_')[0],
                up_sql=up_sql,
                down_sql=down_sql
            ))
        
        return migrations
    
    def _get_applied_versions(self) -> List[str]:
        """Get list of applied migration versions"""
        from .database_manager import DatabaseManager
        from ..config import config_manager
        
        try:
            db_manager = DatabaseManager(config_manager.get_connection_string())
            
            # Create migrations table if not exists
            db_manager.execute_command_sync("""
                CREATE TABLE IF NOT EXISTS _migrations (
                    version VARCHAR(255) PRIMARY KEY,
                    name VARCHAR(255),
                    applied_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
                )
            """)
            
            # Get applied migrations
            results = db_manager.execute_query_sync("SELECT version FROM _migrations ORDER BY version")
            
            return [r['version'] for r in results]
        
        except:
            return []
    
    def _record_migration(self, migration: Migration):
        """Record applied migration"""
        from .database_manager import DatabaseManager
        from ..config import config_manager
        
        db_manager = DatabaseManager(config_manager.get_connection_string())
        
        db_manager.execute_command_sync(
            f"INSERT INTO _migrations (version, name) VALUES ('{migration.version}', '{migration.name}')"
        )
    
    def _unrecord_migration(self, migration: Migration):
        """Remove migration record"""
        from .database_manager import DatabaseManager
        from ..config import config_manager
        
        db_manager = DatabaseManager(config_manager.get_connection_string())
        
        db_manager.execute_command_sync(
            f"DELETE FROM _migrations WHERE version = '{migration.version}'"
        )
    
    def _get_migration(self, version: str) -> Migration:
        """Get migration by version"""
        migrations = self._load_migrations()
        
        for migration in migrations:
            if migration.version == version:
                return migration
        
        raise Exception(f"Migration not found: {version}")
