"""
MCP Audit Logging
Tracks all MCP requests, tool executions, and errors
"""

import time
import logging
from typing import Dict, Any, Optional
from uuid import UUID, uuid4
from datetime import datetime

from app.core.db_router import get_main_db_pool

logger = logging.getLogger(__name__)


class MCPAuditLogger:
    """
    Audit logger for MCP operations
    Logs all requests, tool executions, errors, and performance metrics
    """
    
    async def log_request(
        self,
        project_id: str,
        user_id: str,
        endpoint: str,
        method: str,
        status_code: int,
        execution_time_ms: int,
        tool_name: Optional[str] = None,
        error: Optional[str] = None,
        metadata: Optional[Dict[str, Any]] = None
    ):
        """
        Log MCP request
        
        Args:
            project_id: Project UUID
            user_id: User UUID
            endpoint: MCP endpoint
            method: HTTP method
            status_code: HTTP status code
            execution_time_ms: Execution time in milliseconds
            tool_name: Optional tool name if tool execution
            error: Optional error message
            metadata: Optional additional metadata
        """
        try:
            pool = await get_main_db_pool()
            
            import json
            
            async with pool.acquire() as conn:
                await conn.execute(
                    """
                    INSERT INTO mcp_audit_logs (
                        id,
                        project_id,
                        user_id,
                        endpoint,
                        method,
                        status_code,
                        execution_time_ms,
                        tool_name,
                        error,
                        metadata,
                        created_at
                    ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10::jsonb, $11)
                    """,
                    uuid4(),
                    UUID(project_id),
                    UUID(user_id),
                    endpoint,
                    method,
                    status_code,
                    execution_time_ms,
                    tool_name,
                    error,
                    json.dumps(metadata) if metadata else '{}',
                    datetime.utcnow()
                )
                
        except Exception as e:
            # Don't fail the request if audit logging fails
            logger.error(f"Failed to log MCP request: {str(e)}")
    
    async def log_tool_execution(
        self,
        project_id: str,
        user_id: str,
        tool_name: str,
        parameters: Dict[str, Any],
        success: bool,
        execution_time_ms: int,
        error: Optional[str] = None,
        result_size: Optional[int] = None
    ):
        """
        Log tool execution
        
        Args:
            project_id: Project UUID
            user_id: User UUID
            tool_name: Tool name
            parameters: Tool parameters
            success: Whether execution succeeded
            execution_time_ms: Execution time
            error: Optional error message
            result_size: Optional size of result in bytes
        """
        try:
            pool = await get_main_db_pool()
            
            import json
            
            async with pool.acquire() as conn:
                await conn.execute(
                    """
                    INSERT INTO mcp_tool_executions (
                        id,
                        project_id,
                        user_id,
                        tool_name,
                        parameters,
                        success,
                        execution_time_ms,
                        error,
                        result_size,
                        created_at
                    ) VALUES ($1, $2, $3, $4, $5::jsonb, $6, $7, $8, $9, $10)
                    """,
                    uuid4(),
                    UUID(project_id),
                    UUID(user_id),
                    tool_name,
                    json.dumps(parameters) if parameters else '{}',
                    success,
                    execution_time_ms,
                    error,
                    result_size,
                    datetime.utcnow()
                )
                
        except Exception as e:
            logger.error(f"Failed to log tool execution: {str(e)}")
    
    async def log_error(
        self,
        project_id: Optional[str],
        user_id: Optional[str],
        error_type: str,
        error_message: str,
        stack_trace: Optional[str] = None,
        metadata: Optional[Dict[str, Any]] = None
    ):
        """
        Log error
        
        Args:
            project_id: Optional project UUID
            user_id: Optional user UUID
            error_type: Error type/category
            error_message: Error message
            stack_trace: Optional stack trace
            metadata: Optional additional metadata
        """
        try:
            pool = await get_main_db_pool()
            
            import json
            
            async with pool.acquire() as conn:
                await conn.execute(
                    """
                    INSERT INTO mcp_errors (
                        id,
                        project_id,
                        user_id,
                        error_type,
                        error_message,
                        stack_trace,
                        metadata,
                        created_at
                    ) VALUES ($1, $2, $3, $4, $5, $6, $7::jsonb, $8)
                    """,
                    uuid4(),
                    UUID(project_id) if project_id else None,
                    UUID(user_id) if user_id else None,
                    error_type,
                    error_message,
                    stack_trace,
                    json.dumps(metadata) if metadata else '{}',
                    datetime.utcnow()
                )
                
        except Exception as e:
            logger.error(f"Failed to log error: {str(e)}")
    
    async def get_stats(
        self,
        project_id: str,
        hours: int = 24
    ) -> Dict[str, Any]:
        """
        Get audit statistics
        
        Args:
            project_id: Project UUID
            hours: Time window in hours
            
        Returns:
            Statistics dict
        """
        try:
            pool = await get_main_db_pool()
            
            async with pool.acquire() as conn:
                # Get request stats
                request_stats = await conn.fetchrow(
                    """
                    SELECT 
                        COUNT(*) as total_requests,
                        AVG(execution_time_ms) as avg_execution_time,
                        MAX(execution_time_ms) as max_execution_time,
                        COUNT(CASE WHEN status_code >= 400 THEN 1 END) as error_count
                    FROM mcp_audit_logs
                    WHERE project_id = $1
                        AND created_at > NOW() - INTERVAL '$2 hours'
                    """,
                    UUID(project_id),
                    hours
                )
                
                # Get tool stats
                tool_stats = await conn.fetch(
                    """
                    SELECT 
                        tool_name,
                        COUNT(*) as execution_count,
                        AVG(execution_time_ms) as avg_time,
                        COUNT(CASE WHEN success THEN 1 END) as success_count,
                        COUNT(CASE WHEN NOT success THEN 1 END) as error_count
                    FROM mcp_tool_executions
                    WHERE project_id = $1
                        AND created_at > NOW() - INTERVAL '$2 hours'
                    GROUP BY tool_name
                    ORDER BY execution_count DESC
                    """,
                    UUID(project_id),
                    hours
                )
                
                # Get recent errors
                recent_errors = await conn.fetch(
                    """
                    SELECT 
                        error_type,
                        error_message,
                        created_at
                    FROM mcp_errors
                    WHERE project_id = $1
                        AND created_at > NOW() - INTERVAL '$2 hours'
                    ORDER BY created_at DESC
                    LIMIT 10
                    """,
                    UUID(project_id),
                    hours
                )
                
                return {
                    "time_window_hours": hours,
                    "requests": {
                        "total": request_stats["total_requests"] or 0,
                        "avg_execution_time_ms": int(request_stats["avg_execution_time"] or 0),
                        "max_execution_time_ms": request_stats["max_execution_time"] or 0,
                        "error_count": request_stats["error_count"] or 0
                    },
                    "tools": [dict(row) for row in tool_stats],
                    "recent_errors": [
                        {
                            "type": row["error_type"],
                            "message": row["error_message"],
                            "timestamp": row["created_at"].isoformat()
                        }
                        for row in recent_errors
                    ]
                }
                
        except Exception as e:
            logger.error(f"Failed to get audit stats: {str(e)}")
            return {
                "time_window_hours": hours,
                "requests": {"total": 0, "avg_execution_time_ms": 0, "max_execution_time_ms": 0, "error_count": 0},
                "tools": [],
                "recent_errors": []
            }


# Global audit logger instance
_audit_logger = MCPAuditLogger()


def get_audit_logger() -> MCPAuditLogger:
    """Get global audit logger instance"""
    return _audit_logger
