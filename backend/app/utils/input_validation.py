"""
Input Validation & Sanitization Module
Provides server-side validation and sanitization for all user inputs
"""

import re
import html
import logging
from typing import Optional
from pydantic import BaseModel, EmailStr, Field, validator, ValidationError
from fastapi import HTTPException, status

# Configure logging
logger = logging.getLogger(__name__)

# ============================================
# SANITIZATION UTILITIES
# ============================================

def sanitize_string(value: str, allow_special_chars: bool = False) -> str:
    """
    Sanitize string input by:
    - Stripping HTML tags
    - Escaping special characters
    - Removing script tags
    - Trimming whitespace
    """
    if not value:
        return value
    
    # Strip HTML/script tags
    value = re.sub(r'<[^>]+>', '', value)
    value = re.sub(r'<script[^>]*>.*?</script>', '', value, flags=re.IGNORECASE | re.DOTALL)
    value = re.sub(r'javascript:', '', value, flags=re.IGNORECASE)
    
    # Escape HTML entities
    value = html.escape(value)
    
    # If special chars not allowed, remove them (except basic punctuation)
    if not allow_special_chars:
        # Allow: alphanumeric, spaces, basic punctuation
        value = re.sub(r'[^\w\s\-_.@\']', '', value)
    
    # Trim whitespace
    value = value.strip()
    
    return value

def sanitize_email(email: str) -> str:
    """Sanitize and normalize email address"""
    email = email.strip().lower()
    # Remove any HTML tags or scripts
    email = re.sub(r'<[^>]+>', '', email)
    return email

# ============================================
# ENHANCED AUTH SCHEMAS WITH VALIDATION
# ============================================

class SecureUserCreate(BaseModel):
    """Enhanced user creation schema with comprehensive validation"""
    email: EmailStr
    password: str
    full_name: Optional[str] = None
    
    @validator('email')
    def validate_email(cls, v):
        """Validate email format and length"""
        if not v:
            raise ValueError('Email is required')
        
        # Sanitize email
        v = sanitize_email(v)
        
        # Length check
        if len(v) < 5 or len(v) > 255:
            raise ValueError('Invalid email format')
        
        # Additional format validation
        if not re.match(r'^[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}$', v):
            raise ValueError('Invalid email format')
        
        # Block disposable email domains (common ones)
        disposable_domains = [
            'tempmail.com', 'throwaway.email', '10minutemail.com',
            'guerrillamail.com', 'mailinator.com', 'fakeinbox.com'
        ]
        domain = v.split('@')[1] if '@' in v else ''
        if domain.lower() in disposable_domains:
            raise ValueError('Invalid email format')
        
        return v
    
    @validator('password')
    def validate_password(cls, v):
        """Validate password strength"""
        if not v:
            raise ValueError('Password is required')
        
        # Length check
        if len(v) < 8:
            raise ValueError('Password must be at least 8 characters')
        
        if len(v) > 128:
            raise ValueError('Password too long')
        
        # Complexity check
        has_upper = re.search(r'[A-Z]', v)
        has_lower = re.search(r'[a-z]', v)
        has_digit = re.search(r'\d', v)
        
        if not (has_upper and has_lower and has_digit):
            raise ValueError('Password must contain uppercase, lowercase, and numbers')
        
        # Check for common weak passwords
        weak_passwords = [
            'password', '12345678', 'qwerty', 'admin123', 
            'letmein', 'welcome', 'monkey', 'dragon'
        ]
        if v.lower() in weak_passwords:
            raise ValueError('Password is too weak')
        
        return v
    
    @validator('full_name')
    def validate_full_name(cls, v):
        """Validate and sanitize full name"""
        if v is None:
            return v
        
        # Sanitize
        v = sanitize_string(v, allow_special_chars=False)
        
        # Length check
        if len(v) < 1:
            return None
        
        if len(v) > 100:
            raise ValueError('Name too long')
        
        # Format check - allow letters, spaces, hyphens, apostrophes
        if not re.match(r"^[a-zA-Z\s\-\']+$", v):
            raise ValueError('Invalid name format')
        
        return v


class SecureUserLogin(BaseModel):
    """Enhanced login schema with validation"""
    email: EmailStr
    password: str
    
    @validator('email')
    def validate_email(cls, v):
        """Validate and sanitize email"""
        if not v:
            raise ValueError('Email is required')
        
        v = sanitize_email(v)
        
        if len(v) < 5 or len(v) > 255:
            raise ValueError('Invalid credentials')
        
        return v
    
    @validator('password')
    def validate_password(cls, v):
        """Validate password (don't reveal requirements on login)"""
        if not v:
            raise ValueError('Password is required')
        
        if len(v) > 128:
            raise ValueError('Invalid credentials')
        
        return v


