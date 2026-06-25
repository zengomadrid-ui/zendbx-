"""
Security Management API (Admin)
Provides endpoints for security auditing and password hash analysis
"""
from fastapi import APIRouter, Depends, HTTPException, status, Request
from typing import Optional
from uuid import UUID
import json

from app.api.auth import get_current_user
from app.core.rbac import require_admin
from app.services.password_migration import password_migration_service
from app.services.audit_service import AuditService

router = APIRouter(prefix="/api/admin/security", tags=["Admin - Security"])


@router.get("/password-stats")
async def get_password_security_stats(
    current_user: dict = Depends(require_admin)  # ADMIN ONLY
):
    """
    Get password security statistics for all users.
    
    Returns information about:
    - Total users
    - Users with secure password hashes (bcrypt with 12+ rounds)
    - Users with weak hashes (MD5, SHA256, old bcrypt)
    - Breakdown by algorithm type
    - List of users needing migration
    
    ADMIN ONLY
    """
    stats = await password_migration_service.scan_weak_hashes()
    
    return {
        "summary": {
            "total_users": stats.get("total_users", 0),
            "secure_hashes": stats.get("secure_hashes", 0),
            "weak_hashes": stats.get("weak_hashes", 0),
            "security_score": round(
                (stats.get("secure_hashes", 0) / max(stats.get("total_users", 1), 1)) * 100,
                2
            )
        },
        "weak_by_algorithm": stats.get("weak_by_algorithm", {}),
        "users_needing_migration": stats.get("users_needing_migration", []),
        "recommendations": _generate_recommendations(stats)
    }


@router.post("/password-stats/force-reset/{user_id}")
async def force_user_password_reset(
    user_id: UUID,
    request: Request,
    current_user: dict = Depends(require_admin)  # ADMIN ONLY
):
    """
    Force a specific user to reset their password on next login.
    
    This is useful for users with weak password hashes that need immediate attention.
    The user will be prompted to change their password when they next log in.
    
    ADMIN ONLY
    """
    success = await password_migration_service.force_rehash_user(user_id)
    
    if not success:
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail="Failed to flag user for password reset"
        )
    
    # Log audit event
    await AuditService.log_event(
        event_type="admin_forced_password_reset",
        user_id=current_user["id"],
        event_data=json.dumps({
            "target_user_id": str(user_id),
            "reason": "weak_password_hash"
        }),
        ip_address=request.client.host,
        success=True
    )
    
    return {
        "message": "User flagged for password reset",
        "user_id": str(user_id)
    }


@router.get("/audit-log")
async def get_security_audit_log(
    event_type: Optional[str] = None,
    email: Optional[str] = None,
    limit: int = 100,
    offset: int = 0,
    current_user: dict = Depends(require_admin)  # ADMIN ONLY
):
    """
    Get security audit logs with filtering.
    
    Filter by event type (failed_login_attempt, account_locked, etc.)
    or by email address.
    
    ADMIN ONLY
    """
    from app.core.database import get_main_db_pool
    
    pool = await get_main_db_pool()
    
    conditions = []
    params = []
    param_count = 1
    
    if event_type:
        conditions.append(f"event_type = ${param_count}")
        params.append(event_type)
        param_count += 1
    
    if email:
        conditions.append(f"email ILIKE ${param_count}")
        params.append(f"%{email}%")
        param_count += 1
    
    where_clause = " AND ".join(conditions) if conditions else "TRUE"
    
    async with pool.acquire() as conn:
        logs = await conn.fetch(
            f"""
            SELECT 
                id, event_type, email, ip_address, 
                user_agent, metadata, created_at
            FROM auth_audit_log
            WHERE {where_clause}
            ORDER BY created_at DESC
            LIMIT ${param_count} OFFSET ${param_count + 1}
            """,
            *params, limit, offset
        )
        
        total = await conn.fetchval(
            f"SELECT COUNT(*) FROM auth_audit_log WHERE {where_clause}",
            *params
        )
        
        return {
            "logs": [dict(log) for log in logs],
            "total": total,
            "limit": limit,
            "offset": offset
        }


