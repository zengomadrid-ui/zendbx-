"""
Public Authentication API
Endpoints for external applications to authenticate their users
"""
from fastapi import APIRouter, HTTPException, Header, status
from pydantic import BaseModel, EmailStr
from uuid import UUID, uuid4
import bcrypt
import jwt
from datetime import datetime, timedelta
from app.core.database import get_main_db_pool
import logging

# Setup logging
logger = logging.getLogger(__name__)

router = APIRouter()

# Request Models
class SignUpRequest(BaseModel):
    email: EmailStr
    password: str
    full_name: str = None

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

async def validate_api_key(project_id: UUID, api_key: str) -> bool:
    """Validate API key for project"""
    pool = await get_main_db_pool()
    async with pool.acquire() as conn:
        # Check if API key exists and belongs to project
        result = await conn.fetchrow("""
            SELECT id FROM api_keys 
            WHERE project_id = $1 
            AND encrypted_key = $2 
            AND is_active = TRUE
        """, project_id, api_key)
        return result is not None

async def get_project_jwt_secret(project_id: UUID) -> str:
    """Get JWT secret for project"""
    pool = await get_main_db_pool()
    async with pool.acquire() as conn:
        result = await conn.fetchrow("""
            SELECT jwt_secret FROM projects WHERE id = $1
        """, project_id)
        if not result or not result['jwt_secret']:
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND,
                detail="Project not found or JWT secret not configured"
            )
        return result['jwt_secret']

def generate_jwt(user_id: UUID, project_id: UUID, email: str, jwt_secret: str) -> str:
    """Generate JWT access token"""
    payload = {
        'sub': str(user_id),
        'project_id': str(project_id),
        'email': email,
        'role': 'authenticated',
        'iat': datetime.utcnow(),
        'exp': datetime.utcnow() + timedelta(hours=24)
    }
    return jwt.encode(payload, jwt_secret, algorithm='HS256')

async def sync_user_to_main_table(user_id: UUID, email: str, full_name: str, provider: str) -> dict:
    """
    Sync authenticated user to main users table and create default project if new user
    Returns: dict with 'is_new_user' and 'main_user_id'
    """
    pool = await get_main_db_pool()
    async with pool.acquire() as conn:
        try:
            logger.info(f"🔄 Syncing user to main table - ID: {user_id}, Email: {email}")
            
            # Check if user already exists in main users table
            existing_user = await conn.fetchrow("""
                SELECT id, email FROM users WHERE email = $1
            """, email)
            
            if existing_user:
                logger.info(f"✅ User already exists in main table: {existing_user['id']}")
                return {
                    'is_new_user': False,
                    'main_user_id': existing_user['id']
                }
            
            # Insert new user into main users table
            logger.info(f"📝 Inserting new user into main users table...")
            new_user = await conn.fetchrow("""
                INSERT INTO users (
                    id, email, full_name, oauth_provider, role, 
                    is_active, is_verified, created_at, updated_at
                )
                VALUES ($1, $2, $3, $4, 'user', TRUE, TRUE, NOW(), NOW())
                ON CONFLICT (id) DO NOTHING
                RETURNING id, email, full_name
            """, user_id, email, full_name or email.split('@')[0], provider)
            
            if not new_user:
                # If conflict occurred, fetch the existing user
                logger.warning(f"⚠️  Conflict occurred, fetching existing user...")
                new_user = await conn.fetchrow("""
                    SELECT id, email, full_name FROM users WHERE id = $1
                """, user_id)
            
            logger.info(f"✅ User synced to main table: {new_user['id']}")
            
            # Create default project for new user
            logger.info(f"🏗️  Creating default project for user...")
            project_name = f"{new_user['full_name']}'s Project"
            project_slug = f"project-{str(uuid4())[:8]}"
            db_name = f"proj_{str(uuid4()).replace('-', '_')[:12]}"
            
            project = await conn.fetchrow("""
                INSERT INTO projects (
                    id, user_id, name, slug, database_name,
                    status, created_at, updated_at
                )
                VALUES (
                    $1, $2, $3, $4, $5,
                    'active', NOW(), NOW()
                )
                RETURNING id, name, slug
            """, uuid4(), user_id, project_name, project_slug, db_name)
            
            logger.info(f"✅ Default project created: {project['name']} ({project['id']})")
            
            # Generate JWT secret for the project
            import secrets
            jwt_secret = secrets.token_urlsafe(32)
            
            await conn.execute("""
                UPDATE projects SET jwt_secret = $1 WHERE id = $2
            """, jwt_secret, project['id'])
            
            # Create API keys for the project
            from app.utils.jwt_keys import generate_jwt_key
            
            anon_key = generate_jwt_key(project['id'], 'anon', jwt_secret)
            service_key = generate_jwt_key(project['id'], 'service_role', jwt_secret)
            
            await conn.execute("""
                INSERT INTO api_keys (
                    id, project_id, name, key_prefix, encrypted_key,
                    key_type, role, is_active, created_at
                )
                VALUES 
                    ($1, $2, 'anon (public)', $3, $4, 'anon', 'read', TRUE, NOW()),
                    ($5, $6, 'service_role (secret)', $7, $8, 'service_role', 'admin', TRUE, NOW())
            """, 
                uuid4(), project['id'], anon_key[:20], anon_key,
                uuid4(), project['id'], service_key[:20], service_key
            )
            
            logger.info(f"✅ API keys generated for project: {project['id']}")
            
            return {
                'is_new_user': True,
                'main_user_id': new_user['id'],
                'project_id': project['id'],
                'project_name': project['name']
            }
            
        except Exception as e:
            logger.error(f"❌ Error syncing user to main table: {str(e)}")
            logger.exception(e)
            # Don't fail the auth request if sync fails
            return {
                'is_new_user': False,
                'main_user_id': user_id,
                'error': str(e)
            }

