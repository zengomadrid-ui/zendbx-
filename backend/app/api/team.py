"""
Team Collaboration API
Handles project members and real-time chat
"""
from fastapi import APIRouter, HTTPException, Depends, status
from app.models.schemas import MessageResponse
from app.api.auth import get_current_user
from app.core.database import execute_on_main_db
from typing import List
from uuid import UUID
from pydantic import BaseModel, EmailStr
from datetime import datetime

router = APIRouter()

# ============================================
# SCHEMAS
# ============================================

class MemberInvite(BaseModel):
    email: EmailStr
    role: str = "editor"  # admin, editor, viewer

class MemberUpdate(BaseModel):
    role: str  # admin, editor, viewer

class MemberResponse(BaseModel):
    id: UUID
    project_id: UUID
    user_id: UUID
    email: str
    full_name: str
    role: str
    joined_at: datetime
    last_active_at: datetime

class MessageCreate(BaseModel):
    content: str

class MessageResponse(BaseModel):
    id: UUID
    project_id: UUID
    user_id: UUID
    sender_name: str
    sender_email: str
    content: str
    created_at: datetime
    updated_at: datetime

# ============================================
# HELPER: Check if user is project admin
# ============================================

async def check_project_admin(project_id: UUID, user_id: UUID) -> bool:
    """Check if user is admin of the project"""
    result = await execute_on_main_db(
        """
        SELECT role FROM project_members
        WHERE project_id = $1 AND user_id = $2
        """,
        project_id, user_id
    )
    return result and result[0]["role"] == "admin"

async def check_project_member(project_id: UUID, user_id: UUID) -> bool:
    """Check if user is member of the project"""
    result = await execute_on_main_db(
        """
        SELECT id FROM project_members
        WHERE project_id = $1 AND user_id = $2
        """,
        project_id, user_id
    )
    return bool(result)

# ============================================
# INVITE USER TO PROJECT
# ============================================

@router.post("/{project_id}/invite", response_model=MessageResponse)
async def invite_member(
    project_id: UUID,
    invite: MemberInvite,
    current_user: dict = Depends(get_current_user)
):
    """Invite a user to join the project (admin only)"""
    
    # Check if current user is admin
    is_admin = await check_project_admin(project_id, current_user["id"])
    if not is_admin:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Only project admins can invite members"
        )
    
    # Validate role
    if invite.role not in ["admin", "editor", "viewer"]:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Role must be admin, editor, or viewer"
        )
    
    # Find user by email
    user_result = await execute_on_main_db(
        "SELECT id FROM users WHERE email = $1",
        invite.email
    )
    
    if not user_result:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=f"User with email {invite.email} not found"
        )
    
    invited_user_id = user_result[0]["id"]
    
    # Check if already a member
    existing = await execute_on_main_db(
        """
        SELECT id FROM project_members
        WHERE project_id = $1 AND user_id = $2
        """,
        project_id, invited_user_id
    )
    
    if existing:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="User is already a member of this project"
        )
    
    # Add member
    await execute_on_main_db(
        """
        INSERT INTO project_members (project_id, user_id, role, invited_by)
        VALUES ($1, $2, $3, $4)
        """,
        project_id, invited_user_id, invite.role, current_user["id"]
    )
    
    return MessageResponse(
        message=f"User {invite.email} invited as {invite.role}",
        success=True
    )

# ============================================
# LIST PROJECT MEMBERS
# ============================================

@router.get("/{project_id}/members", response_model=List[MemberResponse])
async def list_members(
    project_id: UUID,
    current_user: dict = Depends(get_current_user)
):
    """Get all members of a project"""
    
    # Check if user is member
    is_member = await check_project_member(project_id, current_user["id"])
    if not is_member:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="You are not a member of this project"
        )
    
    # Get members with user details
    result = await execute_on_main_db(
        """
        SELECT 
            pm.id,
            pm.project_id,
            pm.user_id,
            u.email,
            u.full_name,
            pm.role,
            pm.joined_at,
            pm.last_active_at
        FROM project_members pm
        JOIN users u ON pm.user_id = u.id
        WHERE pm.project_id = $1
        ORDER BY pm.joined_at ASC
        """,
        project_id
    )
    
    return [MemberResponse(**dict(row)) for row in result]

# ============================================
# UPDATE MEMBER ROLE
# ============================================

