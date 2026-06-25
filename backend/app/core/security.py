from datetime import datetime, timedelta
from typing import Optional, Union
from jose import JWTError, jwt
from passlib.context import CryptContext
from cryptography.fernet import Fernet
import secrets
import base64
import hmac
import hashlib
from app.core.config import settings

# ============================================
# SECURE PASSWORD HASHING CONFIGURATION
# ============================================

# Configure bcrypt with secure parameters
# - bcrypt with 12 rounds (2^12 = 4096 iterations)
# - Recommended by OWASP as of 2024
# - Takes ~300ms to hash (good balance of security vs UX)
pwd_context = CryptContext(
    schemes=["bcrypt"],
    deprecated="auto",
    bcrypt__rounds=12,  # Explicit cost factor
    bcrypt__ident="2b",  # Use modern bcrypt variant
)

# For detecting and migrating legacy weak hashes
legacy_pwd_context = CryptContext(
    schemes=["bcrypt", "md5_crypt", "sha256_crypt", "sha512_crypt"],
    deprecated=["md5_crypt", "sha256_crypt", "sha512_crypt"],
)

def verify_password(plain_password: str, hashed_password: str) -> bool:
    """
    Verify a password against a hash using constant-time comparison.
    
    Security features:
    - Uses bcrypt's built-in constant-time comparison
    - Resistant to timing attacks
    - Never logs password values
    
    Args:
        plain_password: Password to verify (never logged)
        hashed_password: Bcrypt hash to compare against
    
    Returns:
        bool: True if password matches, False otherwise
    """
    try:
        # passlib's verify() uses constant-time comparison internally
        return pwd_context.verify(plain_password, hashed_password)
    except Exception:
        # If verification fails (corrupt hash, wrong algorithm), return False
        return False

def verify_password_with_migration_check(
    plain_password: str, 
    hashed_password: str
) -> tuple[bool, bool]:
    """
    Verify password and detect if rehashing is needed.
    
    Returns:
        (is_valid, needs_rehash)
    """
    try:
        # Check if hash needs upgrade
        needs_rehash = pwd_context.needs_update(hashed_password)
        
        # Verify using primary context (bcrypt)
        is_valid = pwd_context.verify(plain_password, hashed_password)
        
        return is_valid, needs_rehash
        
    except ValueError:
        # Hash might be using deprecated algorithm (MD5, SHA256, etc.)
        try:
            is_valid = legacy_pwd_context.verify(plain_password, hashed_password)
            # If valid with legacy algorithm, needs rehash
            return is_valid, is_valid
        except Exception:
            return False, False
    except Exception:
        return False, False

def get_password_hash(password: str) -> str:
    """
    Hash a password using bcrypt with secure parameters.
    
    Security features:
    - bcrypt with 12 rounds (cost factor)
    - Automatically generates cryptographically secure salt
    - Output format: $2b$12$[22-char salt][31-char hash]
    - Never logs the password
    
    Args:
        password: Plain text password (NEVER logged)
    
    Returns:
        str: Bcrypt hash string (safe to store in database)
    
    Example output:
        $2b$12$LQv3c1yqBWVHxkd0LHAkCOYz6TtntnbE3TQCifyuBM.Dq0j7K0JNi
    """
    # SECURITY: Never log password value
    return pwd_context.hash(password)

def hash_password(password: str) -> str:
    """
    Alias for get_password_hash for backward compatibility.
    Hash a password using bcrypt (12 rounds).
    
    NEVER logs password values.
    """
    return get_password_hash(password)

def is_password_hash_secure(hashed_password: str) -> bool:
    """
    Check if a password hash uses secure algorithm (bcrypt).
    
    Returns:
        bool: True if hash is bcrypt with adequate cost factor
    """
    try:
        # Check if it's a bcrypt hash
        if not hashed_password.startswith("$2"):
            return False
        
        # Check if it needs update (cost factor too low)
        return not pwd_context.needs_update(hashed_password)
    except Exception:
        return False

