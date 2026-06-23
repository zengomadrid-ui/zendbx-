"""
Redis Client for Real-Time Quota Tracking
Provides high-performance distributed counters and caching
"""
import redis.asyncio as redis
from typing import Optional, Dict, Any
import json
from datetime import datetime, timedelta
import os


class RedisClient:
    """
    Redis client for quota tracking and caching
    Handles connection pooling and error recovery
    """
    
    def __init__(self):
        self.redis: Optional[redis.Redis] = None
        self.enabled = False
        
    async def connect(self):
        """Initialize Redis connection"""
        try:
            redis_url = os.getenv("REDIS_URL", "redis://localhost:6379/0")
            self.redis = await redis.from_url(
                redis_url,
                encoding="utf-8",
                decode_responses=True,
                max_connections=50
            )
            # Test connection
            await self.redis.ping()
            self.enabled = True
            print("✅ Redis connected successfully")
        except Exception as e:
            print(f"⚠️  Redis connection failed: {e}")
            print("📊 Falling back to database-only quota tracking")
            self.enabled = False
    
    async def disconnect(self):
        """Close Redis connection"""
        if self.redis:
            await self.redis.close()
    
    # ==========================================
    # Quota Counter Operations
    # ==========================================
    
    async def increment_counter(
        self, 
        user_id: str, 
        resource_type: str,
        amount: int = 1,
        ttl: int = 2592000  # 30 days default
    ) -> int:
        """
        Increment usage counter with atomic operation
        Returns new count
        """
        if not self.enabled:
            return 0
        
        try:
            key = self._get_counter_key(user_id, resource_type)
            pipe = self.redis.pipeline()
            pipe.incrby(key, amount)
            pipe.expire(key, ttl)
            results = await pipe.execute()
            return results[0]
        except Exception as e:
            print(f"Redis increment error: {e}")
            return 0
    
    async def get_counter(
        self, 
        user_id: str, 
        resource_type: str
    ) -> int:
        """Get current counter value"""
        if not self.enabled:
            return 0
        
        try:
            key = self._get_counter_key(user_id, resource_type)
            value = await self.redis.get(key)
            return int(value) if value else 0
        except Exception as e:
            print(f"Redis get error: {e}")
            return 0
    
    async def reset_counter(
        self, 
        user_id: str, 
        resource_type: str
    ) -> bool:
        """Reset counter to zero"""
        if not self.enabled:
            return False
        
        try:
            key = self._get_counter_key(user_id, resource_type)
            await self.redis.delete(key)
            return True
        except Exception as e:
            print(f"Redis reset error: {e}")
            return False
    
    async def get_all_counters(self, user_id: str) -> Dict[str, int]:
        """Get all counters for a user"""
        if not self.enabled:
            return {}
        
        try:
            pattern = f"quota:{user_id}:*"
            keys = await self.redis.keys(pattern)
            
            if not keys:
                return {}
            
            values = await self.redis.mget(keys)
            
            result = {}
            for key, value in zip(keys, values):
                # Extract resource type from key
                resource_type = key.split(":")[-1]
                result[resource_type] = int(value) if value else 0
            
            return result
        except Exception as e:
            print(f"Redis get_all error: {e}")
            return {}
    
    # ==========================================
    # Rate Limiting (Sliding Window)
    # ==========================================
    
    async def check_rate_limit(
        self,
        user_id: str,
        resource_type: str,
        limit: int,
        window_seconds: int = 60
    ) -> tuple[bool, int]:
        """
        Check rate limit using sliding window
        Returns (allowed, current_count)
        """
        if not self.enabled:
            return True, 0
        
        try:
            key = f"ratelimit:{user_id}:{resource_type}"
            now = datetime.now().timestamp()
            window_start = now - window_seconds
            
            pipe = self.redis.pipeline()
            # Remove old entries
            pipe.zremrangebyscore(key, 0, window_start)
            # Count current entries
            pipe.zcard(key)
            # Add current request
            pipe.zadd(key, {str(now): now})
            # Set expiry
            pipe.expire(key, window_seconds)
            
            results = await pipe.execute()
            current_count = results[1]
            
            allowed = current_count < limit
            return allowed, current_count
            
        except Exception as e:
            print(f"Redis rate limit error: {e}")
            return True, 0
    
    # ==========================================
    # Caching Operations
    # ==========================================
    
    async def cache_set(
        self,
        key: str,
        value: Any,
        ttl: int = 300  # 5 minutes default
    ) -> bool:
        """Cache a value with TTL"""
        if not self.enabled:
            return False
        
        try:
            serialized = json.dumps(value, default=str)
            await self.redis.setex(key, ttl, serialized)
            return True
        except Exception as e:
            print(f"Redis cache set error: {e}")
            return False
    
    async def cache_get(self, key: str) -> Optional[Any]:
        """Get cached value"""
        if not self.enabled:
            return None
        
        try:
            value = await self.redis.get(key)
            if value:
                return json.loads(value)
            return None
        except Exception as e:
            print(f"Redis cache get error: {e}")
            return None
    
    async def cache_delete(self, key: str) -> bool:
        """Delete cached value"""
        if not self.enabled:
            return False
        
        try:
            await self.redis.delete(key)
            return True
        except Exception as e:
            print(f"Redis cache delete error: {e}")
            return False
    
    async def cache_delete_pattern(self, pattern: str) -> int:
        """Delete all keys matching pattern"""
        if not self.enabled:
            return 0
        
        try:
            keys = await self.redis.keys(pattern)
            if keys:
                return await self.redis.delete(*keys)
            return 0
        except Exception as e:
            print(f"Redis cache delete pattern error: {e}")
            return 0
    
    # ==========================================
    # Helper Methods
    # ==========================================
    
    def _get_counter_key(self, user_id: str, resource_type: str) -> str:
        """Generate counter key"""
        # Include month for automatic monthly reset
        month = datetime.now().strftime("%Y-%m")
        return f"quota:{user_id}:{month}:{resource_type}"
    
    async def sync_to_database(self, user_id: str) -> Dict[str, int]:
        """
        Get all counters for syncing to database
        Called periodically by background job
        """
        return await self.get_all_counters(user_id)
    
    async def health_check(self) -> Dict[str, Any]:
        """Check Redis health"""
        if not self.enabled:
            return {
                "status": "disabled",
                "message": "Redis not configured"
            }
        
        try:
            await self.redis.ping()
            info = await self.redis.info()
            return {
                "status": "healthy",
                "connected_clients": info.get("connected_clients", 0),
                "used_memory_human": info.get("used_memory_human", "unknown"),
                "uptime_in_seconds": info.get("uptime_in_seconds", 0)
            }
        except Exception as e:
            return {
                "status": "unhealthy",
                "error": str(e)
            }


# Singleton instance
redis_client = RedisClient()


async def get_redis_client() -> RedisClient:
    """
    Get the Redis client singleton
    Ensures connection is established
    """
    if not redis_client.enabled and redis_client.redis is None:
        await redis_client.connect()
    return redis_client