@router.patch("/{project_id}/members/{user_id}", response_model=MessageResponse)
async def update_member_role(
    project_id: UUID,
    user_id: UUID,
    update: MemberUpdate,
    current_user: dict = Depends(get_current_user)
):
    """Update a member's role (admin only)"""
    
    # Check if current user is admin
    is_admin = await check_project_admin(project_id, current_user["id"])
    if not is_admin:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Only project admins can update member roles"
        )
    
    # Validate role
    if update.role not in ["admin", "editor", "viewer"]:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Role must be admin, editor, or viewer"
        )
    
    # Check if member exists
    member = await execute_on_main_db(
        """
        SELECT id FROM project_members
        WHERE project_id = $1 AND user_id = $2
        """,
        project_id, user_id
    )
    
    if not member:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Member not found"
        )
    
    # Update role
    await execute_on_main_db(
        """
        UPDATE project_members
        SET role = $1
        WHERE project_id = $2 AND user_id = $3
        """,
        update.role, project_id, user_id
    )
    
    return MessageResponse(
        message=f"Member role updated to {update.role}",
        success=True
    )

# ============================================
# REMOVE MEMBER
# ============================================

@router.delete("/{project_id}/members/{user_id}", response_model=MessageResponse)
async def remove_member(
    project_id: UUID,
    user_id: UUID,
    current_user: dict = Depends(get_current_user)
):
    """Remove a member from the project (admin only)"""
    
    # Check if current user is admin
    is_admin = await check_project_admin(project_id, current_user["id"])
    if not is_admin:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Only project admins can remove members"
        )
    
    # Prevent removing yourself if you're the only admin
    if str(user_id) == str(current_user["id"]):
        admin_count = await execute_on_main_db(
            """
            SELECT COUNT(*) as count FROM project_members
            WHERE project_id = $1 AND role = 'admin'
            """,
            project_id
        )
        
        if admin_count[0]["count"] <= 1:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail="Cannot remove the last admin. Assign another admin first."
            )
    
    # Remove member
    result = await execute_on_main_db(
        """
        DELETE FROM project_members
        WHERE project_id = $1 AND user_id = $2
        """,
        project_id, user_id
    )
    
    return MessageResponse(
        message="Member removed successfully",
        success=True
    )

# ============================================
# GET CHAT MESSAGES
# ============================================

@router.get("/{project_id}/messages", response_model=List[MessageResponse])
async def get_messages(
    project_id: UUID,
    limit: int = 100,
    current_user: dict = Depends(get_current_user)
):
    """Get chat messages for a project"""
    
    # Check if user is member
    is_member = await check_project_member(project_id, current_user["id"])
    if not is_member:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="You are not a member of this project"
        )
    
    # Get messages with sender details
    result = await execute_on_main_db(
        """
        SELECT 
            m.id,
            m.project_id,
            m.user_id,
            u.full_name as sender_name,
            u.email as sender_email,
            m.content,
            m.created_at,
            m.updated_at
        FROM project_messages m
        JOIN users u ON m.user_id = u.id
        WHERE m.project_id = $1 AND m.is_deleted = FALSE
        ORDER BY m.created_at DESC
        LIMIT $2
        """,
        project_id, limit
    )
    
    messages = [MessageResponse(**dict(row)) for row in result]
    return list(reversed(messages))  # Return oldest first

# ============================================
# SEND CHAT MESSAGE
# ============================================

@router.post("/{project_id}/messages", response_model=MessageResponse)
async def send_message(
    project_id: UUID,
    message: MessageCreate,
    current_user: dict = Depends(get_current_user)
):
    """Send a chat message (admin and editor only)"""
    
    # Check if user is member and get role
    member = await execute_on_main_db(
        """
        SELECT role FROM project_members
        WHERE project_id = $1 AND user_id = $2
        """,
        project_id, current_user["id"]
    )
    
    if not member:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="You are not a member of this project"
        )
    
    role = member[0]["role"]
    if role == "viewer":
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Viewers cannot send messages"
        )
    
    # Insert message
    result = await execute_on_main_db(
        """
        INSERT INTO project_messages (project_id, user_id, content)
        VALUES ($1, $2, $3)
        RETURNING id, project_id, user_id, content, created_at, updated_at
        """,
        project_id, current_user["id"], message.content
    )
    
    msg = dict(result[0])
    
    return MessageResponse(
        **msg,
        sender_name=current_user.get("full_name", "Unknown"),
        sender_email=current_user.get("email", "")
    )
