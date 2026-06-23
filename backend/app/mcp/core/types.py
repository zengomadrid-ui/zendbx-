"""
Core type definitions for ZendBX MCP
Defines enums, type aliases, and base models

Philosophy: Strong typing enables AI understanding
"""

from enum import Enum
from typing import TypeAlias, Any, Dict, List, Optional
from datetime import datetime
from uuid import UUID
from pydantic import BaseModel, Field


# ============================================================================
# Type Aliases
# ============================================================================

ProjectID: TypeAlias = UUID
UserID: TypeAlias = UUID
OrganizationID: TypeAlias = UUID
SessionID: TypeAlias = UUID
ToolName: TypeAlias = str
ContextHash: TypeAlias = str


# ============================================================================
# Enums
# ============================================================================

class MCPProtocolVersion(str, Enum):
    """Supported MCP protocol versions"""
    V2024_11_05 = "2024-11-05"


class ConnectionType(str, Enum):
    """MCP connection transport types"""
    SSE = "sse"
    HTTP = "http"
    STDIO = "stdio"


class ToolCategory(str, Enum):
    """
    Tool categorization for organization and capability discovery
    Each category represents a ZendBX subsystem
    """
    PROJECT = "project"
    DATABASE = "database"
    AUTH = "auth"
    STORAGE = "storage"
    REALTIME = "realtime"
    FUNCTIONS = "functions"
    DEPLOYMENT = "deployment"


class AuditStatus(str, Enum):
    """Audit log status"""
    SUCCESS = "success"
    ERROR = "error"
    DENIED = "denied"


class UserRole(str, Enum):
    """
    User roles for RBAC
    Determines what operations are permitted
    """
    OWNER = "owner"
    ADMIN = "admin"
    DEVELOPER = "developer"
    READ_ONLY = "read_only"


class Permission(str, Enum):
    """
    Granular permissions for fine-grained access control
    Phase 1: Only read permissions
    Phase 2+: Write permissions
    """
    # Read permissions (Phase 1)
    READ_PROJECT = "read:project"
    READ_DATABASE = "read:database"
    READ_AUTH = "read:auth"
    READ_STORAGE = "read:storage"
    READ_FUNCTIONS = "read:functions"
    READ_DEPLOYMENT = "read:deployment"
    
    # Write permissions (Phase 2+)
    WRITE_DATABASE = "write:database"
    WRITE_AUTH = "write:auth"
    WRITE_STORAGE = "write:storage"
    WRITE_FUNCTIONS = "write:functions"
    
    # Admin permissions
    MANAGE_PROJECT = "manage:project"
    MANAGE_TEAM = "manage:team"


class MCPErrorCode(str, Enum):
    """
    Standard MCP error codes
    Enables AI to understand and handle errors intelligently
    """
    # Authentication errors
    AUTHENTICATION_FAILED = "auth.failed"
    INVALID_TOKEN = "auth.invalid_token"
    TOKEN_EXPIRED = "auth.token_expired"
    
    # Authorization errors
    PERMISSION_DENIED = "auth.permission_denied"
    INVALID_PROJECT = "auth.invalid_project"
    CROSS_PROJECT_ACCESS = "auth.cross_project"
    
    # Protocol errors
    INVALID_REQUEST = "protocol.invalid_request"
    UNSUPPORTED_VERSION = "protocol.unsupported_version"
    TOOL_NOT_FOUND = "protocol.tool_not_found"
    INVALID_PARAMETERS = "protocol.invalid_parameters"
    
    # Rate limiting
    RATE_LIMIT_EXCEEDED = "rate_limit.exceeded"
    
    # Internal errors
    INTERNAL_ERROR = "internal.error"
    DATABASE_ERROR = "internal.database"
    CACHE_ERROR = "internal.cache"
    CONTEXT_LOAD_ERROR = "internal.context_load"


# ============================================================================
# Base Models
# ============================================================================

class MCPBaseModel(BaseModel):
    """Base model for all MCP Pydantic models"""
    
    class Config:
        """Pydantic configuration"""
        use_enum_values = True
        json_encoders = {
            datetime: lambda v: v.isoformat(),
            UUID: lambda v: str(v)
        }
        arbitrary_types_allowed = True


class ClientInfo(MCPBaseModel):
    """Information about the connected MCP client"""
    name: str = Field(..., description="Client name (e.g., 'cursor', 'claude-desktop')")
    version: Optional[str] = Field(None, description="Client version")
    protocol_version: MCPProtocolVersion = Field(
        MCPProtocolVersion.V2024_11_05,
        description="MCP protocol version"
    )
    user_agent: Optional[str] = None
    ip_address: Optional[str] = None


