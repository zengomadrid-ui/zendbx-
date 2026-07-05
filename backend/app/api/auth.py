from fastapi import APIRouter, HTTPException, Depends, status, Request, BackgroundTasks
from fastapi.security import HTTPBearer, HTTPAuthorizationCredentials
from app.models.schemas import (
    UserCreate, UserLogin, UserResponse, UserUpdate,
    Token, MessageResponse
)
from app.core.security import (
    hash_password, verify_password, create_access_token, decode_token
)
from app.core.database import execute_on_main_db
from app.utils.input_validation import (
    SecureUserCreate, SecureUserLogin, SecurePasswordReset,
    SecureForgotPassword, SecureUserUpdate,
    validate_and_sanitize_input, log_validation_failure,
    log_suspicious_activity
)
from app.services.email_service import get_email_service
from typing import Optional
from uuid import UUID
import secrets
from datetime import datetime, timedelta
from pydantic import BaseModel, EmailStr, ValidationError
import logging

router = APIRouter()
security = HTTPBearer()
logger = logging.getLogger(__name__)

# ============================================
# PASSWORD RESET SCHEMAS
# ============================================

class ForgotPasswordRequest(BaseModel):
    email: EmailStr

class ResetPasswordRequest(BaseModel):
    token: str
    new_password: str

# ============================================
# DEPENDENCY: Get Current User
# ============================================

async def get_current_user(
    credentials: HTTPAuthorizationCredentials = Depends(security)
) -> dict:
    """Get current authenticated user from JWT token"""
    token = credentials.credentials
    
    try:
        payload = decode_token(token)
        user_id = payload.get("sub")
        
        if not user_id:
            raise HTTPException(
                status_code=status.HTTP_401_UNAUTHORIZED,
                detail="Invalid authentication credentials"
            )
        
        # Get user from database (including role and last_selected_project_id)
        result = await execute_on_main_db(
            "SELECT id, email, full_name, avatar_url, is_active, is_verified, plan, role, last_selected_project_id, created_at FROM users WHERE id = $1 AND is_active = TRUE",
            UUID(user_id)
        )
        
        if not result:
            raise HTTPException(
                status_code=status.HTTP_401_UNAUTHORIZED,
                detail="User not found or inactive"
            )
        
        user = dict(result[0])
        # MEDIUM-1 FIX: Role is sourced exclusively from the database record.
        # Never trust the role embedded in the JWT payload — it could be stale
        # or tampered with. The DB value is always authoritative.
        # (The jwt payload role is intentionally NOT merged here.)
        
        return user
        
    except Exception as e:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Could not validate credentials"
        )

# ============================================
# SIGNUP
# ============================================

