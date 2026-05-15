"""
Billing and Usage API Endpoints
"""
from fastapi import APIRouter, Depends, HTTPException
from typing import List, Dict, Any
from app.core.security import get_current_user
from datetime import datetime, timedelta
from app.core.database import get_main_db_pool


router = APIRouter(prefix="/api/billing", tags=["billing"])


@router.get("/subscription")
async def get_subscription(current_user: dict = Depends(get_current_user)):
    """Get user current subscription and usage"""
    try:
        user_id = current_user.get("user_id")
        pool = await get_main_db_pool()
        async with pool.acquire() as conn:
            subscription = await conn.fetchrow("""
                SELECT us.id, us.user_id, us.plan_id, us.status,
                    us.current_period_start, us.current_period_end,
                    us.cancel_at_period_end, sp.name, sp.display_name,
                    sp.description, sp.price_monthly, sp.price_yearly,
                    sp.features, sp.api_requests_limit, sp.database_size_limit,
                    sp.projects_limit, sp.team_members_limit, sp.backup_frequency
                FROM user_subscriptions us
                JOIN subscription_plans sp ON us.plan_id = sp.id
                WHERE us.user_id = $1
                ORDER BY us.created_at DESC LIMIT 1
            """, user_id)
            if not subscription:
                raise HTTPException(status_code=404, detail="No subscription found")
            usage = await conn.fetchrow("""
                SELECT api_requests, database_size_bytes,
                       projects_count, team_members_count, last_reset_at
                FROM usage_tracking WHERE user_id = $1
            """, user_id)
            sub_dict = dict(subscription)
            usage_dict = dict(usage) if usage else {
                "api_requests": 0, "database_size_bytes": 0,
                "projects_count": 0, "team_members_count": 0,
                "last_reset_at": datetime.utcnow()
            }
            return {"subscription": sub_dict, "usage": usage_dict}
    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Failed to fetch subscription: {str(e)}")


@router.get("/plans")
async def get_plans():
    """Get all available subscription plans"""
    try:
        pool = await get_main_db_pool()
        async with pool.acquire() as conn:
            plans = await conn.fetch("""
                SELECT id, name, display_name, description,
                       price_monthly, price_yearly, features,
                       api_requests_limit, database_size_limit,
                       projects_limit, team_members_limit,
                       backup_frequency, is_active, created_at
                FROM subscription_plans
                WHERE is_active = true ORDER BY price_monthly ASC
            """)
            return [dict(plan) for plan in plans]
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Failed to fetch plans: {str(e)}")


@router.post("/upgrade")
async def upgrade_plan(plan_id: str, current_user: dict = Depends(get_current_user)):
    """Upgrade user to a new plan"""
    try:
        user_id = current_user.get("user_id")
        pool = await get_main_db_pool()
        async with pool.acquire() as conn:
            plan = await conn.fetchrow("""
                SELECT id, name, price_monthly FROM subscription_plans
                WHERE id = $1 AND is_active = true
            """, plan_id)
            if not plan:
                raise HTTPException(status_code=404, detail="Plan not found")
            current_sub = await conn.fetchrow("""
                SELECT id, plan_id FROM user_subscriptions
                WHERE user_id = $1 ORDER BY created_at DESC LIMIT 1
            """, user_id)
            if not current_sub:
                raise HTTPException(status_code=404, detail="No current subscription found")
            now = datetime.utcnow()
            period_end = now + timedelta(days=30)
            await conn.execute("""
                UPDATE user_subscriptions
                SET plan_id = $1, status = 'active',
                    current_period_start = $2, current_period_end = $3, updated_at = $2
                WHERE id = $4
            """, plan_id, now, period_end, current_sub['id'])
            await conn.execute("""
                UPDATE usage_tracking
                SET api_requests = 0, last_reset_at = $1 WHERE user_id = $2
            """, now, user_id)
            return {
                "success": True,
                "message": f"Successfully upgraded to {plan['name']}",
                "plan_id": plan_id, "plan_name": plan['name']
            }
    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Failed to upgrade plan: {str(e)}")
