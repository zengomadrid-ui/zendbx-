"""
OAuth Service for Google and GitHub authentication
Dynamic provider loading from database with PKCE support
"""
try:
    from authlib.integrations.starlette_client import OAuth
    OAUTH_AVAILABLE = True
except ImportError:
    OAUTH_AVAILABLE = False
    OAuth = None

from app.core.config import settings
from typing import Optional, Dict, Any, Tuple
import secrets
import asyncio
import hashlib
import base64

if OAUTH_AVAILABLE:
    oauth = OAuth()
    _providers_loaded = False
else:
    oauth = None
    _providers_loaded = False

# ============================================
# PKCE SUPPORT
# ============================================

def generate_pkce() -> Tuple[str, str]:
    """
    Generate PKCE code verifier and challenge
    Returns: (code_verifier, code_challenge)
    """
    # Generate random code verifier (43-128 characters)
    code_verifier = base64.urlsafe_b64encode(secrets.token_bytes(32)).decode('utf-8').rstrip('=')
    
    # Generate code challenge (SHA256 hash of verifier)
    challenge_bytes = hashlib.sha256(code_verifier.encode('utf-8')).digest()
    code_challenge = base64.urlsafe_b64encode(challenge_bytes).decode('utf-8').rstrip('=')
    
    return code_verifier, code_challenge


def generate_state_token() -> str:
    """Generate secure random state token for CSRF protection"""
    return secrets.token_urlsafe(32)


async def store_oauth_state(
    state_token: str,
    provider: str,
    code_verifier: Optional[str] = None,
    redirect_to: Optional[str] = None,
    user_id: Optional[str] = None
) -> None:
    """Store OAuth state in database for validation"""
    from app.core.database import execute_on_main_db
    
    await execute_on_main_db(
        """
        INSERT INTO oauth_states (state_token, provider, code_verifier, redirect_to, user_id)
        VALUES ($1, $2, $3, $4, $5)
        """,
        state_token,
        provider,
        code_verifier,
        redirect_to,
        user_id
    )


async def validate_and_consume_state(
    state_token: str,
    provider: str
) -> Optional[Dict[str, Any]]:
    """
    Validate OAuth state token and mark as used
    Returns state data if valid, None if invalid
    """
    from app.core.database import execute_on_main_db
    
    result = await execute_on_main_db(
        """
        UPDATE oauth_states
        SET used = true
        WHERE state_token = $1 
        AND provider = $2
        AND used = false
        AND expires_at > NOW()
        RETURNING code_verifier, redirect_to, user_id
        """,
        state_token,
        provider
    )
    
    if not result:
        return None
    
    return dict(result[0])


async def cleanup_expired_states() -> None:
    """Remove expired OAuth states from database"""
    from app.core.database import execute_on_main_db
    
    await execute_on_main_db("SELECT cleanup_expired_oauth_states()")


async def log_oauth_action(
    user_id: Optional[str],
    provider: str,
    action: str,
    success: bool,
    error_message: Optional[str] = None,
    ip_address: Optional[str] = None,
    user_agent: Optional[str] = None
) -> None:
    """Log OAuth action to audit trail"""
    from app.core.database import execute_on_main_db
    
    try:
        await execute_on_main_db(
            """
            INSERT INTO oauth_audit_log 
                (user_id, provider, action, success, error_message, ip_address, user_agent)
            VALUES ($1, $2, $3, $4, $5, $6, $7)
            """,
            user_id,
            provider,
            action,
            success,
            error_message,
            ip_address,
            user_agent
        )
    except Exception as e:
        print(f"⚠️  Failed to log OAuth action: {e}")

# ============================================
# DYNAMIC PROVIDER LOADING
# ============================================

async def load_oauth_providers_from_db():
    """Load OAuth providers from database"""
    global _providers_loaded
    
    if not OAUTH_AVAILABLE:
        print("⚠️  OAuth not available - install authlib package")
        return
    
    try:
        from app.core.database import execute_on_main_db
        
        # Load enabled providers from database
        result = await execute_on_main_db(
            """
            SELECT provider, client_id, client_secret, scopes, redirect_uri
            FROM oauth_provider_settings
            WHERE is_enabled = true 
            AND client_id != '' 
            AND client_secret != ''
            """
        )
        
        print(f"🔍 OAuth query returned {len(result) if result else 0} provider(s)")
        
        if not result:
            print("ℹ️  No OAuth providers configured in database")
            # Fall back to environment variables
            await load_oauth_providers_from_env()
            return
        
        for row in result:
            provider = row["provider"]
            client_id = row["client_id"]
            client_secret = row["client_secret"]
            scopes = row["scopes"] or ("openid email profile" if provider == "google" else "user:email")
            
            # Register provider
            if provider == "google":
                oauth.register(
                    name='google',
                    client_id=client_id,
                    client_secret=client_secret,
                    server_metadata_url='https://accounts.google.com/.well-known/openid-configuration',
                    client_kwargs={'scope': scopes}
                )
                print(f"✅ Google OAuth loaded from database")
            
            elif provider == "github":
                oauth.register(
                    name='github',
                    client_id=client_id,
                    client_secret=client_secret,
                    authorize_url='https://github.com/login/oauth/authorize',
                    authorize_params=None,
                    access_token_url='https://github.com/login/oauth/access_token',
                    access_token_params=None,
                    client_kwargs={'scope': scopes}
                )
                print(f"✅ GitHub OAuth loaded from database")
        
        _providers_loaded = True
        
    except Exception as e:
        print(f"⚠️  Failed to load OAuth providers from database: {e}")
        # Fall back to environment variables
        await load_oauth_providers_from_env()

