"""
Public Authentication API v2 - Multi-Tenant
Auth endpoints are PUBLIC - no API key required for signup/login
API keys are only needed for data endpoints (REST API)
"""
from fastapi import APIRouter, HTTPException, Header, Request, status
from fastapi.responses import Response
from pydantic import BaseModel, EmailStr
from uuid import UUID, uuid4
import bcrypt
import jwt
import json
from datetime import datetime, timedelta
import logging

from ..core.db_router import get_main_db_pool, get_project_db_direct
from ..services.auto_table import auto_sync_user
from ..middleware.rls_context import set_rls_context

logger = logging.getLogger(__name__)

router = APIRouter()


# ── Request Models ────────────────────────────────────────────────────────────

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


def generate_jwt(user_id: UUID, project_id: UUID, email: str, secret: str) -> str:
    payload = {
        "sub": str(user_id),
        "project_id": str(project_id),
        "email": email,
        "role": "authenticated",
        "iat": datetime.utcnow(),
        "exp": datetime.utcnow() + timedelta(days=7)
    }
    return jwt.encode(payload, secret, algorithm="HS256")


async def get_project_info(project_id: UUID) -> dict:
    """Fetch project record from main DB, raise 404 if not found."""
    pool = await get_main_db_pool()
    async with pool.acquire() as conn:
        row = await conn.fetchrow(
            "SELECT id, name, database_name, jwt_secret FROM projects WHERE id = $1",
            project_id
        )
    if not row:
        raise HTTPException(status_code=404, detail="Project not found")
    if not row['jwt_secret']:
        raise HTTPException(status_code=500, detail="Project not configured (missing JWT secret)")
    return dict(row)


def parse_metadata(metadata) -> dict:
    """Safely parse metadata field which may be str or dict."""
    if isinstance(metadata, dict):
        return metadata
    if isinstance(metadata, str):
        try:
            return json.loads(metadata)
        except (json.JSONDecodeError, TypeError):
            pass
    return {}


# ── CORS preflight handlers ───────────────────────────────────────────────────

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
    """
    Public endpoint — no API key required.
    Creates a user in the project database and returns a JWT.
    """
    project = await get_project_info(project_id)
    project_db = await get_project_db_direct(str(project_id))

    async with project_db.acquire() as conn:
        from ..services.auto_table import ensure_table_exists
        await ensure_table_exists(project_db, "users")
        await set_rls_context(conn, user_id=None, role='service_role')

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

        logger.info(f"✅ Signup: {user['email']} | project {project_id}")

    access_token = generate_jwt(user['id'], project_id, user['email'], project['jwt_secret'])

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
    """
    Public endpoint — no API key required.
    Verifies credentials and returns a JWT.
    """
    project = await get_project_info(project_id)
    project_db = await get_project_db_direct(str(project_id))

    async with project_db.acquire() as conn:
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
        logger.info(f"✅ Login: {user['email']} | project {project_id}")

    access_token = generate_jwt(user['id'], project_id, user['email'], project['jwt_secret'])

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


# ── Get current user ──────────────────────────────────────────────────────────

@router.get("/v1/auth/{project_id}/user")
async def get_user(project_id: UUID, authorization: str = Header(None)):
    """
    Requires a valid JWT in Authorization: Bearer <token>
    """
    if not authorization or not authorization.startswith('Bearer '):
        raise HTTPException(status_code=401, detail="Missing authorization header")

    token = authorization.removeprefix('Bearer ').strip()
    project = await get_project_info(project_id)

    try:
        payload = jwt.decode(token, project['jwt_secret'], algorithms=["HS256"])
        user_id = payload.get("sub")
        if not user_id:
            raise HTTPException(status_code=401, detail="Invalid token")
    except jwt.ExpiredSignatureError:
        raise HTTPException(status_code=401, detail="Token expired")
    except jwt.InvalidTokenError:
        raise HTTPException(status_code=401, detail="Invalid token")

    project_db = await get_project_db_direct(str(project_id))

    async with project_db.acquire() as conn:
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
