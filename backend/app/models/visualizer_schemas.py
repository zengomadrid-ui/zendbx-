"""
Pydantic schemas for Data Visualizer API
"""
from pydantic import BaseModel, Field, validator
from typing import List, Dict, Any, Optional, Literal
from uuid import UUID
from datetime import datetime


# ============================================
# FILTER SCHEMAS
# ============================================

class VisualizerFilter(BaseModel):
    """Single filter condition"""
    column: str = Field(..., description="Column name to filter on")
    operator: Literal["eq", "ne", "gt", "gte", "lt", "lte", "like", "in", "not_in", "is_null", "is_not_null"] = Field(
        ..., 
        description="Filter operator"
    )
    value: Any = Field(None, description="Filter value (not required for is_null/is_not_null)")


# ============================================
# METRIC SCHEMAS
# ============================================

class VisualizerMetric(BaseModel):
    """Metric aggregation definition"""
    column: str = Field(..., description="Column name to aggregate")
    aggregation: Literal["count", "count_distinct", "sum", "avg", "min", "max"] = Field(
        ...,
        description="Aggregation function"
    )
    alias: Optional[str] = Field(None, description="Custom alias for the metric")


# ============================================
# DIMENSION SCHEMAS
# ============================================

class VisualizerDimension(BaseModel):
    """Dimension definition"""
    column: str = Field(..., description="Column name for dimension")
    time_bucket: Optional[Literal["hour", "day", "week", "month", "quarter", "year"]] = Field(
        None,
        description="Time bucketing for timestamp columns"
    )
    alias: Optional[str] = Field(None, description="Custom alias for the dimension")


# ============================================
# QUERY REQUEST SCHEMAS
# ============================================

class VisualizerQueryRequest(BaseModel):
    """Request to execute a data visualization query"""
    table: str = Field(..., description="Table name to query")
    dimensions: List[VisualizerDimension] = Field(
        default_factory=list,
        description="Dimensions (GROUP BY columns)"
    )
    metrics: List[VisualizerMetric] = Field(
        ...,
        min_items=1,
        description="Metrics to calculate"
    )
    filters: List[VisualizerFilter] = Field(
        default_factory=list,
        description="Filter conditions"
    )
    sort: Optional[Dict[str, str]] = Field(
        None,
        description="Sort configuration: {column: 'field_name', direction: 'asc'|'desc'}"
    )
    limit: int = Field(100, ge=1, le=10000, description="Maximum rows to return")


class VisualizerQueryResponse(BaseModel):
    """Response from visualization query"""
    columns: List[str] = Field(..., description="Column names in result")
    rows: List[Dict[str, Any]] = Field(..., description="Query result rows")
    row_count: int = Field(..., description="Number of rows returned")
    execution_time_ms: int = Field(..., description="Query execution time in milliseconds")
    generated_sql: str = Field(..., description="Generated SQL query")
    timestamp: datetime = Field(default_factory=datetime.utcnow, description="Query execution timestamp")


# ============================================
# SCHEMA DISCOVERY SCHEMAS
# ============================================

class ColumnInfo(BaseModel):
    """Column metadata"""
    name: str
    type: str
    nullable: bool
    default: Optional[str] = None
    primary_key: bool = False


class TableInfo(BaseModel):
    """Table metadata"""
    name: str
    columns: List[ColumnInfo]
    row_count: Optional[int] = None


class VisualizerSchemaResponse(BaseModel):
    """Schema information for visualizer"""
    tables: List[TableInfo]


# ============================================
# CHART CONFIGURATION SCHEMAS
# ============================================

class ChartConfiguration(BaseModel):
    """Chart configuration (stored as JSONB)"""
    table: str
    chart_type: Literal["table", "bar", "line", "pie", "donut", "area", "kpi", "scatter"]
    dimensions: List[VisualizerDimension] = Field(default_factory=list)
    metrics: List[VisualizerMetric]
    filters: List[VisualizerFilter] = Field(default_factory=list)
    sort: Optional[Dict[str, str]] = None
    limit: int = 100
    
    # Chart-specific options
    x_axis_label: Optional[str] = None
    y_axis_label: Optional[str] = None
    show_legend: bool = True
    show_grid: bool = True
    color_scheme: Optional[str] = None


class ChartPosition(BaseModel):
    """Chart position in dashboard grid"""
    x: int = Field(0, ge=0, description="Grid X position")
    y: int = Field(0, ge=0, description="Grid Y position")
    width: int = Field(6, ge=1, le=12, description="Grid width (1-12)")
    height: int = Field(4, ge=1, le=12, description="Grid height")


# ============================================
# CHART CRUD SCHEMAS
# ============================================

class ChartCreate(BaseModel):
    """Create new chart"""
    dashboard_id: Optional[UUID] = Field(None, description="Dashboard ID (optional for standalone charts)")
    name: str = Field(..., min_length=1, max_length=255)
    configuration: ChartConfiguration
    position: Optional[ChartPosition] = None


class ChartUpdate(BaseModel):
    """Update existing chart"""
    name: Optional[str] = Field(None, min_length=1, max_length=255)
    configuration: Optional[ChartConfiguration] = None
    position: Optional[ChartPosition] = None


class ChartResponse(BaseModel):
    """Chart response"""
    id: UUID
    dashboard_id: Optional[UUID]
    project_id: UUID
    name: str
    chart_type: str
    configuration: Dict[str, Any]
    position: Optional[Dict[str, Any]]
    created_at: datetime
    updated_at: datetime


# ============================================
# DASHBOARD CRUD SCHEMAS
# ============================================

class DashboardCreate(BaseModel):
    """Create new dashboard"""
    name: str = Field(..., min_length=1, max_length=255)
    description: Optional[str] = None


class DashboardUpdate(BaseModel):
    """Update existing dashboard"""
    name: Optional[str] = Field(None, min_length=1, max_length=255)
    description: Optional[str] = None


class DashboardResponse(BaseModel):
    """Dashboard response"""
    id: UUID
    project_id: UUID
    name: str
    description: Optional[str]
    created_by: UUID
    created_at: datetime
    updated_at: datetime
    charts: Optional[List[ChartResponse]] = None


class DashboardListResponse(BaseModel):
    """List of dashboards"""
    dashboards: List[DashboardResponse]
    total: int