async def load_oauth_providers_from_env():
    """Load OAuth providers from environment variables (fallback)"""
    global _providers_loaded
    
    if not OAUTH_AVAILABLE:
        return
    
    # Register Google OAuth from env
    if settings.GOOGLE_CLIENT_ID and settings.GOOGLE_CLIENT_SECRET:
        oauth.register(
            name='google',
            client_id=settings.GOOGLE_CLIENT_ID,
            client_secret=settings.GOOGLE_CLIENT_SECRET,
            server_metadata_url='https://accounts.google.com/.well-known/openid-configuration',
            client_kwargs={'scope': 'openid email profile'}
        )
        print(f"✅ Google OAuth loaded from environment")

    # Register GitHub OAuth from env
    if settings.GITHUB_CLIENT_ID and settings.GITHUB_CLIENT_SECRET:
        oauth.register(
            name='github',
            client_id=settings.GITHUB_CLIENT_ID,
            client_secret=settings.GITHUB_CLIENT_SECRET,
            authorize_url='https://github.com/login/oauth/authorize',
            authorize_params=None,
            access_token_url='https://github.com/login/oauth/access_token',
            access_token_params=None,
            client_kwargs={'scope': 'user:email'}
        )
        print(f"✅ GitHub OAuth loaded from environment")
    
    _providers_loaded = True

async def reload_oauth_providers():
    """Reload OAuth providers (called after configuration changes)"""
    global _providers_loaded
    _providers_loaded = False
    
    # Clear existing providers
    if OAUTH_AVAILABLE and oauth:
        oauth._clients.clear()
    
    # Reload from database
    await load_oauth_providers_from_db()


def get_oauth_client(provider: str):
    """Get OAuth client for provider"""
    if not OAUTH_AVAILABLE:
        raise ValueError("OAuth not available - install authlib package")
    
    if provider not in ['google', 'github']:
        raise ValueError(f"Unsupported provider: {provider}")
    
    # Ensure providers are loaded
    if not _providers_loaded:
        # Try to load synchronously (will use env vars as fallback)
        try:
            loop = asyncio.get_event_loop()
            if loop.is_running():
                # If event loop is running, we can't await here
                # This means providers should have been loaded at startup
                pass
            else:
                loop.run_until_complete(load_oauth_providers_from_db())
        except Exception as e:
            print(f"⚠️  Failed to load OAuth providers: {e}")
    
    client = getattr(oauth, provider, None)
    if not client:
        raise ValueError(f"OAuth not configured for {provider}. Please configure in Settings → Authentication → Providers")
    
    return client


def normalize_oauth_user(provider: str, user_info: Dict[str, Any]) -> Dict[str, Any]:
    """Normalize user info from different OAuth providers"""
    
    if provider == 'google':
        return {
            'provider_user_id': user_info.get('sub'),
            'email': user_info.get('email'),
            'full_name': user_info.get('name'),
            'avatar_url': user_info.get('picture'),
            'is_verified': user_info.get('email_verified', False)
        }
    
    elif provider == 'github':
        return {
            'provider_user_id': str(user_info.get('id')),
            'email': user_info.get('email'),
            'full_name': user_info.get('name') or user_info.get('login'),
            'avatar_url': user_info.get('avatar_url'),
            'is_verified': True
        }
    
    return {}


async def link_oauth_to_user(
    user_id: str,
    provider: str,
    provider_user_id: str,
    access_token: str,
    refresh_token: Optional[str],
    profile_data: Dict[str, Any],
    is_primary: bool = False
) -> None:
    """Link OAuth provider to existing user account"""
    from app.core.database import execute_on_main_db
    import json
    
    await execute_on_main_db(
        """
        INSERT INTO oauth_connections 
            (user_id, provider, provider_user_id, access_token, refresh_token, profile_data, is_primary)
        VALUES ($1, $2, $3, $4, $5, $6, $7)
        ON CONFLICT (provider, provider_user_id) 
        DO UPDATE SET
            user_id = EXCLUDED.user_id,
            access_token = EXCLUDED.access_token,
            refresh_token = EXCLUDED.refresh_token,
            profile_data = EXCLUDED.profile_data,
            is_primary = EXCLUDED.is_primary,
            updated_at = NOW()
        """,
        user_id,
        provider,
        provider_user_id,
        access_token,
        refresh_token,
        json.dumps(profile_data),
        is_primary
    )


async def unlink_oauth_from_user(user_id: str, provider: str) -> bool:
    """Unlink OAuth provider from user account"""
    from app.core.database import execute_on_main_db
    
    # Check if user has password or other OAuth providers
    user_data = await execute_on_main_db(
        """
        SELECT 
            password_hash,
            (SELECT COUNT(*) FROM oauth_connections WHERE user_id = $1) as oauth_count
        FROM users 
        WHERE id = $1
        """,
        user_id
    )
    
    if not user_data:
        return False
    
    user = dict(user_data[0])
    
    # Don't allow unlinking if it's the only auth method
    if not user['password_hash'] and user['oauth_count'] <= 1:
        raise ValueError("Cannot unlink the only authentication method")
    
    # Unlink provider
    result = await execute_on_main_db(
        """
        DELETE FROM oauth_connections
        WHERE user_id = $1 AND provider = $2
        RETURNING id
        """,
        user_id,
        provider
    )
    
    return bool(result)


async def get_user_oauth_providers(user_id: str) -> list:
    """Get all OAuth providers linked to user"""
    from app.core.database import execute_on_main_db
    
    result = await execute_on_main_db(
        "SELECT * FROM get_user_oauth_providers($1)",
        user_id
    )
    
    return [dict(row) for row in result]

