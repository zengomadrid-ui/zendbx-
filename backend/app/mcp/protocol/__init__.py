"""
MCP Protocol Compatibility Layer
Provides JSON-RPC 2.0 and MCP specification compliance without modifying existing ZendBX architecture
"""

from .jsonrpc import (
    JSONRPCRequest,
    JSONRPCResponse,
    JSONRPCError,
    JSONRPCErrorCode,
    parse_jsonrpc_request,
    create_jsonrpc_response,
    create_jsonrpc_error
)

from .mcp_adapter import MCPAdapter

from .sse import SSEManager, get_sse_manager

from .project_resolution import (
    resolve_mcp_project,
    ProjectResolutionResult,
    is_initialize_or_ping
)

__all__ = [
    "JSONRPCRequest",
    "JSONRPCResponse",
    "JSONRPCError",
    "JSONRPCErrorCode",
    "parse_jsonrpc_request",
    "create_jsonrpc_response",
    "create_jsonrpc_error",
    "MCPAdapter",
    "SSEManager",
    "get_sse_manager",
    "resolve_mcp_project",
    "ProjectResolutionResult",
    "is_initialize_or_ping"
]
