"""
Storage Service — DEPRECATED COMPATIBILITY SHIM

This module previously contained all storage business logic.
It has been replaced by the V3 architecture:

  app/repositories/storage_repository.py  — all SQL
  app/services/storage/bucket_service.py  — bucket operations
  app/services/storage/object_service.py  — file/object operations
  app/services/storage/upload_service.py  — upload logic
  app/services/storage/project_service.py — project resolution
  app/services/storage/signed_url_service.py — signed URLs

Both routers (storage.py and storage_v2.py) now use the V3 services directly.
This file is retained only so any external import does not cause an ImportError.
Do not add new logic here. Remove this file after all direct imports are cleaned up.
"""

# Re-export constants that might be imported elsewhere
SIGNED_URL_EXPIRY_OPTIONS = {"5m": 300, "15m": 900, "1h": 3600, "24h": 86400, "7d": 604800}

PLAN_UPLOAD_LIMITS = {
    "free": 10 * 1024 * 1024,
    "pro": 100 * 1024 * 1024,
    "enterprise": 500 * 1024 * 1024,
}