@router.post("/signup", response_model=Token, status_code=status.HTTP_201_CREATED)
async def signup(request: Request, raw_data: dict, background_tasks: BackgroundTasks):
    """
    Register a new user with comprehensive server-side validation.
    All inputs are validated and sanitized regardless of frontend checks.
    Sends welcome email in background.
    """
    
    try:
        # Server-side validation and sanitization
        try:
            user_data = validate_and_sanitize_input(
                raw_data,
                SecureUserCreate,
                context="signup"
            )
        except HTTPException as e:
            # Log validation failure (generic message to user)
            log_validation_failure(
                endpoint="signup",
                email=raw_data.get('email', 'unknown'),
                error_type="validation",
                details={"status": "rejected"}
            )
            raise
        
        client_ip = request.client.host if request.client else "unknown"
        logger.info(f"📝 Signup attempt for email: {user_data.email} from IP: {client_ip}")
        
        # Check if user already exists
        existing = await execute_on_main_db(
            "SELECT id FROM users WHERE email = $1",
            user_data.email
        )
        
        if existing:
            logger.warning(f"❌ Signup failed - email already registered: {user_data.email}")
            # Generic error message (don't reveal if email exists)
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail="Unable to create account. Please check your information and try again."
            )
        
        logger.info(f"✅ Email available: {user_data.email}")
        
        # Hash password (already validated for strength)
        try:
            password_hash = hash_password(user_data.password)
            logger.info(f"✅ Password hashed successfully")
        except Exception as e:
            logger.error(f"❌ Password hashing failed: {str(e)}")
            raise HTTPException(
                status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
                detail="Unable to process request. Please try again."
            )
        
        # Create user
        try:
            result = await execute_on_main_db(
                """
                INSERT INTO users (email, password_hash, full_name)
                VALUES ($1, $2, $3)
                RETURNING id, email, full_name, avatar_url, is_active, is_verified, plan, created_at
                """,
                user_data.email,
                password_hash,
                user_data.full_name
            )
            logger.info(f"✅ User created in database: {user_data.email}")
        except Exception as e:
            logger.error(f"❌ Database insert failed: {str(e)}")
            raise HTTPException(
                status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
                detail="Unable to create account. Please try again."
            )
        
        user = dict(result[0])
        
        # Create access token with role
        try:
            access_token = create_access_token({
                "sub": str(user["id"]),
                "email": user["email"],
                "role": user.get("role", "user")
            })
            logger.info(f"✅ Access token created for: {user['email']}")
        except Exception as e:
            logger.error(f"❌ Token creation failed: {str(e)}")
            raise HTTPException(
                status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
                detail="Unable to complete registration. Please try again."
            )
        
        # Schedule welcome email in background (never blocks signup)
        background_tasks.add_task(
            send_welcome_email_background,
            user_id=user["id"],
            user_email=user["email"],
            user_name=user.get("full_name") or user["email"]
        )
        logger.info(f"📧 Welcome email scheduled for: {user['email']}")
        
        logger.info(f"🎉 Signup successful for: {user['email']} from IP: {client_ip}")
        
        return Token(
            access_token=access_token,
            user=UserResponse(**user)
        )
        
    except HTTPException:
        raise
    except ValidationError as e:
        # Log validation error details server-side
        log_validation_failure(
            endpoint="signup",
            email=raw_data.get('email', 'unknown'),
            error_type="pydantic_validation",
            details={"errors": e.errors()}
        )
        # Return generic error
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Invalid input provided. Please check your data and try again."
        )
    except Exception as e:
        logger.error(f"❌ Unexpected error in signup: {str(e)}")
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail="Unable to process request. Please try again."
        )


async def send_welcome_email_background(user_id: UUID, user_email: str, user_name: str):
    """
    Background task to send welcome email and update database.
    Never blocks signup - runs asynchronously.
    """
    try:
        logger.info(f"📧 Starting welcome email background task for: {user_email}")
        
        # Get email service
        email_service = get_email_service()
        
        # Send welcome email
        success = await email_service.send_welcome_email(user_email, user_name)
        
        if success:
            # Update database to mark email as sent
            await execute_on_main_db(
                """
                UPDATE users 
                SET welcome_email_sent = TRUE, welcome_email_sent_at = NOW()
                WHERE id = $1
                """,
                user_id
            )
            logger.info(f"✅ Welcome email sent and database updated for: {user_email}")
        else:
            logger.error(f"❌ Failed to send welcome email for: {user_email}")
            
    except Exception as e:
        # Log error but don't raise - never block signup
        logger.error(f"❌ Error in welcome email background task for {user_email}: {str(e)}")


# ============================================
# LOGIN
# ============================================

