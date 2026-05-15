from fastapi import APIRouter, HTTPException, Depends, status
from app.api.auth import get_current_user
from app.core.database import execute_on_main_db, execute_on_project_db
from app.services.quota_service import quota_service
from uuid import UUID
from datetime import datetime, timedelta
from typing import List, Dict, Any
import asyncpg

router = APIRouter()

# ============================================
# HELPER: Verify Project Access
# ============================================

async def verify_project_access(project_id: UUID, user_id: UUID) -> dict:
    """Verify user has access to project"""
    result = await execute_on_main_db(
        "SELECT * FROM projects WHERE id = $1 AND user_id = $2",
        project_id,
        user_id
    )
    
    if not result:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Project not found"
        )
    
    return dict(result[0])

# ============================================
# GET PERFORMANCE METRICS
# ============================================

@router.get("/projects/{project_id}/analytics/performance")
async def get_performance_metrics(
    project_id: UUID,
    current_user: dict = Depends(get_current_user)
):
    """Get real-time performance metrics for project"""
    
    project = await verify_project_access(project_id, current_user["id"])
    
    # Calculate time ranges
    now = datetime.utcnow()
    today_start = now.replace(hour=0, minute=0, second=0, microsecond=0)
    last_minute = now - timedelta(minutes=1)
    
    # Get queries per second (last minute)
    queries_last_minute = await execute_on_main_db(
        """
        SELECT COUNT(*) as count
        FROM query_history
        WHERE project_id = $1 AND created_at >= $2
        """,
        project_id,
        last_minute
    )
    queries_per_sec = round(queries_last_minute[0]["count"] / 60, 2) if queries_last_minute else 0
    
    # Get average response time (last hour)
    last_hour = now - timedelta(hours=1)
    avg_response = await execute_on_main_db(
        """
        SELECT AVG(execution_time_ms) as avg_time
        FROM query_history
        WHERE project_id = $1 AND created_at >= $2 AND status = 'success'
        """,
        project_id,
        last_hour
    )
    avg_response_time = int(avg_response[0]["avg_time"]) if avg_response and avg_response[0]["avg_time"] else 0
    
    # Get total queries today
    total_today = await execute_on_main_db(
        """
        SELECT COUNT(*) as count
        FROM query_history
        WHERE project_id = $1 AND created_at >= $2
        """,
        project_id,
        today_start
    )
    total_queries_today = total_today[0]["count"] if total_today else 0
    
    # Get slow queries count (>500ms, today)
    slow_queries = await execute_on_main_db(
        """
        SELECT COUNT(*) as count
        FROM query_history
        WHERE project_id = $1 
        AND created_at >= $2 
        AND execution_time_ms > 500
        AND status = 'success'
        """,
        project_id,
        today_start
    )
    slow_queries_count = slow_queries[0]["count"] if slow_queries else 0
    
    # Get REAL-TIME database resource usage from PostgreSQL
    try:
        # Get actual PostgreSQL stats
        db_stats = await execute_on_project_db(
            project["database_name"],
            """
            SELECT 
                (SELECT count(*) FROM pg_stat_activity WHERE datname = current_database() AND state = 'active') as active_connections,
                (SELECT count(*) FROM pg_stat_activity WHERE datname = current_database()) as total_connections,
                pg_database_size(current_database()) as db_size_bytes,
                (SELECT sum(numbackends) FROM pg_stat_database WHERE datname = current_database()) as backends,
                (SELECT count(*) FROM pg_stat_activity WHERE datname = current_database() AND wait_event_type IS NOT NULL) as waiting_queries
            """
        )
        
        active_connections = db_stats[0]["active_connections"] if db_stats else 0
        total_connections = db_stats[0]["total_connections"] if db_stats else 0
        db_size_bytes = db_stats[0]["db_size_bytes"] if db_stats else 0
        waiting_queries = db_stats[0]["waiting_queries"] if db_stats else 0
        
        # Calculate CPU usage based on active queries and waiting queries
        cpu_usage = min(100, int((active_connections + waiting_queries) * 15))
        
        # Calculate memory usage based on DB size (rough estimate)
        # Assume 1GB = 10% memory usage
        memory_usage = min(100, int((db_size_bytes / (1024 * 1024 * 1024)) * 10))
        
    except Exception as e:
        print(f"Error getting DB stats: {e}")
        active_connections = 0
        total_connections = 0
        cpu_usage = 0
        memory_usage = 0
    
    return {
        "queries_per_sec": queries_per_sec,
        "avg_response_time_ms": avg_response_time,
        "total_queries_today": total_queries_today,
        "slow_queries_count": slow_queries_count,
        "cpu_usage_percent": cpu_usage,
        "memory_usage_percent": memory_usage,
        "active_connections": active_connections,
        "total_connections": total_connections,
        "timestamp": now.isoformat()
    }

