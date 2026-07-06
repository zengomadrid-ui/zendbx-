from pydantic import BaseModel, EmailStr, Field, validator
from typing import Optional, List, Dict, Any
from datetime import datetime
from uuid import UUID

# ============================================
# USER SCHEMAS
# ============================================

class UserBase(BaseModel):
    email: EmailStr
    full_name: Optional[str] = None

class UserCreate(UserBase):
    password: str = Field(..., min_length=8)

class UserLogin(BaseModel):
    email: EmailStr
    password: str

class UserResponse(UserBase):
    id: UUID
    avatar_url: Optional[str] = None
    is_active: bool
    is_verified: bool
    plan: str
    role: Optional[str] = "user"  # Added for RBAC
    created_at: datetime
    
    class Config:
        from_attributes = True

class UserUpdate(BaseModel):
    full_name: Optional[str] = None
    avatar_url: Optional[str] = None

# ============================================
# AUTH SCHEMAS
# ============================================

class Token(BaseModel):
    access_token: str
    token_type: str = "bearer"
    user: UserResponse

class TokenPayload(BaseModel):
    sub: str  # user_id
    exp: int

# ============================================
# API KEY SCHEMAS
# ============================================

class APIKeyCreate(BaseModel):
    name: str = Field(..., min_length=1, max_length=255, description="Descriptive name for the API key")
    role: str = Field(..., pattern=r'^(read|admin)$', description="Key role: 'read' or 'admin'")

class APIKeyResponse(BaseModel):
    id: str
    name: str
    key: Optional[str] = None  # Only returned on creation
    key_prefix: str
    role: str
    is_active: bool
    last_used_at: Optional[str] = None
    created_at: str
    message: Optional[str] = None

class APIKeyListResponse(BaseModel):
    keys: List[APIKeyResponse]

# ============================================
# PROJECT SCHEMAS
# ============================================

class ProjectBase(BaseModel):
    name: str = Field(..., min_length=1, max_length=255)
    description: Optional[str] = None

class ProjectCreate(ProjectBase):
    pass

class ProjectUpdate(BaseModel):
    name: Optional[str] = Field(None, min_length=1, max_length=255)
    description: Optional[str] = None

class ProjectResponse(ProjectBase):
    id: UUID
    user_id: UUID
    slug: str
    database_name: str
    status: str
    created_at: datetime
    updated_at: datetime
    anon_key: Optional[str] = None  # Only returned on creation
    service_role_key: Optional[str] = None  # Only returned on creation
    
    class Config:
        from_attributes = True

class ProjectWithURLs(ProjectResponse):
    """Project response with API URLs"""
    api_url_subdomain: str
    api_url_path: str

class ProjectStats(BaseModel):
    table_count: int
    total_rows: int
    total_size_bytes: int
    query_count: int

class ProjectWithStats(ProjectResponse):
    stats: ProjectStats

# ============================================
# TABLE SCHEMAS
# ============================================

class ColumnDefinition(BaseModel):
    name: str
    type: str  # varchar, integer, boolean, timestamp, etc.
    nullable: bool = True
    default: Optional[str] = None
    primary_key: bool = False
    unique: bool = False

class TableCreate(BaseModel):
    table_name: str = Field(..., pattern=r'^[a-z][a-z0-9_]*$')
    columns: List[ColumnDefinition]
    
    @validator('table_name')
    def validate_table_name(cls, v):
        if v.startswith('_'):
            raise ValueError('Table name cannot start with underscore')
        if len(v) > 63:
            raise ValueError('Table name too long (max 63 characters)')
        return v

class TableUpdate(BaseModel):
    add_columns: Optional[List[ColumnDefinition]] = None
    drop_columns: Optional[List[str]] = None
    rename_columns: Optional[Dict[str, str]] = None

class TableSchema(BaseModel):
    table_name: str
    columns: List[ColumnDefinition]
    row_count: int
    column_count: Optional[int] = None
    size_bytes: int
    created_at: Optional[datetime] = None

class TableRow(BaseModel):
    data: Dict[str, Any]

class TableRowUpdate(BaseModel):
    data: Dict[str, Any]

# ============================================
# QUERY SCHEMAS
# ============================================

class QueryExecute(BaseModel):
    sql: str
    question: Optional[str] = None  # Natural language question if AI used
    enable_autofix: bool = True  # Enable/disable automatic SQL error fixing

class QueryExecutionLog(BaseModel):
    statement: str
    status: str  # 'success', 'error'
    message: str
    rows_affected: Optional[int] = None
    execution_time_ms: Optional[int] = None
    error_position: Optional[int] = None
    error_line: Optional[int] = None

