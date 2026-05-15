"""
Query Complexity Analyzer
Detects expensive queries and enforces query limits
"""
import re
import hashlib
from typing import Dict, Any, Optional, List, Tuple
from datetime import datetime, timedelta
from app.core.redis_client import redis_client


class QueryAnalyzer:
    """
    Analyze SQL queries for complexity and cost
    """
    
    # Expensive operations
    EXPENSIVE_OPERATIONS = [
        'CROSS JOIN',
        'CARTESIAN',
        'WITHOUT INDEX',
        'FULL TABLE SCAN',
        'NESTED LOOP'
    ]
    
    # Query patterns that are expensive
    EXPENSIVE_PATTERNS = [
        r'SELECT\s+\*\s+FROM\s+\w+\s+WHERE\s+.*\s+LIKE\s+\'%',  # Leading wildcard
        r'SELECT\s+.*\s+FROM\s+\w+\s+ORDER\s+BY\s+.*\s+LIMIT\s+\d{4,}',  # Large LIMIT
        r'SELECT\s+COUNT\(\*\)\s+FROM\s+\w+\s+WHERE',  # COUNT without index
    ]
    
    def __init__(self):
        self.max_query_time = 30  # seconds
        self.max_concurrent_queries = 10
        self.max_result_rows = 10000
    
    def analyze_query_complexity(self, sql: str) -> Dict[str, Any]:
        """
        Analyze query and return complexity score
        
        Returns:
            Dict with complexity score and warnings
        """
        sql_upper = sql.upper()
        complexity_score = 0
        warnings = []
        
        # Check for expensive operations
        for operation in self.EXPENSIVE_OPERATIONS:
            if operation in sql_upper:
                complexity_score += 10
                warnings.append(f"Contains expensive operation: {operation}")
        
        # Check for expensive patterns
        for pattern in self.EXPENSIVE_PATTERNS:
            if re.search(pattern, sql_upper):
                complexity_score += 5
                warnings.append("Query pattern may be expensive")
        
        # Check for multiple JOINs
        join_count = sql_upper.count('JOIN')
        if join_count > 3:
            complexity_score += join_count * 2
            warnings.append(f"Multiple JOINs detected: {join_count}")
        
        # Check for subqueries
        subquery_count = sql_upper.count('SELECT') - 1
        if subquery_count > 0:
            complexity_score += subquery_count * 3
            warnings.append(f"Subqueries detected: {subquery_count}")
        
        # Check for DISTINCT
        if 'DISTINCT' in sql_upper:
            complexity_score += 3
            warnings.append("DISTINCT operation may be expensive")
        
        # Check for GROUP BY
        if 'GROUP BY' in sql_upper:
            complexity_score += 2
        
        # Check for ORDER BY without LIMIT
        if 'ORDER BY' in sql_upper and 'LIMIT' not in sql_upper:
            complexity_score += 5
            warnings.append("ORDER BY without LIMIT may be expensive")
        
        # Determine complexity level
        if complexity_score >= 20:
            level = "high"
        elif complexity_score >= 10:
            level = "medium"
        else:
            level = "low"
        
        return {
            "complexity_score": complexity_score,
            "complexity_level": level,
            "warnings": warnings,
            "estimated_cost": self._estimate_cost(complexity_score)
        }
    
    def _estimate_cost(self, complexity_score: int) -> str:
        """Estimate query cost"""
        if complexity_score >= 20:
            return "very_high"
        elif complexity_score >= 10:
            return "high"
        elif complexity_score >= 5:
            return "medium"
        else:
            return "low"
    
    async def check_query_limits(
        self,
        user_id: str,
        sql: str,
        plan_limits: Dict[str, Any]
    ) -> Tuple[bool, Optional[str]]:
        """
        Check if query is allowed based on plan limits
        
        Returns:
            (allowed, reason)
        """
        # Analyze complexity
        analysis = self.analyze_query_complexity(sql)
        
        # Check if high complexity queries are allowed
        if analysis['complexity_level'] == 'high':
            # Free plan users can't run high complexity queries
            if plan_limits.get('plan_name') == 'free':
                return False, "High complexity queries not allowed on Free plan"
        
        # Check concurrent queries
        concurrent = await self.get_concurrent_query_count(user_id)
        max_concurrent = plan_limits.get('max_concurrent_queries', self.max_concurrent_queries)
        
        if concurrent >= max_concurrent:
            return False, f"Maximum concurrent queries reached ({max_concurrent})"
        
        return True, None
    
    async def track_query_execution(
        self,
        user_id: str,
        query_id: str,
        sql: str
    ) -> bool:
        """
        Track query execution start
        """
        try:
            key = f"query:active:{user_id}:{query_id}"
            query_hash = hashlib.md5(sql.encode()).hexdigest()
            
            await redis_client.cache_set(
                key,
                {
                    "query_hash": query_hash,
                    "started_at": datetime.now().isoformat(),
                    "sql": sql[:200]  # Store first 200 chars
                },
                ttl=self.max_query_time + 10
            )
            return True
        except Exception as e:
            print(f"Error tracking query: {e}")
            return False
    
    async def complete_query_execution(
        self,
        user_id: str,
        query_id: str,
        execution_time: float,
        row_count: int
    ) -> bool:
        """
        Mark query as completed
        """
        try:
            key = f"query:active:{user_id}:{query_id}"
            await redis_client.cache_delete(key)
            
            # Store execution stats
            stats_key = f"query:stats:{user_id}"
            stats = await redis_client.cache_get(stats_key) or {
                "total_queries": 0,
                "total_time": 0,
                "avg_time": 0
            }
            
            stats['total_queries'] += 1
            stats['total_time'] += execution_time
            stats['avg_time'] = stats['total_time'] / stats['total_queries']
            
            await redis_client.cache_set(stats_key, stats, ttl=86400)  # 24 hours
            
            return True
        except Exception as e:
            print(f"Error completing query: {e}")
            return False
    
    async def get_concurrent_query_count(self, user_id: str) -> int:
        """
        Get number of currently running queries for user
        """
        try:
            if not redis_client.enabled:
                return 0
            
            pattern = f"query:active:{user_id}:*"
            keys = await redis_client.redis.keys(pattern)
            return len(keys)
        except Exception as e:
            print(f"Error getting concurrent queries: {e}")
            return 0
    
    async def get_long_running_queries(
        self,
        user_id: str,
        threshold_seconds: int = 10
    ) -> List[Dict[str, Any]]:
        """
        Get queries running longer than threshold
        """
        try:
            if not redis_client.enabled:
                return []
            
            pattern = f"query:active:{user_id}:*"
            keys = await redis_client.redis.keys(pattern)
            
            long_running = []
            now = datetime.now()
            
            for key in keys:
                query_data = await redis_client.cache_get(key)
                if query_data:
                    started_at = datetime.fromisoformat(query_data['started_at'])
                    duration = (now - started_at).total_seconds()
                    
                    if duration > threshold_seconds:
                        long_running.append({
                            "query_id": key.split(":")[-1],
                            "duration_seconds": duration,
                            "sql": query_data.get('sql', ''),
                            "started_at": query_data['started_at']
                        })
            
            return long_running
        except Exception as e:
            print(f"Error getting long running queries: {e}")
            return []
    
    async def kill_long_running_queries(
        self,
        user_id: str,
        max_duration: int = 30
    ) -> int:
        """
        Kill queries running longer than max_duration
        Returns count of killed queries
        """
        long_running = await self.get_long_running_queries(user_id, max_duration)
        
        killed_count = 0
        for query in long_running:
            # In production, you would actually kill the query in PostgreSQL
            # For now, just remove from tracking
            key = f"query:active:{user_id}:{query['query_id']}"
            await redis_client.cache_delete(key)
            killed_count += 1
        
        return killed_count
    
    def get_query_suggestions(self, sql: str) -> List[str]:
        """
        Provide optimization suggestions for query
        """
        suggestions = []
        sql_upper = sql.upper()
        
        # Check for SELECT *
        if re.search(r'SELECT\s+\*', sql_upper):
            suggestions.append("Consider selecting only needed columns instead of SELECT *")
        
        # Check for missing WHERE clause
        if 'SELECT' in sql_upper and 'WHERE' not in sql_upper and 'LIMIT' not in sql_upper:
            suggestions.append("Consider adding WHERE clause or LIMIT to reduce result set")
        
        # Check for leading wildcard in LIKE
        if re.search(r"LIKE\s+'%", sql_upper):
            suggestions.append("Leading wildcard in LIKE prevents index usage")
        
        # Check for OR in WHERE
        if re.search(r'WHERE.*\sOR\s', sql_upper):
            suggestions.append("Consider using IN clause instead of multiple OR conditions")
        
        # Check for NOT IN
        if 'NOT IN' in sql_upper:
            suggestions.append("Consider using NOT EXISTS instead of NOT IN for better performance")
        
        return suggestions


# Singleton instance
query_analyzer = QueryAnalyzer()
