from datetime import datetime, timedelta
from typing import Optional, Union
from jose import JWTError, jwt
from passlib.context import CryptContext
from app.core.config import settings

pwd_context = CryptContext(schemes=["bcrypt"], deprecated="auto")

def verify_password(plain_password: str, hashed_password: str) -> bool:
    """Verify a password against a hash"""
    return pwd_context.verify(plain_password, hashed_password)

def get_password_hash(password: str) -> str:
    """Hash a password"""
    return pwd_context.hash(password)

def hash_password(password: str) -> str:
    """Alias for get_password_hash"""
    return get_password_hash(password)

def create_access_token(subject: Union[str, dict], expires_delta: Optional[timedelta] = None) -> str:
    """Create JWT access token - accepts either user_id string or data dict"""
    if isinstance(subject, str):
        to_encode = {"sub": subject}
    else:
        to_encode = subject.copy()
    
    if expires_delta:
        expire = datetime.utcnow() + expires_delta
    else:
        expire = datetime.utcnow() + timedelta(minutes=settings.ACCESS_TOKEN_EXPIRE_MINUTES)
    
    to_encode.update({"exp": expire})
    encoded_jwt = jwt.encode(to_encode, settings.SECRET_KEY, algorithm=settings.ALGORITHM)
    return encoded_jwt

def decode_access_token(token: str) -> Optional[dict]:
    """Decode JWT access token"""
    try:
        payload = jwt.decode(token, settings.SECRET_KEY, algorithms=[settings.ALGORITHM])
        return payload
    except JWTError:
        return None

def decode_token(token: str) -> dict:
    """Decode JWT token - raises error if invalid"""
    payload = decode_access_token(token)
    if not payload:
        raise ValueError("Invalid token")
    return payload

def validate_sql_query(sql: str) -> tuple[bool, Optional[str]]:
    """
    Validate SQL query for security
    Returns: (is_valid, error_message)
    """
    sql_upper = sql.upper().strip()
    
    # List of dangerous keywords
    dangerous_keywords = [
        'DROP', 'DELETE', 'TRUNCATE', 'ALTER', 'CREATE USER',
        'GRANT', 'REVOKE', 'EXECUTE', 'INSERT', 'UPDATE'
    ]
    
    # Check for dangerous keywords
    for keyword in dangerous_keywords:
        if keyword in sql_upper:
            return False, f"Query contains forbidden keyword: {keyword}"
    
    # Must be a SELECT query
    if not sql_upper.startswith('SELECT'):
        return False, "Only SELECT queries are allowed"
    
    # Check for multiple statements (SQL injection attempt)
    if ';' in sql and not sql.strip().endswith(';'):
        return False, "Multiple SQL statements are not allowed"
    
    return True, None

# ============================================
# API KEY AUTHENTICATION
# ============================================

import hashlib
from fastapi import Header, HTTPException, status, Depends
from ..models.schemas import UserResponse

async def verify_api_key(x_api_key: str = Header(...)) -> dict:
    """
    Verify API key and return associated user and project info
    Used for external API access (auto-generated endpoints)
    """
    from .database import get_main_db_pool
    
    # Hash the provided key
    key_hash = hashlib.sha256(x_api_key.encode()).hexdigest()
    
    pool = await get_main_db_pool()
    async with pool.acquire() as conn:
        # Look up key
        key_data = await conn.fetchrow(
            """
            SELECT 
                ak.id, ak.user_id, ak.project_id, ak.role, ak.is_active,
                u.email, u.full_name, u.is_active as user_active,
                p.database_name, p.status as project_status
            FROM api_keys ak
            JOIN users u ON ak.user_id = u.id
            JOIN projects p ON ak.project_id = p.id
            WHERE ak.key_hash = $1
            """,
            key_hash
        )
        
        if not key_data:
            raise HTTPException(
                status_code=status.HTTP_401_UNAUTHORIZED,
                detail="Invalid API key"
            )
        
        if not key_data["is_active"]:
            raise HTTPException(
                status_code=status.HTTP_401_UNAUTHORIZED,
                detail="API key is disabled"
            )
        
        if not key_data["user_active"]:
            raise HTTPException(
                status_code=status.HTTP_401_UNAUTHORIZED,
                detail="User account is inactive"
            )
        
        if key_data["project_status"] != "active":
            raise HTTPException(
                status_code=status.HTTP_403_FORBIDDEN,
                detail="Project is not active"
            )
        
        # Update last_used_at
        await conn.execute(
            "UPDATE api_keys SET last_used_at = NOW() WHERE id = $1",
            key_data["id"]
        )
        
        return {
            "user_id": str(key_data["user_id"]),
            "project_id": str(key_data["project_id"]),
            "database_name": key_data["database_name"],
            "role": key_data["role"],
            "email": key_data["email"]
        }


async def get_current_user_from_token(authorization: str = Header(...)) -> UserResponse:
    """
    Get current user from JWT token (existing function, kept for compatibility)
    """
    from .database import get_main_db_pool
    
    if not authorization.startswith("Bearer "):
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Invalid authentication credentials"
        )
    
    token = authorization.replace("Bearer ", "")
    payload = decode_access_token(token)
    
    if not payload:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Could not validate credentials"
        )
    
    user_id = payload.get("sub")
    if not user_id:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Could not validate credentials"
        )
    
    pool = await get_main_db_pool()
    async with pool.acquire() as conn:
        user = await conn.fetchrow(
            "SELECT id, email, full_name, avatar_url, is_active, is_verified, plan, created_at FROM users WHERE id = $1",
            user_id
        )
        
        if not user:
            raise HTTPException(
                status_code=status.HTTP_401_UNAUTHORIZED,
                detail="User not found"
            )
        
        if not user["is_active"]:
            raise HTTPException(
                status_code=status.HTTP_403_FORBIDDEN,
                detail="User account is inactive"
            )
        
        return UserResponse(
            id=str(user["id"]),
            email=user["email"],
            full_name=user["full_name"],
            avatar_url=user["avatar_url"],
            is_active=user["is_active"],
            is_verified=user["is_verified"],
            plan=user["plan"],
            created_at=user["created_at"]
        )


# Alias for backward compatibility
get_current_user = get_current_user_from_token
