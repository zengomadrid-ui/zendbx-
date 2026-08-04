"""Authentication Manager - Handle login, logout, sessions"""

import httpx
import time
import secrets
import os
from typing import Optional, Dict, Any, List
import keyring
import json
from pathlib import Path


class AuthManager:
    """Manages authentication with ZenDBX platform"""
    
    def __init__(self):
        # Use environment variable or default to localhost for development
        # Priority: ENV VAR > localhost (for local testing)
        self.api_url = os.getenv('ZENDBX_API_URL', 'http://localhost:8000')
        self.app_url = os.getenv('ZENDBX_APP_URL', 'http://localhost:3000')
        self.service_name = "zendbx-cli"
        self.auth_dir = Path.home() / ".zendbx" / "auth"
        self.auth_dir.mkdir(parents=True, exist_ok=True)
    
    def generate_auth_url(self) -> tuple[str, str]:
        """Generate browser authentication URL and session ID"""
        session_id = secrets.token_urlsafe(32)
        
        # Initiate session on backend
        try:
            with httpx.Client() as client:
                response = client.post(
                    f"{self.api_url}/api/cli/auth/initiate",
                    json={'session_id': session_id},
                    timeout=10
                )
                
                if response.status_code != 200:
                    raise Exception("Failed to initiate CLI auth session")
        except Exception as e:
            # If backend is down, continue anyway - frontend will handle it
            print(f"Warning: Could not initiate session on backend: {e}")
        
        # Generate auth URL - use app URL for browser
        auth_url = f"{self.app_url}/cli/auth?session_id={session_id}"
        
        return auth_url, session_id
    
    def poll_for_token(self, session_id: str, timeout: int = 300) -> Dict[str, Any]:
        """Poll for authentication completion"""
        start_time = time.time()
        
        while time.time() - start_time < timeout:
            try:
                # Poll backend API for session status
                with httpx.Client() as client:
                    response = client.post(
                        f"{self.api_url}/api/cli/auth/status",
                        json={'session_id': session_id},
                        timeout=10
                    )
                    
                    if response.status_code == 200:
                        data = response.json()
                        
                        if data.get('status') == 'completed':
                            token = data.get('token')
                            user = data.get('user', {})
                            
                            # Store credentials
                            self._store_credentials(user['email'], token, user)
                            
                            return user
                        
                        elif data.get('status') == 'failed':
                            raise Exception("Authentication failed")
                
            except httpx.RequestError:
                # Network error, continue polling
                pass
            except Exception as e:
                # Other errors, re-raise
                if "Authentication failed" in str(e):
                    raise
            
            time.sleep(2)
        
        raise TimeoutError("Authentication timeout")
    
    def login_with_token(self, token: str) -> Dict[str, Any]:
        """Login with a token directly"""
        # Validate token and get user info
        with httpx.Client() as client:
            response = client.get(
                f"{self.api_url}/api/auth/user",
                headers={'Authorization': f'Bearer {token}'},
                timeout=10
            )
            
            if response.status_code != 200:
                raise Exception("Invalid token")
            
            user = response.json()
        
        # Store credentials
        self._store_credentials(user['email'], token, user)
        
        return user
    
    def logout(self):
        """Logout current user"""
        current_user = self.get_current_user()
        
        if current_user:
            email = current_user.get('email')
            if email:
                keyring.delete_password(self.service_name, email)
        
        # Remove current user marker
        current_file = self.auth_dir / "current.json"
        if current_file.exists():
            current_file.unlink()
    
    def logout_all(self):
        """Logout all users"""
        accounts = self.list_accounts()
        
        for account in accounts:
            keyring.delete_password(self.service_name, account['email'])
        
        # Clean up auth directory
        if self.auth_dir.exists():
            for file in self.auth_dir.glob("*"):
                file.unlink()
    
    def get_current_user(self) -> Optional[Dict[str, Any]]:
        """Get currently authenticated user"""
        current_file = self.auth_dir / "current.json"
        
        if not current_file.exists():
            return None
        
        try:
            current_data = json.loads(current_file.read_text())
            email = current_data.get('email')
            
            if not email:
                return None
            
            # Get credentials
            creds_json = keyring.get_password(self.service_name, email)
            
            if not creds_json:
                return None
            
            creds = json.loads(creds_json)
            return creds.get('user')
        
        except:
            return None
    
    def get_current_token(self) -> Optional[str]:
        """Get current user's token"""
        current_file = self.auth_dir / "current.json"
        
        if not current_file.exists():
            return None
        
        try:
            current_data = json.loads(current_file.read_text())
            email = current_data.get('email')
            
            if not email:
                return None
            
            creds_json = keyring.get_password(self.service_name, email)
            
            if not creds_json:
                return None
            
            creds = json.loads(creds_json)
            return creds.get('token')
        
        except:
            return None
    
    def list_accounts(self) -> List[Dict[str, Any]]:
        """List all authenticated accounts"""
        # This is a simplified version
        # In production, you'd maintain a list of accounts
        current = self.get_current_user()
        
        if current:
            return [current]
        
        return []
    
    def switch_account(self, email: str):
        """Switch to a different account"""
        # Verify account exists
        creds_json = keyring.get_password(self.service_name, email)
        
        if not creds_json:
            raise Exception(f"Account not found: {email}")
        
        # Update current user
        current_file = self.auth_dir / "current.json"
        current_file.write_text(json.dumps({'email': email}))
    
    def _store_credentials(self, email: str, token: str, user: Dict[str, Any]):
        """Store credentials securely"""
        # Store in keyring
        creds = {
            'token': token,
            'user': user,
            'stored_at': time.time()
        }
        keyring.set_password(self.service_name, email, json.dumps(creds))
        
        # Mark as current user
        current_file = self.auth_dir / "current.json"
        current_file.write_text(json.dumps({'email': email}))
