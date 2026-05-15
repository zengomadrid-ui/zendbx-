"""
WebSocket Client Service
Forwards database events to the WebSocket server
"""
import httpx
import logging
from typing import Dict, Any
from app.core.config import settings

logger = logging.getLogger(__name__)

class WebSocketClient:
    """
    Client for forwarding events to the WebSocket server
    """
    
    def __init__(self):
        self.websocket_url = settings.WEBSOCKET_SERVER_URL
        self.client = httpx.AsyncClient(timeout=5.0)
        
    async def broadcast_event(self, event_data: Dict[str, Any]):
        """
        Broadcast a database change event to the WebSocket server
        
        Args:
            event_data: Event data containing table, operation, new/old data
        """
        try:
            # Prepare the payload for WebSocket server
            payload = {
                "event": "db_change",
                "channel": f"table:{event_data.get('table')}",
                "data": event_data
            }
            
            # Send to WebSocket server's broadcast endpoint
            response = await self.client.post(
                f"{self.websocket_url}/broadcast",
                json=payload
            )
            
            if response.status_code == 200:
                logger.debug(f"✅ Broadcasted event to WebSocket: {event_data.get('table')}")
            else:
                logger.error(f"Failed to broadcast event: {response.status_code}")
                
        except httpx.TimeoutException:
            logger.error("WebSocket server timeout")
            
        except httpx.ConnectError:
            logger.error(f"Cannot connect to WebSocket server at {self.websocket_url}")
            
        except Exception as e:
            logger.error(f"Error broadcasting to WebSocket: {e}")
            
    async def close(self):
        """Close the HTTP client"""
        await self.client.aclose()

# Global instance
websocket_client = WebSocketClient()
