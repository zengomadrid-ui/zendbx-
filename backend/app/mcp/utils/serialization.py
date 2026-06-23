"""
JSON Serialization Utilities for MCP
Handles conversion of non-JSON-serializable types to JSON-safe formats
"""

from typing import Any, Dict, List
from decimal import Decimal
from datetime import datetime, date, time
from uuid import UUID
import base64


def make_json_safe(data: Any) -> Any:
    """
    Recursively convert data structures to JSON-safe formats
    
    Handles:
    - Decimal -> float
    - datetime/date/time -> ISO string
    - UUID -> string
    - bytes -> base64 string
    - dict values recursively
    - list items recursively
    
    Args:
        data: Any data structure to convert
        
    Returns:
        JSON-safe version of the data
    """
    # Handle None
    if data is None:
        return None
    
    # Handle Decimal (from PostgreSQL NUMERIC)
    if isinstance(data, Decimal):
        return float(data)
    
    # Handle datetime types
    if isinstance(data, (datetime, date, time)):
        return data.isoformat()
    
    # Handle UUID
    if isinstance(data, UUID):
        return str(data)
    
    # Handle bytes
    if isinstance(data, bytes):
        return base64.b64encode(data).decode('utf-8')
    
    # Handle dictionaries recursively
    if isinstance(data, dict):
        return {
            key: make_json_safe(value)
            for key, value in data.items()
        }
    
    # Handle lists/tuples recursively
    if isinstance(data, (list, tuple)):
        return [make_json_safe(item) for item in data]
    
    # Return as-is for JSON-compatible types (str, int, float, bool)
    return data
