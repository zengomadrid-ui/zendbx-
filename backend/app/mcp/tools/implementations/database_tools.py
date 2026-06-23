"""
Database Tools
Tools for database operations and queries
"""

from typing import Dict, Any, List, Optional
import logging
from ...core.types import AuthContext, Permission, ToolCategory
from ..base import BaseTool
from app.core.db_router import get_main_db_pool
from app.services.schema_parser import SchemaParser
from ...utils.serialization import make_json_safe

logger = logging.getLogger(__name__)


class ListTablesTool(BaseTool):
    """
    List all tables in the project database
    """
    
    name = "database.list_tables"
    description = "List all tables in the project database with basic information"
    category = ToolCategory.DATABASE
    required_permissions = [Permission.READ_DATABASE]
    
    input_schema = {
        "type": "object",
        "properties": {
            "include_system_tables": {
                "type": "boolean",
                "description": "Include system tables (default: false)",
                "default": False
            }
        },
        "required": []
    }
    
    async def execute(
        self,
        auth_context: AuthContext,
        parameters: Dict[str, Any]
    ) -> Dict[str, Any]:
        """List all tables"""
        try:
            pool = await get_main_db_pool()
            database_name = auth_context.database_name
            include_system = parameters.get("include_system_tables", False)
            
            async with pool.acquire() as conn:
                query = """
                    SELECT 
                        table_name,
                        table_schema,
                        table_type
                    FROM information_schema.tables
                    WHERE table_schema = $1
                """
                
                if not include_system:
                    query += " AND table_name NOT LIKE 'pg_%'"
                
                query += " ORDER BY table_name"
                
                rows = await conn.fetch(query, database_name)
                
                tables = []
                for row in rows:
                    # Get row count
                    try:
                        count = await conn.fetchval(
                            f'SELECT COUNT(*) FROM "{database_name}"."{row["table_name"]}"'
                        )
                    except:
                        count = 0
                    
                    tables.append({
                        "name": row["table_name"],
                        "schema": row["table_schema"],
                        "type": row["table_type"],
                        "row_count": count
                    })
                
                result = {
                    "database": database_name,
                    "table_count": len(tables),
                    "tables": tables
                }
                
                return make_json_safe(result)
                
        except Exception as e:
            logger.error(f"Error listing tables: {str(e)}")
            raise


class GetTableTool(BaseTool):
    """
    Get detailed information about a specific table
    """
    
    name = "database.get_table"
    description = "Get detailed schema information for a specific table including columns, constraints, and indexes"
    category = ToolCategory.DATABASE
    required_permissions = [Permission.READ_DATABASE]
    
    input_schema = {
        "type": "object",
        "properties": {
            "table_name": {
                "type": "string",
                "description": "Name of the table to get information about"
            }
        },
        "required": ["table_name"]
    }
    
    async def execute(
        self,
        auth_context: AuthContext,
        parameters: Dict[str, Any]
    ) -> Dict[str, Any]:
        """Get table details"""
        try:
            pool = await get_main_db_pool()
            database_name = auth_context.database_name
            table_name = parameters["table_name"]
            
            async with pool.acquire() as conn:
                # Get columns
                columns = await conn.fetch(
                    """
                    SELECT 
                        column_name,
                        data_type,
                        is_nullable,
                        column_default,
                        character_maximum_length
                    FROM information_schema.columns
                    WHERE table_schema = $1 AND table_name = $2
                    ORDER BY ordinal_position
                    """,
                    database_name,
                    table_name
                )
                
                # Get primary key
                pk = await conn.fetch(
                    """
                    SELECT a.attname as column_name
                    FROM pg_index i
                    JOIN pg_attribute a ON a.attrelid = i.indrelid AND a.attnum = ANY(i.indkey)
                    WHERE i.indrelid = $1::regclass AND i.indisprimary
                    """,
                    f'"{database_name}"."{table_name}"'
                )
                
                # Get foreign keys
                fks = await conn.fetch(
                    """
                    SELECT
                        tc.constraint_name,
                        kcu.column_name,
                        ccu.table_name AS foreign_table_name,
                        ccu.column_name AS foreign_column_name
                    FROM information_schema.table_constraints AS tc
                    JOIN information_schema.key_column_usage AS kcu
                        ON tc.constraint_name = kcu.constraint_name
                        AND tc.table_schema = kcu.table_schema
                    JOIN information_schema.constraint_column_usage AS ccu
                        ON ccu.constraint_name = tc.constraint_name
                        AND ccu.table_schema = tc.table_schema
                    WHERE tc.constraint_type = 'FOREIGN KEY'
                        AND tc.table_schema = $1
                        AND tc.table_name = $2
                    """,
                    database_name,
                    table_name
                )
                
                # Get indexes
                indexes = await conn.fetch(
                    """
                    SELECT
                        i.relname as index_name,
                        a.attname as column_name,
                        ix.indisunique as is_unique
                    FROM pg_class t
                    JOIN pg_index ix ON t.oid = ix.indrelid
                    JOIN pg_class i ON i.oid = ix.indexrelid
                    JOIN pg_attribute a ON a.attrelid = t.oid AND a.attnum = ANY(ix.indkey)
                    WHERE t.relname = $1
                        AND t.relnamespace = (SELECT oid FROM pg_namespace WHERE nspname = $2)
                    ORDER BY i.relname
                    """,
                    table_name,
                    database_name
                )
                
                # Get row count
                try:
                    row_count = await conn.fetchval(
                        f'SELECT COUNT(*) FROM "{database_name}"."{table_name}"'
                    )
                except:
                    row_count = 0
                
                result = {
                    "table_name": table_name,
                    "database": database_name,
                    "row_count": row_count,
                    "columns": [dict(col) for col in columns],
                    "primary_key": [pk_col["column_name"] for pk_col in pk],
                    "foreign_keys": [dict(fk) for fk in fks],
                    "indexes": [dict(idx) for idx in indexes]
                }
                
                return make_json_safe(result)
                
        except Exception as e:
            logger.error(f"Error getting table: {str(e)}")
            raise


