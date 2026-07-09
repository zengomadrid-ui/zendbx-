"""
Public Authentication API v2 - Multi-Tenant (Slug-Based Routing)
Uses project_slug for all public endpoints.
Auth endpoints are fully public - no API key required for signup/login.
"""
from fastapi import APIRouter, HTTPException, Header, status
from fastapi.responses import Response
from pydantic import BaseModel, EmailStr
from uuid import UUID
import bcrypt
import jwt
import json
import traceback
from datetime import datetime, timedelta
import logging

from ..core.db_router import get_main_db_pool
from ..core.routes import Routes
from ..services.project_resolver import get_project_resolver
from ..middleware.rls_context import set_rls_context

logger = logging.getLogger(__name__)

router = APIRouter()


# ── Models ────────────────────────────────────────────────────────────────────

class SignUpRequest(BaseModel):
    email: EmailStr
    password: str
    name: str = None

class SignInRequest(BaseModel):
    email: EmailStr
    password: str


# ── Helpers ───────────────────────────────────────────────────────────────────

def hash_password(password: str) -> str:
    salt = bcrypt.gensalt()
    return bcrypt.hashpw(password.encode('utf-8'), salt).decode('utf-8')


def verify_password(password: str, hashed: str) -> bool:
    return bcrypt.checkpw(password.encode('utf-8'), hashed.encode('utf-8'))


def generate_jwt(user_id, project_id: UUID, email: str, secret: str, slug: str = None) -> str:
    """Generate a user access token (role=authenticated)."""
    payload = {
        "iss": "zendbx",
        "sub": str(user_id),
        "project_id": str(project_id),
        "project_slug": slug or "",
        "email": email,
        "role": "authenticated",
        "iat": datetime.utcnow(),
        "exp": datetime.utcnow() + timedelta(days=7)
    }
    return jwt.encode(payload, secret, algorithm="HS256")


def generate_project_key_jwt(project_id: UUID, slug: str, secret: str, role: str) -> str:
    """Generate a project API key JWT (role=anon or service_role, no expiry)."""
    payload = {
        "iss": "zendbx",
        "project_id": str(project_id),
        "project_slug": slug or "",
        "role": role,  # 'anon' or 'service_role'
        "iat": datetime.utcnow(),
        # No 'exp' — project keys do not expire
    }
    return jwt.encode(payload, secret, algorithm="HS256")


def parse_metadata(metadata) -> dict:
    if isinstance(metadata, dict):
        return metadata
    if isinstance(metadata, str):
        try:
            return json.loads(metadata)
        except (json.JSONDecodeError, TypeError):
            pass
    return {}


async def get_project_by_slug(project_slug: str) -> dict:
    """Get project from main DB using slug (public identifier)."""
    pool = await get_main_db_pool()
    resolver = get_project_resolver()
    return await resolver.resolve_project(project_slug, pool)


async def get_project_info(project_id: UUID) -> dict:
    """
    DEPRECATED: Get project by UUID (internal use only).
    Public APIs should use get_project_by_slug instead.
    """
    pool = await get_main_db_pool()
    async with pool.acquire() as conn:
        row = await conn.fetchrow(
            "SELECT id, name, slug, database_name, jwt_secret FROM projects WHERE id = $1",
            project_id
        )
    if not row:
        raise HTTPException(status_code=404, detail="Project not found")
    if not row['jwt_secret']:
        raise HTTPException(status_code=500, detail="Project not configured (missing JWT secret)")
    return dict(row)


# ── CORS preflight ────────────────────────────────────────────────────────────

@router.options(Routes.AUTH_SIGNUP)
async def signup_options(project_slug: str):
    return Response(status_code=200)

@router.options(Routes.AUTH_LOGIN)
async def login_options(project_slug: str):
    return Response(status_code=200)

@router.options(Routes.AUTH_USER)
async def get_user_options(project_slug: str):
    return Response(status_code=200)


# ── Signup ────────────────────────────────────────────────────────────────────

