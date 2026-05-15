"""
PostgreSQL LISTEN/NOTIFY Realtime Service
Listens for database changes and forwards them to WebSocket server
"""
import asyncio
import asyncpg
import json
import logging
from typing import Optional, Dict, Callable
from app.core.config import settings

logger = logging.getLogger(__name__)

class RealtimeListener:
    """
    Manages PostgreSQL LISTEN connections for realtime database notifications
    """
    
    def __init__(self):
        self.connections: Dict[str, asyncpg.Connection] = {}
        self.listeners: Dict[str, asyncio.Task] = {}
        self.running = False
        self.callback: Optional[Callable] = None
        
    def set_callback(self, callback: Callable):
        """Set the callback function to handle notifications"""
        self.callback = callback
        
    async def start_listening(self, database_url: str, database_name: str = "main"):
        """
        Start listening to a database for notifications
        
        Args:
            database_url: PostgreSQL connection URL
            database_name: Identifier for this database (e.g., "main" or project ID)
        """
        if database_name in self.listeners:
            logger.warning(f"Already listening to database: {database_name}")
            return
            
        self.running = True
        task = asyncio.create_task(
            self._listen_loop(database_url, database_name)
        )
        self.listeners[database_name] = task
        logger.info(f"✅ Started realtime listener for database: {database_name}")
        
    async def _listen_loop(self, database_url: str, database_name: str):
        """
        Main listening loop with auto-reconnect
        """
        retry_delay = 1
        max_retry_delay = 60
        consecutive_failures = 0
        max_consecutive_failures = 5
        
        while self.running:
            try:
                # Connect to database (no SSL parameter - use defaults)
                conn = await asyncpg.connect(database_url)
                self.connections[database_name] = conn
                
                logger.info(f"📡 Connected to {database_name} for realtime notifications")
                
                # Add listener for db_changes channel
                await conn.add_listener('db_changes', self._handle_notification)
                
                # Reset retry delay and failure count on successful connection
                retry_delay = 1
                consecutive_failures = 0
                
                # Keep connection alive with periodic pings
                while self.running:
                    try:
                        # Ping database to keep connection alive
                        await conn.fetchval('SELECT 1')
                        await asyncio.sleep(30)  # Ping every 30 seconds
                    except Exception as ping_error:
                        logger.warning(f"Connection ping failed for {database_name}: {ping_error}")
                        break  # Exit inner loop to reconnect
                    
            except asyncpg.PostgresError as e:
                consecutive_failures += 1
                logger.error(f"PostgreSQL error in {database_name}: {e}")
                
            except Exception as e:
                consecutive_failures += 1
                logger.error(f"Unexpected error in {database_name} listener: {e}")
                
            finally:
                # Clean up connection
                if database_name in self.connections:
                    try:
                        await self.connections[database_name].close()
                    except:
                        pass
                    del self.connections[database_name]
                
                # Check if we should stop trying
                if consecutive_failures >= max_consecutive_failures:
                    logger.error(
                        f"❌ Realtime listener for {database_name} failed {consecutive_failures} times. "
                        f"Stopping reconnection attempts. Set ENABLE_REALTIME=false in .env to disable."
                    )
                    self.running = False
                    break
                
                # Retry with exponential backoff
                if self.running:
                    logger.info(f"Reconnecting to {database_name} in {retry_delay}s... (attempt {consecutive_failures + 1})")
                    await asyncio.sleep(retry_delay)
                    retry_delay = min(retry_delay * 2, max_retry_delay)
                    
    def _handle_notification(self, connection, pid, channel, payload):
        """
        Handle incoming notification from PostgreSQL
        
        Args:
            connection: Database connection
            pid: Process ID
            channel: Notification channel name
            payload: JSON payload as string
        """
        try:
            # Parse the JSON payload
            data = json.loads(payload)
            
            logger.info(f"📨 Received notification: {data.get('table')} - {data.get('operation')}")
            
            # Call the callback if set
            if self.callback:
                asyncio.create_task(self.callback(data))
            else:
                logger.warning("No callback set for realtime notifications")
                
        except json.JSONDecodeError as e:
            logger.error(f"Failed to parse notification payload: {e}")
            logger.error(f"Payload: {payload}")
            
        except Exception as e:
            logger.error(f"Error handling notification: {e}")
            
    async def stop_listening(self, database_name: str = None):
        """
        Stop listening to a specific database or all databases
        
        Args:
            database_name: Database to stop listening to (None = all)
        """
        if database_name:
            # Stop specific database
            if database_name in self.listeners:
                self.listeners[database_name].cancel()
                del self.listeners[database_name]
                
            if database_name in self.connections:
                await self.connections[database_name].close()
                del self.connections[database_name]
                
            logger.info(f"Stopped listening to database: {database_name}")
        else:
            # Stop all
            self.running = False
            
            # Cancel all listener tasks
            for task in list(self.listeners.values()):
                task.cancel()
                
            # Close all connections
            for conn in list(self.connections.values()):
                try:
                    await conn.close()
                except:
                    pass
                    
            self.listeners.clear()
            self.connections.clear()
            
            logger.info("Stopped all realtime listeners")
            
    def get_status(self) -> dict:
        """Get status of all listeners"""
        return {
            "running": self.running,
            "active_listeners": list(self.listeners.keys()),
            "active_connections": list(self.connections.keys())
        }

# Global instance
realtime_listener = RealtimeListener()
