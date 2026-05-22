"""
Database Manager Service
Handles direct database operations for tables, functions, and triggers
"""
from typing import List, Dict, Any, Optional
import asyncpg


class DBManager:
    """Manages database operations for project databases"""
    
    @staticmethod
    async def execute_sql(db: asyncpg.Pool, query: str, params: Optional[List] = None) -> Any:
        """Execute raw SQL query"""
        try:
            async with db.acquire() as conn:
                if params:
                    result = await conn.fetch(query, *params)
                else:
                    result = await conn.fetch(query)
                return result
        except Exception as e:
            raise Exception(f"SQL execution failed: {str(e)}")
    
    @staticmethod
    async def fetch_all(db: asyncpg.Pool, query: str, params: Optional[List] = None) -> List[Dict]:
        """Fetch all rows from query"""
        async with db.acquire() as conn:
            if params:
                rows = await conn.fetch(query, *params)
            else:
                rows = await conn.fetch(query)
            return [dict(row) for row in rows]
    
    @staticmethod
    async def fetch_one(db: asyncpg.Pool, query: str, params: Optional[List] = None) -> Optional[Dict]:
        """Fetch single row from query"""
        async with db.acquire() as conn:
            if params:
                row = await conn.fetchrow(query, *params)
            else:
                row = await conn.fetchrow(query)
            return dict(row) if row else None


class TableManager:
    """Manages table operations"""
    
    @staticmethod
    async def create_table(db: asyncpg.Pool, table_name: str, columns: List[Dict]) -> Dict:
        """Create a new table with automatic timestamp columns"""
        # Build column definitions
        col_defs = []
        has_id = False
        has_created_at = False
        has_updated_at = False
        
        for col in columns:
            if col['name'].lower() == 'id':
                has_id = True
            if col['name'].lower() == 'created_at':
                has_created_at = True
            if col['name'].lower() == 'updated_at':
                has_updated_at = True
                
            col_def = f"{col['name']} {col['type']}"
            if col.get('primary_key'):
                col_def += " PRIMARY KEY"
            if col.get('unique'):
                col_def += " UNIQUE"
            if col.get('not_null'):
                col_def += " NOT NULL"
            if col.get('default'):
                col_def += f" DEFAULT {col['default']}"
            col_defs.append(col_def)
        
        # Add id column if not present
        if not has_id:
            col_defs.insert(0, "id UUID PRIMARY KEY DEFAULT gen_random_uuid()")
        
        # Add timestamp columns if not present
        if not has_created_at:
            col_defs.append("created_at TIMESTAMPTZ DEFAULT NOW()")
        if not has_updated_at:
            col_defs.append("updated_at TIMESTAMPTZ DEFAULT NOW()")
        
        # Create table
        query = f"CREATE TABLE {table_name} ({', '.join(col_defs)})"
        await DBManager.execute_sql(db, query)
        
        # Create updated_at trigger function if it doesn't exist
        trigger_function_sql = """
        CREATE OR REPLACE FUNCTION update_updated_at_column()
        RETURNS TRIGGER AS $$
        BEGIN
            NEW.updated_at = NOW();
            RETURN NEW;
        END;
        $$ LANGUAGE plpgsql;
        """
        await DBManager.execute_sql(db, trigger_function_sql)
        
        # Create trigger for auto-updating updated_at
        trigger_sql = f"""
        CREATE TRIGGER update_{table_name}_updated_at
        BEFORE UPDATE ON {table_name}
        FOR EACH ROW
        EXECUTE FUNCTION update_updated_at_column();
        """
        await DBManager.execute_sql(db, trigger_sql)
        
        return {
            "success": True, 
            "table": table_name, 
            "query": query,
            "message": f"Table '{table_name}' created with automatic id, created_at, and updated_at columns"
        }
    
    @staticmethod
    async def drop_table(db: asyncpg.Pool, table_name: str) -> Dict:
        """Drop a table"""
        query = f"DROP TABLE IF EXISTS {table_name} CASCADE"
        await DBManager.execute_sql(db, query)
        return {"success": True, "table": table_name}
    
    @staticmethod
    async def add_column(db: asyncpg.Pool, table_name: str, column: Dict) -> Dict:
        """Add column to existing table"""
        col_def = f"{column['name']} {column['type']}"
        if column.get('not_null'):
            col_def += " NOT NULL"
        if column.get('default'):
            col_def += f" DEFAULT {column['default']}"
        
        query = f"ALTER TABLE {table_name} ADD COLUMN {col_def}"
        await DBManager.execute_sql(db, query)
        return {"success": True, "table": table_name, "column": column['name']}
    
    @staticmethod
    async def drop_column(db: asyncpg.Pool, table_name: str, column_name: str) -> Dict:
        """Drop column from table"""
        query = f"ALTER TABLE {table_name} DROP COLUMN {column_name}"
        await DBManager.execute_sql(db, query)
        return {"success": True, "table": table_name, "column": column_name}


