"""
Public Authentication API v2 - Multi-Tenant
Auto-syncs users to project database after authentication
"""
from fastapi import APIRouter, HTTPException, Header, Request, status
from fastapi.responses import Response
from pydantic import BaseModel, EmailStr
from uuid import UUID, uuid4
import bcrypt
import jwt
from datetime import datetime, timedelta
import logging

from ..core.db_router import get_main_db_pool, get_project_db
from ..services.auto_table import auto_sync_user
from ..middleware.rls_context import set_rls_context

logger = logging.getLogger(__name__)

router = APIRouter()

# Request Models
class SignUpRequest(BaseModel):
    email: EmailStr
    password: str
    name: str = None

class SignInRequest(BaseModel):
    email: EmailStr
    password: str

class AuthResponse(BaseModel):
    access_token: str
    user: dict


# Helper Functions
def hash_password(password: str) -> str:
    """Hash password using bcrypt"""
    salt = bcrypt.gensalt()
    return bcrypt.hashpw(password.encode('utf-8'), salt).decode('utf-8')


def verify_password(password: str, hashed: str) -> bool:
    """Verify password against hash"""
    return bcrypt.checkpw(password.encode('utf-8'), hashed.encode('utf-8'))


async def get_project_jwt_secret(project_id: UUID) -> str:
    """Get JWT secret for project"""
    pool = await get_main_db_pool()
    async with pool.acquire() as conn:
        result = await conn.fetchval("""
            SELECT jwt_secret FROM projects WHERE id = $1
        """, project_id)
        
        if not result:
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND,
                detail="Project not found or JWT secret not configured"
            )
        
        return result


def generate_jwt(user_id: UUID, project_id: UUID, email: str, secret: str) -> str:
    """Generate JWT token"""
    payload = {
        "sub": str(user_id),
        "project_id": str(project_id),
        "email": email,
        "role": "authenticated",
        "iat": datetime.utcnow(),
        "exp": datetime.utcnow() + timedelta(days=7)
    }
    
    return jwt.encode(payload, secret, algorithm="HS256")


# Explicit OPTIONS handlers for CORS preflight
@router.options("/v1/auth/{project_id}/signup")
async def signup_options(project_id: UUID):
    """Handle CORS preflight for signup"""
    return Response(status_code=200)


@router.options("/v1/auth/{project_id}/login")
async def login_options(project_id: UUID):
    """Handle CORS preflight for login"""
    return Response(status_code=200)


@router.options("/v1/auth/{project_id}/user")
async def get_user_options(project_id: UUID):
    """Handle CORS preflight for get user"""
    return Response(status_code=200)


@router.post("/v1/auth/{project_id}/signup")
async def signup(
    project_id: UUID,
    request_data: SignUpRequest,
    authorization: str = Header(None)
):
    """
    Sign up a new user
    
    MULTI-TENANT: Automatically syncs user to project database
    """
    # Extract ANON_KEY
    if not authorization or not authorization.startswith('Bearer '):
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Missing or invalid authorization header"
        )
    
    anon_key = authorization.replace('Bearer ', '')
    
    try:
        # Get project database (validates ANON_KEY)
        project_db = await get_project_db(str(project_id), anon_key)
    except HTTPException as e:
        raise e
    
    # Get JWT secret
    jwt_secret = await get_project_jwt_secret(project_id)
    
    # Check if user already exists in project database
    async with project_db.acquire() as conn:
        # Ensure users table exists
        from ..services.auto_table import ensure_table_exists
        await ensure_table_exists(project_db, "users")

        # Service role context — signup bypasses user-level RLS
        await set_rls_context(conn, user_id=None, role='service_role')

        existing = await conn.fetchrow("""
            SELECT id FROM users WHERE email = $1
        """, request_data.email)
        
        if existing:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail="User with this email already exists"
            )
        
        # Hash password
        hashed_password = hash_password(request_data.password)
        
        # Create user in project database
        user = await conn.fetchrow("""
            INSERT INTO users (
                id, email, name, provider, metadata, created_at, last_login_at
            )
            VALUES (gen_random_uuid(), $1, $2, 'email', jsonb_build_object('password_hash', $3::text), NOW(), NOW())
            RETURNING id, email, name, provider, created_at
        """, request_data.email, request_data.name, hashed_password)
        
        logger.info(f"✅ User created in project database: {user['email']}")
        logger.info(f"   User ID: {user['id']}")
        logger.info(f"   Project ID: {project_id}")
    
    # Generate JWT
    access_token = generate_jwt(user['id'], project_id, user['email'], jwt_secret)
    
    return {
        "access_token": access_token,
        "user": {
            "id": str(user['id']),
            "email": user['email'],
            "name": user['name'],
            "provider": user['provider'],
            "created_at": user['created_at'].isoformat()
        }
    }