class QueryTool(BaseTool):
    """
    Execute a SQL query (SELECT only)
    """
    
    name = "database.query"
    description = "Execute a read-only SQL query (SELECT statements only)"
    category = ToolCategory.DATABASE
    required_permissions = [Permission.READ_DATABASE]
    
    input_schema = {
        "type": "object",
        "properties": {
            "sql": {
                "type": "string",
                "description": "SQL query to execute (SELECT only)"
            },
            "limit": {
                "type": "integer",
                "description": "Maximum number of rows to return (default: 100, max: 1000)",
                "default": 100
            }
        },
        "required": ["sql"]
    }
    
    async def execute(
        self,
        auth_context: AuthContext,
        parameters: Dict[str, Any]
    ) -> Dict[str, Any]:
        """Execute query"""
        try:
            sql = parameters["sql"].strip()
            limit = min(parameters.get("limit", 100), 1000)
            
            # Security: Only allow SELECT statements
            if not sql.upper().startswith("SELECT"):
                raise ValueError("Only SELECT queries are allowed")
            
            # Security: Prevent dangerous operations
            dangerous_keywords = ["DROP", "DELETE", "UPDATE", "INSERT", "ALTER", "CREATE", "TRUNCATE"]
            sql_upper = sql.upper()
            for keyword in dangerous_keywords:
                if keyword in sql_upper:
                    raise ValueError(f"Query contains forbidden keyword: {keyword}")
            
            pool = await get_main_db_pool()
            database_name = auth_context.database_name
            
            # Add limit if not present
            if "LIMIT" not in sql_upper:
                sql = f"{sql} LIMIT {limit}"
            
            async with pool.acquire() as conn:
                # Set search path to project database
                await conn.execute(f'SET search_path TO "{database_name}"')
                
                import time
                start_time = time.time()
                rows = await conn.fetch(sql)
                execution_time_ms = int((time.time() - start_time) * 1000)
                
                # Convert to list of dicts
                results = [dict(row) for row in rows]
                
                result = {
                    "query": sql,
                    "row_count": len(results),
                    "execution_time_ms": execution_time_ms,
                    "columns": list(results[0].keys()) if results else [],
                    "rows": results
                }
                
                return make_json_safe(result)
                
        except Exception as e:
            logger.error(f"Error executing query: {str(e)}")
            raise