# ============================================
# GET SLOW QUERY LOG
# ============================================

@router.get("/projects/{project_id}/analytics/slow-queries")
async def get_slow_queries(
    project_id: UUID,
    limit: int = 50,
    threshold_ms: int = 500,
    current_user: dict = Depends(get_current_user)
):
    """Get slow queries log (queries taking longer than threshold)"""
    
    await verify_project_access(project_id, current_user["id"])
    
    # Get slow queries from last 24 hours
    yesterday = datetime.utcnow() - timedelta(days=1)
    
    result = await execute_on_main_db(
        """
        SELECT 
            id,
            sql_query,
            execution_time_ms,
            rows_returned,
            created_at,
            status
        FROM query_history
        WHERE project_id = $1 
        AND created_at >= $2
        AND execution_time_ms > $3
        AND status = 'success'
        ORDER BY execution_time_ms DESC
        LIMIT $4
        """,
        project_id,
        yesterday,
        threshold_ms,
        limit
    )
    
    slow_queries = []
    for row in result:
        slow_queries.append({
            "id": str(row["id"]),
            "query": row["sql_query"][:200] + "..." if len(row["sql_query"]) > 200 else row["sql_query"],
            "execution_time_ms": row["execution_time_ms"],
            "rows_examined": row["rows_returned"] or 0,
            "timestamp": row["created_at"].isoformat()
        })
    
    return {
        "slow_queries": slow_queries,
        "count": len(slow_queries),
        "threshold_ms": threshold_ms
    }

# ============================================
# GET QUERY TRENDS (for charts)
# ============================================

@router.get("/projects/{project_id}/analytics/trends")
async def get_query_trends(
    project_id: UUID,
    hours: int = 24,
    current_user: dict = Depends(get_current_user)
):
    """Get query trends over time (for charts)"""
    
    await verify_project_access(project_id, current_user["id"])
    
    start_time = datetime.utcnow() - timedelta(hours=hours)
    
    # Get queries grouped by hour
    result = await execute_on_main_db(
        """
        SELECT 
            date_trunc('hour', created_at) as hour,
            COUNT(*) as query_count,
            AVG(execution_time_ms) as avg_time,
            COUNT(CASE WHEN status = 'failed' THEN 1 END) as error_count
        FROM query_history
        WHERE project_id = $1 AND created_at >= $2
        GROUP BY hour
        ORDER BY hour
        """,
        project_id,
        start_time
    )
    
    trends = []
    for row in result:
        trends.append({
            "timestamp": row["hour"].isoformat(),
            "query_count": row["query_count"],
            "avg_response_time_ms": int(row["avg_time"]) if row["avg_time"] else 0,
            "error_count": row["error_count"]
        })
    
    return {
        "trends": trends,
        "period_hours": hours
    }


# ============================================
# GET USER QUERY STATISTICS WITH ACCOUNT TYPE
# ============================================