# Endpoints
@router.post("/v1/auth/{project_id}/signup")
async def signup(
    project_id: UUID,
    request: SignUpRequest,
    authorization: str = Header(None)
):
    """
    Sign up a new user to the project
    Requires: API key in Authorization header (Bearer <key>)
    
    VERSION: v1.1 - Uses unified auth service for guaranteed security
    """
    from app.services.auth_service import auth_service
    
    # Validate API key
    if not authorization or not authorization.startswith('Bearer '):
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Missing or invalid authorization header"
        )
    
    api_key = authorization.replace('Bearer ', '')
    
    if not await validate_api_key(project_id, api_key):
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Invalid API key"
        )
    
    pool = await get_main_db_pool()
    async with pool.acquire() as conn:
        # Check if user already exists
        existing = await conn.fetchrow("""
            SELECT id FROM project_users 
            WHERE project_id = $1 AND email = $2
        """, project_id, request.email)
        
        if existing:
            # Generic error - don't reveal if email exists
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail="Unable to create account. Please check your information and try again."
            )
        
        # Create user using unified auth service
        # This GUARANTEES:
        # - Password is always hashed
        # - Username is never NULL
        # - Duplicate usernames are handled
        user = await auth_service.create_user(
            conn=conn,
            email=request.email,
            password=request.password,
            name=request.full_name,
            project_id=project_id,
            provider='email'
        )
        
        user_dict = dict(user)
        logger.info(f"✅ User created via legacy endpoint: {user_dict['email']}")
        
        # Log auth event
        await conn.execute("""
            INSERT INTO project_auth_logs (
                project_id, user_email, event_type, provider, 
                success, created_at
            )
            VALUES ($1, $2, 'signup', 'email', TRUE, NOW())
        """, project_id, request.email)
        
        # Sync user to main users table and create default project
        logger.info(f"🔄 Starting user sync for: {user_dict['email']}")
        sync_result = await sync_user_to_main_table(
            user_dict['id'], 
            user_dict['email'], 
            user_dict.get('username') or user_dict.get('full_name'), 
            user_dict['provider']
        )
        logger.info(f"✅ User sync completed: {sync_result}")
        
        # Generate JWT
        jwt_secret = await get_project_jwt_secret(project_id)
        access_token = generate_jwt(user_dict['id'], project_id, user_dict['email'], jwt_secret)
        
        response_data = {
            "access_token": access_token,
            "user": {
                "id": str(user_dict['id']),
                "email": user_dict['email'],
                "full_name": user_dict.get('username') or user_dict.get('full_name'),
                "provider": user_dict['provider'],
                "created_at": user_dict['created_at'].isoformat()
            }
        }
        
        # Add project info if new user
        if sync_result.get('is_new_user'):
            response_data['new_user_project'] = {
                'project_id': str(sync_result.get('project_id')),
                'project_name': sync_result.get('project_name')
            }
        
        return response_data