@router.get("/failed-login-stats")
async def get_failed_login_stats(
    hours: int = 24,
    current_user: dict = Depends(require_admin)  # ADMIN ONLY
):
    """
    Get statistics on failed login attempts in the last N hours.
    
    Useful for detecting brute force attacks or suspicious activity.
    
    ADMIN ONLY
    """
    from app.core.database import get_main_db_pool
    
    pool = await get_main_db_pool()
    
    async with pool.acquire() as conn:
        # Get failed login attempts
        failed_logins = await conn.fetch(
            """
            SELECT 
                email, 
                COUNT(*) as attempt_count,
                COUNT(DISTINCT ip_address) as unique_ips,
                ARRAY_AGG(DISTINCT ip_address) as ip_addresses,
                MAX(created_at) as last_attempt
            FROM auth_audit_log
            WHERE event_type = 'failed_login_attempt'
            AND created_at > NOW() - INTERVAL '1 hour' * $1
            GROUP BY email
            ORDER BY attempt_count DESC
            LIMIT 20
            """,
            hours
        )
        
        # Get locked accounts
        locked_accounts = await conn.fetch(
            """
            SELECT 
                email, 
                metadata->>'lockout_until' as lockout_until,
                created_at as locked_at
            FROM auth_audit_log
            WHERE event_type = 'account_locked'
            AND created_at > NOW() - INTERVAL '1 hour' * $1
            ORDER BY created_at DESC
            """,
            hours
        )
        
        # Get total stats
        total_failed = await conn.fetchval(
            """
            SELECT COUNT(*)
            FROM auth_audit_log
            WHERE event_type = 'failed_login_attempt'
            AND created_at > NOW() - INTERVAL '1 hour' * $1
            """,
            hours
        )
        
        return {
            "period_hours": hours,
            "total_failed_attempts": total_failed,
            "accounts_with_failures": len(failed_logins),
            "locked_accounts": len(locked_accounts),
            "top_failed_attempts": [dict(row) for row in failed_logins],
            "recently_locked": [dict(row) for row in locked_accounts]
        }


@router.get("/migration-history")
async def get_password_migration_history(
    limit: int = 50,
    offset: int = 0,
    current_user: dict = Depends(require_admin)  # ADMIN ONLY
):
    """
    Get history of automatic password hash migrations.
    
    Shows which users had their passwords automatically upgraded
    from weak hashes (MD5, SHA256, etc.) to secure bcrypt.
    
    ADMIN ONLY
    """
    from app.core.database import get_main_db_pool
    
    pool = await get_main_db_pool()
    
    async with pool.acquire() as conn:
        migrations = await conn.fetch(
            """
            SELECT 
                email,
                metadata->>'user_id' as user_id,
                metadata->>'from_algorithm' as from_algorithm,
                metadata->>'to_algorithm' as to_algorithm,
                created_at as migrated_at
            FROM auth_audit_log
            WHERE event_type = 'password_hash_migrated'
            ORDER BY created_at DESC
            LIMIT $1 OFFSET $2
            """,
            limit, offset
        )
        
        total = await conn.fetchval(
            """
            SELECT COUNT(*)
            FROM auth_audit_log
            WHERE event_type = 'password_hash_migrated'
            """
        )
        
        return {
            "migrations": [dict(row) for row in migrations],
            "total": total,
            "limit": limit,
            "offset": offset
        }


def _generate_recommendations(stats: dict) -> list[str]:
    """Generate security recommendations based on password stats"""
    recommendations = []
    
    total = stats.get("total_users", 0)
    weak = stats.get("weak_hashes", 0)
    weak_by_algo = stats.get("weak_by_algorithm", {})
    
    if total == 0:
        return ["No users found in the system"]
    
    weak_percentage = (weak / total) * 100
    
    if weak_percentage > 50:
        recommendations.append(
            "⚠️ CRITICAL: More than 50% of users have weak password hashes. "
            "Consider forcing password resets for all affected users."
        )
    elif weak_percentage > 20:
        recommendations.append(
            "⚠️ WARNING: Over 20% of users have weak password hashes. "
            "Review affected accounts and consider forcing password resets."
        )
    elif weak_percentage > 0:
        recommendations.append(
            f"ℹ️ {weak} user(s) have weak password hashes. "
            "These will be automatically upgraded when they next log in."
        )
    else:
        recommendations.append("✅ All password hashes are secure (bcrypt with 12+ rounds)")
    
    # Specific algorithm recommendations
    if "md5_crypt" in weak_by_algo:
        recommendations.append(
            f"⚠️ {weak_by_algo['md5_crypt']} user(s) with MD5 hashes. "
            "MD5 is critically weak - force immediate password reset."
        )
    
    if "sha256_crypt" in weak_by_algo or "sha512_crypt" in weak_by_algo:
        sha_count = weak_by_algo.get("sha256_crypt", 0) + weak_by_algo.get("sha512_crypt", 0)
        recommendations.append(
            f"⚠️ {sha_count} user(s) with SHA256/SHA512 hashes. "
            "These are better than MD5 but still weak by modern standards."
        )
    
    if "bcrypt_weak" in weak_by_algo:
        recommendations.append(
            f"ℹ️ {weak_by_algo['bcrypt_weak']} user(s) with old bcrypt (low cost factor). "
            "These will be automatically upgraded on next login."
        )
    
    return recommendations
