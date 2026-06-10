"""
Signed URL Service
Business logic for generating signed/presigned URLs.
"""
from typing import Dict, Any
from fastapi import HTTPException

from app.services.storage_provider import StorageProvider


# Supported expiry options
SIGNED_URL_EXPIRY_OPTIONS = {
    "5m": 300,
    "15m": 900,
    "1h": 3600,
    "24h": 86400,
    "7d": 604800,
}


class SignedUrlService:
    """Service for generating signed URLs."""

    def __init__(self, storage_provider: StorageProvider):
        self.provider = storage_provider

    async def generate_signed_url(
        self,
        storage_key: str,
        expiry: str,
        provider_bucket_name: str,
    ) -> Dict[str, Any]:
        """
        Generate a signed URL for temporary access to a file.
        
        Args:
            storage_key: The storage key/path of the file
            expiry: Expiry duration (5m, 15m, 1h, 24h, 7d)
            provider_bucket_name: The provider bucket name
            
        Returns:
            Dict with url, expires_in, and expiry
        """
        expires_seconds = SIGNED_URL_EXPIRY_OPTIONS.get(expiry, 3600)
        
        url = await self.provider.generate_signed_url(
            storage_key,
            expires_seconds,
            provider_bucket_name,
        )
        
        if not url:
            raise HTTPException(
                status_code=500,
                detail="Failed to generate signed URL",
            )
        
        return {
            "url": url,
            "expires_in": expires_seconds,
            "expiry": expiry,
        }

    async def get_public_url(
        self,
        storage_key: str,
        provider_bucket_name: str,
    ) -> str:
        """
        Get public URL for a file in a public bucket.
        No expiration, works only for publicly accessible files.
        """
        return await self.provider.get_file_url(storage_key, provider_bucket_name)