@router.post(Routes.AUTH_SIGNUP)
async def signup(project_slug: str, request_data: SignUpRequest):
    """
    Public signup endpoint - No API key required.
    Creates user in auth.users table (Phase 1).
    Uses project_slug (public identifier).
    
    VERSION: v2.0 - Slug-based routing, no user_profiles dependency
    """
    logger.info(f"🔵 SIGNUP v2.0 EXECUTING - Slug: {project_slug}, Module: public_auth_v2.py")
    try:
        pool = await get_main_db_pool()
        resolver = get_project_resolver()
        project = await resolver.resolve_project(project_slug, pool)
        project_id = project['id']
        schema = project['database_name']

        pool = await get_main_db_pool()
        async with pool.acquire() as conn:
            # Use project schema
            await conn.execute(f'SET search_path TO "{schema}", public, auth')
            await set_rls_context(conn, user_id=None, role='service_role')

            # Ensure auth schema and auth.users table exist
            await conn.execute("CREATE SCHEMA IF NOT EXISTS auth")
            await conn.execute("""
                CREATE TABLE IF NOT EXISTS auth.users (
                    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
                    email TEXT NOT NULL,
                    username TEXT,
                    password_hash TEXT NOT NULL DEFAULT '',
                    provider TEXT NOT NULL DEFAULT 'email',
                    email_verified BOOLEAN DEFAULT FALSE,
                    is_active BOOLEAN DEFAULT TRUE,
                    avatar_url TEXT,
                    metadata JSONB DEFAULT '{}'::jsonb,
                    last_login_at TIMESTAMPTZ,
                    created_at TIMESTAMPTZ DEFAULT NOW(),
                    updated_at TIMESTAMPTZ DEFAULT NOW(),
                    CONSTRAINT auth_users_email_unique UNIQUE (email)
                )
            """)

            # Check if email already exists (case-insensitive)
            existing = await conn.fetchrow(
                "SELECT id FROM auth.users WHERE LOWER(email) = LOWER($1)", 
                request_data.email
            )
            if existing:
                raise HTTPException(
                    status_code=status.HTTP_409_CONFLICT,
                    detail="User with this email already exists"
                )

            # Hash password using bcrypt
            hashed = hash_password(request_data.password)
            
            # Insert user into auth.users
            user = await conn.fetchrow("""
                INSERT INTO auth.users (
                    email, username, password_hash, provider, 
                    email_verified, created_at, last_login_at
                )
                VALUES ($1, $2, $3, 'email', FALSE, NOW(), NOW())
                RETURNING id, email, username, provider, email_verified, created_at
            """, request_data.email, request_data.name, hashed)

            # Ensure public.users view exists for application queries
            await conn.execute("""
                CREATE OR REPLACE VIEW public.users AS
                SELECT
                    id,
                    email,
                    username,
                    provider,
                    avatar_url,
                    is_active,
                    email_verified,
                    metadata,
                    created_at,
                    updated_at,
                    last_login_at
                FROM auth.users;
            """)

            logger.info(f"✅ Signup: {user['email']} in schema '{schema}' (auth.users + public.users view)")

        # Generate JWT access token
        access_token = generate_jwt(
            user['id'], project_id, user['email'], 
            project['jwt_secret'], project.get('slug')
        )

        return {
            "access_token": access_token,
            "user": {
                "id": str(user['id']),
                "email": user['email'],
                "username": user['username'],
                "provider": user['provider'],
                "email_verified": user['email_verified'],
                "created_at": user['created_at'].isoformat()
            }
        }
        
    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"❌ Signup error for {request_data.email}: {type(e).__name__}: {str(e)}")
        logger.error(traceback.format_exc())
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Unable to create account. Please check your information and try again."
        )


# ── Login ─────────────────────────────────────────────────────────────────────

