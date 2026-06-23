"""
MCP Gateway - Phase 1 Complete
Handles MCP requests with authentication, caching, audit, and rate limiting
"""

import time
import json
from typing import Dict, Any, Optional
from fastapi import Request, HTTPException

from .auth.authenticator import MCPAuthenticator
from .auth.project_resolver import ProjectResolver
from .auth.rbac import RBACValidator
from .tools.implementations.project_tools import GetSchemaTool
from .tools.implementations.database_tools import (
    ListTablesTool,
    GetTableTool,
    QueryTool,
    ExplainQueryTool,
    GetRelationshipsTool,
    ListIndexesTool,
    GetConstraintsTool
)
from .tools.implementations.service_tools import (
    ListUsersTool,
    ListBucketsTool,
    ListFunctionsTool,
    HealthCheckTool,
    ProjectInfoTool
)
from .core.exceptions import MCPError, AuthenticationError, AuthorizationError, RateLimitError
from .core.types import Permission
from .core.audit import get_audit_logger
from .core.rate_limiter import get_rate_limiter

import logging
logger = logging.getLogger(__name__)


class MCPGateway:
    """
    Main MCP Gateway - Phase 1 Complete
    Handles authentication, authorization, and tool execution
    """
    
    def __init__(self):
        self.authenticator = MCPAuthenticator()
        self.project_resolver = ProjectResolver()
        self.audit_logger = get_audit_logger()
        self.rate_limiter = None  # Initialized in initialize()
        
        # Register all 13 tools (Phase 1 Complete!)
        self.tools = {
            # Project tools (2)
            "project.get_schema": GetSchemaTool(),
            "project.get_info": ProjectInfoTool(),
            
            # Database tools (7)
            "database.list_tables": ListTablesTool(),
            "database.get_table": GetTableTool(),
            "database.query": QueryTool(),
            "database.explain_query": ExplainQueryTool(),
            "database.get_relationships": GetRelationshipsTool(),
            "database.list_indexes": ListIndexesTool(),
            "database.get_constraints": GetConstraintsTool(),
            
            # Auth tools (1)
            "auth.list_users": ListUsersTool(),
            
            # Storage tools (1)
            "storage.list_buckets": ListBucketsTool(),
            
            # Functions tools (1)
            "functions.list_functions": ListFunctionsTool(),
            
            # Deployment tools (1)
            "deployment.health_check": HealthCheckTool()
        }
    
    async def initialize(self):
        """Initialize gateway components"""
        logger.info("Initializing MCP Gateway components...")
        
        # Initialize authenticator (with database pool)
        await self.authenticator.initialize()
        if self.authenticator.pool is None:
            raise Exception("MCPAuthenticator pool initialization failed")
        logger.info("✅ MCPAuthenticator initialized")
        
        # Initialize project resolver (with database pool)
        await self.project_resolver.initialize()
        if self.project_resolver.pool is None:
            raise Exception("ProjectResolver pool initialization failed")
        logger.info("✅ ProjectResolver initialized")
        
        # Initialize rate limiter
        self.rate_limiter = await get_rate_limiter()
        logger.info("✅ Rate limiter initialized")
        
        logger.info("🚀 MCP Gateway initialized with all components")
    
    async def handle_initialize(self, project_slug: str, auth_header: Optional[str]) -> Dict[str, Any]:
        """
        Handle MCP initialize request
        Returns server capabilities
        """
        # Authenticate
        auth_context = await self._authenticate(project_slug, auth_header)
        
        return {
            "protocolVersion": "2024-11-05",
            "serverInfo": {
                "name": "ZendBX MCP",
                "version": "0.1.0-demo"
            },
            "capabilities": {
                "tools": {}
            }
        }
    
    async def handle_tools_list(self, project_slug: str, auth_header: Optional[str]) -> Dict[str, Any]:
        """
        List available tools
        """
        # Authenticate
        auth_context = await self._authenticate(project_slug, auth_header)
        
        tools_list = []
        for tool_name, tool in self.tools.items():
            # Check if user has permission for this tool
            has_permission = all(
                perm in auth_context.permissions 
                for perm in tool.required_permissions
            )
            
            if has_permission:
                tools_list.append({
                    "name": tool.name,
                    "description": tool.description,
                    "inputSchema": tool.input_schema
                })
        
        return {
            "tools": tools_list
        }
    
    async def handle_tool_call(
        self,
        project_slug: str,
        tool_name: str,
        arguments: Dict[str, Any],
        auth_header: Optional[str]
    ) -> Dict[str, Any]:
        """
        Execute a tool with audit logging and rate limiting
        """
        start_time = time.time()
        auth_context = None
        status_code = 200
        error_msg = None
        
        try:
            # Authenticate
            auth_context = await self._authenticate(project_slug, auth_header)
            
            # Rate limiting
            if self.rate_limiter:
                try:
                    await self.rate_limiter.check_all(
                        str(auth_context.user_id),
                        str(auth_context.project_id),
                        tool_name
                    )
                except RateLimitError as e:
                    status_code = 429
                    error_msg = str(e)
                    raise
            
            # Find tool
            tool = self.tools.get(tool_name)
            if not tool:
                status_code = 404
                error_msg = f"Tool not found: {tool_name}"
                raise HTTPException(status_code=404, detail=error_msg)
            
            # Check permissions
            for perm in tool.required_permissions:
                if perm not in auth_context.permissions:
                    status_code = 403
                    error_msg = f"Permission denied: {perm.value}"
                    raise AuthorizationError(
                        error_msg,
                        details={"tool": tool_name, "required": perm.value}
                    )
            
            # Validate parameters
            tool.validate_parameters(arguments)
            
            # Execute tool
            result = await tool.execute(auth_context, arguments)
            
            execution_time = int((time.time() - start_time) * 1000)
            
            # Audit log success
            await self.audit_logger.log_tool_execution(
                str(auth_context.project_id),
                str(auth_context.user_id),
                tool_name,
                arguments,
                success=True,
                execution_time_ms=execution_time,
                result_size=len(json.dumps(result))
            )
            
            return {
                "content": [
                    {
                        "type": "text",
                        "text": json.dumps(result, indent=2)
                    }
                ],
                "_meta": {
                    "execution_time_ms": execution_time
                }
            }
            
        except MCPError as e:
            status_code = e.status_code
            error_msg = str(e)
            
            # Audit log error
            if auth_context:
                execution_time = int((time.time() - start_time) * 1000)
                await self.audit_logger.log_tool_execution(
                    str(auth_context.project_id),
                    str(auth_context.user_id),
                    tool_name,
                    arguments,
                    success=False,
                    execution_time_ms=execution_time,
                    error=error_msg
                )
            
            raise HTTPException(status_code=status_code, detail=e.to_dict())
            
        except Exception as e:
            status_code = 500
            error_msg = str(e)
            
            # Audit log error
            if auth_context:
                execution_time = int((time.time() - start_time) * 1000)
                await self.audit_logger.log_tool_execution(
                    str(auth_context.project_id),
                    str(auth_context.user_id),
                    tool_name,
                    arguments,
                    success=False,
                    execution_time_ms=execution_time,
                    error=error_msg
                )
            
            raise HTTPException(status_code=500, detail={"error": str(e)})
    
    async def _authenticate(self, project_slug: str, auth_header: Optional[str]):
        """
        Authenticate request and return auth context
        """
        if self.authenticator.pool is None:
            raise Exception("Authenticator database pool is not initialized")

        user_id, org_id = await self.authenticator.validate_token(auth_header)

        project = await self.project_resolver.resolve_project(
            project_slug, user_id, org_id
        )

        role = await self.project_resolver.get_user_role(
            project["id"], user_id
        )

        auth_context = RBACValidator.create_auth_context(
            str(user_id),
            str(org_id),
            str(project["id"]),
            role
        )

        auth_context.database_name = project["database_name"]

        return auth_context
