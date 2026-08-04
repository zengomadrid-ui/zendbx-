"""Code Generators - Types, SDK, Models"""

from pathlib import Path
from typing import Dict, Any, List


class TypeScriptGenerator:
    """Generate TypeScript types"""
    
    def load_schema(self) -> Dict[str, Any]:
        """Load database schema"""
        from .database_manager import DatabaseManager
        from ..config import config_manager
        
        db_manager = DatabaseManager(config_manager.get_connection_string())
        return db_manager.get_schema_sync()
    
    def generate(self, schema: Dict[str, Any], language: str = "typescript", output_dir: Path = Path("./types")) -> List[str]:
        """Generate types"""
        output_dir.mkdir(parents=True, exist_ok=True)
        
        files = []
        
        if language == "typescript":
            # Generate TypeScript interfaces
            for table_name, table_data in schema.get('tables', {}).items():
                interface_name = self._to_pascal_case(table_name)
                
                lines = [f"export interface {interface_name} {{"]
                
                for column in table_data.get('columns', []):
                    col_name = column['name']
                    col_type = self._map_pg_to_ts_type(column['type'])
                    nullable = " | null" if column.get('nullable') else ""
                    
                    lines.append(f"  {col_name}: {col_type}{nullable};")
                
                lines.append("}\n")
                
                file_path = output_dir / f"{table_name}.ts"
                file_path.write_text('\n'.join(lines))
                files.append(str(file_path))
        
        return files
    
    def _to_pascal_case(self, snake_str: str) -> str:
        """Convert snake_case to PascalCase"""
        return ''.join(word.capitalize() for word in snake_str.split('_'))
    
    def _map_pg_to_ts_type(self, pg_type: str) -> str:
        """Map PostgreSQL type to TypeScript type"""
        type_map = {
            'integer': 'number',
            'bigint': 'number',
            'smallint': 'number',
            'decimal': 'number',
            'numeric': 'number',
            'real': 'number',
            'double precision': 'number',
            'text': 'string',
            'character varying': 'string',
            'varchar': 'string',
            'char': 'string',
            'boolean': 'boolean',
            'timestamp': 'Date',
            'date': 'Date',
            'json': 'any',
            'jsonb': 'any',
        }
        
        return type_map.get(pg_type.lower(), 'any')


class SDKGenerator:
    """Generate SDK/API client"""
    
    def load_config(self) -> Dict[str, Any]:
        """Load project configuration"""
        from .project_manager import ProjectManager
        project_manager = ProjectManager()
        return project_manager.get_linked_project()
    
    def generate(self, config: Dict[str, Any], language: str = "typescript", output_dir: Path = Path("./sdk")) -> List[str]:
        """Generate SDK"""
        output_dir.mkdir(parents=True, exist_ok=True)
        
        files = []
        
        if language == "typescript":
            # Generate client
            client_code = """
import axios from 'axios';

export interface ZenDBXClientOptions {
  url: string;
  apiKey?: string;
}

export class ZenDBXClient {
  private url: string;
  private apiKey?: string;

  constructor(options: ZenDBXClientOptions) {
    this.url = options.url;
    this.apiKey = options.apiKey;
  }

  async query(table: string, params?: any) {
    // Implementation
    return [];
  }

  async insert(table: string, data: any) {
    // Implementation
    return {};
  }

  async update(table: string, id: any, data: any) {
    // Implementation
    return {};
  }

  async delete(table: string, id: any) {
    // Implementation
  }
}

export function createClient(options: ZenDBXClientOptions): ZenDBXClient {
  return new ZenDBXClient(options);
}
"""
            client_file = output_dir / "index.ts"
            client_file.write_text(client_code)
            files.append(str(client_file))
        
        return files


class ModelGenerator:
    """Generate ORM-style models"""
    
    def load_schema(self) -> Dict[str, Any]:
        """Load database schema"""
        from .database_manager import DatabaseManager
        from ..config import config_manager
        
        db_manager = DatabaseManager(config_manager.get_connection_string())
        return db_manager.get_schema_sync()
    
    def generate(self, schema: Dict[str, Any], language: str = "typescript", output_dir: Path = Path("./models")) -> List[str]:
        """Generate models"""
        output_dir.mkdir(parents=True, exist_ok=True)
        
        files = []
        
        if language == "typescript":
            for table_name, table_data in schema.get('tables', {}).items():
                class_name = self._to_pascal_case(table_name)
                
                model_code = f"""
export class {class_name} {{
  // Properties
  {self._generate_properties(table_data)}

  constructor(data: Partial<{class_name}>) {{
    Object.assign(this, data);
  }}

  async save() {{
    // Implementation
  }}

  async delete() {{
    // Implementation
  }}

  static async find(id: any) {{
    // Implementation
    return null;
  }}

  static async findAll() {{
    // Implementation
    return [];
  }}
}}
"""
                model_file = output_dir / f"{table_name}.ts"
                model_file.write_text(model_code)
                files.append(str(model_file))
        
        return files
    
    def _to_pascal_case(self, snake_str: str) -> str:
        """Convert snake_case to PascalCase"""
        return ''.join(word.capitalize() for word in snake_str.split('_'))
    
    def _generate_properties(self, table_data: Dict[str, Any]) -> str:
        """Generate class properties"""
        lines = []
        
        for column in table_data.get('columns', []):
            col_name = column['name']
            lines.append(f"  {col_name}?: any;")
        
        return '\n'.join(lines)
