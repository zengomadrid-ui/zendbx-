"""
Admin Quota Management API
Allows admins to override quotas and manage custom limits
"""
from fastapi import APIRouter, HTTPException, Depends
from typing import Optional, Dict, Any, List
from pydantic import BaseModel
import uuid
from datetime import datetime
from app.core.database import get_main_db_pool
from app.services.quota_service import quota_service
from app.core.redis_client import redis_client
from app.core.rbac import require_admin


router = APIRouter(prefix="/api/admin/quotas", tags=["Admin Quotas"])


# ==========================================
# Request/Response Models
# ==========================================

class QuotaOverrideRequest(BaseModel):
    """Request to override user quota"""
    user_id: str
    resource_type: str  # api_requests, database_size, projects, team_members
    new_limit: int
    reason: str
    expires_at: Optional[datetime] = None


class QuotaOverrideResponse(BaseModel):
    """Response for quota override"""
    id: str
    user_id: str
    resource_type: str
    original_limit: int
    new_limit: int
    reason: str
    created_by: str
    created_at: datetime
    expires_at: Optional[datetime]


class CustomPlanRequest(BaseModel):
    """Request to create custom enterprise plan"""
    user_id: str
    plan_name: str
    api_requests_limit: int
    database_size_limit: int
    projects_limit: int
    team_members_limit: int
    price_monthly: float
    features: List[str] = []


# ==========================================
# Admin Endpoints
# ==========================================

@router.post("/override", response_model=QuotaOverrideResponse)
async def create_quota_override(
    request: QuotaOverrideRequest,
    current_user: dict = Depends(require_admin)
):
    """
    Create a quota override for a user
    Allows temporary or permanent limit increases
    """
    try:
        pool = await get_main_db_pool()
        async with pool.acquire() as conn:
            # Get user's current plan
            plan = await quota_service.get_user_plan(request.user_id)
            if not plan:
                raise HTTPException(status_code=404, detail="User plan not found")
            
            # Get original limit
            limit_column = f"{request.resource_type}_limit"
            original_limit = plan.get(limit_column, 0)
            
            # Create override record
            result = await conn.fetchrow(
                """
                INSERT INTO quota_overrides (
                    user_id, resource_type, original_limit, new_limit,
                    reason, created_by, expires_at
                ) VALUES ($1, $2, $3, $4, $5, $6, $7)
                RETURNING *
                """,
                uuid.UUID(request.user_id),
                request.resource_type,
                original_limit,
                request.new_limit,
                request.reason,
                uuid.UUID(current_user['id']),
                request.expires_at
            )
            
            # Invalidate cache
            await quota_service.invalidate_plan_cache(request.user_id)
            
            # Log audit trail
            await conn.execute(
                """
                INSERT INTO audit_logs (
                    user_id, action, resource_type, details, performed_by
                ) VALUES ($1, 'quota_override', $2, $3, $4)
                """,
                uuid.UUID(request.user_id),
                request.resource_type,
                {
                    "original_limit": original_limit,
                    "new_limit": request.new_limit,
                    "reason": request.reason
                },
                uuid.UUID(current_user['id'])
            )
            
            return QuotaOverrideResponse(**dict(result))
            
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))


@router.get("/overrides/{user_id}")
async def get_user_overrides(
    user_id: str,
    current_user: dict = Depends(require_admin)
):
    """Get all quota overrides for a user"""
    try:
        pool = await get_main_db_pool()
        async with pool.acquire() as conn:
            results = await conn.fetch(
                """
                SELECT qo.*, u.email as created_by_email
                FROM quota_overrides qo
                LEFT JOIN users u ON qo.created_by = u.id
                WHERE qo.user_id = $1
                AND (qo.expires_at IS NULL OR qo.expires_at > NOW())
                ORDER BY qo.created_at DESC
                """,
                uuid.UUID(user_id)
            )
            
            return [dict(row) for row in results]
            
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))


@router.delete("/overrides/{override_id}")
async def remove_quota_override(
    override_id: str,
    current_user: dict = Depends(require_admin)
):
    """Remove a quota override"""
    try:
        pool = await get_main_db_pool()
        async with pool.acquire() as conn:
            # Get override details
            override = await conn.fetchrow(
                "SELECT * FROM quota_overrides WHERE id = $1",
                uuid.UUID(override_id)
            )
            
            if not override:
                raise HTTPException(status_code=404, detail="Override not found")
            
            # Delete override
            await conn.execute(
                "DELETE FROM quota_overrides WHERE id = $1",
                uuid.UUID(override_id)
            )
            
            # Invalidate cache
            await quota_service.invalidate_plan_cache(str(override['user_id']))
            
            # Log audit trail
            await conn.execute(
                """
                INSERT INTO audit_logs (
                    user_id, action, resource_type, details, performed_by
                ) VALUES ($1, 'quota_override_removed', $2, $3, $4)
                """,
                override['user_id'],
                override['resource_type'],
                {"override_id": override_id},
                uuid.UUID(current_user['id'])
            )
            
            return {"message": "Override removed successfully"}
            
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))


