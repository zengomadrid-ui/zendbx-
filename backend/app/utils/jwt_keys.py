"""
Supabase-style JWT API Key Generator

Generates JWT tokens with different roles (anon, service_role) similar to Supabase.
Each key is a valid JWT with:
- Header: {"alg": "HS256", "typ": "JWT"}
- Payload: {"role": "anon|service_role", "iss": "zendbx", "iat": timestamp, "exp": 10 years}
- Signature: HMAC-SHA256 signed with project's JWT secret
"""

import jwt
import secrets
from datetime import datetime, timedelta
from typing import Tuple


def generate_jwt_secret() -> str:
    """Generate a secure random JWT secret for a project"""
    return secrets.token_hex(32)  # 64 character hex string


def generate_api_key(jwt_secret: str, role: str, project_id: str) -> str:
    """
    Generate a Supabase-style JWT API key
    
    Args:
        jwt_secret: The project's JWT secret (used for signing)
        role: Either 'anon' or 'service_role'
        project_id: The project UUID
    
    Returns:
        A signed JWT token string
    """
    now = datetime.utcnow()
    
    # JWT payload - similar to Supabase structure
    payload = {
        "role": role,
        "iss": f"zendbx-{project_id}",  # Issuer
        "iat": int(now.timestamp()),     # Issued at
        "exp": int((now + timedelta(days=3650)).timestamp()),  # Expires in 10 years
    }
    
    # Generate JWT token
    token = jwt.encode(
        payload,
        jwt_secret,
        algorithm="HS256"
    )
    
    return token


def generate_project_keys(project_id: str) -> Tuple[str, str, str]:
    """
    Generate both anon and service_role keys for a project
    
    Returns:
        Tuple of (jwt_secret, anon_key, service_role_key)
    """
    # Generate a unique JWT secret for this project
    jwt_secret = generate_jwt_secret()
    
    # Generate anon key (public, read-only)
    anon_key = generate_api_key(jwt_secret, "anon", project_id)
    
    # Generate service_role key (private, full access)
    service_role_key = generate_api_key(jwt_secret, "service_role", project_id)
    
    return jwt_secret, anon_key, service_role_key


def verify_api_key(token: str, jwt_secret: str) -> dict:
    """
    Verify and decode a JWT API key
    
    Args:
        token: The JWT token to verify
        jwt_secret: The project's JWT secret
    
    Returns:
        Decoded payload if valid
    
    Raises:
        jwt.InvalidTokenError: If token is invalid
    """
    try:
        payload = jwt.decode(
            token,
            jwt_secret,
            algorithms=["HS256"]
        )
        return payload
    except jwt.ExpiredSignatureError:
        raise ValueError("API key has expired")
    except jwt.InvalidTokenError as e:
        raise ValueError(f"Invalid API key: {str(e)}")


def get_key_prefix(token: str) -> str:
    """
    Get a display prefix for a JWT token (first 20 chars + ...)
    
    Args:
        token: The full JWT token
    
    Returns:
        Truncated token for display
    """
    if len(token) > 20:
        return token[:20] + "..."
    return token


# Example usage
if __name__ == "__main__":
    import uuid
    
    # Generate keys for a test project
    project_id = str(uuid.uuid4())
    jwt_secret, anon_key, service_role_key = generate_project_keys(project_id)
    
    print("=" * 80)
    print("ZENDBX API Keys Generated")
    print("=" * 80)
    print(f"\nProject ID: {project_id}")
    print(f"\nJWT Secret (KEEP SECURE!):\n{jwt_secret}")
    print(f"\nAnon Key (public):\n{anon_key}")
    print(f"\nService Role Key (secret):\n{service_role_key}")
    print("\n" + "=" * 80)
    
    # Verify the keys
    print("\nVerifying keys...")
    anon_payload = verify_api_key(anon_key, jwt_secret)
    service_payload = verify_api_key(service_role_key, jwt_secret)
    
    print(f"\nAnon key payload: {anon_payload}")
    print(f"Service role key payload: {service_payload}")
    
    # Show they're different
    print(f"\nAnon key starts with: {get_key_prefix(anon_key)}")
    print(f"Service key starts with: {get_key_prefix(service_role_key)}")
    print(f"\nKeys are different: {anon_key != service_role_key}")
