"""
AI Intent Classification for Auth Detection
Detects when user requests require ZendBX authentication system

IMPORTANT: This is for AI assistance only, NOT for security decisions.
Security must use deterministic schema-aware checks from auth_registry.py
"""

from typing import Dict, List, Set, Optional
from dataclasses import dataclass

# ============================================
# AUTH INTENT KEYWORDS
# ============================================

AUTH_INTENT_KEYWORDS: Set[str] = {
    # Signup/Registration
    'signup', 'sign up', 'sign-up',
    'register', 'registration',
    'create account', 'create user',
    'new user', 'user registration',
    
    # Login/Authentication
    'login', 'log in', 'log-in',
    'sign in', 'signin', 'sign-in',
    'authenticate', 'authentication',
    'auth', 'authorization',
    
    # Logout
    'logout', 'log out', 'log-out',
    'sign out', 'signout', 'sign-out',
    
    # OAuth/Social Login
    'oauth', 'oauth2',
    'google login', 'google auth', 'google signin',
    'github login', 'github auth', 'github signin',
    'facebook login', 'facebook auth',
    'social login', 'social auth',
    
    # Password Management
    'password', 'forgot password',
    'reset password', 'password reset',
    'change password', 'update password',
    
    # Session Management
    'session', 'user session',
    'token', 'jwt', 'access token',
    'refresh token', 'session management',
    
    # User Identity
    'user auth', 'user identity',
    'identity provider', 'authentication provider',
    
    # Security Features
    'two factor', '2fa', 'mfa',
    'email verification', 'verify email',
    'account verification'
}

# Keywords that suggest profile data (NOT auth)
PROFILE_KEYWORDS: Set[str] = {
    'user profile', 'profile',
    'user info', 'user information',
    'user data', 'user details',
    'display name', 'username',
    'avatar', 'bio', 'biography',
    'user preferences', 'settings',
    'profile picture', 'profile image'
}

# ============================================
# INTENT DETECTION
# ============================================

@dataclass
class DetectedIntent:
    """Result of intent classification"""
    requires_auth: bool
    requires_profile: bool
    confidence: float  # 0.0 to 1.0
    matched_keywords: List[str]
    recommendation: str


def detect_auth_intent(user_request: str) -> bool:
    """
    Simple boolean check if request requires authentication
    
    Args:
        user_request: User's natural language request
        
    Returns:
        True if authentication is needed
        
    Examples:
        detect_auth_intent("I need users to sign up") → True
        detect_auth_intent("Add login to my app") → True
        detect_auth_intent("Create a posts table") → False
    """
    if not user_request:
        return False
    
    request_lower = user_request.lower()
    
    return any(keyword in request_lower for keyword in AUTH_INTENT_KEYWORDS)


def detect_profile_intent(user_request: str) -> bool:
    """
    Check if request is about user profiles (not auth)
    
    Args:
        user_request: User's natural language request
        
    Returns:
        True if profile data is needed
    """
    if not user_request:
        return False
    
    request_lower = user_request.lower()
    
    return any(keyword in request_lower for keyword in PROFILE_KEYWORDS)


def classify_intent(user_request: str) -> DetectedIntent:
    """
    Classify user intent with confidence scoring
    
    Args:
        user_request: User's natural language request
        
    Returns:
        DetectedIntent with classification details
        
    Examples:
        classify_intent("Add signup and login")
        → DetectedIntent(requires_auth=True, requires_profile=False, confidence=0.95)
        
        classify_intent("Create user profiles with username and avatar")
        → DetectedIntent(requires_auth=True, requires_profile=True, confidence=0.85)
    """
    if not user_request:
        return DetectedIntent(
            requires_auth=False,
            requires_profile=False,
            confidence=0.0,
            matched_keywords=[],
            recommendation="No clear intent detected"
        )
    
    request_lower = user_request.lower()
    
    # Find matching keywords
    auth_matches = [kw for kw in AUTH_INTENT_KEYWORDS if kw in request_lower]
    profile_matches = [kw for kw in PROFILE_KEYWORDS if kw in request_lower]
    
    # Calculate confidence based on number and specificity of matches
    auth_confidence = min(len(auth_matches) * 0.3, 1.0)
    profile_confidence = min(len(profile_matches) * 0.3, 1.0)
    
    # High confidence if multiple specific keywords found
    if 'signup' in request_lower or 'sign up' in request_lower:
        auth_confidence = max(auth_confidence, 0.9)
    if 'login' in request_lower or 'log in' in request_lower:
        auth_confidence = max(auth_confidence, 0.9)
    
    requires_auth = len(auth_matches) > 0
    requires_profile = len(profile_matches) > 0
    
    # Generate recommendation
    if requires_auth and requires_profile:
        recommendation = "use_zendbx_auth_with_profile"
    elif requires_auth:
        recommendation = "use_zendbx_auth"
    elif requires_profile:
        recommendation = "create_profile_table"
    else:
        recommendation = "standard_table"
    
    return DetectedIntent(
        requires_auth=requires_auth,
        requires_profile=requires_profile,
        confidence=max(auth_confidence, profile_confidence),
        matched_keywords=auth_matches + profile_matches,
        recommendation=recommendation
    )


