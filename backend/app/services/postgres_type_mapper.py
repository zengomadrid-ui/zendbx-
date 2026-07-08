"""
ZendBX PostgreSQL Type Mapper

Framework-level component that converts Python values to PostgreSQL-compatible types
for asyncpg query execution.

Features:
- Automatic PostgreSQL metadata inspection
- Generic type conversion (JSONB, arrays, UUID, dates, etc.)
- Metadata caching for performance
- Zero hardcoded table/column names
- Works with any table in any project

Usage:
    mapper = PostgreSQLTypeMapper(pool)
    converted_values = await mapper.convert_values(
        table_name="campaigns",
        data={"platforms": ["linkedin"], "status": "active"},
        schema="public"
    )
"""
import json
import asyncpg
from typing import Any, Dict, List, Optional, Tuple
from datetime import datetime, date
from decimal import Decimal
from uuid import UUID
import logging

logger = logging.getLogger(__name__)


class PostgreSQLTypeMapper:
    """
    PostgreSQL Type Mapper for ZendBX Framework
    
    Converts Python values to PostgreSQL-compatible types by inspecting
    table metadata and applying appropriate type conversions.
    """
    
    def __init__(self, pool: asyncpg.Pool):
        """
        Initialize the type mapper
        
        Args:
            pool: asyncpg connection pool
        """
        self.pool = pool
        self._metadata_cache: Dict[str, Dict[str, str]] = {}
    
    async def get_column_types(
        self,
        table_name: str,
        schema: str = "public"
    ) -> Dict[str, str]:
        """
        Fetch column types from PostgreSQL information_schema
        
        Args:
            table_name: Name of the table
            schema: Schema name (default: public)
        
        Returns:
            Dictionary mapping column_name -> data_type
        """
        cache_key = f"{schema}.{table_name}"
        
        # Return cached metadata if available
        if cache_key in self._metadata_cache:
            return self._metadata_cache[cache_key]
        
        # Query PostgreSQL metadata
        async with self.pool.acquire() as conn:
            rows = await conn.fetch("""
                SELECT 
                    column_name,
                    udt_name,
                    data_type
                FROM information_schema.columns
                WHERE table_schema = $1 
                AND table_name = $2
            """, schema, table_name)
        
        # Build column type mapping
        column_types = {}
        for row in rows:
            column_name = row['column_name']
            # Use udt_name for actual PostgreSQL type (handles arrays, jsonb, etc.)
            pg_type = row['udt_name']
            column_types[column_name] = pg_type
        
        # Cache the result
        self._metadata_cache[cache_key] = column_types
        
        return column_types
    
    def convert_value(self, value: Any, pg_type: str) -> Any:
        """
        Convert a Python value to PostgreSQL-compatible format
        
        Args:
            value: Python value to convert
            pg_type: PostgreSQL type name (from udt_name)
        
        Returns:
            Converted value suitable for asyncpg
        """
        # Handle NULL values
        if value is None:
            return None
        
        # Normalize PostgreSQL type name
        pg_type_lower = pg_type.lower()
        
        # JSON/JSONB types
        if pg_type_lower in ('json', 'jsonb'):
            # asyncpg requires JSONB to be passed as json.dumps() string
            if isinstance(value, (dict, list)):
                return json.dumps(value)
            elif isinstance(value, str):
                # If already a JSON string, validate it
                try:
                    json.loads(value)  # Validate
                    return value
                except json.JSONDecodeError:
                    # Not valid JSON, wrap it
                    return json.dumps(value)
            return json.dumps(value)
        
        # Array types (ends with [])
        if pg_type_lower.startswith('_'):
            # PostgreSQL array types have underscore prefix (_text, _int4, etc.)
            if isinstance(value, list):
                # asyncpg handles Python lists for PostgreSQL arrays
                return value
            elif isinstance(value, str):
                # Try parsing JSON array string
                try:
                    parsed = json.loads(value)
                    if isinstance(parsed, list):
                        return parsed
                except json.JSONDecodeError:
                    pass
            return value
        
        # UUID type
        if pg_type_lower == 'uuid':
            if isinstance(value, UUID):
                return value
            elif isinstance(value, str):
                try:
                    return UUID(value)
                except (ValueError, AttributeError):
                    return value
            return value
        
        # Boolean type
        if pg_type_lower in ('bool', 'boolean'):
            if isinstance(value, bool):
                return value
            elif isinstance(value, str):
                return value.lower() in ('true', '1', 'yes', 't', 'y')
            elif isinstance(value, (int, float)):
                return bool(value)
            return value
        
        # Integer types
        if pg_type_lower in ('int2', 'int4', 'int8', 'smallint', 'integer', 'bigint'):
            if isinstance(value, int):
                return value
            elif isinstance(value, str):
                try:
                    return int(value)
                except (ValueError, TypeError):
                    return value
            elif isinstance(value, float):
                return int(value)
            return value
        
        # Floating point types
        if pg_type_lower in ('float4', 'float8', 'real', 'double precision'):
            if isinstance(value, (int, float)):
                return float(value)
            elif isinstance(value, str):
                try:
                    return float(value)
                except (ValueError, TypeError):
                    return value
            return value
        
        # Numeric/Decimal type
        if pg_type_lower in ('numeric', 'decimal'):
            if isinstance(value, Decimal):
                return value
            elif isinstance(value, (int, float)):
                return Decimal(str(value))
            elif isinstance(value, str):
                try:
                    return Decimal(value)
                except (ValueError, TypeError):
                    return value
            return value
        
        # Date type
        if pg_type_lower == 'date':
            if isinstance(value, date):
                return value
            elif isinstance(value, datetime):
                return value.date()
            elif isinstance(value, str):
                # Try parsing ISO date string
                try:
                    return datetime.fromisoformat(value.replace('Z', '+00:00')).date()
                except (ValueError, AttributeError):
                    return value
            return value
        
        # Timestamp types
        if pg_type_lower in ('timestamp', 'timestamptz', 'timestamp with time zone', 'timestamp without time zone'):
            if isinstance(value, datetime):
                return value
            elif isinstance(value, str):
                # Try parsing ISO timestamp string
                try:
                    return datetime.fromisoformat(value.replace('Z', '+00:00'))
                except (ValueError, AttributeError):
                    return value
            return value
        
        # Bytea (binary data)
        if pg_type_lower == 'bytea':
            if isinstance(value, bytes):
                return value
            elif isinstance(value, str):
                # Try encoding string to bytes
                try:
                    return value.encode('utf-8')
                except (AttributeError, UnicodeEncodeError):
                    return value
            return value
        
        # Text/String types (text, varchar, char, name, etc.)
        # These handle most other cases - convert to string
        if pg_type_lower in ('text', 'varchar', 'char', 'bpchar', 'name'):
            if isinstance(value, str):
                return value
            return str(value)
        
        # Default: return value as-is
        # PostgreSQL handles many conversions automatically
        return value
    
    async def convert_values(
        self,
        table_name: str,
        data: Dict[str, Any],
        schema: str = "public"
    ) -> List[Any]:
        """
        Convert a dictionary of column->value pairs to PostgreSQL-compatible values
        
        Args:
            table_name: Name of the table
            data: Dictionary of column names to values
            schema: Schema name (default: public)
        
        Returns:
            List of converted values in the same order as data.values()
        """
        # Get column types from metadata
        column_types = await self.get_column_types(table_name, schema)
        
        # Convert each value
        converted = []
        for column_name, value in data.items():
            pg_type = column_types.get(column_name)
            
            if pg_type:
                converted_value = self.convert_value(value, pg_type)
                converted.append(converted_value)
            else:
                # Column not found in metadata - pass through as-is
                # This handles computed columns or special cases
                converted.append(value)
        
        return converted
    
    async def convert_dict(
        self,
        table_name: str,
        data: Dict[str, Any],
        schema: str = "public"
    ) -> Dict[str, Any]:
        """
        Convert a dictionary of column->value pairs, returning a new dictionary
        
        Args:
            table_name: Name of the table
            data: Dictionary of column names to values
            schema: Schema name (default: public)
        
        Returns:
            Dictionary with converted values
        """
        # Get column types from metadata
        column_types = await self.get_column_types(table_name, schema)
        
        # Convert each value
        converted = {}
        for column_name, value in data.items():
            pg_type = column_types.get(column_name)
            
            if pg_type:
                converted[column_name] = self.convert_value(value, pg_type)
            else:
                # Column not found in metadata - pass through as-is
                converted[column_name] = value
        
        return converted
    
    def clear_cache(self, table_name: Optional[str] = None, schema: str = "public"):
        """
        Clear metadata cache
        
        Args:
            table_name: Specific table to clear (None = clear all)
            schema: Schema name
        """
        if table_name:
            cache_key = f"{schema}.{table_name}"
            if cache_key in self._metadata_cache:
                del self._metadata_cache[cache_key]
                logger.info(f"Cleared cache for {cache_key}")
        else:
            self._metadata_cache.clear()
            logger.info("Cleared entire metadata cache")
    
    async def refresh_metadata(self, table_name: str, schema: str = "public"):
        """
        Force refresh metadata for a table
        
        Args:
            table_name: Name of the table
            schema: Schema name
        """
        self.clear_cache(table_name, schema)
        await self.get_column_types(table_name, schema)


# Global mapper instance (initialized per request with project pool)
def get_type_mapper(pool: asyncpg.Pool) -> PostgreSQLTypeMapper:
    """
    Factory function to get a type mapper instance
    
    Args:
        pool: asyncpg connection pool
    
    Returns:
        PostgreSQLTypeMapper instance
    """
    return PostgreSQLTypeMapper(pool)
