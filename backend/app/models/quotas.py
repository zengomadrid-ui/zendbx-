"""
Pydantic models for quotas and billing system
"""
from pydantic import BaseModel, Field
from typing import Optional, List
from datetime import datetime
from decimal import Decimal


class SubscriptionPlan(BaseModel):
    """Subscription plan model"""
    id: str
    name: str
    display_name: str
    description: Optional[str] = None
    price_monthly: Decimal
    price_yearly: Optional[Decimal] = None
    
    # Limits
    api_requests_limit: int
    database_size_limit: int  # in bytes
    projects_limit: int
    team_members_limit: int
    backup_frequency: str
    
    # Features
    features: List[str] = []
    
    # Metadata
    is_active: bool = True
    sort_order: int = 0
    created_at: datetime
    updated_at: datetime
    
    class Config:
        from_attributes = True


class UserSubscription(BaseModel):
    """User subscription model"""
    id: str
    user_id: str
    plan_id: str
    status: str
    current_period_start: datetime
    current_period_end: datetime
    stripe_subscription_id: Optional[str] = None
    stripe_customer_id: Optional[str] = None
    cancelled_at: Optional[datetime] = None
    created_at: datetime
    updated_at: datetime
    
    class Config:
        from_attributes = True


class UsageTracking(BaseModel):
    """Usage tracking model"""
    id: str
    user_id: str
    period_start: datetime
    period_end: datetime
    
    # Usage counters
    api_requests_count: int = 0
    database_size_bytes: int = 0
    projects_count: int = 0
    team_members_count: int = 0
    
    # Metadata
    last_reset_at: datetime
    created_at: datetime
    updated_at: datetime
    
    class Config:
        from_attributes = True


class UsageLog(BaseModel):
    """Usage log model"""
    id: str
    user_id: str
    resource_type: str
    action: str
    amount: int = 1
    endpoint: Optional[str] = None
    project_id: Optional[str] = None
    metadata: dict = {}
    created_at: datetime
    
    class Config:
        from_attributes = True


# Request/Response Models

class QuotaCheckResponse(BaseModel):
    """Response for quota check"""
    allowed: bool
    resource_type: str
    current_usage: int
    limit: int
    percentage: float
    remaining: int
    message: Optional[str] = None
    upgrade_required: bool = False
    suggested_plan: Optional[str] = None


class UsageResponse(BaseModel):
    """Response for usage information"""
    user_id: str
    plan_name: str
    plan_display_name: str
    period_start: datetime
    period_end: datetime
    
    # API Requests
    api_requests_used: int
    api_requests_limit: int
    api_requests_percentage: float
    
    # Database Size
    database_size_used: int
    database_size_limit: int
    database_size_percentage: float
    
    # Projects
    projects_used: int
    projects_limit: int
    projects_percentage: float
    
    # Team Members
    team_members_used: int
    team_members_limit: int
    team_members_percentage: float


class PlanComparisonResponse(BaseModel):
    """Response for plan comparison"""
    current_plan: SubscriptionPlan
    available_plans: List[SubscriptionPlan]
    upgrade_recommended: bool = False
    reason: Optional[str] = None


class UpgradeRequest(BaseModel):
    """Request to upgrade plan"""
    plan_name: str
    billing_cycle: str = Field(default="monthly", pattern="^(monthly|yearly)$")


class QuotaExceededError(BaseModel):
    """Error response when quota is exceeded"""
    error: str = "quota_exceeded"
    message: str
    resource_type: str
    current_usage: int
    limit: int
    percentage: float
    upgrade_url: str = "/dashboard/billing"
    suggested_plans: List[dict] = []