@router.get("/analytics/user-stats")
async def get_user_query_stats(
    current_user: dict = Depends(get_current_user)
):
    """
    Get comprehensive query execution statistics for current user
    Includes account type, usage limits, and query breakdown
    """
    
    user_id = current_user["id"]
    
    # Get user's plan information
    plan = await quota_service.get_user_plan(str(user_id))
    if not plan:
        raise HTTPException(
            status_code=404,
            detail="User subscription plan not found"
        )
    
    # Get usage information
    usage = await quota_service.get_usage_summary(str(user_id))
    
    # Calculate time ranges
    now = datetime.utcnow()
    today_start = now.replace(hour=0, minute=0, second=0, microsecond=0)
    week_start = now - timedelta(days=7)
    month_start = now - timedelta(days=30)
    
    # Get total queries executed (all time)
    total_queries = await execute_on_main_db(
        """
        SELECT COUNT(*) as count
        FROM query_history qh
        JOIN projects p ON qh.project_id = p.id
        WHERE p.user_id = $1
        """,
        user_id
    )
    total_count = total_queries[0]["count"] if total_queries else 0
    
    # Get queries today
    queries_today = await execute_on_main_db(
        """
        SELECT COUNT(*) as count
        FROM query_history qh
        JOIN projects p ON qh.project_id = p.id
        WHERE p.user_id = $1 AND qh.created_at >= $2
        """,
        user_id,
        today_start
    )
    today_count = queries_today[0]["count"] if queries_today else 0
    
    # Get queries this week
    queries_week = await execute_on_main_db(
        """
        SELECT COUNT(*) as count
        FROM query_history qh
        JOIN projects p ON qh.project_id = p.id
        WHERE p.user_id = $1 AND qh.created_at >= $2
        """,
        user_id,
        week_start
    )
    week_count = queries_week[0]["count"] if queries_week else 0
    
    # Get queries this month
    queries_month = await execute_on_main_db(
        """
        SELECT COUNT(*) as count
        FROM query_history qh
        JOIN projects p ON qh.project_id = p.id
        WHERE p.user_id = $1 AND qh.created_at >= $2
        """,
        user_id,
        month_start
    )
    month_count = queries_month[0]["count"] if queries_month else 0
    
    # Get query breakdown by status
    query_breakdown = await execute_on_main_db(
        """
        SELECT 
            status,
            COUNT(*) as count,
            AVG(execution_time_ms) as avg_time
        FROM query_history qh
        JOIN projects p ON qh.project_id = p.id
        WHERE p.user_id = $1 AND qh.created_at >= $2
        GROUP BY status
        """,
        user_id,
        month_start
    )
    
    breakdown = {
        "success": 0,
        "failed": 0,
        "avg_execution_time_ms": 0
    }
    
    for row in query_breakdown:
        if row["status"] == "success":
            breakdown["success"] = row["count"]
            breakdown["avg_execution_time_ms"] = int(row["avg_time"]) if row["avg_time"] else 0
        elif row["status"] == "failed":
            breakdown["failed"] = row["count"]
    
    # Get most active projects
    active_projects = await execute_on_main_db(
        """
        SELECT 
            p.id,
            p.name,
            COUNT(qh.id) as query_count
        FROM projects p
        LEFT JOIN query_history qh ON p.id = qh.project_id AND qh.created_at >= $2
        WHERE p.user_id = $1
        GROUP BY p.id, p.name
        ORDER BY query_count DESC
        LIMIT 5
        """,
        user_id,
        month_start
    )
    
    projects = []
    for row in active_projects:
        projects.append({
            "id": str(row["id"]),
            "name": row["name"],
            "query_count": row["query_count"]
        })
    
    # Get daily query trend (last 30 days)
    daily_trend = await execute_on_main_db(
        """
        SELECT 
            date_trunc('day', qh.created_at) as day,
            COUNT(*) as query_count
        FROM query_history qh
        JOIN projects p ON qh.project_id = p.id
        WHERE p.user_id = $1 AND qh.created_at >= $2
        GROUP BY day
        ORDER BY day
        """,
        user_id,
        month_start
    )
    
    trend_data = []
    for row in daily_trend:
        trend_data.append({
            "date": row["day"].strftime("%Y-%m-%d"),
            "count": row["query_count"]
        })
    
    return {
        "account": {
            "type": plan["name"],
            "display_name": plan["display_name"],
            "status": plan.get("subscription_status", "active")
        },
        "limits": {
            "api_requests_limit": usage.api_requests_limit,
            "api_requests_used": usage.api_requests_used,
            "api_requests_remaining": usage.api_requests_limit - usage.api_requests_used,
            "usage_percentage": round(usage.api_requests_percentage, 2)
        },
        "queries": {
            "total_all_time": total_count,
            "today": today_count,
            "this_week": week_count,
            "this_month": month_count,
            "success_count": breakdown["success"],
            "failed_count": breakdown["failed"],
            "avg_execution_time_ms": breakdown["avg_execution_time_ms"]
        },
        "top_projects": projects,
        "daily_trend": trend_data,
        "period": {
            "start": month_start.isoformat(),
            "end": now.isoformat()
        }
    }


