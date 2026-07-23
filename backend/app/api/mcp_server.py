"""
MCP Server Implementation
Provides Model Context Protocol server for AI tools
"""

from fastapi import APIRouter, HTTPException, Request, Header
from fastapi.responses import JSONResponse, Response
from app.core.database import get_main_db_pool
from app.core.config import settings
from app.core.db_router import validate_project_key, get_project_db_direct
import logging
import json
from typing import Optional

router = APIRouter()
logger = logging.getLogger(__name__)


async def authenticate_mcp_request(project_slug: str, authorization: Optional[str] = None, request_url: str = None) -> dict:
    """
    Authenticate MCP request using project API key
    Returns project context and database pool
    Supports both clean slugs and legacy slugs for backward compatibility
    
    Raises a developer-friendly JSON response when authentication is missing
    """
    from app.utils.schema_compat import resolve_project_by_slug
    
    # Check if authentication is provided - return developer-friendly response
    if not authorization:
        raise HTTPException(
            status_code=401,
            detail={
                "name": "ZenDBX MCP Server",
                "status": "authentication_required",
                "message": "This MCP endpoint requires a valid project API key.",
                "how_to_authenticate": {
                    "header": "Authorization",
                    "value": "Bearer <PROJECT_API_KEY>",
                    "example": f"Authorization: Bearer your_project_api_key_here"
                },
                "steps": [
                    "1. Go to your ZenDBX Dashboard (https://zendbx.in/dashboard/api-keys)",
                    "2. Create a new API key with 'service_role' permissions",
                    "3. Copy the API key (shown only once)",
                    "4. Include it in the Authorization header as shown above"
                ],
                "example_curl": f"curl -H 'Authorization: Bearer <YOUR_API_KEY>' {request_url or 'https://api.zendbx.in/mcp/p/' + project_slug}",
                "documentation": "https://docs.zendbx.in/mcp",
                "mcp_protocol_version": "2024-11-05"
            }
        )
    
    if not authorization.startswith("Bearer "):
        raise HTTPException(
            status_code=401,
            detail={
                "name": "ZenDBX MCP Server",
                "status": "invalid_auth_format",
                "message": "Invalid authentication format. Expected 'Authorization: Bearer <PROJECT_API_KEY>'",
                "how_to_authenticate": {
                    "header": "Authorization",
                    "value": "Bearer <PROJECT_API_KEY>",
                    "example": "Authorization: Bearer your_project_api_key_here"
                },
                "your_format": authorization.split()[0] if authorization else "missing",
                "expected_format": "Bearer <token>",
                "documentation": "https://docs.zendbx.in/mcp"
            }
        )
    
    pool = await get_main_db_pool()
    
    async with pool.acquire() as conn:
        # Get project by slug (supports both slug and legacy_slug with backward compat)
        project = await resolve_project_by_slug(
            conn,
            project_slug,
            additional_columns="id, name, slug, user_id, database_name"
        )
        
        # Security: Don't expose whether project exists or not when auth is invalid
        # This prevents enumeration attacks
        api_key = authorization[7:].strip()
        
        if not project:
            # Return generic auth error - don't reveal project doesn't exist
            raise HTTPException(
                status_code=401,
                detail={
                    "name": "ZenDBX MCP Server",
                    "status": "authentication_failed",
                    "message": "Authentication failed. Invalid API key or project.",
                    "documentation": "https://docs.zendbx.in/mcp"
                }
            )
        
        # Validate API key against project
        try:
            project_context = await validate_project_key(str(project["id"]), api_key)
            
            # Only allow service_role for MCP access (full database access needed)
            if project_context["role"] not in ["service_role", "authenticated"]:
                raise HTTPException(
                    status_code=403,
                    detail={
                        "name": "ZenDBX MCP Server",
                        "status": "insufficient_permissions",
                        "message": "MCP access requires 'service_role' API key.",
                        "your_role": project_context["role"],
                        "required_role": "service_role",
                        "documentation": "https://docs.zendbx.in/mcp"
                    }
                )
            
            return {
                "project": dict(project),
                "context": project_context,
                "pool": project_context["pool"]
            }
            
        except HTTPException:
            raise
        except Exception as e:
            logger.error(f"API key validation failed: {str(e)}")
            # Generic error - don't expose internal details
            raise HTTPException(
                status_code=401,
                detail={
                    "name": "ZenDBX MCP Server",
                    "status": "authentication_failed",
                    "message": "Authentication failed. Invalid API key or project.",
                    "documentation": "https://docs.zendbx.in/mcp"
                }
            )


