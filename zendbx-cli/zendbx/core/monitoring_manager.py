"""Monitoring Manager - Handle logs and metrics"""

import httpx
import os
import time
from typing import List, Dict, Any, Optional


class MonitoringManager:
    """Manages monitoring and logs"""
    
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
            'Authorization': f'Bearer {self.token}'
        }
    
    def get_logs(
        self,
        service: Optional[str] = None,
        level: Optional[str] = None,
        limit: int = 100
    ) -> List[Dict[str, Any]]:
        """Get logs"""
        params = {'limit': limit}
        
        if service:
            params['service'] = service
        
        if level:
            params['level'] = level
        
        with httpx.Client() as client:
            response = client.get(
                f"{self.api_url}/api/projects/{self.project['project_id']}/logs",
                headers=self._get_headers(),
                params=params,
                timeout=30
            )
            
            if response.status_code != 200:
                raise Exception(f"Failed to get logs: {response.text}")
            
            return response.json().get('logs', [])
    
    def stream_logs(
        self,
        service: Optional[str] = None,
        level: Optional[str] = None
    ):
        """Stream logs in real-time"""
        from rich.console import Console
        console = Console()
        
        last_timestamp = None
        
        try:
            while True:
                params = {'limit': 10}
                
                if service:
                    params['service'] = service
                
                if level:
                    params['level'] = level
                
                if last_timestamp:
                    params['after'] = last_timestamp
                
                with httpx.Client() as client:
                    response = client.get(
                        f"{self.api_url}/api/projects/{self.project['project_id']}/logs/stream",
                        headers=self._get_headers(),
                        params=params,
                        timeout=30
                    )
                    
                    if response.status_code == 200:
                        logs = response.json().get('logs', [])
                        
                        for log in logs:
                            timestamp = log.get('timestamp', '')
                            level_str = log.get('level', 'INFO')
                            service_str = log.get('service', 'app')
                            message = log.get('message', '')
                            
                            # Color by level
                            level_style = "white"
                            if level_str == "ERROR":
                                level_style = "red"
                            elif level_str == "WARN":
                                level_style = "yellow"
                            
                            console.print(
                                f"[dim]{timestamp}[/dim] "
                                f"[cyan]{service_str:8}[/cyan] "
                                f"[{level_style}]{level_str:5}[/{level_style}] "
                                f"{message}"
                            )
                            
                            last_timestamp = timestamp
                
                time.sleep(2)
        
        except KeyboardInterrupt:
            pass
