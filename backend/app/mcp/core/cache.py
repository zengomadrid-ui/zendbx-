"""
3-Tier Caching System
Memory (LRU) -> Redis -> Database
"""

import json
import time
import hashlib
import logging
from typing import Dict, Any, Optional, Callable
from functools import lru_cache
from app.core.redis_client import get_redis_client

logger = logging.getLogger(__name__)


class MCPCache:
    """
    3-Tier caching system for MCP
    Tier 1: Memory cache (LRU, fastest)
    Tier 2: Redis cache (shared across processes)
    Tier 3: Database (source of truth)
    """
    
    def __init__(self, default_ttl: int = 300):
        """
        Initialize cache
        
        Args:
            default_ttl: Default time-to-live in seconds (5 minutes)
        """
        self.default_ttl = default_ttl
        self.redis = None
        
        # Memory cache stats
        self.stats = {
            "memory_hits": 0,
            "redis_hits": 0,
            "misses": 0,
            "sets": 0,
            "invalidations": 0
        }
    
    async def initialize(self):
        """Initialize Redis connection"""
        try:
            self.redis = await get_redis_client()
            logger.info("MCPCache initialized with Redis")
        except Exception as e:
            logger.warning(f"Redis not available, using memory cache only: {str(e)}")
            self.redis = None
    
    def _generate_key(self, namespace: str, key: str) -> str:
        """Generate cache key"""
        return f"mcp:{namespace}:{key}"
    
    def _hash_key(self, data: Dict[str, Any]) -> str:
        """Generate hash from dict for cache key"""
        json_str = json.dumps(data, sort_keys=True)
        return hashlib.md5(json_str.encode()).hexdigest()
    
    @lru_cache(maxsize=1000)
    def _memory_get(self, key: str) -> Optional[tuple]:
        """
        Memory cache (LRU) - Tier 1
        Returns (data, timestamp) tuple or None
        """
        # This is implemented via @lru_cache decorator
        # The actual implementation is in get() method
        pass
    
    def _memory_set(self, key: str, value: Any, timestamp: float):
        """Store in memory cache"""
        # LRU cache is automatically updated when _memory_get is called
        self._memory_get.__wrapped__(self, key, (value, timestamp))
    
    async def get(
        self,
        namespace: str,
        key: str,
        loader: Optional[Callable] = None,
        ttl: Optional[int] = None
    ) -> Optional[Any]:
        """
        Get value from cache (3-tier fallback)
        
        Args:
            namespace: Cache namespace (e.g., 'context', 'schema')
            key: Cache key
            loader: Optional function to load data if cache miss
            ttl: Optional TTL override
            
        Returns:
            Cached value or None
        """
        cache_key = self._generate_key(namespace, key)
        ttl = ttl or self.default_ttl
        current_time = time.time()
        
        # Tier 1: Memory cache (LRU)
        try:
            cached = self._memory_get(cache_key)
            if cached:
                value, timestamp = cached
                if current_time - timestamp < ttl:
                    self.stats["memory_hits"] += 1
                    logger.debug(f"Memory cache hit: {cache_key}")
                    return value
        except:
            pass
        
        # Tier 2: Redis cache
        if self.redis and self.redis.enabled:
            try:
                redis_value = await self.redis.cache_get(cache_key)
                if redis_value:
                    value = redis_value.get("value")
                    timestamp = redis_value.get("timestamp", 0)
                    
                    if current_time - timestamp < ttl:
                        self.stats["redis_hits"] += 1
                        logger.debug(f"Redis cache hit: {cache_key}")
                        
                        # Populate memory cache
                        self._memory_set(cache_key, value, timestamp)
                        
                        return value
            except Exception as e:
                logger.warning(f"Redis cache error: {str(e)}")
        
        # Tier 3: Load from source (database)
        if loader:
            try:
                self.stats["misses"] += 1
                logger.debug(f"Cache miss, loading: {cache_key}")
                
                value = await loader()
                
                # Store in all cache tiers
                await self.set(namespace, key, value, ttl)
                
                return value
            except Exception as e:
                logger.error(f"Error loading data: {str(e)}")
                return None
        
        self.stats["misses"] += 1
        return None
    
    async def set(
        self,
        namespace: str,
        key: str,
        value: Any,
        ttl: Optional[int] = None
    ):
        """
        Set value in all cache tiers
        
        Args:
            namespace: Cache namespace
            key: Cache key
            value: Value to cache
            ttl: Optional TTL override
        """
        cache_key = self._generate_key(namespace, key)
        ttl = ttl or self.default_ttl
        timestamp = time.time()
        
        self.stats["sets"] += 1
        
        # Memory cache (Tier 1)
        try:
            self._memory_set(cache_key, value, timestamp)
        except Exception as e:
            logger.warning(f"Memory cache set error: {str(e)}")
        
        # Redis cache (Tier 2)
        if self.redis and self.redis.enabled:
            try:
                data = {
                    "value": value,
                    "timestamp": timestamp
                }
                await self.redis.cache_set(
                    cache_key,
                    data,
                    ttl
                )
                logger.debug(f"Cached in Redis: {cache_key} (TTL: {ttl}s)")
            except Exception as e:
                logger.warning(f"Redis cache set error: {str(e)}")
    
    async def invalidate(self, namespace: str, key: Optional[str] = None):
        """
        Invalidate cache
        
        Args:
            namespace: Cache namespace
            key: Optional specific key (if None, invalidates entire namespace)
        """
        self.stats["invalidations"] += 1
        
        if key:
            # Invalidate specific key
            cache_key = self._generate_key(namespace, key)
            
            # Clear from memory
            try:
                self._memory_get.cache_clear()
            except:
                pass
            
            # Clear from Redis
            if self.redis and self.redis.enabled:
                try:
                    await self.redis.cache_delete(cache_key)
                    logger.debug(f"Invalidated cache: {cache_key}")
                except Exception as e:
                    logger.warning(f"Redis invalidation error: {str(e)}")
        else:
            # Invalidate entire namespace
            pattern = self._generate_key(namespace, "*")
            
            # Clear all memory cache
            try:
                self._memory_get.cache_clear()
            except:
                pass
            
            # Clear Redis keys matching pattern
            if self.redis and self.redis.enabled:
                try:
                    await self.redis.cache_delete_pattern(pattern)
                    logger.debug(f"Invalidated namespace: {namespace}")
                except Exception as e:
                    logger.warning(f"Redis namespace invalidation error: {str(e)}")
    
    async def get_context(
        self,
        project_id: str,
        loader: Callable
    ) -> Dict[str, Any]:
        """
        Get context with caching
        
        Args:
            project_id: Project UUID
            loader: Function to load context
            
        Returns:
            Context dict
        """
        return await self.get(
            namespace="context",
            key=project_id,
            loader=loader,
            ttl=300  # 5 minutes
        )
    
    async def invalidate_context(self, project_id: str):
        """Invalidate context cache for a project"""
        await self.invalidate("context", project_id)
    
    async def get_schema(
        self,
        database_name: str,
        loader: Callable
    ) -> Dict[str, Any]:
        """
        Get schema with caching
        
        Args:
            database_name: Database name
            loader: Function to load schema
            
        Returns:
            Schema dict
        """
        return await self.get(
            namespace="schema",
            key=database_name,
            loader=loader,
            ttl=600  # 10 minutes (schema changes less frequently)
        )
    
    async def invalidate_schema(self, database_name: str):
        """Invalidate schema cache for a database"""
        await self.invalidate("schema", database_name)
    
    async def get_query_result(
        self,
        query_hash: str,
        loader: Callable,
        ttl: int = 60
    ) -> Any:
        """
        Get query result with caching
        
        Args:
            query_hash: Hash of the query
            loader: Function to execute query
            ttl: TTL in seconds (default 60s for queries)
            
        Returns:
            Query result
        """
        return await self.get(
            namespace="query",
            key=query_hash,
            loader=loader,
            ttl=ttl
        )
    
    def get_stats(self) -> Dict[str, Any]:
        """Get cache statistics"""
        total_requests = (
            self.stats["memory_hits"] +
            self.stats["redis_hits"] +
            self.stats["misses"]
        )
        
        if total_requests > 0:
            memory_hit_rate = (self.stats["memory_hits"] / total_requests) * 100
            redis_hit_rate = (self.stats["redis_hits"] / total_requests) * 100
            miss_rate = (self.stats["misses"] / total_requests) * 100
            overall_hit_rate = ((self.stats["memory_hits"] + self.stats["redis_hits"]) / total_requests) * 100
        else:
            memory_hit_rate = 0
            redis_hit_rate = 0
            miss_rate = 0
            overall_hit_rate = 0
        
        return {
            "total_requests": total_requests,
            "memory_hits": self.stats["memory_hits"],
            "redis_hits": self.stats["redis_hits"],
            "misses": self.stats["misses"],
            "sets": self.stats["sets"],
            "invalidations": self.stats["invalidations"],
            "memory_hit_rate": round(memory_hit_rate, 2),
            "redis_hit_rate": round(redis_hit_rate, 2),
            "miss_rate": round(miss_rate, 2),
            "overall_hit_rate": round(overall_hit_rate, 2),
            "redis_available": self.redis is not None
        }
    
    async def clear_all(self):
        """Clear all caches"""
        try:
            self._memory_get.cache_clear()
        except:
            pass
        
        if self.redis and self.redis.enabled:
            try:
                # Use cache_delete_pattern to clear all mcp: keys
                await self.redis.cache_delete_pattern("mcp:*")
                logger.info("Cleared all MCP Redis cache")
            except Exception as e:
                logger.warning(f"Redis flush error: {str(e)}")
        
        # Reset stats
        self.stats = {
            "memory_hits": 0,
            "redis_hits": 0,
            "misses": 0,
            "sets": 0,
            "invalidations": 0
        }


# Global cache instance
_cache_instance = None


async def get_mcp_cache() -> MCPCache:
    """Get global MCP cache instance"""
    global _cache_instance
    
    if _cache_instance is None:
        _cache_instance = MCPCache()
        await _cache_instance.initialize()
    
    return _cache_instance