class SecurePasswordReset(BaseModel):
    """Enhanced password reset schema"""
    token: str
    new_password: str
    
    @validator('token')
    def validate_token(cls, v):
        """Validate reset token format"""
        if not v:
            raise ValueError('Token is required')
        
        # Sanitize token
        v = sanitize_string(v, allow_special_chars=False)
        
        # Length check (tokens should be 32+ chars for security)
        if len(v) < 32 or len(v) > 256:
            raise ValueError('Invalid token')
        
        # Alphanumeric check
        if not re.match(r'^[a-zA-Z0-9_-]+$', v):
            raise ValueError('Invalid token')
        
        return v
    
    @validator('new_password')
    def validate_password(cls, v):
        """Validate new password strength"""
        if not v:
            raise ValueError('Password is required')
        
        if len(v) < 8:
            raise ValueError('Password must be at least 8 characters')
        
        if len(v) > 128:
            raise ValueError('Password too long')
        
        # Complexity requirements
        has_upper = re.search(r'[A-Z]', v)
        has_lower = re.search(r'[a-z]', v)
        has_digit = re.search(r'\d', v)
        
        if not (has_upper and has_lower and has_digit):
            raise ValueError('Password must contain uppercase, lowercase, and numbers')
        
        return v


class SecureForgotPassword(BaseModel):
    """Enhanced forgot password schema"""
    email: EmailStr
    
    @validator('email')
    def validate_email(cls, v):
        """Validate and sanitize email"""
        if not v:
            raise ValueError('Email is required')
        
        v = sanitize_email(v)
        
        if len(v) < 5 or len(v) > 255:
            raise ValueError('Invalid email format')
        
        return v


class SecureUserUpdate(BaseModel):
    """Enhanced profile update schema"""
    full_name: Optional[str] = None
    avatar_url: Optional[str] = None
    
    @validator('full_name')
    def validate_full_name(cls, v):
        """Validate and sanitize full name"""
        if v is None:
            return v
        
        v = sanitize_string(v, allow_special_chars=False)
        
        if len(v) > 100:
            raise ValueError('Name too long')
        
        if len(v) > 0 and not re.match(r"^[a-zA-Z\s\-\']+$", v):
            raise ValueError('Invalid name format')
        
        return v if len(v) > 0 else None
    
    @validator('avatar_url')
    def validate_avatar_url(cls, v):
        """Validate avatar URL"""
        if v is None:
            return v
        
        # Basic URL validation
        if not re.match(r'^https?://', v):
            raise ValueError('Invalid avatar URL')
        
        if len(v) > 500:
            raise ValueError('Avatar URL too long')
        
        # Prevent javascript: protocol and other XSS vectors
        if re.search(r'javascript:|data:|vbscript:', v, re.IGNORECASE):
            raise ValueError('Invalid avatar URL')
        
        return v


# ============================================
# VALIDATION HELPER FUNCTIONS
# ============================================

def validate_and_sanitize_input(
    data: dict,
    schema: type[BaseModel],
    context: str = "input"
) -> BaseModel:
    """
    Validate and sanitize input using Pydantic schema.
    Logs validation failures for monitoring.
    Returns generic error to prevent information disclosure.
    """
    try:
        # Validate with Pydantic schema
        validated_data = schema(**data)
        return validated_data
    
    except ValidationError as e:
        # Log the specific validation error (server-side only)
        logger.warning(
            f"Validation failed for {context}",
            extra={
                "context": context,
                "errors": e.errors(),
                "data_keys": list(data.keys())  # Don't log actual values
            }
        )
        
        # Return generic error message (don't expose which field failed)
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Invalid input provided. Please check your data and try again."
        )
    
    except Exception as e:
        # Log unexpected errors
        logger.error(
            f"Unexpected validation error for {context}: {str(e)}",
            extra={"context": context}
        )
        
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Invalid input provided. Please check your data and try again."
        )


def log_validation_failure(
    endpoint: str,
    email: Optional[str] = None,
    error_type: str = "validation",
    details: Optional[dict] = None
):
    """
    Log validation failures for security monitoring.
    Can be used to detect attack patterns.
    """
    logger.warning(
        f"Authentication validation failure: {endpoint}",
        extra={
            "endpoint": endpoint,
            "email": email if email else "unknown",
            "error_type": error_type,
            "details": details or {}
        }
    )


# ============================================
# RATE LIMITING HELPERS
# ============================================

def check_rate_limit(
    identifier: str,
    max_attempts: int = 5,
    window_seconds: int = 300
) -> bool:
    """
    Check if request exceeds rate limit.
    Can be implemented with Redis or in-memory cache.
    """
    # This is a placeholder - implement with Redis in production
    # For now, return True (allow)
    return True


def log_suspicious_activity(
    activity_type: str,
    identifier: str,
    details: dict
):
    """
    Log suspicious activity for security monitoring.
    """
    logger.warning(
        f"Suspicious activity detected: {activity_type}",
        extra={
            "activity_type": activity_type,
            "identifier": identifier,
            "details": details
        }
    )