@router.post("/login", response_model=Token)
async def login(request: Request, raw_data: dict):
    """
    Login user with comprehensive rate limiting and account lockout.
    
    Features:
    - IP-based rate limiting (10 requests/minute)
    - Account lockout after 5 failed attempts
    - Progressive delays (1s, 2s, 5s, 10s)
    - Generic error messages
    """
    
    try:
        # Get client IP
        client_ip = request.client.host if request.client else "unknown"
        
        # PHASE 1: IP-BASED RATE LIMITING
        # Check if IP has exceeded request rate limit
        from app.services.rate_limiter import rate_limiter
        
        ip_allowed, ip_retry_after = await rate_limiter.check_ip_rate_limit(client_ip)
        if not ip_allowed:
            logger.warning(f"🚫 IP rate limit exceeded: {client_ip}")
            raise HTTPException(
                status_code=status.HTTP_429_TOO_MANY_REQUESTS,
                detail="Too many login requests. Please try again later.",
                headers={"Retry-After": str(ip_retry_after)} if ip_retry_after else {}
            )
        
        # PHASE 2: INPUT VALIDATION
        # Server-side validation and sanitization
        try:
            credentials = validate_and_sanitize_input(
                raw_data,
                SecureUserLogin,
                context="login"
            )
        except HTTPException as e:
            log_validation_failure(
                endpoint="login",
                email=raw_data.get('email', 'unknown'),
                error_type="validation",
                details={"status": "rejected"}
            )
            raise
        
        logger.info(f"🔐 Login attempt for email: {credentials.email} from IP: {client_ip}")
        
        # PHASE 3: ACCOUNT LOCKOUT CHECK
        # Check if account is locked due to failed attempts
        account_allowed, account_retry_after, failure_count = await rate_limiter.check_account_lockout(
            credentials.email
        )
        
        if not account_allowed:
            logger.warning(
                f"🚫 Account locked: {credentials.email} from IP: {client_ip} ({failure_count} failures)"
            )
            log_suspicious_activity(
                activity_type="locked_account_login_attempt",
                identifier=credentials.email,
                details={"ip": client_ip, "failures": failure_count}
            )
            # Generic error - don't reveal lockout reason
            raise HTTPException(
                status_code=status.HTTP_401_UNAUTHORIZED,
                detail="Invalid credentials. Please check your email and password.",
                headers={"Retry-After": str(account_retry_after)} if account_retry_after else {}
            )
        
        # PHASE 4: GET USER FROM DATABASE
        result = await execute_on_main_db(
            "SELECT id, email, full_name, avatar_url, is_active, is_verified, plan, role, password_hash, created_at FROM users WHERE email = $1",
            credentials.email
        )
        
        if not result:
            logger.warning(f"❌ Login failed - user not found: {credentials.email}")
            
            # Record failed attempt (even for non-existent users to prevent enumeration)
            failure_count, delay = await rate_limiter.record_failed_login(
                credentials.email,
                client_ip
            )
            
            # Apply progressive delay
            await rate_limiter.apply_progressive_delay(delay)
            
            # Check if this triggered lockout
            if failure_count >= 5:
                await rate_limiter.send_lockout_notification(credentials.email, failure_count)
            
            # Generic error message
            raise HTTPException(
                status_code=status.HTTP_401_UNAUTHORIZED,
                detail="Invalid credentials. Please check your email and password."
            )
        
        user = dict(result[0])
        logger.info(f"✅ User found: {user['email']}")
        
        # PHASE 5: VERIFY PASSWORD WITH AUTOMATIC MIGRATION
        # Use migration service to verify and upgrade weak hashes
        from app.services.password_migration import password_migration_service
        
        password_valid, was_migrated = await password_migration_service.check_and_migrate_password(
            user_id=user["id"],
            email=user["email"],
            plain_password=credentials.password,
            current_hash=user["password_hash"]
        )
        
        if not password_valid:
            logger.warning(f"❌ Login failed - invalid password: {credentials.email}")
            
            # Record failed attempt
            failure_count, delay = await rate_limiter.record_failed_login(
                credentials.email,
                client_ip
            )
            
            # Apply progressive delay BEFORE responding
            await rate_limiter.apply_progressive_delay(delay)
            
            # Check if this triggered lockout (5 failures = lockout)
            if failure_count >= 5:
                await rate_limiter.send_lockout_notification(credentials.email, failure_count)
                logger.warning(f"🔒 Account locked: {credentials.email} after {failure_count} failures")
            
            # Generic error message (don't reveal lockout status)
            raise HTTPException(
                status_code=status.HTTP_401_UNAUTHORIZED,
                detail="Invalid credentials. Please check your email and password."
            )
        
        logger.info(f"✅ Password verified for: {credentials.email}")
        
        # Log migration if it occurred
        if was_migrated:
            logger.info(f"🔒 Password hash automatically upgraded for: {credentials.email}")
        
        # PHASE 6: CHECK ACCOUNT STATUS
        if not user["is_active"]:
            logger.warning(f"❌ Login blocked - inactive account: {credentials.email}")
            raise HTTPException(
                status_code=status.HTTP_403_FORBIDDEN,
                detail="Account is not active. Please contact support."
            )
        
        # PHASE 7: SUCCESSFUL LOGIN
        # Clear failed attempts on successful login
        await rate_limiter.clear_failed_attempts(credentials.email)
        
        # Create access token with role
        access_token = create_access_token({
            "sub": str(user["id"]),
            "email": user["email"],
            "role": user.get("role", "user")
        })
        
        # Remove password_hash from response
        user.pop("password_hash")
        
        logger.info(f"🎉 Login successful for: {user['email']} from IP: {client_ip}")
        
        return Token(
            access_token=access_token,
            user=UserResponse(**user)
        )
        
    except HTTPException:
        raise
    except ValidationError as e:
        log_validation_failure(
            endpoint="login",
            email=raw_data.get('email', 'unknown'),
            error_type="pydantic_validation",
            details={"errors": e.errors()}
        )
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Invalid input provided. Please check your credentials and try again."
        )
    except Exception as e:
        logger.error(f"❌ Unexpected error in login: {str(e)}")
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail="Unable to process login. Please try again."
        )

