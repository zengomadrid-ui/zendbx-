"""
Server-Sent Events (SSE) Transport for MCP
Minimal implementation for HTTP+SSE transport as per MCP specification
"""

import asyncio
import json
import logging
from typing import AsyncGenerator, Dict, Any, Optional
from datetime import datetime

logger = logging.getLogger(__name__)


class SSEManager:
    """
    Manages Server-Sent Events connections for MCP
    
    Per MCP spec, SSE is used for server→client messages
    Client→server messages use regular HTTP POST
    """
    
    def __init__(self, base_url: str = "http://localhost:8000/mcp"):
        """
        Initialize SSE manager
        
        Args:
            base_url: Base URL for MCP endpoints
        """
        self.base_url = base_url
        self.connections = {}  # Track active connections
    
    async def event_stream(
        self,
        project_slug: str,
        client_id: Optional[str] = None
    ) -> AsyncGenerator[str, None]:
        """
        Generate SSE event stream for MCP client
        
        Per MCP spec, first event MUST be 'endpoint' with the URI for client→server messages
        
        Args:
            project_slug: Project slug
            client_id: Optional client identifier
            
        Yields:
            SSE formatted messages
        """
        connection_id = client_id or f"conn_{datetime.utcnow().timestamp()}"
        
        logger.info(f"SSE connection established: {connection_id} for project {project_slug}")
        
        try:
            # Per MCP spec: First event MUST be 'endpoint' event
            endpoint_uri = f"{self.base_url}"
            endpoint_event = self._format_sse_event(
                event="endpoint",
                data={"uri": endpoint_uri}
            )
            yield endpoint_event
            
            # Keep connection alive with periodic heartbeats
            # This prevents timeout and allows future notifications
            while True:
                await asyncio.sleep(30)  # Heartbeat every 30 seconds
                
                # Send comment as keepalive (doesn't trigger client event)
                yield f": keepalive {datetime.utcnow().isoformat()}\n\n"
                
                # TODO: When we implement notifications, send them here:
                # - notifications/tools/list_changed
                # - notifications/resources/list_changed
                # - etc.
                
        except asyncio.CancelledError:
            logger.info(f"SSE connection closed: {connection_id}")
            raise
        except Exception as e:
            logger.error(f"SSE error for {connection_id}: {str(e)}")
            raise
        finally:
            # Cleanup connection
            if connection_id in self.connections:
                del self.connections[connection_id]
    
    def _format_sse_event(
        self,
        data: Dict[str, Any],
        event: Optional[str] = None,
        event_id: Optional[str] = None,
        retry: Optional[int] = None
    ) -> str:
        """
        Format data as SSE event
        
        SSE format:
        event: <event_type>
        data: <json_data>
        id: <event_id>
        retry: <milliseconds>
        
        Args:
            data: Event data (will be JSON serialized)
            event: Optional event type (default is 'message')
            event_id: Optional event ID
            retry: Optional retry interval in milliseconds
            
        Returns:
            Formatted SSE string
        """
        lines = []
        
        # Event type
        if event:
            lines.append(f"event: {event}")
        
        # Event ID
        if event_id:
            lines.append(f"id: {event_id}")
        
        # Retry interval
        if retry:
            lines.append(f"retry: {retry}")
        
        # Data (JSON serialized)
        data_json = json.dumps(data)
        lines.append(f"data: {data_json}")
        
        # SSE messages end with double newline
        return "\n".join(lines) + "\n\n"
    
    async def send_notification(
        self,
        project_slug: str,
        notification: Dict[str, Any]
    ):
        """
        Send notification to all connected clients for a project
        
        This will be used when we implement:
        - notifications/tools/list_changed
        - notifications/resources/list_changed
        - etc.
        
        Args:
            project_slug: Project slug
            notification: Notification data (JSON-RPC format)
        """
        # TODO: Implement when we support dynamic tool lists
        # For now, we don't have any notifications to send
        logger.debug(f"Notification for {project_slug}: {notification}")
    
    async def send_tools_list_changed(self, project_slug: str):
        """
        Send tools/list_changed notification
        
        Per MCP spec, this notifies clients that the tool list has changed
        """
        notification = {
            "jsonrpc": "2.0",
            "method": "notifications/tools/list_changed"
        }
        
        await self.send_notification(project_slug, notification)
    
    def get_connection_count(self) -> int:
        """Get number of active SSE connections"""
        return len(self.connections)
    
    def get_status(self) -> Dict[str, Any]:
        """Get SSE manager status"""
        return {
            "active_connections": self.get_connection_count(),
            "base_url": self.base_url,
            "supported_events": [
                "endpoint",  # Initial connection event
                "message",   # Generic messages
                # Future notifications:
                # "tools/list_changed",
                # "resources/list_changed"
            ]
        }


# Global SSE manager instance
_sse_manager: Optional[SSEManager] = None


def get_sse_manager(base_url: str = "http://localhost:8000/mcp") -> SSEManager:
    """Get global SSE manager instance"""
    global _sse_manager
    
    if _sse_manager is None:
        _sse_manager = SSEManager(base_url=base_url)
    
    return _sse_manager
