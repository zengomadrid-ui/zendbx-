"""Schema Manager - Handle schema diff, push, pull"""

from pathlib import Path
from typing import Optional, Dict, Any
from rich.console import Console
from rich.table import Table


console = Console()


class Schema:
    """Represents database schema"""
    
    def __init__(self, tables: Dict[str, Any]):
        self.tables = tables


class SchemaDiff:
    """Represents schema differences"""
    
    def __init__(self, additions: list, modifications: list, deletions: list):
        self.additions = additions
        self.modifications = modifications
        self.deletions = deletions
    
    def has_changes(self) -> bool:
        """Check if there are any changes"""
        return bool(self.additions or self.modifications or self.deletions)
    
    def display(self):
        """Display diff in formatted output"""
        if self.additions:
            console.print("\n[bold green]Additions:[/bold green]")
            for item in self.additions:
                console.print(f"  [green]+[/green] {item}")
        
        if self.modifications:
            console.print("\n[bold yellow]Modifications:[/bold yellow]")
            for item in self.modifications:
                console.print(f"  [yellow]~[/yellow] {item}")
        
        if self.deletions:
            console.print("\n[bold red]Deletions:[/bold red]")
            for item in self.deletions:
                console.print(f"  [red]-[/red] {item}")
    
    def to_sql(self) -> str:
        """Generate SQL migration"""
        sql_parts = []
        
        # Additions
        for item in self.additions:
            if item.get('type') == 'table':
                sql_parts.append(f"CREATE TABLE {item['name']} (...);")
            elif item.get('type') == 'column':
                sql_parts.append(f"ALTER TABLE {item['table']} ADD COLUMN {item['name']} {item['type']};")
        
        # Modifications
        for item in self.modifications:
            if item.get('type') == 'column':
                sql_parts.append(f"ALTER TABLE {item['table']} ALTER COLUMN {item['name']} TYPE {item['new_type']};")
        
        # Deletions
        for item in self.deletions:
            if item.get('type') == 'table':
                sql_parts.append(f"DROP TABLE {item['name']};")
            elif item.get('type') == 'column':
                sql_parts.append(f"ALTER TABLE {item['table']} DROP COLUMN {item['name']};")
        
        return '\n'.join(sql_parts)
    
    def to_json(self) -> str:
        """Generate JSON representation"""
        import json
        return json.dumps({
            'additions': self.additions,
            'modifications': self.modifications,
            'deletions': self.deletions
        }, indent=2)


class SchemaManager:
    """Manages database schema operations"""
    
    def __init__(self):
        self.schema_dir = Path("./schema")
    
    def load_local_schema(self) -> Optional[Schema]:
        """Load schema from local files"""
        if not self.schema_dir.exists():
            return None
        
        # Parse schema files
        tables = {}
        
        for schema_file in self.schema_dir.glob("*.sql"):
            # Parse SQL file (simplified)
            tables[schema_file.stem] = {}
        
        return Schema(tables) if tables else None
    
    def get_remote_schema(self) -> Schema:
        """Get schema from remote database"""
        from .database_manager import DatabaseManager
        from ..config import config_manager
        
        db_manager = DatabaseManager(config_manager.get_connection_string())
        schema_data = db_manager.get_schema_sync()
        
        return Schema(schema_data.get('tables', {}))
    
    def generate_diff(self, local: Schema, remote: Schema) -> SchemaDiff:
        """Generate diff between local and remote schema"""
        additions = []
        modifications = []
        deletions = []
        
        # Find additions (in local, not in remote)
        for table_name in local.tables:
            if table_name not in remote.tables:
                additions.append({
                    'type': 'table',
                    'name': table_name
                })
        
        # Find deletions (in remote, not in local)
        for table_name in remote.tables:
            if table_name not in local.tables:
                deletions.append({
                    'type': 'table',
                    'name': table_name
                })
        
        # Find modifications (in both, but different)
        # (Simplified - would need deep comparison)
        
        return SchemaDiff(additions, modifications, deletions)
    
    def apply_diff(self, diff: SchemaDiff, progress_callback=None):
        """Apply schema diff to database"""
        from .database_manager import DatabaseManager
        from ..config import config_manager
        
        db_manager = DatabaseManager(config_manager.get_connection_string())
        
        # Generate and execute SQL
        sql = diff.to_sql()
        
        if sql:
            db_manager.execute_script_sync(sql)
        
        if progress_callback:
            progress_callback(100)
    
    def pull_schema(self) -> Schema:
        """Pull schema from database"""
        return self.get_remote_schema()
    
    def save_local_schema(self, schema: Schema):
        """Save schema to local files"""
        self.schema_dir.mkdir(exist_ok=True)
        
        # Write schema files (simplified)
        for table_name, table_data in schema.tables.items():
            schema_file = self.schema_dir / f"{table_name}.sql"
            schema_file.write_text(f"-- Schema for {table_name}\n")
    
    def local_schema_exists(self) -> bool:
        """Check if local schema exists"""
        return self.schema_dir.exists() and any(self.schema_dir.glob("*.sql"))
