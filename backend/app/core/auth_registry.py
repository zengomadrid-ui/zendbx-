"""
ZendBX Auth System Registry
Schema-aware authentication table classification and security

CRITICAL: Security decisions MUST be schema-aware.
Table names alone are NOT sufficient for authorization.

Examples:
- auth.users (ZendBX system table) → Protected
- proj_abc123.users (developer table) → Normal access
- public.users (platform table) → Protected

Architecture Notes:
- ZendBX uses schema-per-project multi-tenancy
- Each project has schema: proj_<hex> (e.g., proj_faeef53c)
- Auth tables exist within each project schema under "auth" namespace
- Virtual schema names ("public", "auth") map to same physical project schema
"""

from typing import Set, Dict, Optional
from enum import Enum

# ============================================
# AUTH SYSTEM TABLES
# ============================================

# Core authentication tables managed by ZendBX Auth
AUTH_SYSTEM_TABLES: Set[str] = {
    'users',
    'sessions', 
    'refresh_tokens',
    'identities',
    'password_reset_tokens',
    'audit_logs',
    'config',
    'providers_config',
    'roles',
    'user_roles',
    'verification_tokens'
}

# Auth tables that should be completely protected from direct CRUD
PROTECTED_AUTH_TABLES: Set[str] = {
    'users',              # User accounts - use auth endpoints only
    'sessions',           # Active sessions - managed by auth system
    'refresh_tokens',     # Refresh tokens - managed by auth system
    'identities',         # OAuth identities - managed by auth system
    'password_reset_tokens'  # Password resets - use auth endpoints
}

# Auth tables that are read-only for developers (no writes allowed)
READONLY_AUTH_TABLES: Set[str] = {
    'audit_logs',         # Security audit trail
    'config',             # System configuration
    'providers_config'    # OAuth provider settings
}

# Fields that must NEVER be exposed via REST API
SENSITIVE_AUTH_FIELDS: Set[str] = {
    'password_hash',
    'token_hash',
    'refresh_token_hash',
    'jwt_secret',
    'client_secret',
    'encrypted_key',
    'encrypted_secret',
    'secret_key',
    'private_key'
}

# ============================================
# SCHEMA CONSTANTS
# ============================================

# The auth schema name (may be virtual or physical depending on architecture)
AUTH_SCHEMA = "auth"

# Platform schema containing ZendBX internal tables
PLATFORM_SCHEMA = "public"

# Project schema prefix pattern
PROJECT_SCHEMA_PREFIX = "proj_"

# ============================================
# SCHEMA-AWARE CLASSIFICATION
# ============================================

class TableType(Enum):
    """Classification of table types for security decisions"""
    AUTH_SYSTEM = "auth_system"          # ZendBX auth tables (protected)
    PLATFORM = "platform"                # ZendBX platform tables (protected)
    USER_APPLICATION = "user_application"  # Developer tables (normal access)
    SYSTEM_INTERNAL = "system_internal"  # PostgreSQL system schemas


def is_project_schema(schema_name: str) -> bool:
    """
    Check if schema is a project schema (not platform/system)
    
    Args:
        schema_name: PostgreSQL schema name
        
    Returns:
        True if this is a project schema (proj_xxx)
    """
    if not schema_name:
        return False
    return schema_name.startswith(PROJECT_SCHEMA_PREFIX)


def is_auth_schema(schema_name: str) -> bool:
    """
    Check if schema is the auth schema
    
    Args:
        schema_name: PostgreSQL schema name
        
    Returns:
        True if this is the auth schema
    """
    return schema_name and schema_name.lower() == AUTH_SCHEMA.lower()


def is_platform_schema(schema_name: str) -> bool:
    """
    Check if schema is the platform schema
    
    Args:
        schema_name: PostgreSQL schema name
        
    Returns:
        True if this is the platform public schema
    """
    return schema_name and schema_name.lower() == PLATFORM_SCHEMA.lower()


def classify_table(schema_name: str, table_name: str) -> TableType:
    """
    Classify a table for security decisions
    
    CRITICAL: Always pass both schema AND table name.
    Never make security decisions based on table name alone.
    
    Args:
        schema_name: PostgreSQL schema name (e.g., "auth", "proj_abc123", "public")
        table_name: Table name without schema prefix
        
    Returns:
        TableType classification
        
    Examples:
        classify_table("auth", "users") → AUTH_SYSTEM
        classify_table("proj_abc123", "users") → USER_APPLICATION
        classify_table("public", "users") → PLATFORM
        classify_table("proj_abc123", "posts") → USER_APPLICATION
    """
    if not schema_name or not table_name:
        return TableType.SYSTEM_INTERNAL
    
    schema_lower = schema_name.lower()
    table_lower = table_name.lower()
    
    # Auth system tables
    if is_auth_schema(schema_lower) and table_lower in AUTH_SYSTEM_TABLES:
        return TableType.AUTH_SYSTEM
    
    # Platform tables
    if is_platform_schema(schema_lower):
        return TableType.PLATFORM
    
    # PostgreSQL system schemas
    if schema_lower in {'pg_catalog', 'information_schema', 'pg_toast', 'pg_temp'}:
        return TableType.SYSTEM_INTERNAL
    
    # Project schema tables (user-created)
    if is_project_schema(schema_lower):
        return TableType.USER_APPLICATION
    
    # Default to system internal for safety
    return TableType.SYSTEM_INTERNAL


def is_auth_system_table(schema_name: str, table_name: str) -> bool:
    """
    Check if table is a ZendBX auth system table
    
    SCHEMA-AWARE: Returns True ONLY for tables in auth schema
    
    Args:
        schema_name: PostgreSQL schema name
        table_name: Table name
        
    Returns:
        True if this is a protected auth system table
        
    Examples:
        is_auth_system_table("auth", "users") → True
        is_auth_system_table("proj_abc123", "users") → False
        is_auth_system_table("public", "users") → False
    """
    return classify_table(schema_name, table_name) == TableType.AUTH_SYSTEM


