"""Environment Manager - Handle environment variables"""

import httpx
import os
from pathlib import Path
from typing import Dict, Optional


class EnvManager:
    """Manages environment variables"""
    
    def __init__(self):
        self.api_url = os.getenv('ZENDBX_API_URL', 'http://localhost:8000')
        self.env_file = Path(".env")
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
    
    def pull(self) -> Dict[str, str]:
        """Pull environment variables from cloud"""
        with httpx.Client() as client:
            response = client.get(
                f"{self.api_url}/api/projects/{self.project['project_id']}/env",
                headers=self._get_headers(),
                timeout=30
            )
            
            if response.status_code != 200:
                raise Exception(f"Failed to pull environment: {response.text}")
            
            return response.json().get('variables', {})
    
    def push(self, variables: Dict[str, str]):
        """Push environment variables to cloud"""
        with httpx.Client() as client:
            response = client.put(
                f"{self.api_url}/api/projects/{self.project['project_id']}/env",
                headers=self._get_headers(),
                json={'variables': variables},
                timeout=30
            )
            
            if response.status_code != 200:
                raise Exception(f"Failed to push environment: {response.text}")
    
    def set_remote(self, key: str, value: str):
        """Set environment variable in cloud"""
        with httpx.Client() as client:
            response = client.post(
                f"{self.api_url}/api/projects/{self.project['project_id']}/env",
                headers=self._get_headers(),
                json={'key': key, 'value': value},
                timeout=30
            )
            
            if response.status_code not in (200, 201):
                raise Exception(f"Failed to set variable: {response.text}")
    
    def unset_remote(self, key: str):
        """Remove environment variable from cloud"""
        with httpx.Client() as client:
            response = client.delete(
                f"{self.api_url}/api/projects/{self.project['project_id']}/env/{key}",
                headers=self._get_headers(),
                timeout=30
            )
            
            if response.status_code not in (200, 204):
                raise Exception(f"Failed to unset variable: {response.text}")
    
    def list_remote(self) -> Dict[str, str]:
        """List environment variables from cloud"""
        return self.pull()
    
    def load_from_file(self, file_path: str) -> Dict[str, str]:
        """Load environment variables from file"""
        env_file = Path(file_path)
        
        if not env_file.exists():
            return {}
        
        variables = {}
        
        for line in env_file.read_text().splitlines():
            line = line.strip()
            
            if not line or line.startswith('#'):
                continue
            
            if '=' in line:
                key, value = line.split('=', 1)
                variables[key.strip()] = value.strip()
        
        return variables
    
    def save_to_file(self, variables: Dict[str, str]):
        """Save environment variables to .env file"""
        with self.env_file.open('w') as f:
            for key, value in variables.items():
                f.write(f"{key}={value}\n")
    
    def set_local(self, key: str, value: str):
        """Set variable in local .env"""
        variables = self.load_from_file(str(self.env_file))
        variables[key] = value
        self.save_to_file(variables)
    
    def unset_local(self, key: str):
        """Remove variable from local .env"""
        variables = self.load_from_file(str(self.env_file))
        
        if key in variables:
            del variables[key]
            self.save_to_file(variables)
    
    def local_env_exists(self) -> bool:
        """Check if local .env file exists"""
        return self.env_file.exists()