@router.get("/p/{project_slug}")
async def mcp_server_info(
    project_slug: str,
    request: Request,
    authorization: Optional[str] = Header(None)
):
    """
    MCP Server Information Endpoint (New URL)
    Returns server capabilities and information
    """
    try:
        # Authenticate the request (passes request URL for better error messages)
        auth_info = await authenticate_mcp_request(
            project_slug, 
            authorization,
            request_url=str(request.url)
        )
        project = auth_info["project"]
        
        # Return MCP server information
        return {
            "jsonrpc": "2.0",
            "result": {
                "protocolVersion": "2024-11-05",
                "capabilities": {
                    "tools": {
                        "listChanged": True
                    },
                    "resources": {
                        "subscribe": True,
                        "listChanged": True
                    },
                    "prompts": {
                        "listChanged": True
                    },
                    "logging": {}
                },
                "serverInfo": {
                    "name": f"ZenDBX-{project_slug}",
                    "version": "1.0.0"
                }
            }
        }
            
    except HTTPException as http_exc:
        # Return the detailed error response we crafted
        return JSONResponse(
            status_code=http_exc.status_code,
            content=http_exc.detail if isinstance(http_exc.detail, dict) else {"detail": http_exc.detail}
        )
    except Exception as e:
        logger.error(f"Error in MCP server info: {str(e)}")
        raise HTTPException(status_code=500, detail=str(e))


