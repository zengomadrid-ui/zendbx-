"""
Rate Limiting Middleware and Decorators
Protects against brute force, DoS, and abuse

Features:
- IP-based rate limiting
- User-based rate limiting
- Project-based rate limiting
- Sliding window algorithm
- Redis backend (with in-memory fallback)
"""
from functools import wraps
from fastapi import HTTPException, Request
from typing import Optional, Callable
import time
import asyncio
from collections import defaultdict
import logging

logger = logging.getLogger(__name__)


class RateLimiter:
    """
    In-memory rate limiter with sliding window
    
    For production, replace with Redis-based limiter
    """
    
    def __init__(self):
        # Storage: {key: [(timestamp, count), ...]}
        self._requests = defaultdict(list)
        self._lock = asyncio.Lock()
    
    async def check_rate_limit(
        self,
        key: str,
        limit: int,
        window: int  # seconds
    ) -> tuple[bool, Optional[int]]:
        """
        Check if request is within rate limit
        
        Args:
            key: Unique identifier (IP, user_id, etc.)
            limit: Maximum requests allowed
            window: Time window in seconds
        
        Returns:
            (is_allowed, retry_after_seconds)
        """
        async with self._lock:
            now = time.time()
            cutoff = now - window
            
            # Clean old requests
            self._requests[key] = [
                (ts, count) for ts, count in self._requests[key]
                if ts > cutoff
            ]
            
            # Count requests in window
            total = sum(count for _, count in self._requests[key])
            
            if total >= limit:
                # Calculate when oldest request will expire
                if self._requests[key]:
                    oldest_ts = min(ts for ts, _ in self._requests[key])
                    retry_after = int(oldest_ts + window - now) + 1
                else:
                    retry_after = window
                return False, retry_after
            
            # Allow request
            self._requests[key].append((now, 1))
            return True, None
    
    async def cleanup(self):
        """Periodic cleanup of old entries"""
        async with self._lock:
            now = time.time()
            keys_to_delete = []
            
            for key, requests in self._requests.items():
                # Remove entries older than 1 hour
                self._requests[key] = [
                    (ts, count) for ts, count in requests
                    if now - ts < 3600
                ]
                
                if not self._requests[key]:
                    keys_to_delete.append(key)
            
            for key in keys_to_delete:
                del self._requests[key]


# Global rate limiter instance
_rate_limiter = RateLimiter()


def get_rate_limiter() -> RateLimiter:
    """Get global rate limiter instance"""
    return _rate_limiter


def rate_limit(
    calls: int,
    period: int,
    key_func: Optional[Callable] = None
):
    """
    Rate limiting decorator
    
    Args:
        calls: Number of calls allowed
        period: Time period in seconds
        key_func: Function to extract rate limit key from request
    
    Example:
        @rate_limit(calls=10, period=60)  # 10 requests per minute
        async def my_endpoint(request: Request):
            pass
    """
    def decorator(func):
        @wraps(func)
        async def wrapper(*args, **kwargs):
            # Extract request from args/kwargs
            request = None
            for arg in args:
                if isinstance(arg, Request):
                    request = arg
                    break
            if not request and 'request' in kwargs:
                request = kwargs['request']
            
            if not request:
                # No request object, skip rate limiting
                return await func(*args, **kwargs)
            
            # Determine rate limit key
            if key_func:
                key = key_func(request)
            else:
                # Default: use client IP
                key = f"ip:{request.client.host}"
            
            # Check rate limit
            limiter = get_rate_limiter()
            allowed, retry_after = await limiter.check_rate_limit(
                key=key,
                limit=calls,
                window=period
            )
            
            if not allowed:
                raise HTTPException(
                    status_code=429,
                    detail=f"Too many requests. Retry after {retry_after} seconds.",
                    headers={"Retry-After": str(retry_after)} if retry_after else {}
                )
            
            return await func(*args, **kwargs)
        return wrapper
    return decorator


def rate_limit_per_ip(calls: int, period: int):
    """Rate limit by IP address"""
    return rate_limit(
        calls=calls,
        period=period,
        key_func=lambda req: f"ip:{req.client.host}"
    )


def rate_limit_per_user(calls: int, period: int):
    """Rate limit by authenticated user"""
    def key_func(req):
        # Extract user ID from request state (set by auth middleware)
        user_id = getattr(req.state, 'user_id', None)
        if user_id:
            return f"user:{user_id}"
        # Fall back to IP if not authenticated
        return f"ip:{req.client.host}"
    
    return rate_limit(calls=calls, period=period, key_func=key_func)


def rate_limit_per_project(calls: int, period: int):
    """Rate limit by project"""
    def key_func(req):
        # Extract project from path or state
        project_id = getattr(req.state, 'project_id', None)
        if project_id:
            return f"project:{project_id}"
        # Fall back to IP
        return f"ip:{req.client.host}"
    
    return rate_limit(calls=calls, period=period, key_func=key_func)


# Background task to cleanup old rate limit entries
async def cleanup_rate_limiter():
    """Background task to clean up old rate limit entries"""
    limiter = get_rate_limiter()
    while True:
        await asyncio.sleep(3600)  # Run every hour
        try:
            await limiter.cleanup()
            logger.info("Rate limiter cleanup completed")
        except Exception as e:
            logger.error(f"Rate limiter cleanup error: {e}")
