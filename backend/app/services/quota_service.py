"""
Quota Service - Handles usage tracking and quota enforcement
Production-ready with Redis caching and real-time counters
"""
import uuid
from datetime import datetime, timedelta
from typing import Optional, Dict, Any, List
from app.core.database import get_main_db_pool
from app.core.redis_client import redis_client
from app.services.storage_monitor import storage_monitor
from app.models.quotas import (
    QuotaCheckResponse, UsageResponse, SubscriptionPlan,
    UserSubscription, UsageTracking
)


class QuotaService:
    """
    Service for managing quotas and usage tracking
    Uses Redis for real-time counters with DB fallback
    """
    
    def __init__(self):
        self.resource_types = {
            "api_request": "api_requests",
            "database": "database_size",
            "project": "projects",
            "team_member": "team_members"
        }
        self.cache_ttl = 300  # 5 minutes cache for plan data
    
    async def get_user_plan(self, user_id: str) -> Optional[Dict[str, Any]]:
        """
        Get user's current subscription plan
        Uses Redis cache for performance
        """
        # Try cache first
        cache_key = f"plan:{user_id}"
        cached = await redis_client.cache_get(cache_key)
        if cached:
            return cached
        
        # Fetch from database
        pool = await get_main_db_pool()
        async with pool.acquire() as conn:
            result = await conn.fetchrow(
                """
                SELECT 
                    sp.*,
                    us.status as subscription_status,
                    us.current_period_start,
                    us.current_period_end
                FROM user_subscriptions us
                JOIN subscription_plans sp ON us.plan_id = sp.id
                WHERE us.user_id = $1 AND us.status = 'active'
                """,
                uuid.UUID(user_id)
            )
            
            if result:
                plan_data = dict(result)
                # Cache for 5 minutes
                await redis_client.cache_set(cache_key, plan_data, self.cache_ttl)
                return plan_data
            
            return None
    
    async def get_current_usage(self, user_id: str) -> Optional[Dict[str, Any]]:
        """Get current month usage for user"""
        pool = await get_main_db_pool()
        async with pool.acquire() as conn:
            # Get current month period
            period = await conn.fetchrow(
                "SELECT * FROM get_current_month_period()"
            )
            
            # Get or create usage tracking
            result = await conn.fetchrow(
                """
                SELECT * FROM usage_tracking
                WHERE user_id = $1 
                AND period_start = $2
                """,
                uuid.UUID(user_id),
                period['period_start']
            )
            
            if not result:
                # Initialize usage tracking if not exists
                await conn.execute(
                    "SELECT initialize_usage_tracking($1)",
                    uuid.UUID(user_id)
                )
                
                # Fetch again
                result = await conn.fetchrow(
                    """
                    SELECT * FROM usage_tracking
                    WHERE user_id = $1 
                    AND period_start = $2
                    """,
                    uuid.UUID(user_id),
                    period['period_start']
                )
            
            return dict(result) if result else None
    
    async def check_quota(
        self, 
        user_id: str, 
        resource_type: str,
        amount: int = 1
    ) -> QuotaCheckResponse:
        """
        Check if user can use a resource
        Uses Redis for real-time counters
        
        Args:
            user_id: User ID
            resource_type: Type of resource (api_request, database, project, team_member)
            amount: Amount to check (default 1)
        
        Returns:
            QuotaCheckResponse with allowed status and details
        """
        # Get user's plan
        plan = await self.get_user_plan(user_id)
        if not plan:
            return QuotaCheckResponse(
                allowed=False,
                resource_type=resource_type,
                current_usage=0,
                limit=0,
                percentage=100.0,
                remaining=0,
                message="No active subscription found",
                upgrade_required=True
            )
        
        # Get current usage from Redis or DB
        current_usage = await self._get_current_usage_count(user_id, resource_type)
        
        # Special handling for storage
        if resource_type == "database":
            storage_check = await storage_monitor.check_storage_quota(
                user_id,
                plan.get('database_size_limit', 0),
                amount
            )
            return QuotaCheckResponse(
                allowed=storage_check['allowed'],
                resource_type=resource_type,
                current_usage=storage_check['current_bytes'],
                limit=storage_check['limit_bytes'],
                percentage=storage_check['percentage'],
                remaining=storage_check['remaining_bytes'],
                message=None if storage_check['allowed'] else "Storage limit exceeded",
                upgrade_required=not storage_check['allowed'],
                suggested_plan=self._suggest_plan(plan['name']) if not storage_check['allowed'] else None
            )
        
        # Map resource type to limit column
        limit_column = f"{self.resource_types[resource_type]}_limit"
        limit = plan.get(limit_column, 0)
        
        # Calculate metrics
        new_usage = current_usage + amount
        percentage = (new_usage / limit * 100) if limit > 0 else 100.0
        remaining = max(0, limit - new_usage)
        allowed = new_usage <= limit
        
        # Determine message and upgrade suggestion
        message = None
        upgrade_required = False
        suggested_plan = None
        
        if not allowed:
            message = f"You've reached your {resource_type.replace('_', ' ')} limit"
            upgrade_required = True
            suggested_plan = self._suggest_plan(plan['name'])
        elif percentage >= 80:
            message = f"You're at {percentage:.0f}% of your {resource_type.replace('_', ' ')} limit"
        
        return QuotaCheckResponse(
            allowed=allowed,
            resource_type=resource_type,
            current_usage=current_usage,
            limit=limit,
            percentage=percentage,
            remaining=remaining,
            message=message,
            upgrade_required=upgrade_required,
            suggested_plan=suggested_plan
        )
    
    async def increment_usage(
        self,
        user_id: str,
        resource_type: str,
        amount: int = 1,
        metadata: Optional[Dict] = None
    ) -> bool:
        """
        Increment usage counter for a resource
        Updates Redis immediately, syncs to DB periodically
        
        Args:
            user_id: User ID
            resource_type: Type of resource
            amount: Amount to increment
            metadata: Additional metadata to log
        
        Returns:
            True if successful
        """
        # Increment in Redis for real-time tracking
        if redis_client.enabled:
            await redis_client.increment_counter(user_id, resource_type, amount)
        
        # Also update database
        pool = await get_main_db_pool()
        async with pool.acquire() as conn:
            # Get current month period
            period = await conn.fetchrow(
                "SELECT * FROM get_current_month_period()"
            )
            
            # Map resource type to column
            usage_column = f"{self.resource_types[resource_type]}_count" if resource_type != "database" else f"{self.resource_types[resource_type]}_bytes"
            
            # Increment usage
            await conn.execute(
                f"""
                UPDATE usage_tracking
                SET {usage_column} = {usage_column} + $1,
                    updated_at = NOW()
                WHERE user_id = $2 
                AND period_start = $3
                """,
                amount,
                uuid.UUID(user_id),
                period['period_start']
            )
            
            # Log usage
            await conn.execute(
                """
                INSERT INTO usage_logs (
                    user_id, resource_type, action, amount, metadata
                ) VALUES ($1, $2, 'increment', $3, $4)
                """,
                uuid.UUID(user_id),
                resource_type,
                amount,
                metadata or {}
            )
            
            return True
    
    async def decrement_usage(
        self,
        user_id: str,
        resource_type: str,
        amount: int = 1
    ) -> bool:
        """Decrement usage counter (e.g., when deleting a project)"""
        pool = await get_main_db_pool()
        async with pool.acquire() as conn:
            period = await conn.fetchrow(
                "SELECT * FROM get_current_month_period()"
            )
            
            usage_column = f"{self.resource_types[resource_type]}_count" if resource_type != "database" else f"{self.resource_types[resource_type]}_bytes"
            
            await conn.execute(
                f"""
                UPDATE usage_tracking
                SET {usage_column} = GREATEST(0, {usage_column} - $1),
                    updated_at = NOW()
                WHERE user_id = $2 
                AND period_start = $3
                """,
                amount,
                uuid.UUID(user_id),
                period['period_start']
            )
            
            await conn.execute(
                """
                INSERT INTO usage_logs (
                    user_id, resource_type, action, amount
                ) VALUES ($1, $2, 'decrement', $3)
                """,
                uuid.UUID(user_id),
                resource_type,
                amount
            )
            
            return True
    
    async def get_usage_summary(self, user_id: str) -> UsageResponse:
        """Get complete usage summary for user"""
        plan = await self.get_user_plan(user_id)
        usage = await self.get_current_usage(user_id)
        
        if not plan or not usage:
            raise Exception("Plan or usage not found")
        
        def calc_percentage(used: int, limit: int) -> float:
            return (used / limit * 100) if limit > 0 else 0.0
        
        return UsageResponse(
            user_id=user_id,
            plan_name=plan['name'],
            plan_display_name=plan['display_name'],
            period_start=usage['period_start'],
            period_end=usage['period_end'],
            
            api_requests_used=usage['api_requests_count'],
            api_requests_limit=plan['api_requests_limit'],
            api_requests_percentage=calc_percentage(
                usage['api_requests_count'], 
                plan['api_requests_limit']
            ),
            
            database_size_used=usage['database_size_bytes'],
            database_size_limit=plan['database_size_limit'],
            database_size_percentage=calc_percentage(
                usage['database_size_bytes'],
                plan['database_size_limit']
            ),
            
            projects_used=usage['projects_count'],
            projects_limit=plan['projects_limit'],
            projects_percentage=calc_percentage(
                usage['projects_count'],
                plan['projects_limit']
            ),
            
            team_members_used=usage['team_members_count'],
            team_members_limit=plan['team_members_limit'],
            team_members_percentage=calc_percentage(
                usage['team_members_count'],
                plan['team_members_limit']
            )
        )
    
    async def reset_monthly_usage(self, user_id: str) -> bool:
        """Reset usage counters for new month"""
        pool = await get_main_db_pool()
        async with pool.acquire() as conn:
            # Initialize new month tracking
            await conn.execute(
                "SELECT initialize_usage_tracking($1)",
                uuid.UUID(user_id)
            )
            
            # Log reset
            await conn.execute(
                """
                INSERT INTO usage_logs (
                    user_id, resource_type, action, amount
                ) VALUES ($1, 'all', 'reset', 0)
                """,
                uuid.UUID(user_id)
            )
            
            return True
    
    async def _get_current_usage_count(self, user_id: str, resource_type: str) -> int:
        """
        Get current usage count from Redis or DB
        Redis is source of truth for real-time data
        """
        # Try Redis first
        if redis_client.enabled:
            count = await redis_client.get_counter(user_id, resource_type)
            if count > 0:
                return count
        
        # Fallback to database
        usage = await self.get_current_usage(user_id)
        if not usage:
            return 0
        
        usage_column = f"{self.resource_types[resource_type]}_count" if resource_type != "database" else f"{self.resource_types[resource_type]}_bytes"
        return usage.get(usage_column, 0)
    
    async def sync_redis_to_database(self, user_id: str) -> bool:
        """
        Sync Redis counters to database
        Called periodically by background job
        """
        try:
            if not redis_client.enabled:
                return False
            
            # Get all counters from Redis
            counters = await redis_client.get_all_counters(user_id)
            
            if not counters:
                return True
            
            pool = await get_main_db_pool()
            async with pool.acquire() as conn:
                period = await conn.fetchrow(
                    "SELECT * FROM get_current_month_period()"
                )
                
                # Update each counter
                for resource_type, count in counters.items():
                    if resource_type in self.resource_types.values():
                        usage_column = f"{resource_type}_count" if resource_type != "database_size" else f"{resource_type}_bytes"
                        
                        await conn.execute(
                            f"""
                            UPDATE usage_tracking
                            SET {usage_column} = $1,
                                updated_at = NOW()
                            WHERE user_id = $2
                            AND period_start = $3
                            """,
                            count,
                            uuid.UUID(user_id),
                            period['period_start']
                        )
            
            return True
        except Exception as e:
            print(f"Error syncing Redis to DB: {e}")
            return False
    
    async def invalidate_plan_cache(self, user_id: str) -> bool:
        """Invalidate cached plan data when plan changes"""
        cache_key = f"plan:{user_id}"
        return await redis_client.cache_delete(cache_key)
    
    def _suggest_plan(self, current_plan: str) -> Optional[str]:
        """Suggest next plan tier"""
        plan_hierarchy = ['free', 'pro', 'business']
        try:
            current_index = plan_hierarchy.index(current_plan)
            if current_index < len(plan_hierarchy) - 1:
                return plan_hierarchy[current_index + 1]
        except ValueError:
            pass
        return None
    
    async def get_all_plans(self) -> List[Dict[str, Any]]:
        """Get all available subscription plans"""
        pool = await get_main_db_pool()
        async with pool.acquire() as conn:
            results = await conn.fetch(
                """
                SELECT * FROM subscription_plans
                WHERE is_active = true
                ORDER BY sort_order, price_monthly
                """
            )
            return [dict(row) for row in results]


# Singleton instance
quota_service = QuotaService()
