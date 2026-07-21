"""
Schema Security Layer
Prevents access to ZendBX platform tables from project schemas
"""
from typing import Set, Optional
from fastapi import HTTPException, status
import re

# Platform tables that must NEVER be accessible to project users
PLATFORM_TABLES: Set[str] = {
    # Core platform tables
    'users', 'projects', 'api_keys', 'query_history', 'saved_queries',
    'user_tables', 'login_attempts', 'password_reset_tokens',
    
    # OAuth tables
    'oauth_apps', 'oauth_connections', 'oauth_audit_logs', 'oauth_provider_settings',
    'oauth_providers', 'oauth_redirect_urls', 'oauth_state_sessions', 'oauth_states',
    
    # Subscription/Billing tables
    'subscription_plans', 'user_subscriptions', 'usage_tracking', 'usage_logs',
    'quota_overrides', 'usage_records',
    
    # Backup and system tables
    'backups', 'backup_schedules', 'backup_history',
    
    # Authentication tables
    'auth_sessions', 'auth_policies', 'auth_hooks', 'security_settings',
    'user_sessions', 'project_sessions',
    
    # Team collaboration tables
    'project_members', 'project_messages',
    
    # Project management tables
    'project_quotas', 'project_users', 'project_auth_logs',
    'project_oauth_providers', 'project_api_keys',
    
    # Storage tables
    'storage_buckets', 'storage_objects', 'file_uploads',
    
    # Audit and monitoring tables
    'audit_logs', 'rate_limit_logs',
    
    # Testing tables
    'realtime_test', 'realtime_subscriptions',
    
    # Migrations
    'schema_migrations',
}

# Schemas that are ALWAYS forbidden
FORBIDDEN_SCHEMAS: Set[str] = {
    'pg_catalog',
    'information_schema',
    'pg_toast',
    'pg_temp',
}

# System schemas that are readable but not writable
SYSTEM_SCHEMAS: Set[str] = {
    'public',  # Contains platform tables
    'auth',    # Authentication schema
}


def is_platform_table(table_name: str, schema: Optional[str] = None) -> bool:
    """
    Check if a table is a platform table that should be protected.
    
    Args:
        table_name: Name of the table (can include schema prefix like "public.users")
        schema: Explicit schema name (optional)
    
    Returns:
        bool: True if this is a protected platform table
    """
    # Parse schema.table notation
    if '.' in table_name and not schema:
        parts = table_name.split('.', 1)
        schema = parts[0].strip('"')
        table_name = parts[1].strip('"')
    
    # Remove quotes if present
    table_name = table_name.strip('"')
    if schema:
        schema = schema.strip('"')
    
    # Check if table is in the platform tables list
    if table_name.lower() in PLATFORM_TABLES:
        # If explicitly referencing public schema or no schema specified
        if not schema or schema.lower() == 'public':
            return True
    
    # Check if explicitly referencing a system schema
    if schema and schema.lower() in SYSTEM_SCHEMAS:
        return True
    
    return False


def is_forbidden_schema(schema: str) -> bool:
    """
    Check if a schema is completely forbidden for access.
    
    Args:
        schema: Schema name
    
    Returns:
        bool: True if schema is forbidden
    """
    return schema.lower() in FORBIDDEN_SCHEMAS


def extract_table_references(sql: str) -> Set[tuple[Optional[str], str]]:
    """
    Extract all table references from a SQL query.
    
    Returns:
        Set of (schema, table) tuples found in the query
    """
    references = set()
    
    # Pattern to match schema.table or table references
    # Matches: table_name, "table_name", schema.table, "schema"."table"
    patterns = [
        r'FROM\s+(?:"?(\w+)"?\.)?"?(\w+)"?',
        r'JOIN\s+(?:"?(\w+)"?\.)?"?(\w+)"?',
        r'INTO\s+(?:"?(\w+)"?\.)?"?(\w+)"?',
        r'TABLE\s+(?:"?(\w+)"?\.)?"?(\w+)"?',
        r'UPDATE\s+(?:"?(\w+)"?\.)?"?(\w+)"?',
    ]
    
    sql_upper = sql.upper()
    for pattern in patterns:
        matches = re.finditer(pattern, sql_upper, re.IGNORECASE)
        for match in matches:
            schema = match.group(1) if match.group(1) else None
            table = match.group(2)
            if table:
                references.add((schema, table))
    
    return references


