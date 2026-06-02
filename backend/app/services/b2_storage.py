"""
Backblaze B2 Storage Provider Implementation
Uses boto3 with the S3-compatible B2 endpoint.
Drop-in replacement for MinIOStorageProvider — implements the same StorageProvider interface.
"""
import io
import asyncio
from typing import Optional, List, Dict, Any
from functools import partial

from app.services.storage_provider import StorageProvider
from app.core.config import settings


class B2StorageProvider(StorageProvider):
    """
    Backblaze B2 implementation of StorageProvider via the S3-compatible API.
    Uses a single B2 bucket ("zendbx-storage") with path-based isolation:
        {project_id}/{bucket_slug}/{uuid}/{filename}
    """

    def __init__(self):
        self._client = None
        self._resource = None

    def _get_client(self):
        """Lazy-init boto3 S3 client pointed at B2 S3-compatible endpoint."""
        if self._client is None:
            import boto3
            self._client = boto3.client(
                "s3",
                endpoint_url=settings.b2_endpoint_url,
                aws_access_key_id=settings.B2_KEY_ID,
                aws_secret_access_key=settings.B2_APPLICATION_KEY,
                region_name=settings.B2_REGION,
            )
        return self._client

    async def _run_sync(self, func, *args, **kwargs):
        loop = asyncio.get_event_loop()
        return await loop.run_in_executor(None, partial(func, *args, **kwargs))

    # ------------------------------------------------------------------ #
    # Bucket operations                                                    #
    # ------------------------------------------------------------------ #

    async def create_bucket(self, bucket_name: str, is_public: bool = False) -> bool:
        """Ensure the top-level B2 bucket exists. B2 buckets are pre-created in the console."""
        try:
            client = self._get_client()
            # Just verify the bucket is reachable — B2 buckets must be created in the B2 console
            await self._run_sync(client.head_bucket, Bucket=bucket_name)
            return True
        except Exception as e:
            error_code = getattr(e, "response", {}).get("Error", {}).get("Code", "")
            if error_code == "404" or "NoSuchBucket" in str(e) or "404" in str(e):
                # Try creating it (works if key has CreateBucket permission)
                try:
                    client = self._get_client()
                    await self._run_sync(
                        client.create_bucket,
                        Bucket=bucket_name,
                    )
                    print(f"[B2] Created bucket: {bucket_name}")
                    return True
                except Exception as create_err:
                    print(f"[B2] create_bucket error: {create_err}")
                    return False
            print(f"[B2] create_bucket check error: {e}")
            return False

    async def delete_bucket(self, bucket_name: str) -> bool:
        """Delete all objects under a prefix (B2 root bucket itself stays)."""
        try:
            client = self._get_client()
            paginator = client.get_paginator("list_objects_v2")

            async def _delete_all():
                pages = paginator.paginate(Bucket=bucket_name)
                for page in pages:
                    objects = page.get("Contents", [])
                    if objects:
                        client.delete_objects(
                            Bucket=bucket_name,
                            Delete={"Objects": [{"Key": o["Key"]} for o in objects]},
                        )

            await self._run_sync(lambda: [
                client.delete_objects(
                    Bucket=bucket_name,
                    Delete={"Objects": [{"Key": o["Key"]} for o in page.get("Contents", [])]},
                )
                for page in paginator.paginate(Bucket=bucket_name)
                if page.get("Contents")
            ])
            return True
        except Exception as e:
            print(f"[B2] delete_bucket error: {e}")
            return False

    async def bucket_exists(self, bucket_name: str) -> bool:
        try:
            client = self._get_client()
            await self._run_sync(client.head_bucket, Bucket=bucket_name)
            return True
        except Exception:
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
        try:
            client = self._get_client()
            await self._run_sync(
                client.put_object,
                Bucket=bucket_name,
                Key=storage_key,
                Body=file_data,
                ContentType=mime_type,
            )
            return True
        except Exception as e:
            print(f"[B2] upload_file error: {e}")
            return False

    async def delete_file(self, storage_key: str, bucket_name: str = "zendbx-storage") -> bool:
        try:
            client = self._get_client()
            await self._run_sync(
                client.delete_object,
                Bucket=bucket_name,
                Key=storage_key,
            )
            return True
        except Exception as e:
            print(f"[B2] delete_file error: {e}")
            return False

    async def rename_file(
        self,
        old_key: str,
        new_key: str,
        bucket_name: str = "zendbx-storage",
    ) -> bool:
        """B2/S3 rename = copy + delete."""
        try:
            client = self._get_client()
            await self._run_sync(
                client.copy_object,
                Bucket=bucket_name,
                CopySource={"Bucket": bucket_name, "Key": old_key},
                Key=new_key,
            )
            await self._run_sync(
                client.delete_object,
                Bucket=bucket_name,
                Key=old_key,
            )
            return True
        except Exception as e:
            print(f"[B2] rename_file error: {e}")
            return False

    async def list_files(
        self,
        prefix: str,
        bucket_name: str = "zendbx-storage",
    ) -> List[Dict[str, Any]]:
        try:
            client = self._get_client()

            def _list():
                results = []
                paginator = client.get_paginator("list_objects_v2")
                for page in paginator.paginate(Bucket=bucket_name, Prefix=prefix):
                    for obj in page.get("Contents", []):
                        results.append({
                            "key": obj["Key"],
                            "size": obj["Size"],
                            "last_modified": obj["LastModified"].isoformat(),
                            "etag": obj.get("ETag", "").strip('"'),
                        })
                return results

            return await self._run_sync(_list)
        except Exception as e:
            print(f"[B2] list_files error: {e}")
            return []

    async def generate_signed_url(
        self,
        storage_key: str,
        expires_seconds: int = 3600,
        bucket_name: str = "zendbx-storage",
    ) -> str:
        try:
            client = self._get_client()
            url = await self._run_sync(
                client.generate_presigned_url,
                "get_object",
                Params={"Bucket": bucket_name, "Key": storage_key},
                ExpiresIn=expires_seconds,
            )
            return url
        except Exception as e:
            print(f"[B2] generate_signed_url error: {e}")
            return ""

    async def get_file_url(self, storage_key: str, bucket_name: str = "zendbx-storage") -> str:
        """Return the public URL for a publicly-accessible file."""
        base = settings.b2_public_url.rstrip("/")
        return f"{base}/{storage_key}"

    async def get_file(self, storage_key: str, bucket_name: str = "zendbx-storage") -> Optional[bytes]:
        try:
            client = self._get_client()

            def _download():
                response = client.get_object(Bucket=bucket_name, Key=storage_key)
                return response["Body"].read()

            return await self._run_sync(_download)
        except Exception as e:
            print(f"[B2] get_file error: {e}")
            return None

    async def get_file_metadata(
        self, storage_key: str, bucket_name: str = "zendbx-storage"
    ) -> Optional[Dict[str, Any]]:
        try:
            client = self._get_client()
            response = await self._run_sync(
                client.head_object,
                Bucket=bucket_name,
                Key=storage_key,
            )
            return {
                "size": response.get("ContentLength"),
                "content_type": response.get("ContentType"),
                "last_modified": response["LastModified"].isoformat() if response.get("LastModified") else None,
                "etag": response.get("ETag", "").strip('"'),
            }
        except Exception as e:
            print(f"[B2] get_file_metadata error: {e}")
            return None


