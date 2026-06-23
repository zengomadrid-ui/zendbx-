"""
MCP Rate Limiting
Implements rate limiting for MCP requests per user and per tool
"""

import time
import logging
from typing import Dict, Optional, Tuple, Any
from dataclasses import dataclass

from app.core.redis_client import get_redis_client
from .exceptions import RateLimitError

logger = logging.getLogger(__name__)


@dataclass
class RateLimit:
    """Rate limit configuration"""
    max_requests: int
    window_seconds: int
    burst_multiplier: float = 1.5


class MCPRateLimiter:
    """
    Rate limiter for MCP operations
    Uses Redis for distributed rate limiting
    """
    
    # Default rate limits
    DEFAULT_LIMITS = {
        "user": RateLimit(max_requests=100, window_seconds=60),  # 100 req/min per user
        "tool": RateLimit(max_requests=30, window_seconds=60),   # 30 req/min per tool
        "query": RateLimit(max_requests=20, window_seconds=60),  # 20 queries/min
        "global": RateLimit(max_requests=1000, window_seconds=60)  # 1000 req/min globally
    }
    
    def __init__(self):
        self.redis = None
        self.enabled = True
        
        # In-memory fallback (if Redis unavailable)
        self._memory_counts: Dict[str, Tuple[int, float]] = {}
    
    async def initialize(self):
        """Initialize Redis connection"""
        try:
            self.redis = await get_redis_client()
            logger.info("MCPRateLimiter initialized with Redis")
        except Exception as e:
            logger.warning(f"Redis not available, using memory-based rate limiting: {str(e)}")
            self.redis = None
    
    def _get_key(self, namespace: str, identifier: str) -> str:
        """Generate rate limit key"""
        return f"mcp:ratelimit:{namespace}:{identifier}"
    
    async def _check_redis_limit(
        self,
        key: str,
        limit: RateLimit
    ) -> Tuple[bool, int, int]:
        """
        Check rate limit using Redis
        
        Returns:
            (allowed, current_count, reset_time)
        """
        if not self.redis:
            return await self._check_memory_limit(key, limit)
        
        try:
            # Use redis client's check_rate_limit method instead of direct pipeline access
            if self.redis and self.redis.enabled:
                # Use the redis client's built-in rate limiting
                current_time = int(time.time())
                
                # Extract user_id and resource from key
                # key format: mcp:ratelimit:namespace:identifier
                parts = key.split(':')
                if len(parts) >= 4:
                    user_id = ':'.join(parts[3:])
                    resource_type = parts[2]
                    
                    allowed, current_count = await self.redis.check_rate_limit(
                        user_id=user_id,
                        resource_type=resource_type,
                        limit=limit.max_requests,
                        window_seconds=limit.window_seconds
                    )
                    
                    reset_time = current_time + limit.window_seconds
                    return allowed, current_count, reset_time
                else:
                    # Fallback if key format unexpected
                    return await self._check_memory_limit(key, limit)
            else:
                return await self._check_memory_limit(key, limit)
            
        except Exception as e:
            logger.error(f"Redis rate limit check failed: {str(e)}")
            return await self._check_memory_limit(key, limit)
    
    async def _check_memory_limit(
        self,
        key: str,
        limit: RateLimit
    ) -> Tuple[bool, int, int]:
        """
        Fallback memory-based rate limiting
        
        Returns:
            (allowed, current_count, reset_time)
        """
        current_time = time.time()
        
        if key in self._memory_counts:
            count, window_start = self._memory_counts[key]
            
            # Reset if window expired
            if current_time - window_start >= limit.window_seconds:
                self._memory_counts[key] = (1, current_time)
                return True, 1, int(current_time + limit.window_seconds)
            
            # Increment count
            count += 1
            self._memory_counts[key] = (count, window_start)
            
            max_with_burst = int(limit.max_requests * limit.burst_multiplier)
            allowed = count <= max_with_burst
            reset_time = int(window_start + limit.window_seconds)
            
            return allowed, count, reset_time
        else:
            self._memory_counts[key] = (1, current_time)
            return True, 1, int(current_time + limit.window_seconds)
    
    async def check_user_limit(
        self,
        user_id: str,
        project_id: Optional[str] = None
    ) -> Tuple[bool, Dict[str, int]]:
        """
        Check per-user rate limit
        
        Args:
            user_id: User UUID
            project_id: Optional project UUID for project-specific limits
            
        Returns:
            (allowed, rate_limit_info)
        """
        if not self.enabled:
            return True, {}
        
        # Use project-specific limits if available
        key = self._get_key("user", f"{project_id}:{user_id}" if project_id else user_id)
        limit = self.DEFAULT_LIMITS["user"]
        
        allowed, current, reset = await self._check_redis_limit(key, limit)
        
        info = {
            "limit": limit.max_requests,
            "remaining": max(0, limit.max_requests - current),
            "reset": reset,
            "current": current
        }
        
        if not allowed:
            raise RateLimitError(
                f"User rate limit exceeded: {current}/{limit.max_requests} requests per {limit.window_seconds}s",
                details=info
            )
        
        return True, info
    
    async def check_tool_limit(
        self,
        user_id: str,
        tool_name: str
    ) -> Tuple[bool, Dict[str, int]]:
        """
        Check per-tool rate limit
        
        Args:
            user_id: User UUID
            tool_name: Tool name
            
        Returns:
            (allowed, rate_limit_info)
        """
        if not self.enabled:
            return True, {}
        
        key = self._get_key("tool", f"{user_id}:{tool_name}")
        limit = self.DEFAULT_LIMITS["tool"]
        
        # Special limit for query tools
        if "query" in tool_name.lower():
            limit = self.DEFAULT_LIMITS["query"]
        
        allowed, current, reset = await self._check_redis_limit(key, limit)
        
        info = {
            "limit": limit.max_requests,
            "remaining": max(0, limit.max_requests - current),
            "reset": reset,
            "current": current
        }
        
        if not allowed:
            raise RateLimitError(
                f"Tool rate limit exceeded for {tool_name}: {current}/{limit.max_requests} requests per {limit.window_seconds}s",
                details=info
            )
        
        return True, info
    
    async def check_global_limit(self, project_id: str) -> Tuple[bool, Dict[str, int]]:
        """
        Check global project rate limit
        
        Args:
            project_id: Project UUID
            
        Returns:
            (allowed, rate_limit_info)
        """
        if not self.enabled:
            return True, {}
        
        key = self._get_key("global", project_id)
        limit = self.DEFAULT_LIMITS["global"]
        
        allowed, current, reset = await self._check_redis_limit(key, limit)
        
        info = {
            "limit": limit.max_requests,
            "remaining": max(0, limit.max_requests - current),
            "reset": reset,
            "current": current
        }
        
        if not allowed:
            raise RateLimitError(
                f"Global rate limit exceeded for project: {current}/{limit.max_requests} requests per {limit.window_seconds}s",
                details=info
            )
        
        return True, info
    
    async def check_all(
        self,
        user_id: str,
        project_id: str,
        tool_name: Optional[str] = None
    ) -> Dict[str, Dict[str, int]]:
        """
        Check all applicable rate limits
        
        Args:
            user_id: User UUID
            project_id: Project UUID
            tool_name: Optional tool name
            
        Returns:
            Dict with rate limit info for all checks
        """
        rate_limits = {}
        
        # Check global limit
        _, global_info = await self.check_global_limit(project_id)
        rate_limits["global"] = global_info
        
        # Check user limit
        _, user_info = await self.check_user_limit(user_id, project_id)
        rate_limits["user"] = user_info
        
        # Check tool limit if tool specified
        if tool_name:
            _, tool_info = await self.check_tool_limit(user_id, tool_name)
            rate_limits["tool"] = tool_info
        
        return rate_limits
    
    async def get_stats(self, project_id: str) -> Dict[str, Any]:
        """Get rate limiting statistics"""
        # This would query Redis for current usage
        return {
            "enabled": self.enabled,
            "redis_available": self.redis is not None,
            "limits": {
                "user": {
                    "max_requests": self.DEFAULT_LIMITS["user"].max_requests,
                    "window_seconds": self.DEFAULT_LIMITS["user"].window_seconds
                },
                "tool": {
                    "max_requests": self.DEFAULT_LIMITS["tool"].max_requests,
                    "window_seconds": self.DEFAULT_LIMITS["tool"].window_seconds
                },
                "global": {
                    "max_requests": self.DEFAULT_LIMITS["global"].max_requests,
                    "window_seconds": self.DEFAULT_LIMITS["global"].window_seconds
                }
            }
        }
    
    def disable(self):
        """Disable rate limiting (for testing)"""
        self.enabled = False
        logger.warning("Rate limiting disabled")
    
    def enable(self):
        """Enable rate limiting"""
        self.enabled = True
        logger.info("Rate limiting enabled")


# Global rate limiter instance
_rate_limiter = None


async def get_rate_limiter() -> MCPRateLimiter:
    """Get global rate limiter instance"""
    global _rate_limiter
    
    if _rate_limiter is None:
        _rate_limiter = MCPRateLimiter()
        await _rate_limiter.initialize()
    
    return _rate_limiter