def validate_sql_security(sql: str, allowed_schema: str) -> None:
    """
    Validate SQL query for security issues.
    
    Checks:
    - No access to platform tables
    - No access to forbidden schemas
    - No cross-schema queries (except allowed_schema)
    
    Args:
        sql: SQL query to validate
        allowed_schema: The project's schema (allowed for access)
    
    Raises:
        HTTPException: If security violation detected
    """
    # Extract all table references
    references = extract_table_references(sql)
    
    for schema, table in references:
        # Check for platform table access
        if is_platform_table(table, schema):
            # Build full table name for error message
            full_name = f"{schema}.{table}" if schema else table
            raise HTTPException(
                status_code=status.HTTP_403_FORBIDDEN,
                detail=f"Access denied: Cannot access platform table '{full_name}'. This table is reserved for system use only."
            )
        
        # Check for forbidden schema access
        if schema and is_forbidden_schema(schema):
            raise HTTPException(
                status_code=status.HTTP_403_FORBIDDEN,
                detail=f"Access denied: Cannot access system schema '{schema}'."
            )
        
        # Check for cross-schema access (accessing tables from other projects)
        if schema and schema.lower() != allowed_schema.lower() and schema.lower() not in ['public']:
            # Allow access to public for functions/types, but not platform tables
            if schema.lower() == 'public' and not is_platform_table(table, 'public'):
                continue
            
            raise HTTPException(
                status_code=status.HTTP_403_FORBIDDEN,
                detail=f"Access denied: Cannot access schema '{schema}'. You can only access tables in your project schema '{allowed_schema}'."
            )


def sanitize_metadata_query(sql: str, allowed_schema: str) -> str:
    """
    Rewrite information_schema and pg_catalog queries to filter to current schema only.
    
    Args:
        sql: Original SQL query
        allowed_schema: The project's schema to filter to
    
    Returns:
        str: Rewritten SQL query with schema filter
    """
    sql_upper = sql.upper()
    
    # Check if this is an information_schema query
    if 'INFORMATION_SCHEMA.TABLES' in sql_upper:
        # If query doesn't already have a WHERE clause with table_schema filter
        if 'TABLE_SCHEMA' not in sql_upper:
            # Add WHERE clause to filter to project schema only
            if 'WHERE' in sql_upper:
                # Append to existing WHERE
                sql += f" AND table_schema = '{allowed_schema}'"
            else:
                # Add new WHERE clause
                sql += f" WHERE table_schema = '{allowed_schema}'"
    
    elif 'INFORMATION_SCHEMA.COLUMNS' in sql_upper:
        if 'TABLE_SCHEMA' not in sql_upper:
            if 'WHERE' in sql_upper:
                sql += f" AND table_schema = '{allowed_schema}'"
            else:
                sql += f" WHERE table_schema = '{allowed_schema}'"
    
    elif 'PG_TABLES' in sql_upper or 'PG_CLASS' in sql_upper:
        # Add schemaname filter for pg_tables queries
        if 'SCHEMANAME' not in sql_upper:
            if 'WHERE' in sql_upper:
                sql += f" AND schemaname = '{allowed_schema}'"
            else:
                sql += f" WHERE schemaname = '{allowed_schema}'"
    
    return sql


def get_platform_tables_list() -> Set[str]:
    """
    Get the list of all protected platform tables.
    
    Returns:
        Set of platform table names
    """
    return PLATFORM_TABLES.copy()


def is_metadata_query(sql: str) -> bool:
    """
    Check if a query is accessing metadata tables.
    
    Args:
        sql: SQL query
    
    Returns:
        bool: True if this is a metadata query
    """
    sql_upper = sql.upper()
    metadata_indicators = [
        'INFORMATION_SCHEMA',
        'PG_CATALOG',
        'PG_TABLES',
        'PG_CLASS',
        'PG_NAMESPACE',
        'PG_ATTRIBUTE',
    ]
    
    return any(indicator in sql_upper for indicator in metadata_indicators)