class FunctionManager:
    """Manages database functions"""
    
    @staticmethod
    async def create_function(db: asyncpg.Pool, function_sql: str) -> Dict:
        """Create a database function"""
        await DBManager.execute_sql(db, function_sql)
        return {"success": True, "query": function_sql}
    
    @staticmethod
    async def drop_function(db: asyncpg.Pool, function_name: str) -> Dict:
        """Drop a function"""
        query = f"DROP FUNCTION IF EXISTS {function_name} CASCADE"
        await DBManager.execute_sql(db, query)
        return {"success": True, "function": function_name}
    
    @staticmethod
    async def list_functions(db: asyncpg.Pool, schema_name: str = None) -> List[Dict]:
        """List all user-defined functions (excluding system/extension functions)"""
        # Determine which schema to query
        if schema_name is None:
            schema_filter = "n.nspname = 'public'"
        else:
            schema_filter = f"n.nspname = '{schema_name}'"
        
        query = f"""
        SELECT 
            p.proname as name,
            pg_get_functiondef(p.oid) as definition,
            pg_get_function_arguments(p.oid) as arguments,
            pg_get_function_result(p.oid) as return_type
        FROM pg_proc p
        JOIN pg_namespace n ON p.pronamespace = n.oid
        WHERE {schema_filter}
        AND p.proname NOT LIKE 'pg_%'
        AND p.proname NOT LIKE 'uuid_%'
        AND p.prolang = (SELECT oid FROM pg_language WHERE lanname = 'plpgsql')
        ORDER BY p.proname
        """
        return await DBManager.fetch_all(db, query)


class TriggerManager:
    """Manages database triggers"""
    
    @staticmethod
    async def create_trigger(
        db: asyncpg.Pool, 
        trigger_name: str, 
        table_name: str, 
        event: str, 
        function_name: str,
        timing: str = "AFTER"
    ) -> Dict:
        """Create a trigger"""
        query = f"""
        CREATE TRIGGER {trigger_name}
        {timing} {event} ON {table_name}
        FOR EACH ROW
        EXECUTE FUNCTION {function_name}()
        """
        await DBManager.execute_sql(db, query)
        return {"success": True, "trigger": trigger_name, "query": query}
    
    @staticmethod
    async def drop_trigger(db: asyncpg.Pool, trigger_name: str, table_name: str) -> Dict:
        """Drop a trigger"""
        query = f"DROP TRIGGER IF EXISTS {trigger_name} ON {table_name}"
        await DBManager.execute_sql(db, query)
        return {"success": True, "trigger": trigger_name}
    
    @staticmethod
    async def list_triggers(db: asyncpg.Pool, table_name: Optional[str] = None) -> List[Dict]:
        """List all triggers"""
        query = """
        SELECT 
            t.tgname as name,
            c.relname as table_name,
            p.proname as function_name,
            CASE t.tgtype & 2 WHEN 2 THEN 'BEFORE' ELSE 'AFTER' END as timing,
            CASE 
                WHEN t.tgtype & 4 = 4 THEN 'INSERT'
                WHEN t.tgtype & 8 = 8 THEN 'DELETE'
                WHEN t.tgtype & 16 = 16 THEN 'UPDATE'
            END as event
        FROM pg_trigger t
        JOIN pg_class c ON t.tgrelid = c.oid
        JOIN pg_proc p ON t.tgfoid = p.oid
        WHERE NOT t.tgisinternal
        """
        if table_name:
            query += f" AND c.relname = '{table_name}'"
        query += " ORDER BY c.relname, t.tgname"
        return await DBManager.fetch_all(db, query)