# ------------------------------------------------------------------ #
# Singleton + connection test                                          #
# ------------------------------------------------------------------ #

_storage_provider_instance: Optional[StorageProvider] = None


def get_storage_provider() -> Optional[StorageProvider]:
    """
    Get or initialize the B2 storage provider (lazy initialization).
    Returns None if B2 is not configured — API endpoints handle that gracefully.
    """
    global _storage_provider_instance

    if _storage_provider_instance is None:
        if not settings.B2_KEY_ID or not settings.B2_APPLICATION_KEY:
            print("[Storage] ⚠ B2_KEY_ID / B2_APPLICATION_KEY not set — storage disabled")
            return None
        try:
            import boto3
            client = boto3.client(
                "s3",
                endpoint_url=settings.b2_endpoint_url,
                aws_access_key_id=settings.B2_KEY_ID,
                aws_secret_access_key=settings.B2_APPLICATION_KEY,
                region_name=settings.B2_REGION,
            )
            # Lightweight connectivity test
            client.list_buckets()
            print("[Storage] ✓ Backblaze B2 connected successfully")
            _storage_provider_instance = B2StorageProvider()
        except Exception as e:
            print(f"[Storage] ⚠ B2 connection failed: {e}")
            print("[Storage] Storage feature is unavailable — check B2 credentials")
            return None

    return _storage_provider_instance