# ============================================
# GET CURRENT USER
# ============================================

@router.get("/me", response_model=UserResponse)
async def get_me(current_user: dict = Depends(get_current_user)):
    """Get current user profile"""
    current_user.pop("password_hash", None)
    return UserResponse(**current_user)

# ============================================
# UPDATE PROFILE
# ============================================

@router.put("/profile", response_model=UserResponse)
async def update_profile(
    raw_data: dict,
    current_user: dict = Depends(get_current_user)
):
    """
    Update user profile with server-side validation and sanitization.
    """
    
    try:
        # Server-side validation and sanitization
        try:
            update_data = validate_and_sanitize_input(
                raw_data,
                SecureUserUpdate,
                context="profile_update"
            )
        except HTTPException as e:
            log_validation_failure(
                endpoint="profile_update",
                email=current_user.get('email', 'unknown'),
                error_type="validation"
            )
            raise
        
        # Build update query
        updates = []
        values = []
        param_count = 1
        
        if update_data.full_name is not None:
            updates.append(f"full_name = ${param_count}")
            values.append(update_data.full_name)
            param_count += 1
        
        if update_data.avatar_url is not None:
            updates.append(f"avatar_url = ${param_count}")
            values.append(update_data.avatar_url)
            param_count += 1
        
        if not updates:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail="No fields to update"
            )
        
        # Add user_id to values
        values.append(current_user["id"])
        
        # Execute update
        query = f"""
            UPDATE users 
            SET {', '.join(updates)}, updated_at = NOW()
            WHERE id = ${param_count}
            RETURNING id, email, full_name, avatar_url, is_active, is_verified, plan, role, created_at
        """
        
        result = await execute_on_main_db(query, *values)
        
        logger.info(f"✅ Profile updated for user: {current_user['email']}")
        
        return UserResponse(**dict(result[0]))
    
    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"❌ Error updating profile: {str(e)}")
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail="Unable to update profile. Please try again."
        )

# ============================================
# LOGOUT (Client-side token removal)
# ============================================

@router.post("/logout", response_model=MessageResponse)
async def logout(current_user: dict = Depends(get_current_user)):
    """Logout user (client should remove token)"""
    return MessageResponse(
        message="Logged out successfully",
        success=True
    )

# ============================================
# FORGOT PASSWORD
# ============================================

