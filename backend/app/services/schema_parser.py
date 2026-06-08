"""
Schema Parser Service
Parses database schema for visualization
"""
from typing import List, Dict, Any
import asyncpg
import logging
from app.services.db_manager import DBManager

logger = logging.getLogger(__name__)


class SchemaParser:
    """Parses database schema into structured format for visualization"""
    
    @staticmethod
    async def get_full_schema(db: asyncpg.Pool, schema_name: str = None) -> Dict[str, Any]:
        """Get complete schema with tables, columns, and relationships"""
        tables = await SchemaParser.get_tables(db, schema_name)
        relationships = await SchemaParser.get_relationships(db, schema_name)
        
        return {
            "tables": tables,
            "relationships": relationships
        }
    
    # System/infrastructure tables that should never be shown to users
    SYSTEM_TABLES = frozenset({
        'users', 'projects', 'api_keys', 'query_history', 'saved_queries',
        'user_tables', 'login_attempts', 'password_reset_tokens', 'oauth_apps',
        'oauth_connections', 'subscription_plans', 'user_subscriptions',
        'usage_tracking', 'usage_logs', 'backups', 'backup_schedules',
        'auth_sessions', 'auth_policies', 'auth_hooks', 'security_settings',
        'project_members', 'project_messages', 'project_quotas', 'project_sessions',
        'project_users', 'project_auth_logs', 'project_oauth_providers',
        'audit_logs', 'rate_limit_logs', 'realtime_test', 'file_uploads',
        'backup_history', 'oauth_audit_log', 'oauth_audit_logs', 'oauth_provider_settings',
        'oauth_providers', 'oauth_redirect_urls', 'oauth_state_sessions', 'oauth_states',
        'project_api_keys', 'quota_overrides', 'storage_buckets', 'storage_objects',
        'usage_records', 'user_sessions', 'realtime_subscriptions', 'schema_migrations',
    })

    @staticmethod
    async def get_tables(db: asyncpg.Pool, schema_name: str = None) -> List[Dict]:
        """
        Get all user-created tables with their columns from ALL user schemas.
        Excludes system schemas (auth, information_schema, pg_catalog) and
        all internal platform tables regardless of which schema they live in.
        """
        try:
            excluded_tables = ', '.join(f"'{t}'" for t in SchemaParser.SYSTEM_TABLES)

            # Query ALL user schemas, not just public or project schema
            query = f"""
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
            WHERE t.table_type = 'BASE TABLE'
            AND t.table_schema NOT IN ('auth', 'information_schema', 'pg_catalog', 'pg_toast')
            AND t.table_name NOT LIKE '_zendbx_%'
            AND t.table_name NOT LIKE '_nexora_%'
            AND t.table_name NOT IN ({excluded_tables})
            GROUP BY t.table_schema, t.table_name
            ORDER BY t.table_schema, t.table_name
            """
            
            logger.info(f"Executing get_tables query for schema: {schema_name}")
            result = await DBManager.fetch_all(db, query)
            logger.info(f"Found {len(result) if result else 0} tables")
            return result if result else []
        except Exception as e:
            logger.error(f"Error in get_tables: {str(e)}")
            raise
    
    @staticmethod
    async def get_relationships(db: asyncpg.Pool, schema_name: str = None) -> List[Dict]:
        """Get foreign key relationships between user-created tables across ALL user schemas"""
        excluded_tables = ', '.join(f"'{t}'" for t in SchemaParser.SYSTEM_TABLES)

        # Query ALL user schemas for relationships
        query = f"""
        SELECT
            tc.table_schema || '.' || tc.table_name as from_table,
            kcu.column_name as from_column,
            ccu.table_schema || '.' || ccu.table_name as to_table,
            ccu.column_name as to_column,
            tc.constraint_name
        FROM information_schema.table_constraints tc
        JOIN information_schema.key_column_usage kcu
            ON tc.constraint_name = kcu.constraint_name
        JOIN information_schema.constraint_column_usage ccu
            ON ccu.constraint_name = tc.constraint_name
        WHERE tc.constraint_type = 'FOREIGN KEY'
        AND tc.table_schema NOT IN ('auth', 'information_schema', 'pg_catalog', 'pg_toast')
        AND tc.table_name NOT IN ({excluded_tables})
        AND tc.table_name NOT LIKE '_zendbx_%'
        AND tc.table_name NOT LIKE '_nexora_%'
        ORDER BY tc.table_schema, tc.table_name
        """
        result = await DBManager.fetch_all(db, query)
        return result if result else []
    
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