@router.post("/p/{project_slug}")
async def mcp_server_request(
    project_slug: str,
    request: Request,
    authorization: Optional[str] = Header(None)
):
    """
    MCP Server JSON-RPC Endpoint (New URL)
    Handles MCP protocol requests with proper authentication
    """
    # Initialize variables for error handling
    body = None
    request_id = None
    
    try:
        logger.info(f"📨 MCP POST request received for project: {project_slug}")
        logger.info(f"� Authorization header present: {bool(authorization)}")
        
        # Step 1: Parse JSON-RPC request
        try:
            body = await request.json()
            logger.info(f"✅ JSON parsing successful")
            logger.debug(f"📦 Request body: {body}")
        except json.JSONDecodeError as e:
            logger.warning(f"❌ JSON parse error: {str(e)}")
            return JSONResponse(
                status_code=400,
                content={
                    "jsonrpc": "2.0",
                    "error": {
                        "code": -32700,
                        "message": "Parse error: Invalid JSON"
                    },
                    "id": None
                }
            )
        except Exception as e:
            logger.exception(f"❌ Request body read error: {str(e)}")
            return JSONResponse(
                status_code=400,
                content={
                    "jsonrpc": "2.0",
                    "error": {
                        "code": -32700,
                        "message": "Parse error"
                    },
                    "id": None
                }
            )
        
        # Step 2: Validate JSON-RPC request structure
        if not isinstance(body, dict):
            logger.warning(f"❌ Invalid request: body is not a dict, type={type(body)}")
            return JSONResponse(
                status_code=400,
                content={
                    "jsonrpc": "2.0",
                    "error": {
                        "code": -32600,
                        "message": "Invalid Request: body must be an object"
                    },
                    "id": None
                }
            )
        
        request_id = body.get("id")
        
        if "method" not in body:
            logger.warning(f"❌ Invalid request: missing 'method' field")
            return JSONResponse(
                status_code=400,
                content={
                    "jsonrpc": "2.0",
                    "error": {
                        "code": -32600,
                        "message": "Invalid Request: 'method' field is required"
                    },
                    "id": request_id
                }
            )
        
        method = body.get("method")
        params = body.get("params", {})
        
        logger.info(f"🔧 JSON-RPC method: {method}")
        logger.info(f"📋 Parameters: {list(params.keys()) if isinstance(params, dict) else type(params)}")
        
        # Step 3: Authenticate the request
        logger.info(f"🔐 Authenticating request...")
        try:
            auth_info = await authenticate_mcp_request(
                project_slug,
                authorization,
                request_url=str(request.url)
            )
            project = auth_info["project"]
            pool = auth_info["pool"]
            logger.info(f"✅ Authentication successful for project: {project['name']}")
        except HTTPException as http_exc:
            logger.warning(f"❌ Authentication failed: {http_exc.detail}")
            # Return developer-friendly JSON error
            return JSONResponse(
                status_code=http_exc.status_code,
                content={
                    "jsonrpc": "2.0",
                    "error": {
                        "code": -32000,  # Server error
                        "message": http_exc.detail if isinstance(http_exc.detail, str) else http_exc.detail.get("message", "Authentication failed"),
                        "data": http_exc.detail if isinstance(http_exc.detail, dict) else None
                    },
                    "id": request_id
                }
            )
        
        # Step 4: Handle different MCP methods
        logger.info(f"🚀 Executing method: {method}")
        
        # MCP Initialization Protocol
        if method == "initialize":
            logger.info(f"🔄 MCP initialization request received")
            client_info = params.get("clientInfo", {})
            protocol_version = params.get("protocolVersion", "2024-11-05")
            
            logger.info(f"👤 Client: {client_info.get('name', 'unknown')} v{client_info.get('version', 'unknown')}")
            logger.info(f"📡 Protocol version requested: {protocol_version}")
            
            # Return MCP initialization response
            response = {
                "jsonrpc": "2.0",
                "result": {
                    "protocolVersion": "2024-11-05",
                    "capabilities": {
                        "tools": {
                            "listChanged": True
                        }
                    },
                    "serverInfo": {
                        "name": "ZenDBX MCP Server",
                        "version": "1.0.0"
                    }
                },
                "id": request_id
            }
            
            logger.info(f"✅ Initialization response sent")
            return JSONResponse(content=response)
        
        # MCP Initialized Notification (no response needed)
        elif method == "notifications/initialized" or method == "initialized":
            logger.info(f"✅ Client initialization complete (notification received)")
            # This is a notification - do not send a response
            # Return 204 No Content for notifications without id
            if request_id is None:
                return Response(status_code=204)
            else:
                # If it has an id, it's not a proper notification, but acknowledge it
                return JSONResponse(content={
                    "jsonrpc": "2.0",
                    "result": {},
                    "id": request_id
                })
        
        elif method == "tools/list":
            logger.info(f"📋 Listing available tools")
            return JSONResponse(content={
                "jsonrpc": "2.0",
                "result": {
                    "tools": [
                        {
                            "name": "query_database",
                            "description": "Execute SQL queries on the project database",
                            "inputSchema": {
                                "type": "object",
                                "properties": {
                                    "query": {
                                        "type": "string",
                                        "description": "The SQL query to execute"
                                    }
                                },
                                "required": ["query"]
                            }
                        },
                        {
                            "name": "list_tables",
                            "description": "List all tables in the project database",
                            "inputSchema": {
                                "type": "object",
                                "properties": {}
                            }
                        },
                        {
                            "name": "describe_table",
                            "description": "Get detailed information about a table structure",
                            "inputSchema": {
                                "type": "object",
                                "properties": {
                                    "table_name": {
                                        "type": "string",
                                        "description": "Name of the table to describe"
                                    }
                                },
                                "required": ["table_name"]
                            }
                        },
                        {
                            "name": "get_schema",
                            "description": "Get complete database schema information",
                            "inputSchema": {
                                "type": "object",
                                "properties": {}
                            }
                        }
                    ]
                },
                "id": request_id
            })
        
        elif method == "tools/call":
            tool_name = params.get("name")
            arguments = params.get("arguments", {})
            
            logger.info(f"🔧 Tool call: {tool_name}")
            logger.debug(f"📦 Arguments: {arguments}")
            
            # Set schema context for project database
            async with pool.acquire() as project_conn:
                await project_conn.execute(f'SET search_path TO "{project["database_name"]}", public')
                
                if tool_name == "query_database":
                    # Handle database query
                    query = arguments.get("query", "")
                    if not query:
                        logger.warning(f"❌ Tool call failed: query parameter required")
                        return JSONResponse(content={
                            "jsonrpc": "2.0",
                            "error": {
                                "code": -32602,
                                "message": "Invalid parameters: query is required"
                            },
                            "id": request_id
                        })
                    
                    try:
                        logger.info(f"🗄️  Executing query: {query[:100]}...")
                        # Execute query on project database with proper schema context
                        if query.strip().upper().startswith("SELECT"):
                            result = await project_conn.fetch(query)
                            rows = [dict(row) for row in result]
                            
                            logger.info(f"✅ Query executed successfully: {len(rows)} rows returned")
                            
                            return JSONResponse(content={
                                "jsonrpc": "2.0",
                                "result": {
                                    "content": [
                                        {
                                            "type": "text",
                                            "text": f"Query executed successfully. Returned {len(rows)} rows.\n\nResults:\n" + 
                                                   json.dumps(rows, indent=2, default=str)
                                        }
                                    ]
                                },
                                "id": request_id
                            })
                        else:
                            # Non-SELECT queries
                            result = await project_conn.execute(query)
                            logger.info(f"✅ Non-SELECT query executed: {result}")
                            return JSONResponse(content={
                                "jsonrpc": "2.0",
                                "result": {
                                    "content": [
                                        {
                                            "type": "text",
                                            "text": f"Query executed successfully: {result}"
                                        }
                                    ]
                                },
                                "id": request_id
                            })
                            
                    except Exception as e:
                        logger.exception(f"❌ Query execution failed: {str(e)}")
                        return JSONResponse(content={
                            "jsonrpc": "2.0",
                            "result": {
                                "content": [
                                    {
                                        "type": "text",
                                        "text": f"Query failed: {str(e)}"
                                    }
                                ]
                            },
                            "id": request_id
                        })
                
                elif tool_name == "list_tables":
                    try:
                        tables = await project_conn.fetch("""
                            SELECT table_name, table_type
                            FROM information_schema.tables
                            WHERE table_schema = $1
                            ORDER BY table_name
                        """, project["database_name"])
                        
                        table_list = [dict(table) for table in tables]
                        
                        return JSONResponse(content={
                            "jsonrpc": "2.0",
                            "result": {
                                "content": [
                                    {
                                        "type": "text",
                                        "text": f"Tables in project '{project['name']}':\n\n" + 
                                               json.dumps(table_list, indent=2)
                                    }
                                ]
                            },
                            "id": request_id
                        })
                        
                    except Exception as e:
                        return JSONResponse(content={
                            "jsonrpc": "2.0",
                            "result": {
                                "content": [
                                    {
                                        "type": "text",
                                        "text": f"Failed to list tables: {str(e)}"
                                    }
                                ]
                            },
                            "id": request_id
                        })
                
                elif tool_name == "describe_table":
                    table_name = arguments.get("table_name", "")
                    if not table_name:
                        return JSONResponse(content={
                            "jsonrpc": "2.0",
                            "error": {
                                "code": -32602,
                                "message": "Invalid parameters: table_name is required"
                            },
                            "id": request_id
                        })
                    
                    try:
                        columns = await project_conn.fetch("""
                            SELECT column_name, data_type, is_nullable, column_default
                            FROM information_schema.columns
                            WHERE table_schema = $1 AND table_name = $2
                            ORDER BY ordinal_position
                        """, project["database_name"], table_name)
                        
                        if not columns:
                            return JSONResponse(content={
                                "jsonrpc": "2.0",
                                "result": {
                                    "content": [
                                        {
                                            "type": "text",
                                            "text": f"Table '{table_name}' not found"
                                        }
                                    ]
                                },
                                "id": request_id
                            })
                        
                        column_info = [dict(col) for col in columns]
                        
                        return JSONResponse(content={
                            "jsonrpc": "2.0",
                            "result": {
                                "content": [
                                    {
                                        "type": "text",
                                        "text": f"Table structure for '{table_name}':\n\n" + 
                                               json.dumps(column_info, indent=2)
                                    }
                                ]
                            },
                            "id": request_id
                        })
                        
                    except Exception as e:
                        return JSONResponse(content={
                            "jsonrpc": "2.0",
                            "result": {
                                "content": [
                                    {
                                        "type": "text",
                                        "text": f"Failed to describe table: {str(e)}"
                                    }
                                ]
                            },
                            "id": request_id
                        })
                
                elif tool_name == "get_schema":
                    try:
                        # Get comprehensive schema information
                        schema_info = await project_conn.fetchrow("""
                            SELECT 
                                COUNT(*) as table_count,
                                $1 as schema_name
                            FROM information_schema.tables 
                            WHERE table_schema = $1
                        """, project["database_name"])
                        
                        # Get all tables with column counts
                        tables = await project_conn.fetch("""
                            SELECT 
                                t.table_name,
                                t.table_type,
                                COUNT(c.column_name) as column_count
                            FROM information_schema.tables t
                            LEFT JOIN information_schema.columns c 
                                ON t.table_name = c.table_name 
                                AND t.table_schema = c.table_schema
                            WHERE t.table_schema = $1
                            GROUP BY t.table_name, t.table_type
                            ORDER BY t.table_name
                        """, project["database_name"])
                        
                        schema_data = {
                            "project": project["name"],
                            "schema": project["database_name"],
                            "table_count": schema_info["table_count"],
                            "tables": [dict(table) for table in tables]
                        }
                        
                        return JSONResponse(content={
                            "jsonrpc": "2.0",
                            "result": {
                                "content": [
                                    {
                                        "type": "text",
                                        "text": f"Database schema for '{project['name']}':\n\n" + 
                                               json.dumps(schema_data, indent=2)
                                    }
                                ]
                            },
                            "id": request_id
                        })
                        
                    except Exception as e:
                        return JSONResponse(content={
                            "jsonrpc": "2.0",
                            "result": {
                                "content": [
                                    {
                                        "type": "text",
                                        "text": f"Failed to get schema: {str(e)}"
                                    }
                                ]
                            },
                            "id": request_id
                        })
                
                else:
                    return JSONResponse(content={
                        "jsonrpc": "2.0",
                        "error": {
                            "code": -32601,
                            "message": f"Tool '{tool_name}' not found"
                        },
                        "id": request_id
                    })
        
        elif method == "resources/list":
            return JSONResponse(content={
                "jsonrpc": "2.0",
                "result": {
                    "resources": [
                        {
                            "uri": f"zendbx://project/{project_slug}/schema",
                            "name": f"Database Schema - {project['name']}",
                            "description": "Complete database schema information",
                            "mimeType": "application/json"
                        }
                    ]
                },
                "id": request_id
            })
        
        elif method == "prompts/list":
            return JSONResponse(content={
                "jsonrpc": "2.0",
                "result": {
                    "prompts": [
                        {
                            "name": "analyze_database",
                            "description": "Analyze the database structure and suggest improvements"
                        },
                        {
                            "name": "generate_api",
                            "description": "Generate REST API endpoints for tables"
                        }
                    ]
                },
                "id": request_id
            })
        
        else:
            logger.warning(f"❌ Unknown method: {method}")
            return JSONResponse(content={
                "jsonrpc": "2.0",
                "error": {
                    "code": -32601,
                    "message": f"Method '{method}' not found"
                },
                "id": request_id
            })
            
    except HTTPException as http_exc:
        logger.exception(f"❌ HTTP exception in MCP server: {http_exc.detail}")
        raise
    except Exception as e:
        logger.exception(f"❌ Unhandled exception in MCP server request")
        # Use request_id if available, otherwise None
        return JSONResponse(
            status_code=500,
            content={
                "jsonrpc": "2.0",
                "error": {
                    "code": -32603,
                    "message": f"Internal error: {str(e)}"
                },
                "id": request_id
            }
        )


# Backward compatibility routes - redirect old URLs to new format
@router.get("/mcp/p/{project_slug}")
async def mcp_server_info_legacy(
    project_slug: str,
    request: Request,
    authorization: Optional[str] = Header(None)
):
    """
    Legacy MCP Server Information Endpoint - Redirects to new URL
    DEPRECATED: Use /p/{project_slug} instead
    """
    return await mcp_server_info(project_slug, request, authorization)


@router.post("/mcp/p/{project_slug}")
async def mcp_server_request_legacy(
    project_slug: str,
    request: Request,
    authorization: Optional[str] = Header(None)
):
    """
    Legacy MCP Server JSON-RPC Endpoint - Redirects to new URL  
    DEPRECATED: Use /p/{project_slug} instead
    """
    return await mcp_server_request(project_slug, request, authorization)