def detect_weak_hash(hashed_password: str) -> Optional[str]:
    """
    Detect if a hash uses a weak algorithm.
    
    Returns:
        str: Algorithm name if weak (md5, sha256, etc.) or None if secure
    """
    if hashed_password.startswith("$1$"):
        return "md5_crypt"
    elif hashed_password.startswith("$5$"):
        return "sha256_crypt"
    elif hashed_password.startswith("$6$"):
        return "sha512_crypt"
    elif hashed_password.startswith("$2") and not hashed_password.startswith("$2b$12$"):
        return "bcrypt_weak"  # Old bcrypt with low cost factor
    return None

def secure_compare(a: str, b: str) -> bool:
    """
    Constant-time string comparison to prevent timing attacks.
    
    Use this when comparing secrets, tokens, or hashes.
    """
    return hmac.compare_digest(a.encode(), b.encode())

# Initialize encryption for OAuth client secrets
def get_encryption_key() -> bytes:
    """Get or generate encryption key for OAuth secrets"""
    key = getattr(settings, 'OAUTH_ENCRYPTION_KEY', None)
    if not key:
        # Generate a key if not set (for development only)
        key = Fernet.generate_key().decode()
        print(f"WARNING: Using generated encryption key. Set OAUTH_ENCRYPTION_KEY in production: {key}")
    return key.encode() if isinstance(key, str) else key

_fernet = None

def get_fernet() -> Fernet:
    """Get Fernet instance for encryption/decryption"""
    global _fernet
    if _fernet is None:
        _fernet = Fernet(get_encryption_key())
    return _fernet

def encrypt_client_secret(secret: str) -> str:
    """Encrypt OAuth client secret for storage"""
    fernet = get_fernet()
    encrypted = fernet.encrypt(secret.encode())
    return base64.urlsafe_b64encode(encrypted).decode()

def decrypt_client_secret(encrypted_secret: str) -> str:
    """Decrypt OAuth client secret"""
    fernet = get_fernet()
    encrypted_bytes = base64.urlsafe_b64decode(encrypted_secret.encode())
    decrypted = fernet.decrypt(encrypted_bytes)
    return decrypted.decode()

def generate_oauth_state() -> str:
    """Generate cryptographically secure state token for OAuth CSRF protection"""
    return secrets.token_urlsafe(32)

def validate_redirect_url(url: str, allowed_urls: list[str]) -> bool:
    """
    Validate redirect URL against whitelist
    Returns True if URL is in allowed list (exact match required)
    """
    if not url:
        return False
    
    # Exact match required - no wildcards
    return url in allowed_urls

def is_valid_https_url(url: str, allow_localhost: bool = True) -> bool:
    """
    Validate that URL is properly formatted and uses HTTPS
    Allow localhost for development if specified
    """
    from urllib.parse import urlparse
    
    try:
        parsed = urlparse(url)
        
        # Check scheme
        if parsed.scheme not in ['https', 'http']:
            return False
        
        # In production, require HTTPS unless localhost
        if parsed.scheme == 'http':
            if not allow_localhost:
                return False
            if not (parsed.hostname in ['localhost', '127.0.0.1'] or parsed.hostname.startswith('192.168.')):
                return False
        
        # Must have a valid hostname
        if not parsed.hostname:
            return False
        
        return True
    except Exception:
        return False

# ============================================
# OAUTH ENCRYPTION & SECURITY
# ============================================

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
                detail="Invalid authentication credentials"
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


# ============================================
# UNIFIED AUTHENTICATION RESOLVER
# ============================================

from fastapi import Request
import re as _re

_PROJECT_SLUG_RE = _re.compile(r"^/p/([^/]+)")