def is_protected_auth_table(schema_name: str, table_name: str) -> bool:
    """
    Check if table should be protected from direct CRUD access
    
    Protected tables require using ZendBX Auth API endpoints instead
    
    Args:
        schema_name: PostgreSQL schema name
        table_name: Table name
        
    Returns:
        True if table is protected from direct CRUD
        
    Examples:
        is_protected_auth_table("auth", "users") → True (use auth endpoints)
        is_protected_auth_table("auth", "sessions") → True (use auth endpoints)
        is_protected_auth_table("proj_abc123", "users") → False (normal CRUD allowed)
    """
    if not is_auth_system_table(schema_name, table_name):
        return False
    
    return table_name.lower() in PROTECTED_AUTH_TABLES


def is_readonly_auth_table(schema_name: str, table_name: str) -> bool:
    """
    Check if auth table is read-only (view only, no writes)
    
    Args:
        schema_name: PostgreSQL schema name
        table_name: Table name
        
    Returns:
        True if table is read-only
    """
    if not is_auth_system_table(schema_name, table_name):
        return False
    
    return table_name.lower() in READONLY_AUTH_TABLES


def is_sensitive_field(field_name: str) -> bool:
    """
    Check if field contains sensitive authentication data
    
    Args:
        field_name: Column name
        
    Returns:
        True if field should be filtered from responses
        
    Examples:
        is_sensitive_field("password_hash") → True
        is_sensitive_field("email") → False
    """
    if not field_name:
        return False
    
    return field_name.lower() in SENSITIVE_AUTH_FIELDS


def filter_sensitive_fields(row: dict, schema_name: Optional[str] = None) -> dict:
    """
    Remove sensitive fields from a database row
    
    Args:
        row: Dictionary of column name → value
        schema_name: Optional schema context for smarter filtering
        
    Returns:
        Filtered dictionary with sensitive fields removed
        
    Examples:
        filter_sensitive_fields({"email": "x@y.com", "password_hash": "..."})
        → {"email": "x@y.com"}
    """
    if not row:
        return row
    
    # If this is an auth table, be extra cautious
    if schema_name and is_auth_schema(schema_name):
        return {
            key: value
            for key, value in row.items()
            if not is_sensitive_field(key)
        }
    
    # For other schemas, still filter common sensitive fields
    return {
        key: value
        for key, value in row.items()
        if not is_sensitive_field(key)
    }


# ============================================
# RESERVED TABLE NAMES
# ============================================

# Table names that developers SHOULD NOT use in project schemas
# (Not enforced, but recommended for clarity)
DISCOURAGED_TABLE_NAMES: Set[str] = AUTH_SYSTEM_TABLES | {
    'schema_migrations',
    '_nexora_metadata',
    '_zendbx_metadata'
}


def is_discouraged_table_name(table_name: str) -> bool:
    """
    Check if table name should be discouraged (but not blocked)
    
    Args:
        table_name: Table name to check
        
    Returns:
        True if name overlaps with system tables
        
    Note:
        This is advisory only. Developers CAN create tables with these names
        in their project schema, but it may cause confusion.
    """
    return table_name and table_name.lower() in DISCOURAGED_TABLE_NAMES


# ============================================
# SCHEMA RESOLUTION
# ============================================

def resolve_virtual_schema(
    virtual_schema: str,
    project_schema: str
) -> str:
    """
    Resolve virtual schema name to physical PostgreSQL schema
    
    Virtual schemas are display concepts used in the UI/API:
    - "public" (virtual) → proj_abc123 (physical)
    - "auth" (virtual) → auth (physical)
    - "storage" (virtual) → storage (physical)
    - "realtime" (virtual) → realtime (physical)
    
    Args:
        virtual_schema: Virtual schema name from UI/API
        project_schema: Actual project schema name (e.g., proj_abc123)
        
    Returns:
        Physical PostgreSQL schema name
        
    Examples:
        resolve_virtual_schema("public", "proj_abc123") → "proj_abc123"
        resolve_virtual_schema("auth", "proj_abc123") → "auth"
        resolve_virtual_schema("proj_abc123", "proj_abc123") → "proj_abc123"
    """
    if not virtual_schema:
        return project_schema
    
    virtual_lower = virtual_schema.lower()
    
    # "public" is virtual name for project schema
    if virtual_lower == "public":
        return project_schema
    
    # Auth, storage, realtime are real schemas
    if virtual_lower in {"auth", "storage", "realtime"}:
        return virtual_schema
    
    # Already a physical schema name
    if is_project_schema(virtual_schema):
        return virtual_schema
    
    # Default to project schema
    return project_schema


# ============================================
# SECURITY MESSAGES
# ============================================

def get_protection_message(schema_name: str, table_name: str) -> str:
    """
    Get user-friendly error message for protected table access
    
    Args:
        schema_name: Schema name
        table_name: Table name
        
    Returns:
        Error message string
    """
    if is_protected_auth_table(schema_name, table_name):
        return (
            f"Direct CRUD access to '{schema_name}.{table_name}' is not allowed. "
            "Use ZendBX Auth API endpoints instead: "
            "POST /p/{{slug}}/auth/signup, POST /p/{{slug}}/auth/login, etc."
        )
    
    if is_readonly_auth_table(schema_name, table_name):
        return (
            f"Table '{schema_name}.{table_name}' is read-only. "
            "Modifications must be made through ZendBX Auth configuration."
        )
    
    return f"Access to '{schema_name}.{table_name}' is restricted."