class ExplainQueryTool(BaseTool):
    """
    Get the execution plan for a SQL query
    """
    
    name = "database.explain_query"
    description = "Get the execution plan for a SQL query to understand performance"
    category = ToolCategory.DATABASE
    required_permissions = [Permission.READ_DATABASE]
    
    input_schema = {
        "type": "object",
        "properties": {
            "sql": {
                "type": "string",
                "description": "SQL query to explain"
            },
            "analyze": {
                "type": "boolean",
                "description": "Actually run the query and show actual times (default: false)",
                "default": False
            }
        },
        "required": ["sql"]
    }
    
    async def execute(
        self,
        auth_context: AuthContext,
        parameters: Dict[str, Any]
    ) -> Dict[str, Any]:
        """Explain query"""
        try:
            sql = parameters["sql"].strip()
            analyze = parameters.get("analyze", False)
            
            pool = await get_main_db_pool()
            database_name = auth_context.database_name
            
            # Build EXPLAIN query
            explain_sql = "EXPLAIN (FORMAT JSON"
            if analyze:
                explain_sql += ", ANALYZE TRUE, BUFFERS TRUE"
            explain_sql += f") {sql}"
            
            async with pool.acquire() as conn:
                await conn.execute(f'SET search_path TO "{database_name}"')
                
                result = await conn.fetchval(explain_sql)
                
                response = {
                    "query": sql,
                    "analyzed": analyze,
                    "plan": result[0] if result else {}
                }
                
                return make_json_safe(response)
                
        except Exception as e:
            logger.error(f"Error explaining query: {str(e)}")
            raise


class GetRelationshipsTool(BaseTool):
    """
    Get all foreign key relationships in the database
    """
    
    name = "database.get_relationships"
    description = "Get all foreign key relationships between tables"
    category = ToolCategory.DATABASE
    required_permissions = [Permission.READ_DATABASE]
    
    input_schema = {
        "type": "object",
        "properties": {
            "table_name": {
                "type": "string",
                "description": "Optional: Filter relationships for a specific table"
            }
        },
        "required": []
    }
    
    async def execute(
        self,
        auth_context: AuthContext,
        parameters: Dict[str, Any]
    ) -> Dict[str, Any]:
        """Get relationships"""
        try:
            pool = await get_main_db_pool()
            database_name = auth_context.database_name
            table_name = parameters.get("table_name")
            
            async with pool.acquire() as conn:
                query = """
                    SELECT
                        tc.table_name AS from_table,
                        kcu.column_name AS from_column,
                        ccu.table_name AS to_table,
                        ccu.column_name AS to_column,
                        tc.constraint_name
                    FROM information_schema.table_constraints AS tc
                    JOIN information_schema.key_column_usage AS kcu
                        ON tc.constraint_name = kcu.constraint_name
                        AND tc.table_schema = kcu.table_schema
                    JOIN information_schema.constraint_column_usage AS ccu
                        ON ccu.constraint_name = tc.constraint_name
                        AND ccu.table_schema = tc.table_schema
                    WHERE tc.constraint_type = 'FOREIGN KEY'
                        AND tc.table_schema = $1
                """
                
                params = [database_name]
                
                if table_name:
                    query += " AND (tc.table_name = $2 OR ccu.table_name = $2)"
                    params.append(table_name)
                
                query += " ORDER BY tc.table_name, tc.constraint_name"
                
                rows = await conn.fetch(query, *params)
                
                relationships = [dict(row) for row in rows]
                
                result = {
                    "database": database_name,
                    "filter_table": table_name,
                    "relationship_count": len(relationships),
                    "relationships": relationships
                }
                
                return make_json_safe(result)
                
        except Exception as e:
            logger.error(f"Error getting relationships: {str(e)}")
            raise


