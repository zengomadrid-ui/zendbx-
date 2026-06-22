"""
Billing and Usage API Endpoints
"""
from fastapi import APIRouter, Depends, HTTPException
from typing import List, Dict, Any
from app.api.auth import get_current_user
from datetime import datetime, timedelta
from app.core.database import get_main_db_pool
from app.core.rbac import require_admin


router = APIRouter(prefix="/api/billing", tags=["billing"])


def _user_id(current_user: dict):
    """Extract user ID regardless of which get_current_user variant returned the dict."""
    uid = current_user.get("user_id") or current_user.get("id")
    if not uid:
        raise HTTPException(status_code=401, detail="Could not determine user identity")
    return uid


@router.get("/subscription")
async def get_subscription(current_user: dict = Depends(get_current_user)):
    """Get user current subscription and usage"""
    try:
        user_id = _user_id(current_user)
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
                # Return a default free plan response instead of 404
                # so the billing page renders gracefully even when no subscription row exists
                return {
                    "subscription": {
                        "id": None,
                        "user_id": str(user_id),
                        "plan_id": None,
                        "status": "active",
                        "current_period_start": None,
                        "current_period_end": None,
                        "cancel_at_period_end": False,
                        "name": "free",
                        "display_name": "Free",
                        "description": "Free tier",
                        "price_monthly": 0,
                        "price_yearly": 0,
                        "features": [],
                        "api_requests_limit": 10000,
                        "database_size_limit": 500,
                        "projects_limit": 2,
                        "team_members_limit": 1,
                        "backup_frequency": "weekly",
                    },
                    "usage": {
                        "api_requests": 0,
                        "database_size_bytes": 0,
                        "projects_count": 0,
                        "team_members_count": 0,
                        "last_reset_at": datetime.utcnow().isoformat(),
                    }
                }

            usage = await conn.fetchrow("""
                SELECT api_requests, database_size_bytes,
                       projects_count, team_members_count, last_reset_at
                FROM usage_tracking WHERE user_id = $1
            """, user_id)

            sub_dict = dict(subscription)
            # Serialize non-JSON-safe types
            for k, v in sub_dict.items():
                if hasattr(v, 'isoformat'):
                    sub_dict[k] = v.isoformat()

            usage_dict = dict(usage) if usage else {
                "api_requests": 0, "database_size_bytes": 0,
                "projects_count": 0, "team_members_count": 0,
                "last_reset_at": datetime.utcnow().isoformat(),
            }
            if usage_dict.get("last_reset_at") and hasattr(usage_dict["last_reset_at"], "isoformat"):
                usage_dict["last_reset_at"] = usage_dict["last_reset_at"].isoformat()

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
            result = []
            for plan in plans:
                p = dict(plan)
                if p.get("created_at") and hasattr(p["created_at"], "isoformat"):
                    p["created_at"] = p["created_at"].isoformat()
                result.append(p)
            return result
    except Exception as e:
        # Return empty list instead of 500 — billing page still renders
        return []


@router.post("/upgrade")
async def upgrade_plan(plan_id: str, current_user: dict = Depends(get_current_user)):
    """Upgrade user to a new plan"""
    try:
        user_id = _user_id(current_user)
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


@router.get("/free-trial-stats")
async def get_free_trial_stats(current_user: dict = Depends(require_admin)):
    """
    Admin-only: Get free trial adoption stats.
    """
    try:
        pool = await get_main_db_pool()
        async with pool.acquire() as conn:
            plan_counts = await conn.fetch("""
                SELECT
                    sp.name AS plan_name,
                    sp.display_name,
                    sp.api_requests_limit,
                    COUNT(us.user_id) AS user_count
                FROM subscription_plans sp
                LEFT JOIN user_subscriptions us
                    ON sp.id = us.plan_id AND us.status = 'active'
                GROUP BY sp.name, sp.display_name, sp.api_requests_limit
                ORDER BY sp.sort_order
            """)

            free_usage = await conn.fetchrow("""
                SELECT
                    COUNT(ut.user_id)                          AS total_free_users,
                    COALESCE(SUM(ut.api_requests_count), 0)   AS total_api_requests,
                    COALESCE(AVG(ut.api_requests_count), 0)   AS avg_api_requests,
                    COUNT(CASE
                        WHEN sp.api_requests_limit > 0
                         AND ut.api_requests_count::float / sp.api_requests_limit >= 0.9
                        THEN 1 END)                            AS near_limit_users,
                    COUNT(CASE
                        WHEN ut.api_requests_count = 0
                        THEN 1 END)                            AS inactive_users
                FROM usage_tracking ut
                JOIN user_subscriptions us  ON ut.user_id = us.user_id
                JOIN subscription_plans sp  ON us.plan_id = sp.id
                WHERE sp.name = 'free'
                  AND us.status = 'active'
            """)

            signup_trend = await conn.fetch("""
                SELECT
                    date_trunc('day', u.created_at)::date AS day,
                    COUNT(*)                              AS signups
                FROM users u
                JOIN user_subscriptions us  ON u.id = us.user_id
                JOIN subscription_plans sp  ON us.plan_id = sp.id
                WHERE sp.name = 'free'
                  AND u.created_at >= NOW() - INTERVAL '30 days'
                GROUP BY day
                ORDER BY day
            """)

            conversions = await conn.fetchval("""
                SELECT COUNT(DISTINCT us.user_id)
                FROM user_subscriptions us
                JOIN subscription_plans sp ON us.plan_id = sp.id
                WHERE sp.name != 'free'
                  AND us.status = 'active'
            """)

            return {
                "plan_distribution": [dict(row) for row in plan_counts],
                "free_plan": {
                    "total_users":        int(free_usage["total_free_users"] or 0),
                    "total_api_requests": int(free_usage["total_api_requests"] or 0),
                    "avg_api_requests":   round(float(free_usage["avg_api_requests"] or 0), 1),
                    "near_limit_users":   int(free_usage["near_limit_users"] or 0),
                    "inactive_users":     int(free_usage["inactive_users"] or 0),
                },
                "paid_users": int(conversions or 0),
                "signup_trend": [
                    {"day": str(row["day"]), "signups": row["signups"]}
                    for row in signup_trend
                ],
            }
    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Failed to fetch free trial stats: {str(e)}")
