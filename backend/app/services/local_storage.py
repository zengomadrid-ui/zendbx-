"""
Local Filesystem Storage Provider Implementation
Fallback storage provider when MinIO is not available.
Stores files in a local directory structure.
"""
import os
import shutil
import asyncio
from typing import Optional, List, Dict, Any
from datetime import datetime, timedelta
from pathlib import Path
from functools import partial

from app.services.storage_provider import StorageProvider
from app.core.config import settings


class LocalStorageProvider(StorageProvider):
    """
    Local filesystem implementation of StorageProvider.
    Stores files in: {STORAGE_ROOT}/{bucket_name}/{storage_key}
    """

    def __init__(self, storage_root: str = "./storage_data"):
        self.storage_root = Path(storage_root)
        self.storage_root.mkdir(parents=True, exist_ok=True)

    async def _run_sync(self, func, *args, **kwargs):
        """Run a synchronous file operation in a thread pool."""
        loop = asyncio.get_event_loop()
        return await loop.run_in_executor(None, partial(func, *args, **kwargs))

    def _get_bucket_path(self, bucket_name: str) -> Path:
        """Get the directory path for a bucket."""
        return self.storage_root / bucket_name

    def _get_file_path(self, storage_key: str, bucket_name: str) -> Path:
        """Get the full file path for a storage key."""
        return self._get_bucket_path(bucket_name) / storage_key

    # ------------------------------------------------------------------ #
    # Bucket operations                                                    #
    # ------------------------------------------------------------------ #

    async def create_bucket(self, bucket_name: str, is_public: bool = False) -> bool:
        """Create a bucket directory."""
        try:
            bucket_path = self._get_bucket_path(bucket_name)
            await self._run_sync(bucket_path.mkdir, parents=True, exist_ok=True)
            return True
        except Exception as e:
            print(f"[LocalStorage] create_bucket error: {e}")
            return False

    async def delete_bucket(self, bucket_name: str) -> bool:
        """Delete a bucket directory and all its contents."""
        try:
            bucket_path = self._get_bucket_path(bucket_name)
            if bucket_path.exists():
                await self._run_sync(shutil.rmtree, bucket_path)
            return True
        except Exception as e:
            print(f"[LocalStorage] delete_bucket error: {e}")
            return False

    async def bucket_exists(self, bucket_name: str) -> bool:
        """Check if a bucket directory exists."""
        try:
            bucket_path = self._get_bucket_path(bucket_name)
            return await self._run_sync(bucket_path.exists)
        except Exception as e:
            print(f"[LocalStorage] bucket_exists error: {e}")
            return False

    # ------------------------------------------------------------------ #
    # File operations                                                      #
    # ------------------------------------------------------------------ #

    async def upload_file(
        self,
        storage_key: str,
        file_data: bytes,
        mime_type: str,
        bucket_name: str = "zendbx-storage",
    ) -> bool:
        """Upload a file to local storage."""
        try:
            file_path = self._get_file_path(storage_key, bucket_name)
            # Ensure parent directories exist
            await self._run_sync(file_path.parent.mkdir, parents=True, exist_ok=True)
            # Write file
            await self._run_sync(file_path.write_bytes, file_data)
            return True
        except Exception as e:
            print(f"[LocalStorage] upload_file error: {e}")
            return False

    async def delete_file(self, storage_key: str, bucket_name: str = "zendbx-storage") -> bool:
        """Delete a file from local storage."""
        try:
            file_path = self._get_file_path(storage_key, bucket_name)
            if file_path.exists():
                await self._run_sync(file_path.unlink)
            return True
        except Exception as e:
            print(f"[LocalStorage] delete_file error: {e}")
            return False

    async def rename_file(
        self,
        old_key: str,
        new_key: str,
        bucket_name: str = "zendbx-storage",
    ) -> bool:
        """Rename/move a file within storage."""
        try:
            old_path = self._get_file_path(old_key, bucket_name)
            new_path = self._get_file_path(new_key, bucket_name)
            # Ensure parent directories exist
            await self._run_sync(new_path.parent.mkdir, parents=True, exist_ok=True)
            # Move file
            await self._run_sync(shutil.move, str(old_path), str(new_path))
            return True
        except Exception as e:
            print(f"[LocalStorage] rename_file error: {e}")
            return False

    async def list_files(
        self,
        prefix: str,
        bucket_name: str = "zendbx-storage",
    ) -> List[Dict[str, Any]]:
        """List files under a prefix."""
        try:
            bucket_path = self._get_bucket_path(bucket_name)
            prefix_path = bucket_path / prefix
            
            if not prefix_path.exists():
                return []
            
            files = []
            for file_path in prefix_path.rglob("*"):
                if file_path.is_file():
                    stat = await self._run_sync(file_path.stat)
                    relative_key = str(file_path.relative_to(bucket_path))
                    files.append({
                        "key": relative_key.replace("\\", "/"),  # Normalize path separators
                        "size": stat.st_size,
                        "last_modified": datetime.fromtimestamp(stat.st_mtime).isoformat(),
                        "etag": None,
                    })
            return files
        except Exception as e:
            print(f"[LocalStorage] list_files error: {e}")
            return []

    async def generate_signed_url(
        self,
        storage_key: str,
        expires_seconds: int = 3600,
        bucket_name: str = "zendbx-storage",
    ) -> str:
        """
        Generate a signed URL for temporary access.
        For local storage, we return a direct API endpoint URL.
        """
        # In production, you'd implement proper signed URLs with JWT tokens
        # For now, return a simple URL that goes through the API
        return f"/api/storage/files/download?key={storage_key}&bucket={bucket_name}"

    async def get_file_url(self, storage_key: str, bucket_name: str = "zendbx-storage") -> str:
        """Get the public URL for a file."""
        # For local storage, return API endpoint
        return f"/api/storage/files/download?key={storage_key}&bucket={bucket_name}"

    async def get_file(self, storage_key: str, bucket_name: str = "zendbx-storage") -> Optional[bytes]:
        """Download file bytes from storage."""
        try:
            file_path = self._get_file_path(storage_key, bucket_name)
            if not file_path.exists():
                return None
            return await self._run_sync(file_path.read_bytes)
        except Exception as e:
            print(f"[LocalStorage] get_file error: {e}")
            return None

    async def get_file_metadata(
        self, storage_key: str, bucket_name: str = "zendbx-storage"
    ) -> Optional[Dict[str, Any]]:
        """Get file metadata (size, content-type, last-modified)."""
        try:
            file_path = self._get_file_path(storage_key, bucket_name)
            if not file_path.exists():
                return None
            
            stat = await self._run_sync(file_path.stat)
            
            # Try to guess content type from extension
            import mimetypes
            mime_type, _ = mimetypes.guess_type(str(file_path))
            
            return {
                "size": stat.st_size,
                "content_type": mime_type or "application/octet-stream",
                "last_modified": datetime.fromtimestamp(stat.st_mtime).isoformat(),
                "etag": None,
            }
        except Exception as e:
            print(f"[LocalStorage] get_file_metadata error: {e}")
            return None