@router.post("/forgot-password", response_model=MessageResponse)
async def forgot_password(request: Request, raw_data: dict):
    """
    Request password reset with server-side validation.
    Generic response prevents email enumeration attacks.
    """
    
    try:
        # Server-side validation and sanitization
        try:
            reset_request = validate_and_sanitize_input(
                raw_data,
                SecureForgotPassword,
                context="forgot_password"
            )
        except HTTPException as e:
            log_validation_failure(
                endpoint="forgot_password",
                email=raw_data.get('email', 'unknown'),
                error_type="validation"
            )
            raise
        
        client_ip = request.client.host if request.client else "unknown"
        logger.info(f"🔑 Password reset request for: {reset_request.email} from IP: {client_ip}")
        
        # Check if user exists
        result = await execute_on_main_db(
            "SELECT id, email, full_name FROM users WHERE email = $1 AND is_active = TRUE",
            reset_request.email
        )
        
        if not result:
            # Don't reveal if email exists or not (security best practice)
            logger.info(f"Password reset requested for non-existent email: {reset_request.email}")
            return MessageResponse(
                message="If your email is registered, you will receive a password reset link shortly.",
                success=True
            )
        
        user = dict(result[0])
        
        # Generate secure reset token
        reset_token = secrets.token_urlsafe(32)
        expires_at = datetime.utcnow() + timedelta(hours=1)  # Token valid for 1 hour
        
        # Store reset token in database
        await execute_on_main_db(
            """
            INSERT INTO password_reset_tokens (user_id, token, expires_at)
            VALUES ($1, $2, $3)
            """,
            user["id"],
            reset_token,
            expires_at
        )
        
        # In production, send email here
        # TODO: Integrate email service (SendGrid, AWS SES, etc.)
        
        logger.info(f"🔑 Password reset token generated for {user['email']}")
        logger.info(f"🔗 Reset link: http://localhost:3000/reset-password?token={reset_token}")
        
        return MessageResponse(
            message="If your email is registered, you will receive a password reset link shortly.",
            success=True
        )
    
    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"❌ Error in forgot password: {str(e)}")
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail="Unable to process request. Please try again."
        )

# ============================================
# RESET PASSWORD
# ============================================

@router.post("/reset-password", response_model=MessageResponse)
async def reset_password(request: Request, raw_data: dict):
    """
    Reset password using token with comprehensive validation.
    Validates token format and new password strength.
    """
    
    try:
        # Server-side validation and sanitization
        try:
            reset_data = validate_and_sanitize_input(
                raw_data,
                SecurePasswordReset,
                context="reset_password"
            )
        except HTTPException as e:
            log_validation_failure(
                endpoint="reset_password",
                error_type="validation",
                details={"has_token": bool(raw_data.get('token'))}
            )
            raise
        
        client_ip = request.client.host if request.client else "unknown"
        logger.info(f"🔑 Password reset attempt from IP: {client_ip}")
        
        # Validate token
        result = await execute_on_main_db(
            """
            SELECT prt.id, prt.user_id, prt.expires_at, prt.used, u.email
            FROM password_reset_tokens prt
            JOIN users u ON prt.user_id = u.id
            WHERE prt.token = $1
            """,
            reset_data.token
        )
        
        if not result:
            logger.warning(f"❌ Invalid reset token from IP: {client_ip}")
            log_suspicious_activity(
                activity_type="invalid_reset_token",
                identifier=client_ip,
                details={"reason": "token_not_found"}
            )
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail="Invalid or expired reset token"
            )
        
        token_data = dict(result[0])
        
        # Check if token is already used
        if token_data["used"]:
            logger.warning(f"❌ Reset token already used: {token_data['email']}")
            log_suspicious_activity(
                activity_type="reused_reset_token",
                identifier=token_data['email'],
                details={"ip": client_ip}
            )
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail="This reset token has already been used"
            )
        
        # Check if token is expired
        if datetime.utcnow() > token_data["expires_at"].replace(tzinfo=None):
            logger.warning(f"❌ Expired reset token: {token_data['email']}")
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail="Reset token has expired. Please request a new one."
            )
        
        # Hash new password (already validated for strength by SecurePasswordReset)
        password_hash = hash_password(reset_data.new_password)
        
        # Update user password
        await execute_on_main_db(
            """
            UPDATE users 
            SET password_hash = $1, updated_at = NOW()
            WHERE id = $2
            """,
            password_hash,
            token_data["user_id"]
        )
        
        # Mark token as used
        await execute_on_main_db(
            """
            UPDATE password_reset_tokens 
            SET used = TRUE
            WHERE id = $1
            """,
            token_data["id"]
        )
        
        logger.info(f"✅ Password reset successful for user: {token_data['email']}")
        
        return MessageResponse(
            message="Password has been reset successfully. You can now login with your new password.",
            success=True
        )
    
    except HTTPException:
        raise
    except ValidationError as e:
        log_validation_failure(
            endpoint="reset_password",
            error_type="pydantic_validation",
            details={"errors": e.errors()}
        )
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Invalid input provided. Please check your data and try again."
        )
    except Exception as e:
        logger.error(f"❌ Error in password reset: {str(e)}")
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail="Unable to reset password. Please try again."
        )

