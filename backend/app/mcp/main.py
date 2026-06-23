"""
MCP FastAPI Application - MCP Specification Compliant
Provides MCP endpoints for AI clients (Cursor, Claude Desktop, etc.)
"""

from fastapi import FastAPI, Request, Header, HTTPException
from fastapi.responses import JSONResponse, StreamingResponse
from typing import Optional, Union
import logging
import json

from .gateway import MCPGateway
from .core.exceptions import MCPError
from .protocol import (
    parse_jsonrpc_request,
    create_jsonrpc_error,
    JSONRPCErrorCode,
    MCPAdapter,
    get_sse_manager,
    resolve_mcp_project,
    is_initialize_or_ping
)

# Setup logging
logging.basicConfig(level=logging.INFO)
logger = logging.getLogger(__name__)

# Create FastAPI app
mcp_app = FastAPI(
    title="ZendBX MCP",
    description="AI Operating Layer for ZendBX Projects - MCP Specification Compliant",
    version="1.0.0"
)

# Create gateway instance
gateway = MCPGateway()

# Create MCP adapter (protocol layer)
adapter: Optional[MCPAdapter] = None


@mcp_app.on_event("startup")
async def startup():
    """Initialize gateway and MCP adapter on startup"""
    global adapter
    
    logger.info("🚀 Starting ZendBX MCP Gateway...")
    try:
        await gateway.initialize()
        logger.info("✅ ZendBX MCP Gateway initialized")
        
        # Initialize MCP protocol adapter
        adapter = MCPAdapter(gateway)
        logger.info("✅ MCP Protocol Adapter initialized")
        logger.info("✅ ZendBX MCP ready (MCP Specification Compliant)")
        
    except Exception as e:
        logger.error(f"❌ MCP initialization failed: {str(e)}")
        logger.error(f"   This will prevent MCP from working properly!")
        import traceback
        logger.error(traceback.format_exc())
        # Don't raise - let the server start but MCP will return errors
        logger.warning("⚠️  MCP started in degraded state - endpoints may fail")


@mcp_app.get("/debug")
async def debug_endpoint():
    """Debug endpoint to verify MCP app is mounted correctly"""
    return {
        "message": "MCP app is working!",
        "service": "zendbx-mcp",
        "mounted_at": "/mcp"
    }


@mcp_app.post("/debug")
async def debug_post_endpoint(request: Request):
    """Debug POST endpoint to test routing"""
    body = None
    try:
        body = await request.json()
    except:
        body = "Could not parse JSON"
    
    return {
        "message": "MCP POST is working!",
        "path": str(request.url.path),
        "method": request.method,
        "body": body,
        "headers": dict(request.headers),
        "query_params": dict(request.query_params)
    }


@mcp_app.get("/health")
async def health():
    """Health check endpoint"""
    return {
        "status": "healthy",
        "service": "zendbx-mcp",
        "version": "1.0.0",
        "mcp_compliant": True,
        "protocol_version": "2024-11-05"
    }


# =============================================================================
# MCP SPECIFICATION-COMPLIANT ENDPOINTS (JSON-RPC 2.0)
# =============================================================================

@mcp_app.post("/")
async def mcp_jsonrpc_endpoint(
    request: Request,
    authorization: Optional[str] = Header(None)
):
    """
    Main MCP JSON-RPC 2.0 endpoint

    Handles all MCP methods:
    - initialize
    - tools/list
    - tools/call
    - ping
    """
    if adapter is None:
        return JSONResponse(
            status_code=503,
            content={
                "jsonrpc": "2.0",
                "id": None,
                "error": {
                    "code": -32603,
                    "message": "MCP adapter not initialized"
                }
            }
        )

    try:
        body = await request.json()

        try:
            jsonrpc_request = parse_jsonrpc_request(body)
        except ValueError as e:
            return JSONResponse(
                content=create_jsonrpc_error(
                    request_id=body.get("id"),
                    code=JSONRPCErrorCode.INVALID_REQUEST,
                    message=str(e)
                ).to_dict()
            )

        project_resolution = await resolve_mcp_project(request, jsonrpc_request)

        method_needs_project = not is_initialize_or_ping(jsonrpc_request.method)

        if not project_resolution.is_success and method_needs_project:
            return JSONResponse(
                content=create_jsonrpc_error(
                    request_id=jsonrpc_request.id,
                    code=JSONRPCErrorCode.INVALID_PARAMS,
                    message=project_resolution.error or "Could not determine project"
                ).to_dict()
            )

        project_slug = project_resolution.project_slug

        if jsonrpc_request.is_notification():
            await adapter.handle_request(jsonrpc_request, project_slug, authorization)
            return JSONResponse(content={})

        response = await adapter.handle_request(jsonrpc_request, project_slug, authorization)

        return JSONResponse(content=response.to_dict())

    except json.JSONDecodeError:
        return JSONResponse(
            content=create_jsonrpc_error(
                request_id=None,
                code=JSONRPCErrorCode.PARSE_ERROR,
                message="Invalid JSON"
            ).to_dict()
        )
    except Exception as e:
        logger.error(f"MCP endpoint error: {str(e)}", exc_info=True)
        return JSONResponse(
            status_code=500,
            content=create_jsonrpc_error(
                request_id=None,
                code=JSONRPCErrorCode.INTERNAL_ERROR,
                message=str(e)
            ).to_dict()
        )


