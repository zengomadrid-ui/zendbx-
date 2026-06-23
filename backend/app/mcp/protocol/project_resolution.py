"""
MCP Project Resolution
Unified project resolution for MCP JSON-RPC endpoints
Supports multiple resolution methods per MCP specification
"""

from typing import Optional, Dict, Any, Tuple
from fastapi import Request
from .jsonrpc import JSONRPCRequest
import logging

logger = logging.getLogger(__name__)


class ProjectResolutionResult:
    """Result of project resolution"""
    
    def __init__(
        self,
        project_slug: Optional[str] = None,
        source: Optional[str] = None,
        error: Optional[str] = None
    ):
        self.project_slug = project_slug
        self.source = source  # "query", "params", "header", "path"
        self.error = error
    
    @property
    def is_success(self) -> bool:
        return self.project_slug is not None
    
    def __repr__(self) -> str:
        if self.is_success:
            return f"<ProjectResolution project={self.project_slug} source={self.source}>"
        return f"<ProjectResolution error={self.error}>"


async def resolve_mcp_project(
    request: Request,
    jsonrpc_request: Optional[JSONRPCRequest] = None
) -> ProjectResolutionResult:
    """
    Resolve project from MCP request using multiple strategies
    
    Priority order:
    1. Query string:  ?project=project-slug
    2. JSON-RPC params: {"params": {"project": "project-slug"}}
    3. HTTP header: X-Project-Slug: project-slug
    4. URL path params: /mcp/p/{project_slug}  (legacy support)
    
    Args:
        request: FastAPI Request object
        jsonrpc_request: Parsed JSON-RPC request (optional)
        
    Returns:
        ProjectResolutionResult with project_slug or error
    """
    
    # Priority 1: Query string
    project_slug = request.query_params.get("project")
    if project_slug:
        logger.debug(f"Project resolved from query string: {project_slug}")
        return ProjectResolutionResult(
            project_slug=project_slug,
            source="query"
        )
    
    # Priority 2: JSON-RPC params
    if jsonrpc_request and jsonrpc_request.params:
        # Check for 'project' key in params
        project_slug = jsonrpc_request.params.get("project")
        if project_slug:
            logger.debug(f"Project resolved from JSON-RPC params: {project_slug}")
            return ProjectResolutionResult(
                project_slug=project_slug,
                source="params"
            )
    
    # Priority 3: HTTP header
    project_slug = request.headers.get("X-Project-Slug") or request.headers.get("x-project-slug")
    if project_slug:
        logger.debug(f"Project resolved from header: {project_slug}")
        return ProjectResolutionResult(
            project_slug=project_slug,
            source="header"
        )
    
    # Priority 4: URL path params (legacy support)
    project_slug = request.path_params.get("project_slug")
    if project_slug:
        logger.debug(f"Project resolved from path: {project_slug}")
        return ProjectResolutionResult(
            project_slug=project_slug,
            source="path"
        )
    
    # No project found
    logger.warning("Could not resolve project from any source")
    return ProjectResolutionResult(
        error="Project not specified. Provide via: ?project=slug, JSON-RPC params, or X-Project-Slug header"
    )


def is_initialize_or_ping(method: Optional[str]) -> bool:
    """
    Check if method is initialize or ping (which may not require project)
    
    Per MCP spec:
    - initialize: May be called before project selection
    - ping: Keepalive, may not need project context
    """
    return method in ["initialize", "ping"]
