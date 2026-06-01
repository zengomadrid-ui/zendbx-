"""
MinIO Storage Provider Implementation
Implements StorageProvider using the MinIO Python SDK.
MinIO runs as a SEPARATE Render service — never inside the FastAPI container.
"""
import io
import asyncio
from typing import Optional, List, Dict, Any
from datetime import timedelta
from functools import partial

from app.services.storage_provider import StorageProvider
from app.core.config import settings


class MinIOStorageProvider(StorageProvider):
    """
    MinIO implementation of StorageProvider.
    Uses a single MinIO bucket ("zendbx-storage") with path-based isolation:
        {project_id}/{bucket_slug}/{uuid}/{filename}
    """

    def __init__(self):
        self._client = None

    def _get_client(self):
        """Lazy-init MinIO client (avoids import errors if minio not installed)."""
        if self._client is None:
            from minio import Minio
            endpoint = settings.MINIO_ENDPOINT.replace("http://", "").replace("https://", "")
            self._client = Minio(
                endpoint,
                access_key=settings.MINIO_ACCESS_KEY,
                secret_key=settings.MINIO_SECRET_KEY,
                secure=settings.MINIO_SECURE,
            )
        return self._client

    async def _run_sync(self, func, *args, **kwargs):
        """Run a synchronous MinIO call in a thread pool to avoid blocking the event loop."""
        loop = asyncio.get_event_loop()
        return await loop.run_in_executor(None, partial(func, *args, **kwargs))

    # ------------------------------------------------------------------ #
    # Bucket operations                                                    #
    # ------------------------------------------------------------------ #

    async def create_bucket(self, bucket_name: str, is_public: bool = False) -> bool:
        """Ensure the top-level MinIO bucket exists."""
        try:
            client = self._get_client()
            exists = await self._run_sync(client.bucket_exists, bucket_name)
            if not exists:
                await self._run_sync(client.make_bucket, bucket_name)
                if is_public:
                    await self._set_public_policy(client, bucket_name)
            return True
        except Exception as e:
            print(f"[MinIO] create_bucket error: {e}")
            return False

    async def _set_public_policy(self, client, bucket_name: str):
        """Apply a read-only public policy to a bucket."""
        import json
        policy = {
            "Version": "2012-10-17",
            "Statement": [
                {
                    "Effect": "Allow",
                    "Principal": {"AWS": ["*"]},
                    "Action": ["s3:GetObject"],
                    "Resource": [f"arn:aws:s3:::{bucket_name}/*"],
                }
            ],
        }
        await self._run_sync(client.set_bucket_policy, bucket_name, json.dumps(policy))

    async def delete_bucket(self, bucket_name: str) -> bool:
        """Delete a MinIO bucket (must be empty first)."""
        try:
            client = self._get_client()
            # Remove all objects first
            objects = await self._run_sync(
                lambda: list(client.list_objects(bucket_name, recursive=True))
            )
            for obj in objects:
                await self._run_sync(client.remove_object, bucket_name, obj.object_name)
            await self._run_sync(client.remove_bucket, bucket_name)
            return True
        except Exception as e:
            print(f"[MinIO] delete_bucket error: {e}")
            return False

    async def bucket_exists(self, bucket_name: str) -> bool:
        try:
            client = self._get_client()
            return await self._run_sync(client.bucket_exists, bucket_name)
        except Exception as e:
            print(f"[MinIO] bucket_exists error: {e}")
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
            # Ensure bucket exists
            await self.create_bucket(bucket_name)
            data_stream = io.BytesIO(file_data)
            await self._run_sync(
                client.put_object,
                bucket_name,
                storage_key,
                data_stream,
                len(file_data),
                content_type=mime_type,
            )
            return True
        except Exception as e:
            print(f"[MinIO] upload_file error: {e}")
            return False

    async def delete_file(self, storage_key: str, bucket_name: str = "zendbx-storage") -> bool:
        try:
            client = self._get_client()
            await self._run_sync(client.remove_object, bucket_name, storage_key)
            return True
        except Exception as e:
            print(f"[MinIO] delete_file error: {e}")
            return False

    async def rename_file(
        self,
        old_key: str,
        new_key: str,
        bucket_name: str = "zendbx-storage",
    ) -> bool:
        """MinIO rename = copy to new key + delete old key."""
        try:
            from minio.commonconfig import CopySource
            client = self._get_client()
            source = CopySource(bucket_name, old_key)
            await self._run_sync(client.copy_object, bucket_name, new_key, source)
            await self._run_sync(client.remove_object, bucket_name, old_key)
            return True
        except Exception as e:
            print(f"[MinIO] rename_file error: {e}")
            return False

    async def list_files(
        self,
        prefix: str,
        bucket_name: str = "zendbx-storage",
    ) -> List[Dict[str, Any]]:
        try:
            client = self._get_client()
            objects = await self._run_sync(
                lambda: list(client.list_objects(bucket_name, prefix=prefix, recursive=True))
            )
            return [
                {
                    "key": obj.object_name,
                    "size": obj.size,
                    "last_modified": obj.last_modified.isoformat() if obj.last_modified else None,
                    "etag": obj.etag,
                }
                for obj in objects
            ]
        except Exception as e:
            print(f"[MinIO] list_files error: {e}")
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
                client.presigned_get_object,
                bucket_name,
                storage_key,
                expires=timedelta(seconds=expires_seconds),
            )
            return url
        except Exception as e:
            print(f"[MinIO] generate_signed_url error: {e}")
            return ""

    async def get_file_url(self, storage_key: str, bucket_name: str = "zendbx-storage") -> str:
        """Return the public URL using MINIO_PUBLIC_URL."""
        public_url = settings.MINIO_PUBLIC_URL.rstrip("/")
        return f"{public_url}/{bucket_name}/{storage_key}"

    async def get_file(self, storage_key: str, bucket_name: str = "zendbx-storage") -> Optional[bytes]:
        try:
            client = self._get_client()
            response = await self._run_sync(client.get_object, bucket_name, storage_key)
            data = response.read()
            response.close()
            response.release_conn()
            return data
        except Exception as e:
            print(f"[MinIO] get_file error: {e}")
            return None

    async def get_file_metadata(
        self, storage_key: str, bucket_name: str = "zendbx-storage"
    ) -> Optional[Dict[str, Any]]:
        try:
            client = self._get_client()
            stat = await self._run_sync(client.stat_object, bucket_name, storage_key)
            return {
                "size": stat.size,
                "content_type": stat.content_type,
                "last_modified": stat.last_modified.isoformat() if stat.last_modified else None,
                "etag": stat.etag,
            }
        except Exception as e:
            print(f"[MinIO] get_file_metadata error: {e}")
            return None


# ------------------------------------------------------------------ #
# Singleton — swap this for R2StorageProvider / S3StorageProvider    #
# when migrating providers                                            #
# ------------------------------------------------------------------ #

def _initialize_storage_provider() -> StorageProvider:
    """
    Initialize MinIO storage provider.
    MinIO must be running for storage to work.
    """
    try:
        from minio import Minio
        endpoint = settings.MINIO_ENDPOINT.replace("http://", "").replace("https://", "")
        client = Minio(
            endpoint,
            access_key=settings.MINIO_ACCESS_KEY,
            secret_key=settings.MINIO_SECRET_KEY,
            secure=settings.MINIO_SECURE,
        )
        # Test connection
        client.list_buckets()
        print("[Storage] ✓ MinIO connected successfully")
        return MinIOStorageProvider()
    except Exception as e:
        print(f"[Storage] ✗ MinIO connection failed: {e}")
        print("[Storage] Please ensure MinIO is running: docker-compose up -d")
        raise RuntimeError(f"MinIO storage is required but unavailable: {e}")


storage_provider: StorageProvider = _initialize_storage_provider()
