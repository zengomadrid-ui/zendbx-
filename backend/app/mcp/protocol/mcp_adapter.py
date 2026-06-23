"""
MCP Adapter - Protocol Translation Layer
Routes MCP methods to existing ZendBX gateway WITHOUT modifying core logic
"""

from typing import Dict, Any, Optional, Union
import logging
import time

from .jsonrpc import (
    JSONRPCRequest,
    JSONRPCResponse,
    JSONRPCErrorCode,
    create_jsonrpc_response,
    create_jsonrpc_error
)

from ..gateway import MCPGateway

logger = logging.getLogger(__name__)


class MCPAdapter:
    """
    MCP Protocol Adapter
    Translates between MCP JSON-RPC 2.0 and ZendBX internal format
    
    This is a THIN LAYER - all business logic remains in MCPGateway
    """
    
    MCP_PROTOCOL_VERSION = "2024-11-05"
    SERVER_NAME = "ZendBX MCP"
    SERVER_VERSION = "1.0.0"
    
    def __init__(self, gateway: MCPGateway):
        """
        Initialize adapter
        
        Args:
            gateway: Existing ZendBX MCPGateway instance
        """
        self.gateway = gateway
        
        # MCP method handlers
        self.method_handlers = {
            "initialize": self._handle_initialize,
            "ping": self._handle_ping,
            "tools/list": self._handle_tools_list,
            "tools/call": self._handle_tools_call,
            "notifications/initialized": self._handle_initialized_notification
        }
    
    async def handle_request(
        self,
        request: JSONRPCRequest,
        project_slug: Optional[str],
        auth_header: Optional[str]
    ) -> JSONRPCResponse:
        """
        Handle MCP JSON-RPC request
        """
        try:
            if request.is_notification():
                await self._handle_notification(request, project_slug, auth_header)
                return None

            handler = self.method_handlers.get(request.method)

            if not handler:
                return create_jsonrpc_error(
                    request_id=request.id,
                    code=JSONRPCErrorCode.METHOD_NOT_FOUND,
                    message=f"Method not found: {request.method}",
                    data={"method": request.method}
                )

            result = await handler(request, project_slug, auth_header)

            return create_jsonrpc_response(
                request_id=request.id,
                result=result
            )

        except Exception as e:
            logger.error(f"Error handling MCP request: {str(e)}", exc_info=True)
            return self._exception_to_error(request.id, e)
    
    async def _handle_initialize(
        self,
        request: JSONRPCRequest,
        project_slug: Optional[str],
        auth_header: Optional[str]
    ) -> Dict[str, Any]:
        """
        Handle MCP initialize request
        
        MCP Spec requires:
        - protocolVersion negotiation
        - capabilities exchange
        - serverInfo
        
        Note: initialize can be called without project context initially
        """
        # Get client info from params
        params = request.params or {}
        client_protocol_version = params.get("protocolVersion")
        client_capabilities = params.get("capabilities", {})
        client_info = params.get("clientInfo", {})
        
        logger.info(f"MCP Initialize from client: {client_info.get('name', 'unknown')}")
        logger.info(f"Client protocol version: {client_protocol_version}")
        
        # Validate protocol version
        if client_protocol_version and client_protocol_version != self.MCP_PROTOCOL_VERSION:
            logger.warning(f"Client requested protocol {client_protocol_version}, server supports {self.MCP_PROTOCOL_VERSION}")
        
        # If project is provided, authenticate to verify access
        if project_slug and auth_header:
            try:
                await self.gateway.handle_initialize(project_slug, auth_header)
                logger.info(f"Initialize with project authentication succeeded: {project_slug}")
            except Exception as e:
                # Authentication failed
                logger.warning(f"Initialize authentication failed: {str(e)}")
                raise Exception(f"Authentication failed: {str(e)}")
        
        # Return MCP-compliant initialize response
        return {
            "protocolVersion": self.MCP_PROTOCOL_VERSION,
            "capabilities": {
                "tools": {
                    "listChanged": False  # We don't support dynamic tool list yet
                },
                # Optional capabilities we don't support yet:
                # "resources": {},
                # "prompts": {},
                # "logging": {}
            },
            "serverInfo": {
                "name": self.SERVER_NAME,
                "version": self.SERVER_VERSION
            }
        }
    
    async def _handle_initialized_notification(
        self,
        request: JSONRPCRequest,
        project_slug: Optional[str],
        auth_header: Optional[str]
    ) -> None:
        """
        Handle initialized notification from client
        This is sent after initialize response to indicate client is ready
        """
        logger.info(f"Client initialized for project: {project_slug}")
        # Nothing to do - just acknowledge the client is ready
    
    async def _handle_ping(
        self,
        request: JSONRPCRequest,
        project_slug: Optional[str],
        auth_header: Optional[str]
    ) -> Dict[str, Any]:
        """
        Handle ping request (keepalive)
        Returns empty object as per MCP spec
        Project context not required for ping
        """
        return {}
    
    async def _handle_tools_list(
        self,
        request: JSONRPCRequest,
        project_slug: Optional[str],
        auth_header: Optional[str]
    ) -> Dict[str, Any]:
        """
        Handle tools/list request
        """
        if not project_slug:
            raise ValueError("Project required for tools/list")

        gateway_response = await self.gateway.handle_tools_list(project_slug, auth_header)

        params = request.params or {}

        return {
            "tools": gateway_response.get("tools", [])
        }
    
    async def _handle_tools_call(
        self,
        request: JSONRPCRequest,
        project_slug: Optional[str],
        auth_header: Optional[str]
    ) -> Dict[str, Any]:
        """
        Handle tools/call request
        Executes a tool and returns result in MCP format
        Requires project context
        """
        if not project_slug:
            raise ValueError("Project required for tools/call")
        
        params = request.params or {}
        tool_name = params.get("name")
        arguments = params.get("arguments", {})
        
        if not tool_name:
            raise ValueError("Missing required parameter: name")
        
        # Call existing gateway
        try:
            gateway_response = await self.gateway.handle_tool_call(
                project_slug,
                tool_name,
                arguments,
                auth_header
            )
            
            # Gateway returns: {"content": [...], "_meta": {...}}
            # MCP expects: {"content": [...], "isError": false}
            
            # Convert to MCP format
            result = {
                "content": gateway_response.get("content", []),
                "isError": False  # REQUIRED by MCP spec
            }
            
            return result
            
        except Exception as e:
            # Tool execution failed - return as MCP error result (not JSON-RPC error)
            # Per MCP spec: tool execution errors should be in result with isError=true
            logger.error(f"Tool execution error: {str(e)}")
            
            return {
                "content": [
                    {
                        "type": "text",
                        "text": f"Tool execution failed: {str(e)}"
                    }
                ],
                "isError": True  # Indicates tool-level error
            }
    
    async def _handle_notification(
        self,
        request: JSONRPCRequest,
        project_slug: Optional[str],
        auth_header: Optional[str]
    ) -> None:
        """
        Handle notification (no response expected)
        """
        if request.method == "notifications/initialized":
            await self._handle_initialized_notification(request, project_slug, auth_header)
        else:
            logger.warning(f"Unknown notification: {request.method}")
    
    def _exception_to_error(
        self,
        request_id: Optional[Union[str, int]],
        exception: Exception
    ) -> JSONRPCResponse:
        """
        Convert exception to JSON-RPC error response
        """
        from ..core.exceptions import AuthenticationError, AuthorizationError, RateLimitError
        
        message = str(exception)
        
        # Check by exception type FIRST (most precise), then fall back to message
        if isinstance(exception, AuthenticationError):
            code = JSONRPCErrorCode.AUTHENTICATION_ERROR
        elif isinstance(exception, AuthorizationError):
            code = JSONRPCErrorCode.AUTHORIZATION_ERROR
        elif isinstance(exception, RateLimitError):
            code = JSONRPCErrorCode.RATE_LIMIT_ERROR
        elif "not found" in message.lower():
            code = JSONRPCErrorCode.METHOD_NOT_FOUND
        elif "missing" in message.lower() and ("auth" in message.lower() or "token" in message.lower()):
            # "Missing authorization header" etc.
            code = JSONRPCErrorCode.AUTHENTICATION_ERROR
        elif "invalid" in message.lower() and ("token" in message.lower() or "expired" in message.lower() or "auth" in message.lower()):
            # "Invalid or expired token", "Invalid authorization format"
            code = JSONRPCErrorCode.AUTHENTICATION_ERROR
        elif "invalid" in message.lower() or "validation" in message.lower():
            code = JSONRPCErrorCode.INVALID_PARAMS
        elif "permission" in message.lower() or "forbidden" in message.lower():
            code = JSONRPCErrorCode.AUTHORIZATION_ERROR
        elif "rate limit" in message.lower():
            code = JSONRPCErrorCode.RATE_LIMIT_ERROR
        else:
            code = JSONRPCErrorCode.INTERNAL_ERROR
        
        return create_jsonrpc_error(
            request_id=request_id,
            code=code,
            message=message,
            data={"type": type(exception).__name__}
        )
    
    def get_server_info(self) -> Dict[str, Any]:
        """
        Get server information
        Useful for debugging and status endpoints
        """
        return {
            "name": self.SERVER_NAME,
            "version": self.SERVER_VERSION,
            "protocolVersion": self.MCP_PROTOCOL_VERSION,
            "supportedMethods": list(self.method_handlers.keys()),
            "toolCount": len(self.gateway.tools),
            "capabilities": {
                "tools": True,
                "resources": False,
                "prompts": False,
                "logging": False,
                "sampling": False
            }
        }
