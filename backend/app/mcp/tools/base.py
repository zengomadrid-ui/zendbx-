"""
Base Tool Class
Foundation for all MCP tools
"""

from abc import ABC, abstractmethod
from typing import Dict, Any, List
from ..core.types import AuthContext, Permission, ToolCategory


class BaseTool(ABC):
    """
    Base class for all MCP tools
    Provides structure and validation
    """
    
    # Must be overridden by subclasses
    name: str
    description: str
    category: ToolCategory
    required_permissions: List[Permission]
    input_schema: Dict[str, Any]
    
    @abstractmethod
    async def execute(
        self,
        auth_context: AuthContext,
        parameters: Dict[str, Any]
    ) -> Dict[str, Any]:
        """
        Execute the tool
        
        Args:
            auth_context: Authenticated context with user/project info
            parameters: Tool parameters
            
        Returns:
            Tool result as dict
        """
        pass
    
    def validate_parameters(self, parameters: Dict[str, Any]) -> bool:
        """
        Validate parameters against schema
        Basic validation - can be overridden
        """
        # For demo, just check required fields exist
        required = self.input_schema.get("required", [])
        for field in required:
            if field not in parameters:
                raise ValueError(f"Missing required parameter: {field}")
        return True
