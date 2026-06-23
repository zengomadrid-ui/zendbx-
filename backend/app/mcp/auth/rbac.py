"""
RBAC Validator
Role-Based Access Control for MCP tools
"""

from typing import List

from ..core.types import UserRole, Permission, AuthContext
from ..core.exceptions import AuthorizationError


# Role to Permission Mapping
ROLE_PERMISSIONS = {
    UserRole.OWNER: [
        # Read permissions
        Permission.READ_PROJECT,
        Permission.READ_DATABASE,
        Permission.READ_AUTH,
        Permission.READ_STORAGE,
        Permission.READ_FUNCTIONS,
        Permission.READ_DEPLOYMENT,
        # Write permissions (Phase 2+)
        Permission.WRITE_DATABASE,
        Permission.WRITE_AUTH,
        Permission.WRITE_STORAGE,
        Permission.WRITE_FUNCTIONS,
        # Admin permissions
        Permission.MANAGE_PROJECT,
        Permission.MANAGE_TEAM,
    ],
    UserRole.ADMIN: [
        # Read permissions
        Permission.READ_PROJECT,
        Permission.READ_DATABASE,
        Permission.READ_AUTH,
        Permission.READ_STORAGE,
        Permission.READ_FUNCTIONS,
        Permission.READ_DEPLOYMENT,
        # Write permissions (Phase 2+)
        Permission.WRITE_DATABASE,
        Permission.WRITE_AUTH,
        Permission.WRITE_STORAGE,
        Permission.WRITE_FUNCTIONS,
        # Limited admin
        Permission.MANAGE_TEAM,
    ],
    UserRole.DEVELOPER: [
        # Read permissions
        Permission.READ_PROJECT,
        Permission.READ_DATABASE,
        Permission.READ_AUTH,
        Permission.READ_STORAGE,
        Permission.READ_FUNCTIONS,
        Permission.READ_DEPLOYMENT,
        # Write permissions (Phase 2+)
        Permission.WRITE_DATABASE,
        Permission.WRITE_FUNCTIONS,
    ],
    UserRole.READ_ONLY: [
        # Read permissions only
        Permission.READ_PROJECT,
        Permission.READ_DATABASE,
        Permission.READ_AUTH,
        Permission.READ_STORAGE,
        Permission.READ_FUNCTIONS,
        Permission.READ_DEPLOYMENT,
    ],
}


class RBACValidator:
    """
    Validates permissions for MCP operations
    Enforces role-based access control
    """
    
    @staticmethod
    def get_permissions_for_role(role: UserRole) -> List[Permission]:
        """Get all permissions for a role"""
        return ROLE_PERMISSIONS.get(role, [])
    
    @staticmethod
    def validate_permission(
        auth_context: AuthContext,
        required_permission: Permission
    ) -> bool:
        """
        Check if auth context has required permission
        Returns True if allowed, raises exception if denied
        """
        if required_permission not in auth_context.permissions:
            raise AuthorizationError(
                f"Permission denied: {required_permission.value}",
                details={
                    "required_permission": required_permission.value,
                    "user_role": auth_context.role.value,
                    "user_permissions": [p.value for p in auth_context.permissions]
                }
            )
        
        return True
    
    @staticmethod
    def validate_permissions(
        auth_context: AuthContext,
        required_permissions: List[Permission]
    ) -> bool:
        """
        Check if auth context has all required permissions
        Returns True if allowed, raises exception if any denied
        """
        for permission in required_permissions:
            RBACValidator.validate_permission(auth_context, permission)
        
        return True
    
    @staticmethod
    def create_auth_context(
        user_id: str,
        organization_id: str,
        project_id: str,
        role: UserRole,
        session_id: str = None
    ) -> AuthContext:
        """
        Create auth context with permissions based on role
        """
        permissions = RBACValidator.get_permissions_for_role(role)
        
        return AuthContext(
            user_id=user_id,
            organization_id=organization_id,
            project_id=project_id,
            role=role,
            permissions=permissions,
            session_id=session_id
        )
