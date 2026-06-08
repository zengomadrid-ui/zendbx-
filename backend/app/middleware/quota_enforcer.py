"""
Quota Enforcement Middleware - Production Ready
Checks and enforces usage quotas before request execution
Includes storage limits, query complexity, and rate limiting
"""
from fastapi import Request, HTTPException
from fastapi.responses import JSONResponse
from starlette.middleware.base import BaseHTTPMiddleware
from starlette.types import ASGIApp
from app.services.quota_service import quota_service
from app.services.storage_monitor import storage_monitor
from app.services.query_analyzer import query_analyzer
from app.core.redis_client import redis_client
import time
import uuid


class QuotaEnforcerMiddleware(BaseHTTPMiddleware):
    """
    Production-ready middleware to enforce usage quotas
    Includes API limits, storage limits, and query complexity checks
    """
    
    def __init__(self, app: ASGIApp):
        super().__init__(app)
        
        # Endpoints that should be excluded from API quota checks
        self.excluded_paths = [
            "/docs",
            "/redoc",
            "/openapi.json",
            "/api/auth/login",
            "/api/auth/register",
            "/api/auth/refresh",
            "/api/billing",  # Allow access to billing page
            "/health",
            "/metrics"
        ]
        
        # Endpoints that require specific quota checks
        self.quota_check_rules = {
            "/api/projects": "project",
            "/api/team": "team_member",
            "/api/queries/execute": "api_request",
            "/api/backups": "storage",
        }
        
        # Storage-sensitive endpoints
        self.storage_check_paths = [
            "/api/backups/create",
            "/api/imports",
            "/api/tables"
        ]
    
    async def dispatch(self, request: Request, call_next):
        """Process request and enforce quotas"""
        
        # CRITICAL: Skip for OPTIONS requests FIRST (CORS preflight)
        if request.method == "OPTIONS":
            print(f"🔵 QuotaEnforcer: Skipping OPTIONS {request.url.path}")
            return await call_next(request)
        
        # Skip quota check for excluded paths
        if self._should_skip_quota_check(request.url.path):
            return await call_next(request)
        
        # Get user ID from request (assuming it's set by auth middleware)
        user_id = self._get_user_id(request)
        
        if not user_id:
            # No user ID, skip quota check (will be handled by auth)
            return await call_next(request)
        
        try:
            # Get user's plan for limit checks
            plan = await quota_service.get_user_plan(user_id)
            if not plan:
                return await call_next(request)
            
            # 1. Check API request quota for all API calls
            if request.url.path.startswith("/api/"):
                # Rate limiting check (requests per minute)
                if redis_client.enabled:
                    allowed, current_count = await redis_client.check_rate_limit(
                        user_id,
                        "api_request",
                        limit=100,  # 100 requests per minute
                        window_seconds=60
                    )
                    
                    if not allowed:
                        return JSONResponse(
                            status_code=429,
                            content={
                                "error": "rate_limit_exceeded",
                                "message": "Too many requests. Please slow down.",
                                "retry_after": 60
                            }
                        )
                
                # Monthly quota check
                quota_check = await quota_service.check_quota(
                    user_id, 
                    "api_request",
                    amount=1
                )
                
                if not quota_check.allowed:
                    return self._quota_exceeded_response(quota_check)
                
                # Increment API request counter
                await quota_service.increment_usage(
                    user_id,
                    "api_request",
                    amount=1,
                    metadata={
                        "endpoint": request.url.path,
                        "method": request.method
                    }
                )
            
            # 2. Check storage quota for storage-sensitive operations
            if any(path in request.url.path for path in self.storage_check_paths):
                storage_warning = await storage_monitor.enforce_storage_limit(
                    user_id,
                    plan.get('database_size_limit', 0)
                )
                
                if storage_warning and 'error' in storage_warning:
                    return JSONResponse(
                        status_code=429,
                        content=storage_warning
                    )
            
            # 3. Check query complexity for SQL execution
            if "/api/queries/execute" in request.url.path and request.method == "POST":
                # Get SQL from request body
                body = await request.body()
                try:
                    import json
                    data = json.loads(body)
                    sql = data.get('sql', '')
                    
                    if sql:
                        # Check query limits
                        allowed, reason = await query_analyzer.check_query_limits(
                            user_id,
                            sql,
                            {
                                'plan_name': plan.get('name'),
                                'max_concurrent_queries': 10 if plan.get('name') == 'free' else 50
                            }
                        )
                        
                        if not allowed:
                            return JSONResponse(
                                status_code=429,
                                content={
                                    "error": "query_limit_exceeded",
                                    "message": reason,
                                    "upgrade_url": "/dashboard/billing"
                                }
                            )
                        
                        # Track query execution
                        query_id = str(uuid.uuid4())
                        await query_analyzer.track_query_execution(user_id, query_id, sql)
                        request.state.query_id = query_id
                        request.state.query_start_time = time.time()
                
                except Exception as e:
                    print(f"Error checking query: {e}")
            
            # 4. Check specific resource quotas
            resource_type = self._get_resource_type(request)
            if resource_type and request.method == "POST":
                quota_check = await quota_service.check_quota(
                    user_id,
                    resource_type,
                    amount=1
                )
                
                if not quota_check.allowed:
                    return self._quota_exceeded_response(quota_check)
            
            # Process request
            start_time = time.time()
            response = await call_next(request)
            execution_time = time.time() - start_time
            
            # 5. Post-request processing
            
            # Increment resource counter if creation was successful
            if resource_type and request.method == "POST" and response.status_code in [200, 201]:
                await quota_service.increment_usage(
                    user_id,
                    resource_type,
                    amount=1,
                    metadata={
                        "endpoint": request.url.path,
                        "method": request.method
                    }
                )
            
            # Complete query tracking
            if hasattr(request.state, 'query_id'):
                await query_analyzer.complete_query_execution(
                    user_id,
                    request.state.query_id,
                    execution_time,
                    row_count=0  # Would need to extract from response
                )
            
            # Add quota headers to response
            if request.url.path.startswith("/api/"):
                current_quota = await quota_service.check_quota(user_id, "api_request", 0)
                response.headers["X-RateLimit-Limit"] = str(current_quota.limit)
                response.headers["X-RateLimit-Remaining"] = str(current_quota.remaining)
                response.headers["X-RateLimit-Used"] = str(current_quota.current_usage)
                response.headers["X-RateLimit-Percentage"] = str(round(current_quota.percentage, 2))
            
            return response
            
        except Exception as e:
            # Log error but don't block request
            print(f"Quota enforcement error: {e}")
            return await call_next(request)
    
    def _should_skip_quota_check(self, path: str) -> bool:
        """Check if path should skip quota enforcement"""
        for excluded in self.excluded_paths:
            if path.startswith(excluded):
                return True
        return False
    
    def _get_user_id(self, request: Request) -> str:
        """Extract user ID from request"""
        # Try to get from request state (set by auth middleware)
        if hasattr(request.state, "user_id"):
            return request.state.user_id
        
        # Try to get from user object
        if hasattr(request.state, "user"):
            user = request.state.user
            if isinstance(user, dict):
                return user.get("id") or user.get("user_id")
            elif hasattr(user, "id"):
                return user.id
        
        return None
    
    def _get_resource_type(self, request: Request) -> str:
        """Determine resource type from request path"""
        path = request.url.path
        
        for pattern, resource_type in self.quota_check_rules.items():
            if pattern in path:
                return resource_type
        
        return None
    
    def _quota_exceeded_response(self, quota_check) -> JSONResponse:
        """Generate quota exceeded response"""
        
        # Get suggested plans
        suggested_plans = []
        if quota_check.suggested_plan:
            suggested_plans = [
                {
                    "name": quota_check.suggested_plan.title(),
                    "message": f"Upgrade to {quota_check.suggested_plan.title()} for higher limits"
                }
            ]
        
        return JSONResponse(
            status_code=429,
            content={
                "error": "quota_exceeded",
                "message": quota_check.message or f"You've reached your {quota_check.resource_type.replace('_', ' ')} limit",
                "resource_type": quota_check.resource_type,
                "current_usage": quota_check.current_usage,
                "limit": quota_check.limit,
                "percentage": round(quota_check.percentage, 2),
                "remaining": quota_check.remaining,
                "upgrade_required": quota_check.upgrade_required,
                "upgrade_url": "/dashboard/billing",
                "suggested_plans": suggested_plans,
                "retry_after": self._calculate_retry_after(quota_check.resource_type)
            }
        )
    
    def _calculate_retry_after(self, resource_type: str) -> int:
        """Calculate retry-after seconds based on resource type"""
        if resource_type == "api_request":
            # For API requests, suggest retry at start of next month
            from datetime import datetime
            now = datetime.now()
            next_month = now.replace(day=1, hour=0, minute=0, second=0, microsecond=0)
            if now.month == 12:
                next_month = next_month.replace(year=now.year + 1, month=1)
            else:
                next_month = next_month.replace(month=now.month + 1)
            
            return int((next_month - now).total_seconds())
        
        # For other resources, no automatic retry
        return 0


# Helper function to add quota info to response headers
def add_quota_headers(response, quota_check):
    """Add quota information to response headers"""
    response.headers["X-RateLimit-Limit"] = str(quota_check.limit)
    response.headers["X-RateLimit-Remaining"] = str(quota_check.remaining)
    response.headers["X-RateLimit-Used"] = str(quota_check.current_usage)
    response.headers["X-RateLimit-Percentage"] = str(round(quota_check.percentage, 2))
    return response
