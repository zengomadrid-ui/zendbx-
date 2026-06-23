"""
MCP Authenticator
Validates JWT tokens and API keys
Extracts user, organization, and project context
"""

from typing import Optional, Tuple
from uuid import UUID
import asyncpg

from app.core.security import decode_access_token
from app.core.db_router import get_main_db_pool
from ..core.types import UserID, OrganizationID, ProjectID
from ..core.exceptions import AuthenticationError


class MCPAuthenticator:
    """
    Authenticates MCP requests
    Supports both JWT and API keys
    """
    
    def __init__(self):
        self.pool: Optional[asyncpg.Pool] = None
    
    async def initialize(self):
        """Initialize database connection"""
        pool = await get_main_db_pool()
        if pool is None:
            raise Exception("Failed to initialize database pool")
        self.pool = pool
        print(f"✅ MCPAuthenticator: Database pool initialized (size: {self.pool.get_size()})")
    
    async def authenticate_jwt(self, token: str) -> Tuple[UserID, OrganizationID]:
        """
        Authenticate using JWT token
        Returns (user_id, organization_id)
        """
        payload = decode_access_token(token)
        if not payload:
            raise AuthenticationError("Invalid or expired token")

        user_id_str = payload.get("sub")
        if not user_id_str:
            raise AuthenticationError("Token missing user identifier")

        try:
            user_id = UUID(user_id_str)
        except ValueError:
            raise AuthenticationError("Invalid user identifier in token")

        async with self.pool.acquire() as conn:
            user = await conn.fetchrow(
                """
                SELECT id, is_active
                FROM users
                WHERE id = $1
                """,
                user_id
            )

            if not user:
                raise AuthenticationError("User not found")

            if not user["is_active"]:
                raise AuthenticationError("User account is inactive")

            return user["id"], user["id"]
    
    async def authenticate_api_key(self, api_key: str, project_slug: str) -> Tuple[UserID, OrganizationID, ProjectID]:
        """
        Authenticate using project API key
        Returns (user_id, organization_id, project_id)
        """
        import hashlib
        
        # Hash the key
        key_hash = hashlib.sha256(api_key.encode()).hexdigest()
        
        async with self.pool.acquire() as conn:
            key_data = await conn.fetchrow(
                """
                SELECT 
                    ak.id, ak.user_id, ak.project_id, ak.is_active,
                    u.is_active as user_active, u.organization_id,
                    p.slug, p.status as project_status
                FROM api_keys ak
                JOIN users u ON ak.user_id = u.id
                JOIN projects p ON ak.project_id = p.id
                WHERE ak.key_hash = $1 AND p.slug = $2
                """,
                key_hash,
                project_slug
            )
            
            if not key_data:
                raise AuthenticationError("Invalid API key")
            
            if not key_data["is_active"]:
                raise AuthenticationError("API key is disabled")
            
            if not key_data["user_active"]:
                raise AuthenticationError("User account is inactive")
            
            if key_data["project_status"] != "active":
                raise AuthenticationError("Project is not active")
            
            # Update last_used_at
            await conn.execute(
                "UPDATE api_keys SET last_used_at = NOW() WHERE id = $1",
                key_data["id"]
            )
            
            return key_data["user_id"], key_data["organization_id"], key_data["project_id"]
    
    async def validate_token(self, authorization: Optional[str]) -> Tuple[UserID, OrganizationID]:
        """
        Validate authorization header
        Returns (user_id, organization_id)
        """
        if not authorization:
            raise AuthenticationError("Missing authorization header")

        if not authorization.startswith("Bearer "):
            raise AuthenticationError("Invalid authorization format. Expected 'Bearer <token>'")

        token = authorization[7:].strip()

        if not token:
            raise AuthenticationError("Empty authorization token")

        return await self.authenticate_jwt(token)
