"""Secrets Manager - Handle secure secrets"""

import httpx
import os
from typing import List, Dict, Any


class SecretsManager:
    """Manages secure secrets"""
    
    def __init__(self):
        self.api_url = os.getenv('ZENDBX_API_URL', 'http://localhost:8000')
        self._ensure_auth()
        self._ensure_project()
    
    def _ensure_auth(self):
        """Ensure user is authenticated"""
        from .auth import AuthManager
        self.auth_manager = AuthManager()
        self.token = self.auth_manager.get_current_token()
        
        if not self.token:
            raise Exception("Not authenticated. Run: zendbx login")
    
    def _ensure_project(self):
        """Ensure project is linked"""
        from .project_manager import ProjectManager
        project_manager = ProjectManager()
        
        if not project_manager.is_linked():
            raise Exception("Not linked to a project. Run: zendbx link <project>")
        
        self.project = project_manager.get_linked_project()
    
    def _get_headers(self) -> Dict[str, str]:
        """Get headers with auth token"""
        return {
            'Authorization': f'Bearer {self.token}',
            'Content-Type': 'application/json'
        }
    
    def list_secrets(self) -> List[Dict[str, Any]]:
        """List all secrets (names only, not values)"""
        with httpx.Client() as client:
            response = client.get(
                f"{self.api_url}/api/projects/{self.project['project_id']}/secrets",
                headers=self._get_headers(),
                timeout=30
            )
            
            if response.status_code != 200:
                raise Exception(f"Failed to list secrets: {response.text}")
            
            return response.json().get('secrets', [])
    
    def get_secret(self, name: str) -> str:
        """Get secret value"""
        with httpx.Client() as client:
            response = client.get(
                f"{self.api_url}/api/projects/{self.project['project_id']}/secrets/{name}",
                headers=self._get_headers(),
                timeout=30
            )
            
            if response.status_code != 200:
                raise Exception(f"Failed to get secret: {response.text}")
            
            return response.json().get('value', '')
    
    def set_secret(self, name: str, value: str):
        """Set secret value"""
        with httpx.Client() as client:
            response = client.put(
                f"{self.api_url}/api/projects/{self.project['project_id']}/secrets/{name}",
                headers=self._get_headers(),
                json={'value': value},
                timeout=30
            )
            
            if response.status_code not in (200, 201):
                raise Exception(f"Failed to set secret: {response.text}")
    
    def delete_secret(self, name: str):
        """Delete secret"""
        with httpx.Client() as client:
            response = client.delete(
                f"{self.api_url}/api/projects/{self.project['project_id']}/secrets/{name}",
                headers=self._get_headers(),
                timeout=30
            )
            
            if response.status_code not in (200, 204):
                raise Exception(f"Failed to delete secret: {response.text}")
