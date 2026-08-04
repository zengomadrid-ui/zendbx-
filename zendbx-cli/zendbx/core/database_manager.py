"""Database Manager - Synchronous wrapper around database operations"""

import asyncio
from typing import Optional, Dict, Any, List
from .database import DatabaseManager as AsyncDatabaseManager


class DatabaseManager:
    """Synchronous wrapper for database operations"""
    
    def __init__(self, connection_string: str):
        self.connection_string = connection_string
        self._async_manager = AsyncDatabaseManager(connection_string)
    
    def _run_async(self, coro):
        """Run async function synchronously"""
        try:
            loop = asyncio.get_event_loop()
        except RuntimeError:
            loop = asyncio.new_event_loop()
            asyncio.set_event_loop(loop)
        
        return loop.run_until_complete(coro)
    
    def test_connection_sync(self) -> Dict[str, Any]:
        """Test database connection"""
        return self._run_async(self._async_manager.test_connection())
    
    def execute_query_sync(self, sql: str) -> List[Dict[str, Any]]:
        """Execute SELECT query"""
        return self._run_async(self._async_manager.execute_query(sql))
    
    def execute_command_sync(self, sql: str) -> str:
        """Execute command"""
        return self._run_async(self._async_manager.execute_command(sql))
    
    def execute_script_sync(self, sql: str):
        """Execute SQL script"""
        commands = sql.split(';')
        for command in commands:
            command = command.strip()
            if command:
                self.execute_command_sync(command)
    
    def get_schema_sync(self) -> Dict[str, Any]:
        """Get database schema"""
        return self._run_async(self._async_manager.get_schema())
    
    def get_table_stats_sync(self) -> List[Dict[str, Any]]:
        """Get table statistics"""
        return self._run_async(self._async_manager.get_table_stats())
    
    def get_slow_queries_sync(self, limit: int = 10) -> List[Dict[str, Any]]:
        """Get slow queries"""
        return self._run_async(self._async_manager.get_slow_queries(limit))
    
    def get_missing_indexes_sync(self) -> List[Dict[str, Any]]:
        """Get missing indexes suggestions"""
        return self._run_async(self._async_manager.get_missing_indexes())
    
    def analyze_health_sync(self) -> Dict[str, Any]:
        """Analyze database health"""
        return self._run_async(self._async_manager.analyze_database_health())
    
    def drop_all_tables_sync(self):
        """Drop all tables (DESTRUCTIVE)"""
        sql = """
        DO $$ DECLARE
            r RECORD;
        BEGIN
            FOR r IN (SELECT tablename FROM pg_tables WHERE schemaname = 'public') LOOP
                EXECUTE 'DROP TABLE IF EXISTS ' || quote_ident(r.tablename) || ' CASCADE';
            END LOOP;
        END $$;
        """
        self.execute_command_sync(sql)
