"""
Schema Parser Service
Parses database schema for visualization
"""
from typing import List, Dict, Any
import asyncpg
from app.services.db_manager import DBManager


class SchemaParser:
    """Parses database schema into structured format for visualization"""
    
    @staticmethod
    async def get_full_schema(db: asyncpg.Pool) -> Dict[str, Any]:
        """Get complete schema with tables, columns, and relationships"""
        tables = await SchemaParser.get_tables(db)
        relationships = await SchemaParser.get_relationships(db)
        
        return {
            "tables": tables,
            "relationships": relationships
        }
    
    @staticmethod
    async def get_tables(db: asyncpg.Pool) -> List[Dict]:
        """Get all tables with their columns from all user schemas"""
        query = """
        SELECT 
            t.table_schema,
            t.table_name,
            t.table_schema || '.' || t.table_name as full_name,
            json_agg(
                json_build_object(
                    'name', c.column_name,
                    'type', c.data_type,
                    'nullable', c.is_nullable = 'YES',
                    'default', c.column_default,
                    'primary_key', (
                        SELECT COUNT(*) > 0
                        FROM information_schema.table_constraints tc
                        JOIN information_schema.key_column_usage kcu 
                            ON tc.constraint_name = kcu.constraint_name
                        WHERE tc.table_schema = t.table_schema
                        AND tc.table_name = t.table_name
                        AND tc.constraint_type = 'PRIMARY KEY'
                        AND kcu.column_name = c.column_name
                    )
                ) ORDER BY c.ordinal_position
            ) as columns
        FROM information_schema.tables t
        JOIN information_schema.columns c 
            ON t.table_name = c.table_name 
            AND t.table_schema = c.table_schema
        WHERE t.table_schema NOT IN ('pg_catalog', 'information_schema')
        AND t.table_type = 'BASE TABLE'
        AND t.table_name NOT LIKE '_nexora_%'
        GROUP BY t.table_schema, t.table_name
        ORDER BY t.table_schema, t.table_name
        """
        return await DBManager.fetch_all(db, query)
    
    @staticmethod
    async def get_relationships(db: asyncpg.Pool) -> List[Dict]:
        """Get foreign key relationships between tables"""
        query = """
        SELECT
            tc.table_name as from_table,
            kcu.column_name as from_column,
            ccu.table_name as to_table,
            ccu.column_name as to_column,
            tc.constraint_name
        FROM information_schema.table_constraints tc
        JOIN information_schema.key_column_usage kcu
            ON tc.constraint_name = kcu.constraint_name
        JOIN information_schema.constraint_column_usage ccu
            ON ccu.constraint_name = tc.constraint_name
        WHERE tc.constraint_type = 'FOREIGN KEY'
        AND tc.table_schema = 'public'
        ORDER BY tc.table_name
        """
        return await DBManager.fetch_all(db, query)
    
    @staticmethod
    async def get_table_details(db: asyncpg.Pool, table_name: str) -> Dict:
        """Get detailed information about a specific table (supports schema.table format)"""
        # Parse schema and table name
        if '.' in table_name:
            schema_name, table_only = table_name.split('.', 1)
        else:
            schema_name = 'public'
            table_only = table_name
        
        columns_query = """
        SELECT 
            column_name as name,
            data_type as type,
            is_nullable = 'YES' as nullable,
            column_default as default_value,
            character_maximum_length as max_length
        FROM information_schema.columns
        WHERE table_name = $1
        AND table_schema = $2
        ORDER BY ordinal_position
        """
        
        constraints_query = """
        SELECT 
            tc.constraint_type as type,
            tc.constraint_name as name,
            kcu.column_name
        FROM information_schema.table_constraints tc
        JOIN information_schema.key_column_usage kcu
            ON tc.constraint_name = kcu.constraint_name
        WHERE tc.table_name = $1
        AND tc.table_schema = $2
        """
        
        columns = await DBManager.fetch_all(db, columns_query, [table_only, schema_name])
        constraints = await DBManager.fetch_all(db, constraints_query, [table_only, schema_name])
        
        return {
            "table_name": table_name,
            "schema": schema_name,
            "columns": columns,
            "constraints": constraints
        }