@router.post("/v1/auth/{project_id}/login")
async def login(
    project_id: UUID,
    request: SignInRequest,
    authorization: str = Header(None)
):
    """
    Sign in an existing user
    Requires: API key in Authorization header (Bearer <key>)
    """
    # Validate API key
    if not authorization or not authorization.startswith('Bearer '):
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Missing or invalid authorization header"
        )
    
    api_key = authorization.replace('Bearer ', '')
    
    if not await validate_api_key(project_id, api_key):
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Invalid API key"
        )
    
    pool = await get_main_db_pool()
    async with pool.acquire() as conn:
        # Find user
        user = await conn.fetchrow("""
            SELECT id, email, full_name, provider, encrypted_password, 
                   is_active, created_at
            FROM project_users 
            WHERE project_id = $1 AND email = $2
        """, project_id, request.email)
        
        if not user:
            # Log failed attempt (don't reveal reason in log)
            await conn.execute("""
                INSERT INTO project_auth_logs (
                    project_id, user_email, event_type, provider, 
                    success, error_message, created_at
                )
                VALUES ($1, $2, 'login', 'email', FALSE, 'Authentication failed', NOW())
            """, project_id, request.email)
            
            # Generic error - don't reveal if email exists
            raise HTTPException(
                status_code=status.HTTP_401_UNAUTHORIZED,
                detail="Invalid credentials. Please check your email and password."
            )
        
        # Verify password
        if not user['encrypted_password'] or not verify_password(request.password, user['encrypted_password']):
            # Log failed attempt (don't reveal reason in log)
            await conn.execute("""
                INSERT INTO project_auth_logs (
                    project_id, user_email, event_type, provider, 
                    success, error_message, created_at
                )
                VALUES ($1, $2, 'login', 'email', FALSE, 'Authentication failed', NOW())
            """, project_id, request.email)
            
            # Generic error - don't reveal which part failed
            raise HTTPException(
                status_code=status.HTTP_401_UNAUTHORIZED,
                detail="Invalid credentials. Please check your email and password."
            )
        
        # Check if user is active
        if not user['is_active']:
            # Generic error - don't reveal account status
            raise HTTPException(
                status_code=status.HTTP_401_UNAUTHORIZED,
                detail="Invalid credentials. Please check your email and password."
            )
        
        # Update last login
        await conn.execute("""
            UPDATE project_users 
            SET last_login_at = NOW()
            WHERE id = $1
        """, user['id'])
        
        # Log successful login
        await conn.execute("""
            INSERT INTO project_auth_logs (
                project_id, project_user_id, user_email, event_type, 
                provider, success, created_at
            )
            VALUES ($1, $2, $3, 'login', 'email', TRUE, NOW())
        """, project_id, user['id'], request.email)
        
        # Generate JWT
        jwt_secret = await get_project_jwt_secret(project_id)
        access_token = generate_jwt(user['id'], project_id, user['email'], jwt_secret)
        
        return {
            "access_token": access_token,
            "user": {
                "id": str(user['id']),
                "email": user['email'],
                "full_name": user['full_name'],
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
    Requires: JWT token in Authorization header (Bearer <token>)
    """
    if not authorization or not authorization.startswith('Bearer '):
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Missing or invalid authorization header"
        )
    
    token = authorization.replace('Bearer ', '')
    
    try:
        # Get JWT secret
        jwt_secret = await get_project_jwt_secret(project_id)
        
        # Decode token
        payload = jwt.decode(token, jwt_secret, algorithms=['HS256'])
        user_id = UUID(payload['sub'])
        
        # Get user from database
        pool = await get_main_db_pool()
        async with pool.acquire() as conn:
            user = await conn.fetchrow("""
                SELECT id, email, full_name, provider, created_at, last_login_at
                FROM project_users 
                WHERE id = $1 AND project_id = $2 AND is_active = TRUE
            """, user_id, project_id)
            
            if not user:
                raise HTTPException(
                    status_code=status.HTTP_401_UNAUTHORIZED,
                    detail="Invalid authentication credentials"
                )
            
            return {
                "id": str(user['id']),
                "email": user['email'],
                "full_name": user['full_name'],
                "provider": user['provider'],
                "created_at": user['created_at'].isoformat(),
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
