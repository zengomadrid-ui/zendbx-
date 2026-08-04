"""
CLI Authentication API
Handles authentication flow for ZendBX CLI tool
"""

from fastapi import APIRouter, HTTPException, Depends, status
from pydantic import BaseModel
from typing import Optional
import json
from pathlib import Path
import tempfile
import os

from ..core.security import get_current_user

router = APIRouter(prefix="/api/cli/auth", tags=["cli-auth"])


class CLIAuthCompleteRequest(BaseModel):
    session_id: str
    token: str
    user: dict


class CLIAuthStatusRequest(BaseModel):
    session_id: str


@router.post("/complete")
async def complete_cli_auth(
    request: CLIAuthCompleteRequest
):
    """
    Complete CLI authentication by storing session data
    
    This endpoint is called by the frontend after user logs in via browser.
    It stores the auth token and user info in a session file that the CLI polls.
    
    Note: This endpoint does NOT require authentication since the frontend
    is passing the token in the request body, not as a Bearer token header.
    """
    
    # Store session data in temp directory
    # In production, you'd use Redis or a database
    session_dir = Path(tempfile.gettempdir()) / "zendbx_cli_sessions"
    session_dir.mkdir(exist_ok=True)
    
    session_file = session_dir / f"session_{request.session_id}.json"
    
    session_data = {
        'session_id': request.session_id,
        'status': 'completed',
        'token': request.token,
        'user': {
            'id': request.user.get('id'),
            'email': request.user.get('email'),
            'name': request.user.get('name', ''),
        }
    }
    
    # Write session file
    session_file.write_text(json.dumps(session_data))
    
    return {
        'success': True,
        'message': 'CLI authentication completed'
    }


@router.post("/status")
async def get_cli_auth_status(request: CLIAuthStatusRequest):
    """
    Check CLI authentication status
    
    Called by CLI to poll for authentication completion.
    """
    
    # Check session file
    session_dir = Path(tempfile.gettempdir()) / "zendbx_cli_sessions"
    session_file = session_dir / f"session_{request.session_id}.json"
    
    if not session_file.exists():
        return {
            'status': 'pending',
            'message': 'Waiting for authentication'
        }
    
    try:
        session_data = json.loads(session_file.read_text())
        
        if session_data.get('status') == 'completed':
            return {
                'status': 'completed',
                'token': session_data.get('token'),
                'user': session_data.get('user')
            }
        else:
            return {
                'status': session_data.get('status', 'pending'),
                'message': 'Authentication in progress'
            }
    except Exception as e:
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Failed to read session: {str(e)}"
        )


@router.post("/initiate")
async def initiate_cli_auth(request: CLIAuthStatusRequest):
    """
    Initiate CLI authentication session
    
    Called by CLI to create a new auth session.
    """
    
    # Create session directory if it doesn't exist
    session_dir = Path(tempfile.gettempdir()) / "zendbx_cli_sessions"
    session_dir.mkdir(exist_ok=True)
    
    session_file = session_dir / f"session_{request.session_id}.json"
    
    # Create initial session data
    session_data = {
        'session_id': request.session_id,
        'status': 'pending',
        'created_at': str(os.times())
    }
    
    session_file.write_text(json.dumps(session_data))
    
    return {
        'success': True,
        'session_id': request.session_id,
        'message': 'CLI authentication session initiated'
    }


@router.delete("/cancel")
async def cancel_cli_auth(request: CLIAuthStatusRequest):
    """
    Cancel CLI authentication
    
    Called by CLI when user cancels authentication.
    """
    
    session_dir = Path(tempfile.gettempdir()) / "zendbx_cli_sessions"
    session_file = session_dir / f"session_{request.session_id}.json"
    
    if session_file.exists():
        session_file.unlink()
    
    return {
        'success': True,
        'message': 'CLI authentication cancelled'
    }