@router.post(Routes.AUTH_LOGIN)
async def login(project_slug: str, request_data: SignInRequest):
    """
    Public login endpoint - No API key required.
    Verifies credentials against auth.users table (Phase 1).
    Uses project_slug (public identifier).
    """
    try:
        project = await get_project_by_slug(project_slug)
        project_id = project['id']
        schema = project['database_name']

        pool = await get_main_db_pool()
        async with pool.acquire() as conn:
            await conn.execute(f'SET search_path TO "{schema}", public, auth')
            await set_rls_context(conn, user_id=None, role='service_role')

            # Query auth.users with case-insensitive email lookup
            user = await conn.fetchrow("""
                SELECT id, email, username, password_hash, provider, 
                       email_verified, is_active, metadata, created_at
                FROM auth.users
                WHERE LOWER(email) = LOWER($1)
            """, request_data.email)

            if not user:
                raise HTTPException(
                    status_code=status.HTTP_401_UNAUTHORIZED,
                    detail="Invalid email or password"
                )

            # Check if account is active
            if not user['is_active']:
                raise HTTPException(
                    status_code=status.HTTP_403_FORBIDDEN,
                    detail="Account is disabled. Please contact support."
                )

            # Verify password
            if not verify_password(request_data.password, user['password_hash']):
                raise HTTPException(
                    status_code=status.HTTP_401_UNAUTHORIZED,
                    detail="Invalid email or password"
                )

            # Update last_login_at
            await conn.execute("""
                UPDATE auth.users 
                SET last_login_at = NOW(), updated_at = NOW()
                WHERE id = $1
            """, user['id'])

            logger.info(f"✅ Login: {user['email']} in schema '{schema}' (auth.users)")

        # Generate JWT access token
        access_token = generate_jwt(
            user['id'], project_id, user['email'], 
            project['jwt_secret'], project.get('slug')
        )

        return {
            "access_token": access_token,
            "user": {
                "id": str(user['id']),
                "email": user['email'],
                "username": user['username'],
                "provider": user['provider'],
                "email_verified": user['email_verified'],
                "avatar_url": user.get('avatar_url'),
                "metadata": parse_metadata(user.get('metadata')),
                "created_at": user['created_at'].isoformat()
            }
        }
        
    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"❌ Login error for {request_data.email}: {type(e).__name__}: {str(e)}")
        logger.error(traceback.format_exc())
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Invalid email or password"
        )


# ── Get user ──────────────────────────────────────────────────────────────────

@router.get(Routes.AUTH_USER)
async def get_user(project_slug: str, authorization: str = Header(None)):
    """
    Get current user - Requires JWT token.
    Returns user info from auth.users (NEVER returns password_hash).
    Uses project_slug (public identifier).
    """
    if not authorization or not authorization.startswith('Bearer '):
        raise HTTPException(status_code=401, detail="Missing authorization header")

    token = authorization.removeprefix('Bearer ').strip()
    project = await get_project_by_slug(project_slug)
    schema = project['database_name']

    try:
        payload = jwt.decode(token, project['jwt_secret'], algorithms=["HS256"])
        user_id = payload.get("sub")
        if not user_id:
            raise HTTPException(status_code=401, detail="Invalid token")
    except jwt.ExpiredSignatureError:
        raise HTTPException(status_code=401, detail="Token expired")
    except jwt.InvalidTokenError:
        raise HTTPException(status_code=401, detail="Invalid token")

    pool = await get_main_db_pool()
    async with pool.acquire() as conn:
        await conn.execute(f'SET search_path TO "{schema}", public, auth')
        await set_rls_context(conn, user_id=str(user_id), role='authenticated')

        # Query auth.users - IMPORTANT: Do NOT select password_hash
        user = await conn.fetchrow("""
            SELECT id, email, username, provider, email_verified, 
                   is_active, avatar_url, metadata, created_at, last_login_at
            FROM auth.users
            WHERE id = $1
        """, user_id)

        if not user:
            raise HTTPException(
                status_code=status.HTTP_401_UNAUTHORIZED,
                detail="User not found"
            )

    return {
        "id": str(user['id']),
        "email": user['email'],
        "username": user['username'],
        "provider": user['provider'],
        "email_verified": user['email_verified'],
        "is_active": user['is_active'],
        "avatar_url": user['avatar_url'],
        "metadata": parse_metadata(user['metadata']),
        "created_at": user['created_at'].isoformat() if user['created_at'] else None,
        "last_login_at": user['last_login_at'].isoformat() if user['last_login_at'] else None
    }
