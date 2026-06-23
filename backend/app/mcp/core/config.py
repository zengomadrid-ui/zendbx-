"""
MCP Configuration
Centralized configuration management
"""

import os
from typing import Optional
from pydantic import Field
from pydantic_settings import BaseSettings


class MCPConfig(BaseSettings):
    """
    MCP configuration
    Loaded from environment variables with MCP_ prefix
    """
    
    # Protocol
    protocol_version: str = "2024-11-05"
    max_connections: int = 1000
    
    # Context Cache
    context_cache_ttl: int = Field(default=1800, description="Context cache TTL in seconds (30 min)")
    context_memory_cache_ttl: int = Field(default=300, description="Memory cache TTL in seconds (5 min)")
    context_generation_timeout: int = Field(default=30, description="Context generation timeout in seconds")
    
    # Rate Limiting
    rate_limit_requests_per_minute: int = Field(default=60, description="Max requests per minute per session")
    rate_limit_tools_per_hour: int = Field(default=1000, description="Max tool calls per hour per project")
    
    # Security
    secret_filter_enabled: bool = Field(default=True, description="Enable secret filtering in context")
    max_query_results: int = Field(default=1000, description="Max rows returned from database queries")
    
    # Audit
    audit_enabled: bool = Field(default=True, description="Enable audit logging")
    audit_log_parameters: bool = Field(default=True, description="Log tool parameters")
    audit_log_results: bool = Field(default=False, description="Log tool results (can be large)")
    
    # Performance
    enable_context_compression: bool = Field(default=False, description="Compress context cache")
    parallel_context_loading: bool = Field(default=True, description="Load context collectors in parallel")
    
    # Development
    debug_mode: bool = Field(default=False, description="Enable debug logging")
    mock_context: bool = Field(default=False, description="Use mock context for development")
    
    class Config:
        env_prefix = "MCP_"
        case_sensitive = False


# Singleton instance
mcp_config = MCPConfig()