async def resolve_principal(
    request: Request,
    authorization: Optional[str] = Header(None),
) -> dict:
    """
    Unified auth dependency for endpoints that serve both dashboard users
    (platform JWTs) and SDK users (project-scoped JWTs).

    Resolution order:
      1. Platform JWT  — signed with settings.SECRET_KEY, sub = platform user UUID
      2. Project JWT   — signed with project.jwt_secret, role = 'authenticated'
         Project is identified from /p/{slug} path or 'apikey' header.

    Returns a normalized principal dict:
      {
        "user_id":      str,
        "email":        str | None,
        "plan":         str | None,
        "token_type":   "platform" | "project",
        "project_id":   str | None,   # only for project tokens
      }

    Raises 401 for missing / invalid tokens.
    Raises 403 for inactive accounts.
    """
    from .database import get_main_db_pool

    if not authorization or not authorization.startswith("Bearer "):
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Authentication required. Provide Authorization: Bearer <token>.",
        )

    token = authorization[7:].strip()

    # ── 1. Try platform JWT ────────────────────────────────────────────────
    payload = decode_access_token(token)
    if payload:
        user_id = payload.get("sub")
        if not user_id:
            raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED,
                                detail="Could not validate credentials")

        pool = await get_main_db_pool()
        async with pool.acquire() as conn:
            user = await conn.fetchrow(
                "SELECT id, email, full_name, is_active, plan FROM users WHERE id = $1",
                user_id,
            )

        if not user:
            raise HTTPException(
                status_code=status.HTTP_401_UNAUTHORIZED,
                detail="Invalid authentication credentials"
            )
        if not user["is_active"]:
            raise HTTPException(status_code=status.HTTP_403_FORBIDDEN,
                                detail="User account is inactive")

        return {
            "user_id": str(user["id"]),
            "email": user["email"],
            "plan": user["plan"],
            "token_type": "platform",
            "project_id": None,
        }

    # ── 2. Try project-scoped JWT ──────────────────────────────────────────
    # Identify the project from the path (/p/{slug}/...) or apikey header.
    project_identifier = None

    path = request.url.path
    m = _PROJECT_SLUG_RE.match(path)
    if m:
        project_identifier = m.group(1)

    if not project_identifier:
        project_identifier = request.headers.get("apikey") or request.headers.get("x-project-id")

    if not project_identifier:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Could not validate credentials. Token is not a valid platform JWT "
                   "and no project context was found to attempt project-scoped validation.",
        )

    pool = await get_main_db_pool()
    async with pool.acquire() as conn:
        # Resolve slug or UUID
        try:
            import uuid as _uuid
            _uuid.UUID(project_identifier)
            project = await conn.fetchrow(
                "SELECT id, jwt_secret FROM projects WHERE id = $1", project_identifier
            )
        except ValueError:
            # Support both slug and legacy_slug for backward compatibility
            project = await conn.fetchrow(
                """
                SELECT id, jwt_secret FROM projects 
                WHERE slug = $1 OR legacy_slug = $1
                ORDER BY CASE WHEN slug = $1 THEN 1 ELSE 2 END
                LIMIT 1
                """, 
                project_identifier
            )

    if not project or not project["jwt_secret"]:
        raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED,
                            detail="Could not validate credentials")

    import jwt as _pyjwt
    try:
        proj_payload = _pyjwt.decode(token, project["jwt_secret"], algorithms=["HS256"])
    except _pyjwt.ExpiredSignatureError:
        raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED,
                            detail="Token expired")
    except _pyjwt.InvalidTokenError:
        raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED,
                            detail="Could not validate credentials")

    role = proj_payload.get("role", "")
    # Accept authenticated users and service_role — reject bare anon keys
    if role not in ("authenticated", "service_role"):
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Anonymous key cannot be used for authenticated requests. "
                   "Call auth.signIn() to get a user token.",
        )

    user_id = proj_payload.get("sub") or proj_payload.get("user_id")
    email = proj_payload.get("email")

    return {
        "user_id": user_id or f"service:{project['id']}",
        "email": email,
        "plan": None,
        "token_type": "project",
        "project_id": str(project["id"]),
    }
