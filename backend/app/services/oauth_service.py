"""
OAuth Service for Google and GitHub authentication
"""
try:
    from authlib.integrations.starlette_client import OAuth
    OAUTH_AVAILABLE = True
except ImportError:
    OAUTH_AVAILABLE = False
    OAuth = None

from app.core.config import settings
from typing import Optional, Dict, Any

if OAUTH_AVAILABLE:
    oauth = OAuth()

    # Register Google OAuth
    if settings.GOOGLE_CLIENT_ID and settings.GOOGLE_CLIENT_SECRET:
        oauth.register(
            name='google',
            client_id=settings.GOOGLE_CLIENT_ID,
            client_secret=settings.GOOGLE_CLIENT_SECRET,
            server_metadata_url='https://accounts.google.com/.well-known/openid-configuration',
            client_kwargs={'scope': 'openid email profile'}
        )

    # Register GitHub OAuth
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
else:
    oauth = None


def get_oauth_client(provider: str):
    """Get OAuth client for provider"""
    if not OAUTH_AVAILABLE:
        raise ValueError("OAuth not available - install authlib package")
    
    if provider not in ['google', 'github']:
        raise ValueError(f"Unsupported provider: {provider}")
    
    client = getattr(oauth, provider, None)
    if not client:
        raise ValueError(f"OAuth not configured for {provider}")
    
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
