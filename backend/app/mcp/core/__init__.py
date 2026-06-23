"""
Core MCP framework components
Type definitions, exceptions, configuration
"""

from .types import (
    MCPProtocolVersion,
    ConnectionType,
    ToolCategory,
    AuditStatus,
    UserRole,
    Permission,
    ClientInfo,
    AuthContext,
    ToolMetadata,
    MCPErrorCode,
)
from .exceptions import (
    MCPError,
    AuthenticationError,
    AuthorizationError,
    ProtocolError,
    RateLimitError,
    InternalError,
)
from .config import MCPConfig

__all__ = [
    # Enums
    "MCPProtocolVersion",
    "ConnectionType",
    "ToolCategory",
    "AuditStatus",
    "UserRole",
    "Permission",
    "MCPErrorCode",
    # Models
    "ClientInfo",
    "AuthContext",
    "ToolMetadata",
    # Exceptions
    "MCPError",
    "AuthenticationError",
    "AuthorizationError",
    "ProtocolError",
    "RateLimitError",
    "InternalError",
    # Config
    "MCPConfig",
]