class AuthContext(MCPBaseModel):
    """
    Authenticated user and project context
    Every MCP request operates within this context
    """
    user_id: UserID
    organization_id: OrganizationID
    project_id: ProjectID
    role: UserRole
    permissions: List[Permission]
    session_id: Optional[SessionID] = None
    database_name: Optional[str] = None  # Database name for project
    
    def has_permission(self, permission: Permission) -> bool:
        """Check if context has specific permission"""
        return permission in self.permissions


class ToolMetadata(MCPBaseModel):
    """
    Metadata about an MCP tool
    Used for tool discovery and validation
    """
    name: ToolName
    description: str
    category: ToolCategory
    input_schema: Dict[str, Any]
    is_destructive: bool = False
    required_permissions: List[Permission]


class CapabilityInfo(MCPBaseModel):
    """
    Describes a capability (subsystem) of ZendBX
    Future-proof: allows plugins to register themselves
    """
    name: str
    version: str
    description: str
    tools: List[ToolName]
    enabled: bool = True


# ============================================================================
# Context Models (The Core of MCP)
# ============================================================================

class ProjectMetadata(MCPBaseModel):
    """Basic project information"""
    id: str
    name: str
    slug: str
    description: Optional[str] = None
    database_name: str
    created_at: datetime
    status: str


class DatabaseColumn(MCPBaseModel):
    """Database column definition"""
    name: str
    type: str
    nullable: bool
    default: Optional[str] = None
    is_primary_key: bool = False
    is_foreign_key: bool = False
    foreign_key_table: Optional[str] = None
    foreign_key_column: Optional[str] = None


class DatabaseTable(MCPBaseModel):
    """Database table definition"""
    name: str
    columns: List[DatabaseColumn]
    primary_key: List[str]
    indexes: List[Dict[str, Any]]
    row_count: Optional[int] = None
    size_mb: Optional[float] = None


class DatabaseRelationship(MCPBaseModel):
    """Relationship between tables"""
    from_table: str
    to_table: str
    type: str  # 'one_to_many', 'many_to_one', 'many_to_many'
    on_clause: str


class DatabaseContext(MCPBaseModel):
    """Complete database understanding"""
    tables: List[DatabaseTable]
    relationships: List[DatabaseRelationship]
    views: List[Dict[str, Any]]
    functions: List[Dict[str, Any]]
    triggers: List[Dict[str, Any]]


class AuthSubsystemContext(MCPBaseModel):
    """Authentication subsystem context"""
    enabled_providers: List[str]
    mfa_enabled: bool
    session_timeout: int
    user_count: int
    rls_enabled: bool


class StorageContext(MCPBaseModel):
    """Storage subsystem context"""
    buckets: List[Dict[str, Any]]
    total_size_mb: float
    total_files: int


class RealtimeContext(MCPBaseModel):
    """Realtime subsystem context"""
    enabled: bool
    channels: List[str]
    active_connections: int


class FunctionsContext(MCPBaseModel):
    """Functions subsystem context"""
    deployed_functions: List[Dict[str, Any]]
    runtime: Optional[str] = None


class DeploymentContext(MCPBaseModel):
    """Deployment and health context"""
    status: str  # 'healthy', 'degraded', 'down'
    version: Optional[str] = None
    last_deployed_at: Optional[datetime] = None
    uptime_percent: Optional[float] = None


class SDKContext(MCPBaseModel):
    """SDK configuration"""
    supported_languages: List[str]
    version: str
    documentation_url: Optional[str] = None


class ProjectContext(MCPBaseModel):
    """
    THE BRAIN: Complete AI understanding of a project
    
    This is what makes ZendBX MCP unique.
    When AI connects, it immediately receives complete understanding.
    No questions needed. No manual explanation required.
    """
    # Static Context
    project: ProjectMetadata
    database: DatabaseContext
    auth: AuthSubsystemContext
    storage: StorageContext
    realtime: RealtimeContext
    functions: FunctionsContext
    sdk: SDKContext
    
    # Live Context
    deployment: DeploymentContext
    
    # Capabilities
    capabilities: List[CapabilityInfo]
    
    # Metadata
    context_version: int = 1
    generated_at: datetime = Field(default_factory=datetime.utcnow)
