"""Project Manager - Handle project operations"""

import httpx
import os
import json
from pathlib import Path
from typing import Optional, Dict, Any, List


class ProjectManager:
    """Manages ZenDBX projects"""
    
    def __init__(self):
        self.api_url = os.getenv('ZENDBX_API_URL', 'http://localhost:8000')
        self.project_file = Path(".zendbx") / "project.json"
        self._ensure_auth()
    
    def _ensure_auth(self):
        """Ensure user is authenticated"""
        from .auth import AuthManager
        self.auth_manager = AuthManager()
        self.token = self.auth_manager.get_current_token()
        
        if not self.token:
            raise Exception("Not authenticated. Run: zendbx login")
    
    def _get_headers(self) -> Dict[str, str]:
        """Get headers with auth token"""
        return {
            'Authorization': f'Bearer {self.token}',
            'Content-Type': 'application/json'
        }
    
    def list_projects(self) -> List[Dict[str, Any]]:
        """List all projects"""
        with httpx.Client() as client:
            response = client.get(
                f"{self.api_url}/api/projects",
                headers=self._get_headers(),
                timeout=30
            )
            
            if response.status_code != 200:
                raise Exception(f"Failed to list projects: {response.text}")
            
            # Backend returns a list directly, not wrapped in {"projects": [...]}
            data = response.json()
            if isinstance(data, list):
                return data
            return data.get('projects', [])
    
    def get_project(self, slug: str, remote: Optional[str] = None) -> Optional[Dict[str, Any]]:
        """Get project by slug"""
        api_url = remote or self.api_url
        
        with httpx.Client() as client:
            response = client.get(
                f"{api_url}/api/projects/{slug}",
                headers=self._get_headers(),
                timeout=30
            )
            
            if response.status_code != 200:
                return None
            
            return response.json()
    
    def create_project(self, name: str, region: str = "us-east-1") -> Dict[str, Any]:
        """Create a new project"""
        with httpx.Client() as client:
            response = client.post(
                f"{self.api_url}/api/projects",
                headers=self._get_headers(),
                json={
                    'name': name,
                    'region': region
                },
                timeout=60
            )
            
            if response.status_code not in (200, 201):
                raise Exception(f"Failed to create project: {response.text}")
            
            return response.json()
    
    def delete_project(self, slug: str):
        """Delete a project"""
        with httpx.Client() as client:
            response = client.delete(
                f"{self.api_url}/api/projects/{slug}",
                headers=self._get_headers(),
                timeout=30
            )
            
            if response.status_code not in (200, 204):
                raise Exception(f"Failed to delete project: {response.text}")
    
    def is_linked(self) -> bool:
        """Check if current directory is linked to a project"""
        return self.project_file.exists()
    
    def get_linked_project(self) -> Optional[Dict[str, Any]]:
        """Get linked project info"""
        if not self.project_file.exists():
            return None
        
        try:
            return json.loads(self.project_file.read_text())
        except:
            return None
    
    def save_link(self, project: Dict[str, Any], remote: str):
        """Save project link"""
        self.project_file.parent.mkdir(parents=True, exist_ok=True)
        
        link_data = {
            'project_id': project['id'],
            'slug': project['slug'],
            'name': project['name'],
            'remote': remote
        }
        
        self.project_file.write_text(json.dumps(link_data, indent=2))
    
    def pull_environment(self, project_id: str) -> Dict[str, str]:
        """Pull environment variables"""
        with httpx.Client() as client:
            response = client.get(
                f"{self.api_url}/api/projects/{project_id}/env",
                headers=self._get_headers(),
                timeout=30
            )
            
            if response.status_code != 200:
                raise Exception(f"Failed to pull environment: {response.text}")
            
            return response.json().get('variables', {})
    
    def pull_schema(self, project_id: str) -> Dict[str, Any]:
        """Pull database schema"""
        with httpx.Client() as client:
            response = client.get(
                f"{self.api_url}/api/projects/{project_id}/schema",
                headers=self._get_headers(),
                timeout=30
            )
            
            if response.status_code != 200:
                raise Exception(f"Failed to pull schema: {response.text}")
            
            return response.json()
    
    def save_env(self, variables: Dict[str, str]):
        """Save environment variables to .env"""
        env_file = Path(".env")
        
        with env_file.open('w') as f:
            for key, value in variables.items():
                f.write(f"{key}={value}\n")
    
    def save_schema(self, schema: Dict[str, Any]):
        """Save schema to files"""
        from .schema_manager import SchemaManager, Schema
        
        schema_manager = SchemaManager()
        schema_obj = Schema(schema.get('tables', {}))
        schema_manager.save_local_schema(schema_obj)
