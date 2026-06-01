"""
Abstract Storage Provider Interface
Allows swapping MinIO → Cloudflare R2 → AWS S3 → Backblaze B2 without changing API or business logic.
"""
from abc import ABC, abstractmethod
from typing import Optional, List, Dict, Any, BinaryIO


class StorageProvider(ABC):
    """
    Provider-agnostic storage interface.
    All storage implementations must implement these methods.
    """

    @abstractmethod
    async def create_bucket(self, bucket_name: str, is_public: bool = False) -> bool:
        """Create a bucket/container in the storage backend."""
        ...

    @abstractmethod
    async def delete_bucket(self, bucket_name: str) -> bool:
        """Delete a bucket and all its contents."""
        ...

    @abstractmethod
    async def bucket_exists(self, bucket_name: str) -> bool:
        """Check if a bucket exists."""
        ...

    @abstractmethod
    async def upload_file(
        self,
        storage_key: str,
        file_data: bytes,
        mime_type: str,
        bucket_name: str = "zendbx-storage",
    ) -> bool:
        """Upload a file to storage. Returns True on success."""
        ...

    @abstractmethod
    async def delete_file(self, storage_key: str, bucket_name: str = "zendbx-storage") -> bool:
        """Delete a file from storage."""
        ...

    @abstractmethod
    async def rename_file(
        self,
        old_key: str,
        new_key: str,
        bucket_name: str = "zendbx-storage",
    ) -> bool:
        """Rename/move a file within storage (copy + delete)."""
        ...

    @abstractmethod
    async def list_files(
        self,
        prefix: str,
        bucket_name: str = "zendbx-storage",
    ) -> List[Dict[str, Any]]:
        """List files under a prefix. Returns list of {key, size, last_modified}."""
        ...

    @abstractmethod
    async def generate_signed_url(
        self,
        storage_key: str,
        expires_seconds: int = 3600,
        bucket_name: str = "zendbx-storage",
    ) -> str:
        """Generate a pre-signed URL for temporary access."""
        ...

    @abstractmethod
    async def get_file_url(self, storage_key: str, bucket_name: str = "zendbx-storage") -> str:
        """Get the public URL for a file (only valid for public buckets)."""
        ...

    @abstractmethod
    async def get_file(self, storage_key: str, bucket_name: str = "zendbx-storage") -> Optional[bytes]:
        """Download file bytes from storage."""
        ...

    @abstractmethod
    async def get_file_metadata(
        self, storage_key: str, bucket_name: str = "zendbx-storage"
    ) -> Optional[Dict[str, Any]]:
        """Get file metadata (size, content-type, last-modified)."""
        ...
