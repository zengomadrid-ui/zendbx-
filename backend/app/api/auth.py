from fastapi import APIRouter, HTTPException, Depends, status
from fastapi.security import HTTPBearer, HTTPAuthorizationCredentials
from app.models.schemas import (
    UserCreate, UserLogin, UserResponse, UserUpdate,
    Token, MessageResponse
)
from app.core.security import (
    hash_password, verify_password, create_access_token, decode_token
)
from app.core.database import execute_on_main_db
from typing import Optional
from uuid import UUID
import secrets
from datetime import datetime, timedelta
from pydantic import BaseModel, EmailStr

router = APIRouter()
security = HTTPBearer()

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
        # Add role from JWT payload (for consistency)
        user["role"] = payload.get("role", user.get("role", "user"))
        
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
async def signup(user_data: UserCreate):
    """Register a new user"""
    
    try:
        print(f"📝 Signup attempt for email: {user_data.email}")
        
        # Check if user already exists
        existing = await execute_on_main_db(
            "SELECT id FROM users WHERE email = $1",
            user_data.email
        )
        
        if existing:
            print(f"❌ Email already registered: {user_data.email}")
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail="Email already registered"
            )
        
        print(f"✅ Email available: {user_data.email}")
        
        # Hash password
        try:
            password_hash = hash_password(user_data.password)
            print(f"✅ Password hashed successfully")
        except Exception as e:
            print(f"❌ Password hashing failed: {str(e)}")
            raise HTTPException(
                status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
                detail=f"Password hashing failed: {str(e)}"
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
            print(f"✅ User created in database")
        except Exception as e:
            print(f"❌ Database insert failed: {str(e)}")
            print(f"❌ Error type: {type(e).__name__}")
            import traceback
            print(f"❌ Traceback: {traceback.format_exc()}")
            raise HTTPException(
                status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
                detail=f"Failed to create user: {str(e)}"
            )
        
        user = dict(result[0])
        print(f"✅ User data retrieved: {user['email']}")
        
        # Create access token with role
        try:
            access_token = create_access_token({
                "sub": str(user["id"]),
                "email": user["email"],
                "role": user.get("role", "user")
            })
            print(f"✅ Access token created")
        except Exception as e:
            print(f"❌ Token creation failed: {str(e)}")
            raise HTTPException(
                status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
                detail=f"Token creation failed: {str(e)}"
            )
        
        print(f"🎉 Signup successful for: {user['email']}")
        
        return Token(
            access_token=access_token,
            user=UserResponse(**user)
        )
        
    except HTTPException:
        # Re-raise HTTP exceptions
        raise
    except Exception as e:
        # Catch any unexpected errors
        print(f"❌ Unexpected error in signup: {str(e)}")
        print(f"❌ Error type: {type(e).__name__}")
        import traceback
        print(f"❌ Full traceback:")
        print(traceback.format_exc())
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Signup failed: {str(e)}"
        )

# ============================================
# LOGIN
# ============================================

@router.post("/login", response_model=Token)
async def login(credentials: UserLogin):
    """Login user"""
    
    try:
        print(f"🔐 Login attempt for email: {credentials.email}")
        
        # Get user
        result = await execute_on_main_db(
            "SELECT id, email, full_name, avatar_url, is_active, is_verified, plan, role, password_hash, created_at FROM users WHERE email = $1",
            credentials.email
        )
        
        if not result:
            print(f"❌ User not found: {credentials.email}")
            raise HTTPException(
                status_code=status.HTTP_401_UNAUTHORIZED,
                detail="Invalid email or password"
            )
        
        user = dict(result[0])
        print(f"✅ User found: {user['email']}")
        
        # Verify password
        if not verify_password(credentials.password, user["password_hash"]):
            print(f"❌ Invalid password for: {credentials.email}")
            raise HTTPException(
                status_code=status.HTTP_401_UNAUTHORIZED,
                detail="Invalid email or password"
            )
        
        print(f"✅ Password verified for: {credentials.email}")
        
        # Check if active
        if not user["is_active"]:
            print(f"❌ Inactive account: {credentials.email}")
            raise HTTPException(
                status_code=status.HTTP_403_FORBIDDEN,
                detail="Account is inactive"
            )
        
        # Create access token with role
        access_token = create_access_token({
            "sub": str(user["id"]),
            "email": user["email"],
            "role": user.get("role", "user")
        })
        
        # Remove password_hash from response
        user.pop("password_hash")
        
        print(f"🎉 Login successful for: {user['email']}")
        
        return Token(
            access_token=access_token,
            user=UserResponse(**user)
        )
        
    except HTTPException:
        raise
    except Exception as e:
        print(f"❌ Unexpected error in login: {str(e)}")
        import traceback
        print(traceback.format_exc())
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Login failed: {str(e)}"
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
    update_data: UserUpdate,
    current_user: dict = Depends(get_current_user)
):
    """Update user profile"""
    
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
    
    return UserResponse(**dict(result[0]))

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
async def forgot_password(request: ForgotPasswordRequest):
    """Request password reset - sends reset token"""
    
    # Check if user exists
    result = await execute_on_main_db(
        "SELECT id, email, full_name FROM users WHERE email = $1 AND is_active = TRUE",
        request.email
    )
    
    if not result:
        # Don't reveal if email exists or not (security best practice)
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
    # For now, we'll just return success
    # TODO: Integrate email service (SendGrid, AWS SES, etc.)
    
    print(f"🔑 Password reset token for {user['email']}: {reset_token}")
    print(f"🔗 Reset link: http://localhost:3000/reset-password?token={reset_token}")
    
    return MessageResponse(
        message="If your email is registered, you will receive a password reset link shortly.",
        success=True
    )

# ============================================
# RESET PASSWORD
# ============================================

@router.post("/reset-password", response_model=MessageResponse)
async def reset_password(request: ResetPasswordRequest):
    """Reset password using token"""
    
    # Validate token
    result = await execute_on_main_db(
        """
        SELECT prt.id, prt.user_id, prt.expires_at, prt.used, u.email
        FROM password_reset_tokens prt
        JOIN users u ON prt.user_id = u.id
        WHERE prt.token = $1
        """,
        request.token
    )
    
    if not result:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Invalid or expired reset token"
        )
    
    token_data = dict(result[0])
    
    # Check if token is already used
    if token_data["used"]:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="This reset token has already been used"
        )
    
    # Check if token is expired
    if datetime.utcnow() > token_data["expires_at"].replace(tzinfo=None):
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Reset token has expired. Please request a new one."
        )
    
    # Validate new password
    if len(request.new_password) < 8:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Password must be at least 8 characters long"
        )
    
    # Hash new password
    password_hash = hash_password(request.new_password)
    
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
    
    print(f"✅ Password reset successful for user: {token_data['email']}")
    
    return MessageResponse(
        message="Password has been reset successfully. You can now login with your new password.",
        success=True
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
