"""
MCP Server Implementation
Provides Model Context Protocol server for AI tools
"""

from fastapi import APIRouter, HTTPException, Request, Header
from fastapi.responses import JSONResponse
from app.core.database import get_main_db_pool
from app.core.config import settings
from app.core.db_router import validate_project_key, get_project_db_direct
import logging
import json
from typing import Optional

router = APIRouter()
logger = logging.getLogger(__name__)


async def authenticate_mcp_request(project_slug: str, authorization: Optional[str] = None) -> dict:
    """
    Authenticate MCP request using project API key
    Returns project context and database pool
    """
    pool = await get_main_db_pool()
    
    async with pool.acquire() as conn:
        # Get project by slug
        project = await conn.fetchrow(
            """
            SELECT id, name, slug, user_id, database_name
            FROM projects
            WHERE slug = $1 AND status = 'active'
            """,
            project_slug
        )
        
        if not project:
            raise HTTPException(status_code=404, detail="Project not found")
        
        # Check if authentication is provided
        if not authorization:
            raise HTTPException(
                status_code=401, 
                detail="Authentication required. Include 'Authorization: Bearer <project_api_key>' header."
            )
        
        if not authorization.startswith("Bearer "):
            raise HTTPException(
                status_code=401,
                detail="Invalid authentication format. Use 'Authorization: Bearer <project_api_key>'"
            )
        
        api_key = authorization[7:].strip()
        
        # Validate API key against project
        try:
            project_context = await validate_project_key(str(project["id"]), api_key)
            
            # Only allow service_role for MCP access (full database access needed)
            if project_context["role"] not in ["service_role", "authenticated"]:
                raise HTTPException(
                    status_code=403,
                    detail="MCP access requires service_role or authenticated API key"
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
            raise HTTPException(status_code=401, detail="Invalid API key")


@router.get("/mcp/p/{project_slug}")
async def mcp_server_info(
    project_slug: str,
    request: Request,
    authorization: Optional[str] = Header(None)
):
    """
    MCP Server Information Endpoint
    Returns server capabilities and information
    """
    try:
        # Authenticate the request
        auth_info = await authenticate_mcp_request(project_slug, authorization)
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
            
    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Error in MCP server info: {str(e)}")
        raise HTTPException(status_code=500, detail=str(e))


@router.post("/mcp/p/{project_slug}")
async def mcp_server_request(
    project_slug: str,
    request: Request,
    authorization: Optional[str] = Header(None)
):
    """
    MCP Server JSON-RPC Endpoint
    Handles MCP protocol requests with proper authentication
    """
    try:
        # Parse JSON-RPC request
        body = await request.json()
        
        if not isinstance(body, dict) or "method" not in body:
            raise HTTPException(status_code=400, detail="Invalid JSON-RPC request")
        
        method = body.get("method")
        params = body.get("params", {})
        request_id = body.get("id")
        
        # Authenticate the request
        auth_info = await authenticate_mcp_request(project_slug, authorization)
        project = auth_info["project"]
        pool = auth_info["pool"]
        
        # Handle different MCP methods
        if method == "tools/list":
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
            
            # Set schema context for project database
            async with pool.acquire() as project_conn:
                await project_conn.execute(f'SET search_path TO "{project["database_name"]}", public')
                
                if tool_name == "query_database":
                    # Handle database query
                    query = arguments.get("query", "")
                    if not query:
                        return JSONResponse(content={
                            "jsonrpc": "2.0",
                            "error": {
                                "code": -32602,
                                "message": "Invalid parameters: query is required"
                            },
                            "id": request_id
                        })
                    
                    try:
                        # Execute query on project database with proper schema context
                        if query.strip().upper().startswith("SELECT"):
                            result = await project_conn.fetch(query)
                            rows = [dict(row) for row in result]
                            
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
            return JSONResponse(content={
                "jsonrpc": "2.0",
                "error": {
                    "code": -32601,
                    "message": f"Method '{method}' not found"
                },
                "id": request_id
            })
            
    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Error in MCP server request: {str(e)}")
        return JSONResponse(
            status_code=500,
            content={
                "jsonrpc": "2.0",
                "error": {
                    "code": -32603,
                    "message": f"Internal error: {str(e)}"
                },
                "id": body.get("id") if isinstance(body, dict) else None
            }
        )