# ============================================
# GET PLATFORM-WIDE ANALYTICS (Admin Only)
# ============================================

@router.get("/analytics/platform")
async def get_platform_analytics(
    current_user: dict = Depends(get_current_user)
):
    """
    Get platform-wide analytics showing all users' query stats by account type
    Admin only endpoint
    """
    
    # Check if user is admin
    if current_user.get("role") != "admin":
        raise HTTPException(
            status_code=403,
            detail="Admin access required"
        )
    
    # Get query stats by plan type
    stats_by_plan = await execute_on_main_db(
        """
        SELECT 
            sp.name as plan_name,
            sp.display_name,
            COUNT(DISTINCT us.user_id) as user_count,
            COUNT(qh.id) as total_queries,
            AVG(qh.execution_time_ms) as avg_execution_time,
            COUNT(CASE WHEN qh.status = 'failed' THEN 1 END) as failed_queries
        FROM subscription_plans sp
        JOIN user_subscriptions us ON sp.id = us.plan_id
        LEFT JOIN projects p ON us.user_id = p.user_id
        LEFT JOIN query_history qh ON p.id = qh.project_id 
            AND qh.created_at >= NOW() - INTERVAL '30 days'
        WHERE us.status = 'active'
        GROUP BY sp.name, sp.display_name
        ORDER BY sp.sort_order
        """
    )
    
    plan_stats = []
    for row in stats_by_plan:
        plan_stats.append({
            "plan_name": row["plan_name"],
            "display_name": row["display_name"],
            "user_count": row["user_count"],
            "total_queries": row["total_queries"] or 0,
            "avg_execution_time_ms": int(row["avg_execution_time"]) if row["avg_execution_time"] else 0,
            "failed_queries": row["failed_queries"] or 0,
            "success_rate": round(
                ((row["total_queries"] - (row["failed_queries"] or 0)) / row["total_queries"] * 100) 
                if row["total_queries"] and row["total_queries"] > 0 else 0,
                2
            )
        })
    
    # Get top users by query count
    top_users = await execute_on_main_db(
        """
        SELECT 
            u.id,
            u.email,
            sp.display_name as plan_name,
            COUNT(qh.id) as query_count
        FROM users u
        JOIN user_subscriptions us ON u.id = us.user_id
        JOIN subscription_plans sp ON us.plan_id = sp.id
        LEFT JOIN projects p ON u.id = p.user_id
        LEFT JOIN query_history qh ON p.id = qh.project_id 
            AND qh.created_at >= NOW() - INTERVAL '30 days'
        WHERE us.status = 'active'
        GROUP BY u.id, u.email, sp.display_name
        ORDER BY query_count DESC
        LIMIT 10
        """
    )
    
    top_users_list = []
    for row in top_users:
        top_users_list.append({
            "user_id": str(row["id"]),
            "email": row["email"],
            "plan": row["plan_name"],
            "query_count": row["query_count"] or 0
        })
    
    return {
        "stats_by_plan": plan_stats,
        "top_users": top_users_list,
        "period": "last_30_days"
    }
