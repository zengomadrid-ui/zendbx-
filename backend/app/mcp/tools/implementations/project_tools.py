"""
Project Tools
Tools for project-level operations
"""

from typing import Dict, Any
from ...core.types import AuthContext, Permission, ToolCategory
from ..base import BaseTool
from ...context.loader import ContextLoader
from ...utils.serialization import make_json_safe


class GetSchemaTool(BaseTool):
    """
    Get complete project schema
    Returns database tables, columns, and relationships
    """
    
    name = "project.get_schema"
    description = "Get complete database schema with tables, columns, and relationships"
    category = ToolCategory.PROJECT
    required_permissions = [Permission.READ_DATABASE]
    
    input_schema = {
        "type": "object",
        "properties": {},
        "required": []
    }
    
    def __init__(self):
        self.context_loader = ContextLoader()
    
    async def execute(
        self,
        auth_context: AuthContext,
        parameters: Dict[str, Any]
    ) -> Dict[str, Any]:
        """
        Load and return project schema
        """
        # Use the project's specific database name from auth context
        database_name = auth_context.database_name
        
        # Load context (includes schema)
        context = await self.context_loader.load(
            str(auth_context.project_id),
            database_name
        )
        
        # Filter database context to only include project-specific tables
        filtered_database = {
            **context["database"],
            "tables": [
                table for table in context["database"].get("tables", [])
                if table.get("table_schema") == database_name
            ],
            "relationships": [
                rel for rel in context["database"].get("relationships", [])
                if database_name in rel.get("from_table", "") or database_name in rel.get("to_table", "")
            ]
        }
        
        result = {
            "project": context["project"],
            "database": filtered_database,
            "metadata": context["metadata"]
        }
        
        return make_json_safe(result)
