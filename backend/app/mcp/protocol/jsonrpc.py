"""
JSON-RPC 2.0 Protocol Implementation
Compliant with https://www.jsonrpc.org/specification
"""

from typing import Dict, Any, Optional, Union
from dataclasses import dataclass
from enum import IntEnum
import logging

logger = logging.getLogger(__name__)


class JSONRPCErrorCode(IntEnum):
    """Standard JSON-RPC 2.0 error codes"""
    PARSE_ERROR = -32700
    INVALID_REQUEST = -32600
    METHOD_NOT_FOUND = -32601
    INVALID_PARAMS = -32602
    INTERNAL_ERROR = -32603
    
    # MCP-specific error codes (custom range)
    TOOL_NOT_FOUND = -32001
    TOOL_EXECUTION_ERROR = -32002
    AUTHENTICATION_ERROR = -32003
    AUTHORIZATION_ERROR = -32004
    RATE_LIMIT_ERROR = -32005


@dataclass
class JSONRPCRequest:
    """JSON-RPC 2.0 request"""
    jsonrpc: str
    method: str
    params: Optional[Dict[str, Any]]
    id: Optional[Union[str, int]]
    
    def is_notification(self) -> bool:
        """Check if this is a notification (no id)"""
        return self.id is None


@dataclass
class JSONRPCResponse:
    """JSON-RPC 2.0 response"""
    jsonrpc: str
    id: Union[str, int, None]
    result: Optional[Dict[str, Any]] = None
    error: Optional[Dict[str, Any]] = None
    
    def to_dict(self) -> Dict[str, Any]:
        """Convert to dictionary"""
        response = {
            "jsonrpc": self.jsonrpc,
            "id": self.id
        }
        
        if self.error is not None:
            response["error"] = self.error
        else:
            response["result"] = self.result
        
        return response


@dataclass
class JSONRPCError:
    """JSON-RPC 2.0 error"""
    code: int
    message: str
    data: Optional[Dict[str, Any]] = None
    
    def to_dict(self) -> Dict[str, Any]:
        """Convert to dictionary"""
        error = {
            "code": self.code,
            "message": self.message
        }
        
        if self.data is not None:
            error["data"] = self.data
        
        return error


def parse_jsonrpc_request(data: Dict[str, Any]) -> JSONRPCRequest:
    """
    Parse JSON-RPC 2.0 request
    
    Args:
        data: Request dictionary
        
    Returns:
        JSONRPCRequest object
        
    Raises:
        ValueError: If request is invalid
    """
    # Validate jsonrpc version
    if data.get("jsonrpc") != "2.0":
        raise ValueError("Invalid JSON-RPC version, expected '2.0'")
    
    # Validate method
    method = data.get("method")
    if not method or not isinstance(method, str):
        raise ValueError("Missing or invalid 'method' field")
    
    # Get params (optional)
    params = data.get("params")
    if params is not None and not isinstance(params, (dict, list)):
        raise ValueError("Invalid 'params' field, must be object or array")
    
    # Get id (optional for notifications)
    request_id = data.get("id")
    
    return JSONRPCRequest(
        jsonrpc="2.0",
        method=method,
        params=params if isinstance(params, dict) else {},
        id=request_id
    )


def create_jsonrpc_response(
    request_id: Union[str, int, None],
    result: Dict[str, Any]
) -> JSONRPCResponse:
    """
    Create JSON-RPC 2.0 success response
    
    Args:
        request_id: ID from the request
        result: Result data
        
    Returns:
        JSONRPCResponse object
    """
    return JSONRPCResponse(
        jsonrpc="2.0",
        id=request_id,
        result=result
    )


def create_jsonrpc_error(
    request_id: Union[str, int, None],
    code: int,
    message: str,
    data: Optional[Dict[str, Any]] = None
) -> JSONRPCResponse:
    """
    Create JSON-RPC 2.0 error response
    
    Args:
        request_id: ID from the request (can be None if parse failed)
        code: Error code
        message: Error message
        data: Optional additional data
        
    Returns:
        JSONRPCResponse object with error
    """
    error = JSONRPCError(code=code, message=message, data=data)
    
    return JSONRPCResponse(
        jsonrpc="2.0",
        id=request_id,
        error=error.to_dict()
    )


def validate_jsonrpc_request(data: Any) -> tuple[bool, Optional[str]]:
    """
    Validate JSON-RPC request format
    
    Args:
        data: Request data
        
    Returns:
        Tuple of (is_valid, error_message)
    """
    if not isinstance(data, dict):
        return False, "Request must be a JSON object"
    
    if data.get("jsonrpc") != "2.0":
        return False, "Invalid or missing 'jsonrpc' field"
    
    if "method" not in data:
        return False, "Missing 'method' field"
    
    if not isinstance(data["method"], str):
        return False, "'method' must be a string"
    
    if "params" in data and not isinstance(data["params"], (dict, list)):
        return False, "'params' must be an object or array"
    
    return True, None


def wrap_exception_as_jsonrpc_error(
    request_id: Union[str, int, None],
    exception: Exception
) -> JSONRPCResponse:
    """
    Wrap Python exception as JSON-RPC error
    
    Args:
        request_id: Request ID
        exception: The exception to wrap
        
    Returns:
        JSONRPCResponse with error
    """
    # Map common exceptions to JSON-RPC error codes
    error_code = JSONRPCErrorCode.INTERNAL_ERROR
    message = str(exception)
    data = {"type": type(exception).__name__}
    
    if "not found" in message.lower():
        error_code = JSONRPCErrorCode.METHOD_NOT_FOUND
    elif "invalid" in message.lower() or "validation" in message.lower():
        error_code = JSONRPCErrorCode.INVALID_PARAMS
    elif "auth" in message.lower():
        error_code = JSONRPCErrorCode.AUTHENTICATION_ERROR
    elif "permission" in message.lower() or "forbidden" in message.lower():
        error_code = JSONRPCErrorCode.AUTHORIZATION_ERROR
    elif "rate limit" in message.lower():
        error_code = JSONRPCErrorCode.RATE_LIMIT_ERROR
    
    return create_jsonrpc_error(
        request_id=request_id,
        code=error_code,
        message=message,
        data=data
    )
