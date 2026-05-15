"""
Role-Based Access Control (RBAC) Middleware
Provides decorators and dependencies for role-based authorization
"""
from fastapi import HTTPException, status, Depends
from typing import List
from app.api.auth import get_current_user


# ============================================
# ROLE CONSTANTS
# ============================================

class Role:
    ADMIN = "admin"
    USER = "user"


# ============================================
# ADMIN MIDDLEWARE
# ============================================

async def require_admin(current_user: dict = Depends(get_current_user)) -> dict:
    """
    Dependency that requires admin role
    Raises 403 Forbidden if user is not an admin
    """
    if current_user.get("role") != Role.ADMIN:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Access denied. Admin privileges required."
        )
    return current_user


# ============================================
# ROLE CHECKER
# ============================================

def require_roles(allowed_roles: List[str]):
    """
    Dependency factory that checks if user has one of the allowed roles
    
    Usage:
        @router.get("/endpoint", dependencies=[Depends(require_roles(["admin", "moderator"]))])
    """
    async def role_checker(current_user: dict = Depends(get_current_user)) -> dict:
        user_role = current_user.get("role", "user")
        
        if user_role not in allowed_roles:
            raise HTTPException(
                status_code=status.HTTP_403_FORBIDDEN,
                detail=f"Access denied. Required roles: {', '.join(allowed_roles)}"
            )
        
        return current_user
    
    return role_checker


# ============================================
# PERMISSION HELPERS
# ============================================

def is_admin(user: dict) -> bool:
    """Check if user is an admin"""
    return user.get("role") == Role.ADMIN


def can_access_all_users(user: dict) -> bool:
    """Check if user can access all users data"""
    return is_admin(user)


def can_access_all_logs(user: dict) -> bool:
    """Check if user can access all audit logs"""
    return is_admin(user)


def can_access_user_data(current_user: dict, target_user_id: str) -> bool:
    """
    Check if current user can access target user's data
    - Admins can access anyone's data
    - Users can only access their own data
    """
    if is_admin(current_user):
        return True
    
    return str(current_user.get("id")) == str(target_user_id)


# ============================================
# OWNERSHIP VALIDATOR
# ============================================

async def require_ownership_or_admin(
    resource_user_id: str,
    current_user: dict = Depends(get_current_user)
) -> dict:
    """
    Dependency that requires either:
    - User owns the resource (resource_user_id matches current_user.id)
    - User is an admin
    
    Raises 403 if neither condition is met
    """
    if not can_access_user_data(current_user, resource_user_id):
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Access denied. You can only access your own data."
        )
    
    return current_user
