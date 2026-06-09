"""
Public Authentication API v2 - Multi-Tenant
Uses PostgreSQL schemas (same as the rest of the system - NOT separate databases).
Auth endpoints are fully public - no API key required for signup/login.
"""
from fastapi import APIRouter, HTTPException, Header, status
from fastapi.responses import Response
from pydantic import BaseModel, EmailStr
from uuid import UUID
import bcrypt
import jwt
import json
from datetime import datetime, timedelta
import logging

from ..core.db_router import get_main_db_pool
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


async def get_project_info(project_id: UUID) -> dict:
    """Get project from main DB."""
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

@router.options("/v1/auth/{project_id}/signup")
async def signup_options(project_id: UUID):
    return Response(status_code=200)

@router.options("/v1/auth/{project_id}/login")
async def login_options(project_id: UUID):
    return Response(status_code=200)

@router.options("/v1/auth/{project_id}/user")
async def get_user_options(project_id: UUID):
    return Response(status_code=200)


# ── Signup ────────────────────────────────────────────────────────────────────

@router.post("/v1/auth/{project_id}/signup")
async def signup(project_id: UUID, request_data: SignUpRequest):
    """Public — no API key needed. Creates user in project schema."""
    project = await get_project_info(project_id)
    schema = project['database_name']

    pool = await get_main_db_pool()
    async with pool.acquire() as conn:
        # Use project schema
        await conn.execute(f'SET search_path TO "{schema}", public')
        await set_rls_context(conn, user_id=None, role='service_role')

        # Ensure users table exists with correct schema
        await conn.execute("""
            CREATE TABLE IF NOT EXISTS users (
                id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
                email VARCHAR(255) UNIQUE NOT NULL,
                name VARCHAR(255),
                provider VARCHAR(50) DEFAULT 'email',
                avatar_url TEXT,
                is_active BOOLEAN DEFAULT TRUE,
                metadata JSONB DEFAULT '{}',
                created_at TIMESTAMPTZ DEFAULT NOW(),
                updated_at TIMESTAMPTZ DEFAULT NOW(),
                last_login_at TIMESTAMPTZ
            )
        """)
        # Add missing columns for existing tables (safe, idempotent)
        for col_sql in [
            "ALTER TABLE users ADD COLUMN IF NOT EXISTS name VARCHAR(255)",
            "ALTER TABLE users ADD COLUMN IF NOT EXISTS provider VARCHAR(50) DEFAULT 'email'",
            "ALTER TABLE users ADD COLUMN IF NOT EXISTS avatar_url TEXT",
            "ALTER TABLE users ADD COLUMN IF NOT EXISTS is_active BOOLEAN DEFAULT TRUE",
            "ALTER TABLE users ADD COLUMN IF NOT EXISTS metadata JSONB DEFAULT '{}'",
            "ALTER TABLE users ADD COLUMN IF NOT EXISTS updated_at TIMESTAMPTZ DEFAULT NOW()",
            "ALTER TABLE users ADD COLUMN IF NOT EXISTS last_login_at TIMESTAMPTZ",
        ]:
            try:
                await conn.execute(col_sql)
            except Exception:
                pass  # Column already exists

        existing = await conn.fetchrow("SELECT id FROM users WHERE email = $1", request_data.email)
        if existing:
            raise HTTPException(status_code=400, detail="User with this email already exists")

        hashed = hash_password(request_data.password)
        user = await conn.fetchrow("""
            INSERT INTO users (id, email, name, provider, metadata, created_at, last_login_at)
            VALUES (gen_random_uuid(), $1, $2, 'email',
                    jsonb_build_object('password_hash', $3::text), NOW(), NOW())
            RETURNING id, email, name, provider, created_at
        """, request_data.email, request_data.name or request_data.email.split('@')[0], hashed)

        logger.info(f"✅ Signup: {user['email']} in schema '{schema}'")

    access_token = generate_jwt(user['id'], project_id, user['email'], project['jwt_secret'], project.get('slug'))

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


# ── Login ─────────────────────────────────────────────────────────────────────

@router.post("/v1/auth/{project_id}/login")
async def login(project_id: UUID, request_data: SignInRequest):
    """Public — no API key needed. Verifies credentials against project schema."""
    project = await get_project_info(project_id)
    schema = project['database_name']

    pool = await get_main_db_pool()
    async with pool.acquire() as conn:
        await conn.execute(f'SET search_path TO "{schema}", public')
        await set_rls_context(conn, user_id=None, role='service_role')

        user = await conn.fetchrow("""
            SELECT id, email, name, provider, metadata, created_at
            FROM users WHERE email = $1
        """, request_data.email)

        if not user:
            raise HTTPException(status_code=401, detail="Invalid email or password")

        metadata = parse_metadata(user['metadata'])
        password_hash = metadata.get('password_hash')

        if not password_hash or not verify_password(request_data.password, password_hash):
            raise HTTPException(status_code=401, detail="Invalid email or password")

        await set_rls_context(conn, user_id=str(user['id']), role='authenticated')
        await conn.execute(
            "UPDATE users SET last_login_at = NOW(), updated_at = NOW() WHERE id = $1",
            user['id']
        )
        logger.info(f"✅ Login: {user['email']} in schema '{schema}'")

    access_token = generate_jwt(user['id'], project_id, user['email'], project['jwt_secret'], project.get('slug'))

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


# ── Get user ──────────────────────────────────────────────────────────────────

@router.get("/v1/auth/{project_id}/user")
async def get_user(project_id: UUID, authorization: str = Header(None)):
    """Requires JWT token from login/signup."""
    if not authorization or not authorization.startswith('Bearer '):
        raise HTTPException(status_code=401, detail="Missing authorization header")

    token = authorization.removeprefix('Bearer ').strip()
    project = await get_project_info(project_id)
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
        await conn.execute(f'SET search_path TO "{schema}", public')
        await set_rls_context(conn, user_id=str(user_id), role='authenticated')

        user = await conn.fetchrow("""
            SELECT id, email, name, provider, avatar_url, is_active, created_at, last_login_at
            FROM users WHERE id = $1
        """, user_id)

        if not user:
            raise HTTPException(status_code=404, detail="User not found")

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