@router.post("/v1/auth/{project_id}/login")
async def login(
    project_id: UUID,
    request_data: SignInRequest,
    authorization: str = Header(None)
):
    """
    Log in an existing user
    
    MULTI-TENANT: Updates last_login_at in project database
    """
    # Extract ANON_KEY
    if not authorization or not authorization.startswith('Bearer '):
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Missing or invalid authorization header"
        )
    
    anon_key = authorization.replace('Bearer ', '')
    
    try:
        # Get project database (validates ANON_KEY)
        project_db = await get_project_db(str(project_id), anon_key)
    except HTTPException as e:
        raise e
    
    # Get JWT secret
    jwt_secret = await get_project_jwt_secret(project_id)
    
    # Find user and verify password
    async with project_db.acquire() as conn:
        # service_role to read user record regardless of RLS on users table
        await set_rls_context(conn, user_id=None, role='service_role')

        user = await conn.fetchrow("""
            SELECT id, email, name, provider, metadata, created_at
            FROM users
            WHERE email = $1
        """, request_data.email)
        
        if not user:
            raise HTTPException(
                status_code=status.HTTP_401_UNAUTHORIZED,
                detail="Invalid email or password"
            )
        
        # Verify password
        password_hash = user['metadata']
        # metadata may be a string (JSON) or already a dict depending on asyncpg
        if isinstance(password_hash, str):
            import json
            try:
                password_hash = json.loads(password_hash)
            except (json.JSONDecodeError, TypeError):
                password_hash = {}
        password_hash = password_hash.get('password_hash') if isinstance(password_hash, dict) else None
        if not password_hash or not verify_password(request_data.password, password_hash):
            raise HTTPException(
                status_code=status.HTTP_401_UNAUTHORIZED,
                detail="Invalid email or password"
            )

        # Set authenticated context for the update
        await set_rls_context(conn, user_id=str(user['id']), role='authenticated')
        
        # Update last_login_at
        await conn.execute("""
            UPDATE users 
            SET last_login_at = NOW(), updated_at = NOW()
            WHERE id = $1
        """, user['id'])
        
        logger.info(f"✅ User logged in: {user['email']}")
    
    # Generate JWT
    access_token = generate_jwt(user['id'], project_id, user['email'], jwt_secret)
    
    return {
        "access_token": access_token,
        "user": {
            "id": str(user['id']),
            "email": user['email'],
            "name": user['name'],
            "provider": user['provider'],
            "created_at": user['created_at'].isoformat()
        }
    }


@router.get("/v1/auth/{project_id}/user")
async def get_user(
    project_id: UUID,
    authorization: str = Header(None)
):
    """
    Get current user from JWT token
    
    MULTI-TENANT: Reads from project database
    """
    if not authorization or not authorization.startswith('Bearer '):
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Missing or invalid authorization header"
        )
    
    token = authorization.replace('Bearer ', '')
    
    # Get JWT secret
    jwt_secret = await get_project_jwt_secret(project_id)
    
    try:
        # Decode JWT
        payload = jwt.decode(token, jwt_secret, algorithms=["HS256"])
        user_id = payload.get("sub")
        
        if not user_id:
            raise HTTPException(
                status_code=status.HTTP_401_UNAUTHORIZED,
                detail="Invalid token"
            )
        
        # Get project database (using ANON_KEY from token or header)
        # For this endpoint, we'll extract from the main DB
        pool = await get_main_db_pool()
        async with pool.acquire() as conn:
            project = await conn.fetchrow("""
                SELECT database_name FROM projects WHERE id = $1
            """, project_id)
            
            if not project:
                raise HTTPException(status_code=404, detail="Project not found")
        
        # Connect to project DB directly
        from ..core.db_router import get_project_db_direct
        project_db = await get_project_db_direct(str(project_id))
        
        # Get user — inject authenticated context so auth.uid() resolves correctly
        async with project_db.acquire() as conn:
            await set_rls_context(conn, user_id=str(user_id), role='authenticated')

            user = await conn.fetchrow("""
                SELECT id, email, name, provider, avatar_url, is_active, created_at, last_login_at
                FROM users
                WHERE id = $1
            """, user_id)
            
            if not user:
                raise HTTPException(
                    status_code=status.HTTP_404_NOT_FOUND,
                    detail="User not found"
                )
        
        return {
            "id": str(user['id']),
            "email": user['email'],
            "name": user['name'],
            "provider": user['provider'],
            "avatar_url": user['avatar_url'],
            "is_active": user['is_active'],
            "created_at": user['created_at'].isoformat() if user['created_at'] else None,
            "last_login_at": user['last_login_at'].isoformat() if user['last_login_at'] else None
        }
        
    except jwt.ExpiredSignatureError:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Token expired"
        )
    except jwt.InvalidTokenError:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Invalid token"
        )
