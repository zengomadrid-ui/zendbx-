"""Functions Manager - Handle serverless functions"""

import httpx
import os
import subprocess
from pathlib import Path
from typing import List, Dict, Any, Optional


class FunctionsManager:
    """Manages serverless functions"""
    
    def __init__(self):
        self.api_url = os.getenv('ZENDBX_API_URL', 'http://localhost:8000')
        self.functions_dir = Path("./functions")
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
            'Authorization': f'Bearer {self.token}'
        }
    
    def create_function(self, name: str, template: str = "typescript") -> Path:
        """Create a new function from template"""
        function_dir = self.functions_dir / name
        function_dir.mkdir(parents=True, exist_ok=True)
        
        # Create function files based on template
        if template == "typescript":
            (function_dir / "index.ts").write_text("""
import { ZenDBXRequest, ZenDBXResponse } from '@zendbx/functions'

export default async function handler(req: ZenDBXRequest): Promise<ZenDBXResponse> {
  return {
    status: 200,
    body: { message: 'Hello from ZenDBX!' }
  }
}
""")
            (function_dir / "package.json").write_text("""{
  "name": "%s",
  "version": "1.0.0",
  "main": "index.ts",
  "dependencies": {
    "@zendbx/functions": "^1.0.0"
  }
}
""" % name)
        
        elif template == "python":
            (function_dir / "main.py").write_text("""
from zendbx_functions import ZenDBXRequest, ZenDBXResponse

def handler(req: ZenDBXRequest) -> ZenDBXResponse:
    return ZenDBXResponse(
        status=200,
        body={"message": "Hello from ZenDBX!"}
    )
""")
            (function_dir / "requirements.txt").write_text("zendbx-functions>=1.0.0\n")
        
        return function_dir
    
    def list_local_functions(self) -> List[str]:
        """List local function directories"""
        if not self.functions_dir.exists():
            return []
        
        return [d.name for d in self.functions_dir.iterdir() if d.is_dir()]
    
    def build_function(self, name: str):
        """Build function for deployment"""
        function_dir = self.functions_dir / name
        
        if not function_dir.exists():
            raise Exception(f"Function not found: {name}")
        
        # Build based on runtime
        if (function_dir / "package.json").exists():
            subprocess.run(["npm", "install"], cwd=function_dir, check=True)
            subprocess.run(["npm", "run", "build"], cwd=function_dir, check=True)
        
        elif (function_dir / "requirements.txt").exists():
            subprocess.run(["pip", "install", "-r", "requirements.txt", "-t", "./vendor"], 
                         cwd=function_dir, check=True)
    
    def deploy_function(self, name: str):
        """Deploy function to cloud"""
        function_dir = self.functions_dir / name
        
        if not function_dir.exists():
            raise Exception(f"Function not found: {name}")
        
        # Package and deploy
        # (Simplified - would need proper packaging)
        
        with httpx.Client() as client:
            response = client.post(
                f"{self.api_url}/api/functions/deploy",
                headers=self._get_headers(),
                json={'name': name},
                timeout=300
            )
            
            if response.status_code not in (200, 201):
                raise Exception(f"Deployment failed: {response.text}")
    
    def serve(self, port: int = 9000, watch: bool = True):
        """Serve functions locally"""
        # Start local development server
        # (Simplified - would need proper implementation)
        
        print(f"Server running on http://localhost:{port}")
        print("Press Ctrl+C to stop")
        
        try:
            import time
            while True:
                time.sleep(1)
        except KeyboardInterrupt:
            pass
    
    def get_logs(self, name: str, limit: int = 100) -> List[Dict[str, Any]]:
        """Get function logs"""
        with httpx.Client() as client:
            response = client.get(
                f"{self.api_url}/api/functions/{name}/logs",
                headers=self._get_headers(),
                params={'limit': limit},
                timeout=30
            )
            
            if response.status_code != 200:
                raise Exception(f"Failed to get logs: {response.text}")
            
            return response.json().get('logs', [])
    
    def stream_logs(self, name: str):
        """Stream function logs"""
        from rich.console import Console
        console = Console()
        
        try:
            while True:
                logs = self.get_logs(name, limit=10)
                
                for log in logs:
                    timestamp = log.get('timestamp', '')
                    level = log.get('level', 'INFO')
                    message = log.get('message', '')
                    
                    console.print(f"[dim]{timestamp}[/dim] [{level}] {message}")
                
                import time
                time.sleep(2)
        
        except KeyboardInterrupt:
            pass