class ListIndexesTool(BaseTool):
    """
    List all indexes in the database
    """
    
    name = "database.list_indexes"
    description = "List all indexes in the database with their properties"
    category = ToolCategory.DATABASE
    required_permissions = [Permission.READ_DATABASE]
    
    input_schema = {
        "type": "object",
        "properties": {
            "table_name": {
                "type": "string",
                "description": "Optional: Filter indexes for a specific table"
            }
        },
        "required": []
    }
    
    async def execute(
        self,
        auth_context: AuthContext,
        parameters: Dict[str, Any]
    ) -> Dict[str, Any]:
        """List indexes"""
        try:
            pool = await get_main_db_pool()
            database_name = auth_context.database_name
            table_name = parameters.get("table_name")
            
            async with pool.acquire() as conn:
                query = """
                    SELECT
                        t.relname as table_name,
                        i.relname as index_name,
                        array_agg(a.attname) as columns,
                        ix.indisunique as is_unique,
                        ix.indisprimary as is_primary,
                        am.amname as index_type
                    FROM pg_class t
                    JOIN pg_index ix ON t.oid = ix.indrelid
                    JOIN pg_class i ON i.oid = ix.indexrelid
                    JOIN pg_am am ON i.relam = am.oid
                    JOIN pg_attribute a ON a.attrelid = t.oid AND a.attnum = ANY(ix.indkey)
                    WHERE t.relnamespace = (SELECT oid FROM pg_namespace WHERE nspname = $1)
                """
                
                params = [database_name]
                
                if table_name:
                    query += " AND t.relname = $2"
                    params.append(table_name)
                
                query += """
                    GROUP BY t.relname, i.relname, ix.indisunique, ix.indisprimary, am.amname
                    ORDER BY t.relname, i.relname
                """
                
                rows = await conn.fetch(query, *params)
                
                indexes = [dict(row) for row in rows]
                
                result = {
                    "database": database_name,
                    "filter_table": table_name,
                    "index_count": len(indexes),
                    "indexes": indexes
                }
                
                return make_json_safe(result)
                
        except Exception as e:
            logger.error(f"Error listing indexes: {str(e)}")
            raise


class GetConstraintsTool(BaseTool):
    """
    Get all constraints in the database
    """
    
    name = "database.get_constraints"
    description = "Get all constraints (primary key, foreign key, unique, check) in the database"
    category = ToolCategory.DATABASE
    required_permissions = [Permission.READ_DATABASE]
    
    input_schema = {
        "type": "object",
        "properties": {
            "table_name": {
                "type": "string",
                "description": "Optional: Filter constraints for a specific table"
            },
            "constraint_type": {
                "type": "string",
                "description": "Optional: Filter by constraint type (PRIMARY KEY, FOREIGN KEY, UNIQUE, CHECK)",
                "enum": ["PRIMARY KEY", "FOREIGN KEY", "UNIQUE", "CHECK"]
            }
        },
        "required": []
    }
    
    async def execute(
        self,
        auth_context: AuthContext,
        parameters: Dict[str, Any]
    ) -> Dict[str, Any]:
        """Get constraints"""
        try:
            pool = await get_main_db_pool()
            database_name = auth_context.database_name
            table_name = parameters.get("table_name")
            constraint_type = parameters.get("constraint_type")
            
            async with pool.acquire() as conn:
                query = """
                    SELECT
                        tc.table_name,
                        tc.constraint_name,
                        tc.constraint_type,
                        array_agg(kcu.column_name) as columns
                    FROM information_schema.table_constraints tc
                    LEFT JOIN information_schema.key_column_usage kcu
                        ON tc.constraint_name = kcu.constraint_name
                        AND tc.table_schema = kcu.table_schema
                    WHERE tc.table_schema = $1
                """
                
                params = [database_name]
                param_count = 1
                
                if table_name:
                    param_count += 1
                    query += f" AND tc.table_name = ${param_count}"
                    params.append(table_name)
                
                if constraint_type:
                    param_count += 1
                    query += f" AND tc.constraint_type = ${param_count}"
                    params.append(constraint_type)
                
                query += """
                    GROUP BY tc.table_name, tc.constraint_name, tc.constraint_type
                    ORDER BY tc.table_name, tc.constraint_type, tc.constraint_name
                """
                
                rows = await conn.fetch(query, *params)
                
                constraints = [dict(row) for row in rows]
                
                result = {
                    "database": database_name,
                    "filter_table": table_name,
                    "filter_type": constraint_type,
                    "constraint_count": len(constraints),
                    "constraints": constraints
                }
                
                return make_json_safe(result)
                
        except Exception as e:
            logger.error(f"Error getting constraints: {str(e)}")
            raise
