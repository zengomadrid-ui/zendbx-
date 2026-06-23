"""
ZendBX MCP - AI Operating Layer for Backend Management

Phase 1: Foundation - Read-only project understanding

This is NOT just an MCP server.
This is the AI BRAIN that powers every ZendBX project.
"""

__version__ = "0.1.0"
__phase__ = "1"

from .gateway import MCPGateway

__all__ = ["MCPGateway"]