@mcp_app.get("/sse")
async def mcp_sse_endpoint(
    request: Request,
    project: Optional[str] = None
):
    """
    SSE endpoint for MCP (HTTP+SSE transport)
    
    Per MCP spec:
    1. Client connects to SSE endpoint
    2. Server sends 'endpoint' event with URI for client→server messages
    3. Server streams notifications (tools/list_changed, etc.)
    
    This endpoint enables real-time server→client communication
    """
    if not project:
        raise HTTPException(status_code=400, detail="Missing required query parameter: project")
    
    # Get SSE manager
    sse_manager = get_sse_manager()
    
    # Stream events
    return StreamingResponse(
        sse_manager.event_stream(project_slug=project),
        media_type="text/event-stream",
        headers={
            "Cache-Control": "no-cache",
            "Connection": "keep-alive",
            "X-Accel-Buffering": "no"  # Disable nginx buffering
        }
    )


# =============================================================================
# LEGACY REST ENDPOINTS (Keep for backward compatibility)
# =============================================================================


@mcp_app.post("/p/{project_slug}/initialize")
async def initialize(
    project_slug: str,
    authorization: Optional[str] = Header(None)
):
    """
    MCP initialize endpoint
    Returns server capabilities
    """
    try:
        result = await gateway.handle_initialize(project_slug, authorization)
        return JSONResponse(result)
    except MCPError as e:
        raise HTTPException(status_code=e.status_code, detail=e.to_dict())
    except Exception as e:
        logger.error(f"Initialize error: {str(e)}")
        raise HTTPException(status_code=500, detail={"error": str(e)})


@mcp_app.post("/p/{project_slug}/tools/list")
async def tools_list(
    project_slug: str,
    authorization: Optional[str] = Header(None)
):
    """
    List available tools
    """
    try:
        result = await gateway.handle_tools_list(project_slug, authorization)
        return JSONResponse(result)
    except MCPError as e:
        raise HTTPException(status_code=e.status_code, detail=e.to_dict())
    except Exception as e:
        import traceback
        logger.error(f"Tools list error: {str(e)}")
        logger.error(f"Full traceback:\n{traceback.format_exc()}")
        
        # Debug pool state
        logger.error(f"Gateway authenticator pool: {gateway.authenticator.pool}")
        logger.error(f"Gateway project_resolver pool: {gateway.project_resolver.pool}")
        
        raise HTTPException(status_code=500, detail={"error": str(e)})


@mcp_app.post("/p/{project_slug}/tools/call")
async def tools_call(
    project_slug: str,
    request: Request,
    authorization: Optional[str] = Header(None)
):
    """
    Execute a tool
    """
    try:
        body = await request.json()
        tool_name = body.get("name")
        arguments = body.get("arguments", {})
        
        if not tool_name:
            raise HTTPException(status_code=400, detail={"error": "Missing tool name"})
        
        result = await gateway.handle_tool_call(
            project_slug,
            tool_name,
            arguments,
            authorization
        )
        return JSONResponse(result)
    except MCPError as e:
        raise HTTPException(status_code=e.status_code, detail=e.to_dict())
    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Tool call error: {str(e)}")
        raise HTTPException(status_code=500, detail={"error": str(e)})


@mcp_app.get("/p/{project_slug}")
async def project_info(project_slug: str):
    """
    Project MCP endpoint info (GET request)
    Shows helpful information for browser access
    """
    return {
        "service": "ZendBX MCP",
        "version": "1.0.0",
        "phase": "1-complete",
        "project_slug": project_slug,
        "message": "This is an MCP (Model Context Protocol) endpoint for AI clients.",
        "usage": {
            "note": "MCP endpoints require POST requests with Bearer JWT authentication",
            "endpoints": {
                "initialize": f"/p/{project_slug}/initialize",
                "tools_list": f"/p/{project_slug}/tools/list",
                "tools_call": f"/p/{project_slug}/tools/call"
            },
            "authentication": "Required: Authorization: Bearer <jwt_token>",
            "supported_clients": [
                "Cursor IDE",
                "Claude Desktop",
                "Cline",
                "VS Code with MCP extensions"
            ]
        },
        "features": {
            "tools": 13,
            "context_collectors": 6,
            "caching": "3-tier (Memory + Redis + DB)",
            "audit_logging": "enabled",
            "rate_limiting": "enabled"
        },
        "documentation": "See ZendBX dashboard for setup instructions and JWT token"
    }


@mcp_app.get("/")
async def root():
    """Root endpoint with MCP information"""
    server_info = adapter.get_server_info() if adapter else {}
    
    return {
        "service": "ZendBX MCP",
        "version": "1.0.0",
        "mcp_compliant": True,
        "protocol_version": "2024-11-05",
        "description": "AI Operating Layer for ZendBX - MCP Specification Compliant",
        "endpoints": {
            "mcp": "/mcp (POST - JSON-RPC 2.0)",
            "sse": "/mcp/sse (GET - Server-Sent Events)",
            "health": "/health",
            "legacy": {
                "initialize": "/p/{project_slug}/initialize",
                "tools_list": "/p/{project_slug}/tools/list",
                "tools_call": "/p/{project_slug}/tools/call"
            }
        },
        "transport": "HTTP + SSE",
        "capabilities": server_info.get("capabilities", {}),
        "supported_methods": server_info.get("supportedMethods", []),
        "tool_count": server_info.get("toolCount", 0),
        "documentation": "https://modelcontextprotocol.io/specification/2024-11-05"
    }
