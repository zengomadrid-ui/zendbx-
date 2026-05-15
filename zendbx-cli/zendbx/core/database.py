"""Database connection and operations"""

import asyncio
from typing import Optional, Dict, Any, List
import asyncpg
from contextlib import asynccontextmanager
from ..utils.errors import ConnectionError, DatabaseError
from ..utils.logger import logger


class DatabaseManager:
    """Manages PostgreSQL database connections and operations"""
    
    def __init__(self, connection_string: str):
        self.connection_string = connection_string
        self._pool: Optional[asyncpg.Pool] = None
    
    async def connect(self) -> None:
        """Establish database connection pool"""
        try:
            self._pool = await asyncpg.create_pool(
                self.connection_string,
                min_size=1,
                max_size=10,
                command_timeout=60
            )
            logger.info("Database connection pool created")
        except Exception as e:
            raise ConnectionError(f"Failed to connect to database: {e}")
    
    async def disconnect(self) -> None:
        """Close database connection pool"""
        if self._pool:
            await self._pool.close()
            self._pool = None
            logger.info("Database connection pool closed")
    
    @asynccontextmanager
    async def get_connection(self):
        """Get a connection from the pool"""
        if not self._pool:
            await self.connect()
        
        async with self._pool.acquire() as conn:
            yield conn
    
    async def test_connection(self) -> Dict[str, Any]:
        """Test database connection and return server info"""
        try:
            async with self.get_connection() as conn:
                version = await conn.fetchval("SELECT version()")
                current_db = await conn.fetchval("SELECT current_database()")
                current_user = await conn.fetchval("SELECT current_user")
                
                return {
                    "connected": True,
                    "version": version,
                    "database": current_db,
                    "user": current_user,
                }
        except Exception as e:
            raise ConnectionError(f"Connection test failed: {e}")
    
    async def execute_query(self, sql: str) -> List[Dict[str, Any]]:
        """Execute a SELECT query and return results"""
        try:
            async with self.get_connection() as conn:
                rows = await conn.fetch(sql)
                return [dict(row) for row in rows]
        except Exception as e:
            raise DatabaseError(f"Query execution failed: {e}")
    
    async def execute_command(self, sql: str) -> str:
        """Execute a command (INSERT, UPDATE, DELETE, etc.)"""
        try:
            async with self.get_connection() as conn:
                result = await conn.execute(sql)
                return result
        except Exception as e:
            raise DatabaseError(f"Command execution failed: {e}")
    
    async def get_schema(self) -> Dict[str, Any]:
        """Get database schema information"""
        try:
            async with self.get_connection() as conn:
                # Get all tables
                tables_query = """
                    SELECT table_name
                    FROM information_schema.tables
                    WHERE table_schema = 'public'
                    AND table_type = 'BASE TABLE'
                    ORDER BY table_name
                """
                tables = await conn.fetch(tables_query)
                
                schema = {"tables": {}}
                
                # Get columns for each table
                for table_row in tables:
                    table_name = table_row['table_name']
                    
                    columns_query = """
                        SELECT 
                            column_name,
                            data_type,
                            is_nullable,
                            column_default
                        FROM information_schema.columns
                        WHERE table_schema = 'public'
                        AND table_name = $1
                        ORDER BY ordinal_position
                    """
                    columns = await conn.fetch(columns_query, table_name)
                    
                    schema["tables"][table_name] = {
                        "columns": [
                            {
                                "name": col['column_name'],
                                "type": col['data_type'],
                                "nullable": col['is_nullable'] == 'YES',
                                "default": col['column_default']
                            }
                            for col in columns
                        ]
                    }
                
                return schema
        except Exception as e:
            raise DatabaseError(f"Failed to get schema: {e}")
    
    async def get_table_stats(self) -> List[Dict[str, Any]]:
        """Get statistics for all tables"""
        try:
            async with self.get_connection() as conn:
                query = """
                    SELECT 
                        schemaname,
                        tablename,
                        pg_size_pretty(pg_total_relation_size(schemaname||'.'||tablename)) AS size,
                        n_live_tup AS row_count,
                        n_dead_tup AS dead_rows,
                        last_vacuum,
                        last_autovacuum,
                        last_analyze
                    FROM pg_stat_user_tables
                    ORDER BY pg_total_relation_size(schemaname||'.'||tablename) DESC
                """
                rows = await conn.fetch(query)
                return [dict(row) for row in rows]
        except Exception as e:
            raise DatabaseError(f"Failed to get table stats: {e}")
    
    async def get_slow_queries(self, limit: int = 10) -> List[Dict[str, Any]]:
        """Get slow queries from pg_stat_statements if available"""
        try:
            async with self.get_connection() as conn:
                # Check if pg_stat_statements is available
                check_query = """
                    SELECT EXISTS (
                        SELECT 1 FROM pg_extension WHERE extname = 'pg_stat_statements'
                    )
                """
                has_extension = await conn.fetchval(check_query)
                
                if not has_extension:
                    return []
                
                query = f"""
                    SELECT 
                        query,
                        calls,
                        total_exec_time,
                        mean_exec_time,
                        max_exec_time
                    FROM pg_stat_statements
                    ORDER BY mean_exec_time DESC
                    LIMIT {limit}
                """
                rows = await conn.fetch(query)
                return [dict(row) for row in rows]
        except Exception as e:
            logger.warning(f"Failed to get slow queries: {e}")
            return []
    
    async def get_missing_indexes(self) -> List[Dict[str, Any]]:
        """Suggest missing indexes based on sequential scans"""
        try:
            async with self.get_connection() as conn:
                query = """
                    SELECT 
                        schemaname,
                        tablename,
                        seq_scan,
                        seq_tup_read,
                        idx_scan,
                        seq_tup_read / seq_scan AS avg_seq_tup_read
                    FROM pg_stat_user_tables
                    WHERE seq_scan > 0
                    AND seq_tup_read / seq_scan > 10000
                    ORDER BY seq_tup_read DESC
                    LIMIT 10
                """
                rows = await conn.fetch(query)
                return [dict(row) for row in rows]
        except Exception as e:
            logger.warning(f"Failed to get missing indexes: {e}")
            return []
    
    async def analyze_database_health(self) -> Dict[str, Any]:
        """Comprehensive database health analysis"""
        try:
            async with self.get_connection() as conn:
                # Database size
                db_size_query = "SELECT pg_size_pretty(pg_database_size(current_database()))"
                db_size = await conn.fetchval(db_size_query)
                
                # Connection count
                conn_query = "SELECT count(*) FROM pg_stat_activity"
                conn_count = await conn.fetchval(conn_query)
                
                # Table count
                table_query = """
                    SELECT count(*) FROM information_schema.tables 
                    WHERE table_schema = 'public' AND table_type = 'BASE TABLE'
                """
                table_count = await conn.fetchval(table_query)
                
                # Cache hit ratio
                cache_query = """
                    SELECT 
                        round(100.0 * sum(blks_hit) / nullif(sum(blks_hit + blks_read), 0), 2) AS cache_hit_ratio
                    FROM pg_stat_database
                    WHERE datname = current_database()
                """
                cache_hit_ratio = await conn.fetchval(cache_query)
                
                return {
                    "database_size": db_size,
                    "active_connections": conn_count,
                    "table_count": table_count,
                    "cache_hit_ratio": f"{cache_hit_ratio}%" if cache_hit_ratio else "N/A",
                }
        except Exception as e:
            raise DatabaseError(f"Health analysis failed: {e}")
