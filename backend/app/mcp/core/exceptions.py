"""
MCP Exception Hierarchy
Typed exceptions for AI-friendly error handling
"""

from typing import Optional, Any, Dict
from .types import MCPErrorCode


class MCPError(Exception):
    """
    Base exception for all MCP errors
    AI can parse these to understand what went wrong
    """
    
    def __init__(
        self,
        message: str,
        code: MCPErrorCode,
        details: Optional[Dict[str, Any]] = None,
        status_code: int = 500
    ):
        self.message = message
        self.code = code
        self.details = details or {}
        self.status_code = status_code
        super().__init__(message)
    
    def to_dict(self) -> Dict[str, Any]:
        """Convert to JSON-serializable dict"""
        return {
            "error": {
                "message": self.message,
                "code": self.code.value,
                "details": self.details
            }
        }


class AuthenticationError(MCPError):
    """Authentication failed - invalid or missing credentials"""
    
    def __init__(self, message: str = "Authentication failed", details: Optional[Dict[str, Any]] = None):
        super().__init__(
            message=message,
            code=MCPErrorCode.AUTHENTICATION_FAILED,
            details=details,
            status_code=401
        )


class AuthorizationError(MCPError):
    """Authorization failed - insufficient permissions"""
    
    def __init__(self, message: str = "Permission denied", details: Optional[Dict[str, Any]] = None):
        super().__init__(
            message=message,
            code=MCPErrorCode.PERMISSION_DENIED,
            details=details,
            status_code=403
        )


class ProtocolError(MCPError):
    """MCP protocol violation or invalid request"""
    
    def __init__(self, message: str, details: Optional[Dict[str, Any]] = None):
        super().__init__(
            message=message,
            code=MCPErrorCode.INVALID_REQUEST,
            details=details,
            status_code=400
        )


class RateLimitError(MCPError):
    """Rate limit exceeded"""
    
    def __init__(self, message: str = "Rate limit exceeded", details: Optional[Dict[str, Any]] = None):
        super().__init__(
            message=message,
            code=MCPErrorCode.RATE_LIMIT_EXCEEDED,
            details=details,
            status_code=429
        )


class InternalError(MCPError):
    """Internal server error"""
    
    def __init__(self, message: str = "Internal server error", details: Optional[Dict[str, Any]] = None):
        super().__init__(
            message=message,
            code=MCPErrorCode.INTERNAL_ERROR,
            details=details,
            status_code=500
        )


class ContextLoadError(MCPError):
    """Failed to load project context"""
    
    def __init__(self, message: str = "Failed to load project context", details: Optional[Dict[str, Any]] = None):
        super().__init__(
            message=message,
            code=MCPErrorCode.CONTEXT_LOAD_ERROR,
            details=details,
            status_code=500
        )


class ToolNotFoundError(MCPError):
    """Requested tool does not exist"""
    
    def __init__(self, tool_name: str):
        super().__init__(
            message=f"Tool not found: {tool_name}",
            code=MCPErrorCode.TOOL_NOT_FOUND,
            details={"tool_name": tool_name},
            status_code=404
        )


class InvalidParametersError(MCPError):
    """Tool parameters are invalid"""
    
    def __init__(self, message: str, details: Optional[Dict[str, Any]] = None):
        super().__init__(
            message=message,
            code=MCPErrorCode.INVALID_PARAMETERS,
            details=details,
            status_code=400
        )