@router.post("/custom-plan")
async def create_custom_plan(
    request: CustomPlanRequest,
    current_user: dict = Depends(require_admin)
):
    """
    Create custom enterprise plan for a user
    """
    try:
        pool = await get_main_db_pool()
        async with pool.acquire() as conn:
            # Create custom plan
            plan = await conn.fetchrow(
                """
                INSERT INTO subscription_plans (
                    name, display_name, description,
                    price_monthly, price_yearly,
                    api_requests_limit, database_size_limit,
                    projects_limit, team_members_limit,
                    backup_frequency, features, is_active
                ) VALUES (
                    $1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, true
                )
                RETURNING *
                """,
                f"custom_{request.user_id[:8]}",
                request.plan_name,
                f"Custom enterprise plan for user {request.user_id}",
                request.price_monthly,
                request.price_monthly * 10,  # Yearly discount
                request.api_requests_limit,
                request.database_size_limit,
                request.projects_limit,
                request.team_members_limit,
                'hourly',
                request.features
            )
            
            # Assign plan to user
            await conn.execute(
                """
                UPDATE user_subscriptions
                SET plan_id = $1,
                    updated_at = NOW()
                WHERE user_id = $2
                """,
                plan['id'],
                uuid.UUID(request.user_id)
            )
            
            # Invalidate cache
            await quota_service.invalidate_plan_cache(request.user_id)
            
            # Log audit trail
            await conn.execute(
                """
                INSERT INTO audit_logs (
                    user_id, action, resource_type, details, performed_by
                ) VALUES ($1, 'custom_plan_created', 'subscription', $2, $3)
                """,
                uuid.UUID(request.user_id),
                {"plan_id": str(plan['id']), "plan_name": request.plan_name},
                uuid.UUID(current_user['id'])
            )
            
            return {"message": "Custom plan created", "plan": dict(plan)}
            
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))


@router.get("/usage-stats")
async def get_platform_usage_stats(
    current_user: dict = Depends(require_admin)
):
    """
    Get platform-wide usage statistics
    """
    try:
        pool = await get_main_db_pool()
        async with pool.acquire() as conn:
            # Get current period
            period = await conn.fetchrow(
                "SELECT * FROM get_current_month_period()"
            )
            
            # Get aggregated stats
            stats = await conn.fetchrow(
                """
                SELECT
                    COUNT(DISTINCT user_id) as total_users,
                    SUM(api_requests_count) as total_api_requests,
                    SUM(database_size_bytes) as total_database_size,
                    SUM(projects_count) as total_projects,
                    SUM(team_members_count) as total_team_members
                FROM usage_tracking
                WHERE period_start = $1
                """,
                period['period_start']
            )
            
            # Get plan distribution
            plan_dist = await conn.fetch(
                """
                SELECT sp.name, sp.display_name, COUNT(*) as user_count
                FROM user_subscriptions us
                JOIN subscription_plans sp ON us.plan_id = sp.id
                WHERE us.status = 'active'
                GROUP BY sp.name, sp.display_name
                ORDER BY user_count DESC
                """
            )
            
            # Get top users by usage
            top_users = await conn.fetch(
                """
                SELECT
                    u.email,
                    ut.api_requests_count,
                    ut.database_size_bytes,
                    ut.projects_count
                FROM usage_tracking ut
                JOIN users u ON ut.user_id = u.id
                WHERE ut.period_start = $1
                ORDER BY ut.api_requests_count DESC
                LIMIT 10
                """,
                period['period_start']
            )
            
            return {
                "period": {
                    "start": period['period_start'],
                    "end": period['period_end']
                },
                "totals": dict(stats),
                "plan_distribution": [dict(row) for row in plan_dist],
                "top_users": [dict(row) for row in top_users]
            }
            
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))


@router.post("/reset-usage/{user_id}")
async def reset_user_usage(
    user_id: str,
    current_user: dict = Depends(require_admin)
):
    """
    Manually reset usage counters for a user
    Use with caution - for emergency situations only
    """
    try:
        # Reset in Redis
        if redis_client.enabled:
            await redis_client.cache_delete_pattern(f"quota:{user_id}:*")
        
        # Reset in database
        success = await quota_service.reset_monthly_usage(user_id)
        
        if success:
            # Log audit trail
            pool = await get_main_db_pool()
            async with pool.acquire() as conn:
                await conn.execute(
                    """
                    INSERT INTO audit_logs (
                        user_id, action, resource_type, details, performed_by
                    ) VALUES ($1, 'usage_reset', 'all', $2, $3)
                    """,
                    uuid.UUID(user_id),
                    {"reason": "Manual admin reset"},
                    uuid.UUID(current_user['id'])
                )
            
            return {"message": "Usage reset successfully"}
        else:
            raise HTTPException(status_code=500, detail="Failed to reset usage")
            
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))