class QueryResult(BaseModel):
    columns: List[str]
    rows: List[Dict[str, Any]]
    row_count: int
    execution_time_ms: int
    logs: List[QueryExecutionLog] = []
    # Auto-fix metadata
    auto_fixed: Optional[bool] = False
    original_sql: Optional[str] = None
    fixed_sql: Optional[str] = None
    # Metadata refresh flag for DDL operations
    metadata_refresh: Optional[bool] = False

class QueryHistoryResponse(BaseModel):
    id: UUID
    question: Optional[str]
    sql_query: str
    status: str
    execution_time_ms: Optional[int]
    rows_returned: Optional[int]
    error_message: Optional[str]
    created_at: datetime
    
    class Config:
        from_attributes = True

class SavedQueryCreate(BaseModel):
    name: str
    description: Optional[str] = None
    question: Optional[str] = None
    sql_query: str
    tags: Optional[List[str]] = None

class SavedQueryUpdate(BaseModel):
    name: Optional[str] = None
    description: Optional[str] = None
    tags: Optional[List[str]] = None
    is_favorite: Optional[bool] = None

class SavedQueryResponse(BaseModel):
    id: UUID
    name: str
    description: Optional[str]
    question: Optional[str]
    sql_query: str
    tags: Optional[List[str]]
    is_favorite: bool
    run_count: int
    created_at: datetime
    updated_at: datetime
    
    class Config:
        from_attributes = True

# ============================================
# AI SCHEMAS
# ============================================

class AIQueryRequest(BaseModel):
    question: str = Field(..., min_length=1)
    model: Optional[str] = "gpt-4"  # gpt-4, claude, llama

class AIQueryResponse(BaseModel):
    question: str
    sql: str
    explanation: str
    confidence: float  # 0.0 to 1.0

class AIExplainRequest(BaseModel):
    sql: str

class AIExplainResponse(BaseModel):
    sql: str
    explanation: str
    steps: List[str]

# ============================================
# API KEY SCHEMAS
# ============================================

class APIKeyCreate(BaseModel):
    name: str = Field(..., min_length=1, max_length=255, description="Descriptive name for the API key")
    role: str = Field(..., pattern=r'^(read|admin)$', description="Key role: 'read' or 'admin'")

class APIKeyResponse(BaseModel):
    id: str
    name: str
    key: Optional[str] = None  # Only returned on creation
    key_prefix: str
    role: str
    is_active: bool
    last_used_at: Optional[str] = None
    created_at: str
    message: Optional[str] = None

class APIKeyListResponse(BaseModel):
    keys: List[APIKeyResponse]

# ============================================
# FILE UPLOAD SCHEMAS
# ============================================

class FileUploadResponse(BaseModel):
    id: UUID
    filename: str
    original_filename: str
    file_size: int
    status: str
    table_name: Optional[str]
    error_message: Optional[str]
    created_at: datetime
    
    class Config:
        from_attributes = True

# ============================================
# GENERIC RESPONSES
# ============================================

class MessageResponse(BaseModel):
    message: str
    success: bool = True

class ErrorResponse(BaseModel):
    error: str
    detail: Optional[str] = None
    success: bool = False


# ============================================
# AI SCHEMAS
# ============================================

class AIQueryRequest(BaseModel):
    question: str
    model: str = "gpt-4"

class AIQueryResponse(BaseModel):
    question: str
    sql: str
    explanation: str
    confidence: float

class AIExplainRequest(BaseModel):
    sql: str

class AIExplainResponse(BaseModel):
    sql: str
    explanation: str
    steps: List[str] = []

# ============================================
# TEAM COLLABORATION SCHEMAS
# ============================================

class MemberInvite(BaseModel):
    email: EmailStr
    role: str = "editor"  # admin, editor, viewer

class MemberUpdate(BaseModel):
    role: str  # admin, editor, viewer

class MemberResponse(BaseModel):
    id: UUID
    project_id: UUID
    user_id: UUID
    email: str
    full_name: str
    role: str
    joined_at: datetime
    last_active_at: datetime
    
    class Config:
        from_attributes = True

class ChatMessageCreate(BaseModel):
    content: str

class ChatMessageResponse(BaseModel):
    id: UUID
    project_id: UUID
    user_id: UUID
    sender_name: str
    sender_email: str
    content: str
    created_at: datetime
    updated_at: datetime
    
    class Config:
        from_attributes = True
