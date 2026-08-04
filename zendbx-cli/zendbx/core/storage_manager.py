"""Storage Manager - Handle file storage operations"""

import httpx
import os
from pathlib import Path
from typing import List, Dict, Any, Optional, Callable


class StorageManager:
    """Manages file storage operations"""
    
    def __init__(self):
        self.api_url = os.getenv('ZENDBX_API_URL', 'http://localhost:8000')
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
    
    def list_buckets(self) -> List[Dict[str, Any]]:
        """List all storage buckets"""
        with httpx.Client() as client:
            response = client.get(
                f"{self.api_url}/api/storage/buckets",
                headers=self._get_headers(),
                timeout=30
            )
            
            if response.status_code != 200:
                raise Exception(f"Failed to list buckets: {response.text}")
            
            return response.json().get('buckets', [])
    
    def list_files(self, bucket: str, prefix: Optional[str] = None) -> List[Dict[str, Any]]:
        """List files in bucket"""
        params = {}
        if prefix:
            params['prefix'] = prefix
        
        with httpx.Client() as client:
            response = client.get(
                f"{self.api_url}/api/storage/buckets/{bucket}/files",
                headers=self._get_headers(),
                params=params,
                timeout=30
            )
            
            if response.status_code != 200:
                raise Exception(f"Failed to list files: {response.text}")
            
            return response.json().get('files', [])
    
    def upload_file(
        self,
        file_path: Path,
        bucket: str,
        dest_path: str,
        progress_callback: Optional[Callable] = None
    ):
        """Upload file to storage"""
        with open(file_path, 'rb') as f:
            files = {'file': (dest_path, f)}
            
            with httpx.Client() as client:
                response = client.post(
                    f"{self.api_url}/api/storage/buckets/{bucket}/upload",
                    headers=self._get_headers(),
                    files=files,
                    timeout=300
                )
                
                if response.status_code not in (200, 201):
                    raise Exception(f"Upload failed: {response.text}")
        
        if progress_callback:
            progress_callback(100)
    
    def download_file(
        self,
        bucket: str,
        file_path: str,
        output_path: Path,
        progress_callback: Optional[Callable] = None
    ):
        """Download file from storage"""
        with httpx.Client() as client:
            response = client.get(
                f"{self.api_url}/api/storage/buckets/{bucket}/files/{file_path}",
                headers=self._get_headers(),
                timeout=300
            )
            
            if response.status_code != 200:
                raise Exception(f"Download failed: {response.text}")
            
            output_path.write_bytes(response.content)
        
        if progress_callback:
            progress_callback(100)
    
    def delete_file(self, bucket: str, file_path: str):
        """Delete file from storage"""
        with httpx.Client() as client:
            response = client.delete(
                f"{self.api_url}/api/storage/buckets/{bucket}/files/{file_path}",
                headers=self._get_headers(),
                timeout=30
            )
            
            if response.status_code not in (200, 204):
                raise Exception(f"Delete failed: {response.text}")
    
    def get_public_url(self, bucket: str, file_path: str) -> Optional[str]:
        """Get public URL for file"""
        return f"{self.api_url}/storage/{bucket}/{file_path}"
