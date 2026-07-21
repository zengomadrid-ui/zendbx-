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
    async def get_tables(db: asyncpg.Pool, schema_name: str = None, include_system: bool = False) -> List[Dict]:
        """
        Get all user-created tables with their columns from the project's schema.
        REQUIRES: schema_name parameter must be explicitly provided.
        Excludes system schemas (auth, information_schema, pg_catalog) and
        all internal platform tables regardless of which schema they live in.
        
        Args:
            db: Database connection pool
            schema_name: Specific schema to query (REQUIRED - must be project schema like 'proj_xxx')
            include_system: If True, include system tables in results (default: False)
        """
        try:
            # 🔧 FIX: Schema name is REQUIRED - never default to 'public'
            if not schema_name:
                raise ValueError(
                    "schema_name parameter is required for get_tables(). "
                    "Project schema must be explicitly provided (e.g., 'proj_60f192dc')."
                )
            
            logger.info(f"\n{'='*80}")
            logger.info(f"🔍 DEBUG: SchemaParser.get_tables() START")
            logger.info(f"{'='*80}")
            logger.info(f"📥 INPUT: schema_name = '{schema_name}'")
            logger.info(f"📥 INPUT: include_system = {include_system}")
            logger.info(f"📥 INPUT: schema_name.startswith('proj_') = {schema_name.startswith('proj_')}")
            
            # Always filter to the specified schema - use parameterized query
            schema_filter = "AND t.table_schema = $1"
            
            # For 'public' schema: exclude system/platform tables
            # For 'auth' schema: always exclude (unless explicitly requested)
            # For project schemas (proj_*): allow all user tables
            if schema_name == 'public':
                # Public schema: exclude ZenDBX platform tables
                if not include_system:
                    excluded_tables = ', '.join(f"'{t}'" for t in SchemaParser.SYSTEM_TABLES)
                    exclude_filter = f"AND t.table_name NOT IN ({excluded_tables})"
                    logger.info(f"🔍 DEBUG: Schema is 'public' → Applying SYSTEM_TABLES filter")
                    logger.info(f"🔍 DEBUG: exclude_filter = '{exclude_filter[:100]}...'")
                else:
                    exclude_filter = ""
                    logger.info(f"🔍 DEBUG: Schema is 'public' + include_system=True → No filter")
            elif schema_name == 'auth':
                # Auth schema: hide by default (internal authentication tables)
                if not include_system:
                    exclude_filter = "AND 1=0"  # Hide all auth tables by default
                    logger.info(f"🔍 DEBUG: Schema is 'auth' → Hiding all tables (AND 1=0)")
                else:
                    exclude_filter = ""
                    logger.info(f"🔍 DEBUG: Schema is 'auth' + include_system=True → No filter")
            elif schema_name.startswith('proj_'):
                # Project-specific schemas: show all user tables
                exclude_filter = ""
                logger.info(f"✅ DEBUG: Schema starts with 'proj_' → NO SYSTEM_TABLES filter applied!")
                logger.info(f"✅ DEBUG: exclude_filter = '' (empty - ALL tables should be visible)")
            else:
                # Other schemas: apply system table filter
                if not include_system:
                    excluded_tables = ', '.join(f"'{t}'" for t in SchemaParser.SYSTEM_TABLES)
                    exclude_filter = f"AND t.table_name NOT IN ({excluded_tables})"
                    logger.info(f"🔍 DEBUG: Schema is '{schema_name}' (not proj_*) → Applying SYSTEM_TABLES filter")
                    logger.info(f"🔍 DEBUG: exclude_filter = '{exclude_filter[:100]}...'")
                else:
                    exclude_filter = ""
                    logger.info(f"🔍 DEBUG: Schema is '{schema_name}' + include_system=True → No filter")

            # Query only the project's schema - use parameterized query
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
            {schema_filter}
            AND t.table_name NOT LIKE '_zendbx_%'
            AND t.table_name NOT LIKE '_nexora_%'
            {exclude_filter}
            GROUP BY t.table_schema, t.table_name
            ORDER BY t.table_schema, t.table_name
            """
            
            logger.info(f"✅ Executing get_tables query for schema: {schema_name}")
            logger.info(f"📊 Full SQL Query:\n{query}")
            logger.info(f"📊 Query Parameters: ['{schema_name}']")
            
            result = await DBManager.fetch_all(db, query, [schema_name])  # Pass schema as parameter
            
            logger.info(f"\n{'='*80}")
            logger.info(f"📊 RAW PostgreSQL RESULT (before any processing):")
            logger.info(f"{'='*80}")
            logger.info(f"✅ Total tables returned from PostgreSQL: {len(result) if result else 0}")
            
            if result:
                logger.info(f"\n📋 ALL TABLES from PostgreSQL:")
                for idx, table in enumerate(result, 1):
                    logger.info(f"   {idx}. {table['table_schema']}.{table['table_name']}")
                    if table['table_name'] == 'users':
                        logger.info(f"      🎯 FOUND 'users' table in raw PostgreSQL result!")
                        logger.info(f"      🎯 Full record: {dict(table)}")
                
                # Check specifically for 'users' table
                users_table = [t for t in result if t['table_name'] == 'users']
                if users_table:
                    logger.info(f"\n✅✅✅ 'users' table EXISTS in raw PostgreSQL result!")
                    logger.info(f"✅✅✅ Record: {dict(users_table[0])}")
                else:
                    logger.info(f"\n❌❌❌ 'users' table NOT FOUND in raw PostgreSQL result!")
                    logger.info(f"❌❌❌ This means it was filtered by the SQL query itself")
            else:
                logger.info(f"❌ No tables returned from PostgreSQL")
            
            logger.info(f"\n{'='*80}")
            logger.info(f"🔍 DEBUG: SchemaParser.get_tables() END - Returning {len(result) if result else 0} tables")
            logger.info(f"{'='*80}\n")
            
            return result if result else []
        except Exception as e:
            import traceback
            logger.error(f"Error in get_tables: {str(e)}")
            logger.error(f"Full traceback: {traceback.format_exc()}")
            logger.error(f"Query was: {query}")
            raise
    
    @staticmethod
    async def get_relationships(db: asyncpg.Pool, schema_name: str = None) -> List[Dict]:
        """
        Get foreign key relationships between tables.
        
        Args:
            db: Database connection pool
            schema_name: Specific schema to query (optional - if None, queries all non-system schemas)
        """
        if schema_name:
            logger.info(f"🔍 SchemaParser.get_relationships() for schema: '{schema_name}'")
        else:
            logger.info(f"🔍 SchemaParser.get_relationships() for all user schemas")
        
        excluded_tables = ', '.join(f"'{t}'" for t in SchemaParser.SYSTEM_TABLES)

        # If schema_name provided, filter to that schema only
        if schema_name:
            schema_filter = "AND tc.table_schema = $1"
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
            {schema_filter}
            AND tc.table_name NOT IN ({excluded_tables})
            AND tc.table_name NOT LIKE '_zendbx_%'
            AND tc.table_name NOT LIKE '_nexora_%'
            ORDER BY tc.table_schema, tc.table_name
            """
            result = await DBManager.fetch_all(db, query, [schema_name])
        else:
            # Query ALL user schemas for relationships (original behavior)
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
        
        logger.info(f"✅ Found {len(result) if result else 0} relationships")
        return result if result else []
    
    @staticmethod
    async def get_table_details(db: asyncpg.Pool, table_name: str, schema_name: str = None) -> Dict:
        """
        Get detailed information about a specific table.
        
        Args:
            db: Database connection pool
            table_name: Table name (can be qualified as 'schema.table' or bare 'table')
            schema_name: Schema name (required if table_name is not qualified)
        """
        # Parse schema and table name
        if '.' in table_name:
            parsed_schema, table_only = table_name.split('.', 1)
        else:
            # If not qualified, schema_name parameter is REQUIRED
            if not schema_name:
                raise ValueError(
                    "schema_name parameter is required when table_name is not qualified. "
                    f"Provide either 'schema.table' or separate schema_name parameter."
                )
            parsed_schema = schema_name
            table_only = table_name
        
        logger.info(f"🔍 SchemaParser.get_table_details() for table: {parsed_schema}.{table_only}")
        
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
        
        columns = await DBManager.fetch_all(db, columns_query, [table_only, parsed_schema])
        constraints = await DBManager.fetch_all(db, constraints_query, [table_only, parsed_schema])
        
        return {
            "table_name": table_name,
            "schema": parsed_schema,
            "columns": columns,
            "constraints": constraints
        }