# ============================================
# AUTH RECOMMENDATION
# ============================================

def get_auth_recommendation(
    project_id: str,
    user_request: str
) -> Dict:
    """
    Generate ZendBX Auth setup recommendation
    
    Args:
        project_id: UUID of current project
        user_request: User's request
        
    Returns:
        Dictionary with auth setup guidance
        
    Example Response:
        {
            "intent": "auth_required",
            "confidence": 0.95,
            "recommendation": "Use ZendBX Auth (already configured)",
            "sdk_usage": {...},
            "endpoints": {...},
            "profile_pattern": {...}
        }
    """
    intent = classify_intent(user_request)
    
    if not intent.requires_auth:
        return {
            "intent": "no_auth_required",
            "recommendation": "Standard table creation",
            "message": "This request doesn't require authentication."
        }
    
    response = {
        "intent": "auth_required",
        "confidence": intent.confidence,
        "matched_keywords": intent.matched_keywords,
        "recommendation": "Use ZendBX Auth (native authentication system)",
        "message": (
            "ZendBX Auth is available for your project. "
            "Use the built-in authentication system instead of creating custom auth tables."
        ),
        "auth_tables": {
            "description": "ZendBX manages these tables automatically",
            "tables": [
                {"name": "auth.users", "description": "User accounts"},
                {"name": "auth.sessions", "description": "Active sessions"},
                {"name": "auth.refresh_tokens", "description": "Token rotation"},
                {"name": "auth.identities", "description": "OAuth connections"},
                {"name": "auth.password_reset_tokens", "description": "Password resets"}
            ]
        },
        "sdk_usage": {
            "signup": "await client.auth.signUp({ email, password })",
            "login": "await client.auth.signIn({ email, password })",
            "logout": "await client.auth.signOut()",
            "get_user": "await client.auth.getUser()",
            "get_session": "await client.auth.getSession()",
            "refresh": "await client.auth.refreshSession()"
        },
        "endpoints": {
            "signup": "POST /p/{slug}/auth/signup",
            "login": "POST /p/{slug}/auth/login",
            "logout": "POST /p/{slug}/auth/logout",
            "user": "GET /p/{slug}/auth/user"
        },
        "security": {
            "password_hashing": "bcrypt (12 rounds)",
            "jwt_tokens": "HS256, project-scoped",
            "session_management": "Automatic token rotation",
            "oauth_support": "Google, GitHub"
        }
    }
    
    # Add profile recommendation if needed
    if intent.requires_profile:
        response["profile_pattern"] = {
            "recommendation": "Create public.profiles for application-specific data",
            "separation": "Keep auth in auth.users, profiles in public.profiles",
            "schema": {
                "table": "profiles",
                "columns": [
                    {"name": "id", "type": "uuid", "primary": True, "default": "gen_random_uuid()"},
                    {"name": "user_id", "type": "uuid", "references": "auth.users(id)", "required": True},
                    {"name": "display_name", "type": "text"},
                    {"name": "username", "type": "text", "unique": True},
                    {"name": "avatar_url", "type": "text"},
                    {"name": "bio", "type": "text"},
                    {"name": "preferences", "type": "jsonb", "default": "'{}'::jsonb"},
                    {"name": "created_at", "type": "timestamptz", "default": "NOW()"},
                    {"name": "updated_at", "type": "timestamptz", "default": "NOW()"}
                ]
            },
            "relationship": "public.profiles.user_id → auth.users.id",
            "example_query": "SELECT u.email, p.display_name FROM auth.users u JOIN public.profiles p ON u.id = p.user_id"
        }
    
    return response


# ============================================
# DISCOURAGED PATTERNS
# ============================================

DISCOURAGED_PATTERNS = [
    {
        "pattern": r"create\s+table\s+.*users.*password",
        "issue": "Custom authentication table",
        "recommendation": "Use ZendBX Auth instead of creating custom auth tables"
    },
    {
        "pattern": r"password_hash|password_digest|hashed_password",
        "issue": "Manual password management",
        "recommendation": "Let ZendBX Auth handle password hashing and verification"
    },
    {
        "pattern": r"jwt_token|access_token.*varchar|session_token",
        "issue": "Manual token management",
        "recommendation": "Use ZendBX Auth for token generation and validation"
    }
]


def detect_discouraged_patterns(sql_or_request: str) -> List[Dict]:
    """
    Detect patterns that should use ZendBX Auth instead
    
    Args:
        sql_or_request: SQL statement or user request
        
    Returns:
        List of detected issues with recommendations
    """
    import re
    
    if not sql_or_request:
        return []
    
    detected_issues = []
    text_lower = sql_or_request.lower()
    
    for pattern_info in DISCOURAGED_PATTERNS:
        if re.search(pattern_info["pattern"], text_lower):
            detected_issues.append({
                "issue": pattern_info["issue"],
                "recommendation": pattern_info["recommendation"],
                "severity": "warning"
            })
    
    return detected_issues