# ============================================
# VERIFY RESET TOKEN
# ============================================

@router.get("/verify-reset-token/{token}", response_model=MessageResponse)
async def verify_reset_token(token: str):
    """Verify if reset token is valid (for frontend validation)"""
    
    result = await execute_on_main_db(
        """
        SELECT expires_at, used
        FROM password_reset_tokens
        WHERE token = $1
        """,
        token
    )
    
    if not result:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Invalid reset token"
        )
    
    token_data = dict(result[0])
    
    if token_data["used"]:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="This reset token has already been used"
        )
    
    if datetime.utcnow() > token_data["expires_at"].replace(tzinfo=None):
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Reset token has expired"
        )
    
    return MessageResponse(
        message="Token is valid",
        success=True
    )


# ============================================
# UPDATE LAST SELECTED PROJECT
# ============================================

@router.put("/me/last-project/{project_id}", response_model=MessageResponse)
async def update_last_selected_project(
    project_id: UUID,
    current_user: dict = Depends(get_current_user)
):
    """Update user's last selected project"""
    
    try:
        # Verify project belongs to user
        project = await execute_on_main_db(
            "SELECT id FROM projects WHERE id = $1 AND user_id = $2",
            project_id,
            current_user["id"]  # Already a UUID object
        )
        
        if not project:
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND,
                detail="Project not found or access denied"
            )
        
        # Update last selected project
        await execute_on_main_db(
            "UPDATE users SET last_selected_project_id = $1, updated_at = NOW() WHERE id = $2",
            project_id,
            current_user["id"]  # Already a UUID object
        )
        
        return {"message": "Last selected project updated successfully", "success": True}
        
    except HTTPException:
        raise
    except Exception as e:
        import traceback
        print(f"❌ Error updating last selected project: {str(e)}")
        print(traceback.format_exc())
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Failed to update last selected project: {str(e)}"
        )


# ============================================
# TEST ENDPOINT: Send Welcome Email
# ============================================

@router.post("/test/send-welcome-email", response_model=MessageResponse)
async def test_send_welcome_email(
    email: EmailStr,
    current_user: dict = Depends(get_current_user)
):
    """
    Test endpoint to send welcome email to any address.
    Protected - requires authentication.
    """
    
    try:
        logger.info(f"🧪 Test welcome email request from: {current_user['email']} to: {email}")
        
        # Get email service
        email_service = get_email_service()
        
        # Send welcome email
        user_name = email.split('@')[0].title()  # Use email prefix as name
        success = await email_service.send_welcome_email(email, user_name)
        
        if success:
            logger.info(f"✅ Test welcome email sent to: {email}")
            return MessageResponse(
                message=f"Welcome email sent successfully to {email}",
                success=True
            )
        else:
            logger.error(f"❌ Failed to send test welcome email to: {email}")
            raise HTTPException(
                status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
                detail="Failed to send welcome email. Check server logs for details."
            )
            
    except Exception as e:
        logger.error(f"❌ Error in test welcome email: {str(e)}")
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Failed to send test email: {str(e)}"
        )

