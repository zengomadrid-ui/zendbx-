# ZendBX Storage Architecture V3

## Overview

Storage V3 is a complete architectural refactor that transforms ZendBX Storage into a first-class platform service comparable to Supabase Storage, Appwrite Storage, and Firebase Storage.

## Architecture Layers

```
HTTP Router (FastAPI)
       ↓
Service Layer (Business Logic)
       ↓
Repository Layer (Database Operations)
       ↓
Database (PostgreSQL)
       ↓
Storage Provider Interface
       ↓
Provider Implementation (Backblaze B2, AWS S3, etc.)
```

### Separation of Concerns

- **Routers**: Thin HTTP handlers that validate requests and delegate to services
- **Services**: Business logic, validation, and orchestration
- **Repositories**: Pure database operations (SQL only)
- **Providers**: Storage backend abstraction

## Project Structure

```
backend/app/
├── api/
│   ├── storage.py           # Legacy API (deprecated)
│   └── storage_v2.py         # V3 project-scoped API
├── services/
│   └── storage/
│       ├── bucket_service.py        # Bucket CRUD operations
│       ├── object_service.py        # File/object operations
│       ├── upload_service.py        # Upload logic & validation
│       ├── project_service.py       # Project & bucket resolution
│       └── signed_url_service.py    # URL generation
├── repositories/
│   └── storage_repository.py        # All SQL queries
└── providers/
    ├── storage_provider.py          # Abstract interface
    └── b2_storage.py                # Backblaze B2 implementation
```

## Core Design Principles

### 1. Project-Scoped Everything

All storage operations are scoped to projects via URL:

```
/p/{project_slug}/storage/buckets
/p/{project_slug}/storage/buckets/{bucket_slug}/upload
/p/{project_slug}/storage/files/{file_id}
```

- No `project_id` in query parameters
- No internal UUIDs leaked to clients
- Clean, predictable URLs

### 2. Human-Readable Identifiers

Public APIs use slugs, not UUIDs:

```javascript
const bucket = client.storage.bucket("resumes");
await bucket.upload(file);
```

Backend resolves:
```
slug "resumes" → bucket UUID → storage provider
```

### 3. Single Source of Truth

Business logic exists in **one place only**:
- ✅ Service layer contains all logic
- ❌ No SQL in routers
- ❌ No business rules in repositories
- ❌ No duplicate implementations

### 4. Provider Abstraction

Storage providers are fully abstracted:

```python
class StorageProvider(ABC):
    @abstractmethod
    async def upload_file(...): ...
    @abstractmethod
    async def delete_file(...): ...
    @abstractmethod
    async def generate_signed_url(...): ...
```

Current implementation: Backblaze B2  
Future providers: AWS S3, Cloudflare R2, MinIO, Azure Blob, GCS

**Zero router changes required to swap providers.**

## API Endpoints

### Buckets

```
GET    /p/{slug}/storage/buckets              # List buckets
POST   /p/{slug}/storage/buckets              # Create bucket
PATCH  /p/{slug}/storage/buckets/{bucket}     # Update bucket
DELETE /p/{slug}/storage/buckets/{bucket}     # Delete bucket
GET    /p/{slug}/storage/buckets/{bucket}/stats  # Bucket stats
```

### Files

```
POST   /p/{slug}/storage/buckets/{bucket}/upload   # Upload file
GET    /p/{slug}/storage/buckets/{bucket}/files    # List files
GET    /p/{slug}/storage/buckets/{bucket}/objects  # List objects
GET    /p/{slug}/storage/files/{file_id}           # File metadata
DELETE /p/{slug}/storage/files/{file_id}           # Delete file
GET    /p/{slug}/storage/files/{file_id}/download  # Download file
GET    /p/{slug}/storage/files/{file_id}/preview   # Preview file
POST   /p/{slug}/storage/files/{file_id}/signed-url  # Generate signed URL
```

### Analytics

```
GET    /p/{slug}/storage/analytics             # Storage analytics
```

## Resource Resolution

### Bucket Resolution

The system supports **both** slug and UUID identifiers:

```python
# By slug
GET /p/demo/storage/buckets/resumes

# By UUID (backward compatibility)
GET /p/demo/storage/buckets/550e8400-e29b-41d4-a716-446655440000
```

Repository performs a single query:

```sql
SELECT * FROM storage_buckets
WHERE project_id = $1
  AND deleted_at IS NULL
  AND (slug = $2 OR id::text = $2)
LIMIT 1;
```

### Resolution Flow

```
1. Client sends: /p/demo/storage/buckets/resumes/upload
2. Router extracts: project_slug="demo", bucket="resumes"
3. ProjectService.resolve_project("demo") → project UUID
4. ProjectService.resolve_bucket("resumes", project_uuid) → bucket UUID
5. Service layer operates on UUIDs internally
6. Response returns slug: {"bucket": "resumes", ...}
```

## Service Layer Details

### BucketService

```python
class BucketService:
    async def list_buckets(project_id, conn)
    async def create_bucket(project_id, user_id, name, ...)
    async def update_bucket(bucket, name, description, ...)
    async def delete_bucket(bucket, project_id, ...)
    async def get_bucket_stats(bucket_id, conn)
```

### ObjectService

```python
class ObjectService:
    async def list_objects(bucket_id, prefix, conn)
    async def list_files(bucket_id, search, sort_by, ...)
    async def get_object(object_id, project_id, conn)
    async def delete_object(obj, project_id, ...)
    async def download_object(obj, provider_bucket, conn)
```

### UploadService

```python
class UploadService:
    async def upload_file(file, bucket, project, user_id, ...)
```

Validation:
- File extension check (blocks .exe, .bat, etc.)
- MIME type validation
- File size limits per plan (free: 10MB, pro: 100MB, enterprise: 500MB)
- Storage quota enforcement
- Filename sanitization

### ProjectService

```python
class ProjectService:
    async def resolve_project(slug_or_id, conn)
    async def resolve_project_for_user(slug_or_id, user_id, conn)
    async def resolve_bucket(identifier, project_id, conn)
    async def get_storage_analytics(project_id, project, conn)
```

### SignedUrlService

```python
class SignedUrlService:
    async def generate_signed_url(storage_key, expiry, ...)
    async def get_public_url(storage_key, ...)
```

Expiry options: `5m`, `15m`, `1h`, `24h`, `7d`

## Repository Layer

All SQL operations are in `StorageRepository`:

```python
class StorageRepository:
    # Project
    @staticmethod
    async def get_project_by_slug_or_id(...)
    
    # Bucket
    @staticmethod
    async def get_bucket_by_slug_or_id(...)
    @staticmethod
    async def list_buckets(...)
    @staticmethod
    async def create_bucket(...)
    @staticmethod
    async def update_bucket(...)
    @staticmethod
    async def soft_delete_bucket(...)
    
    # Object
    @staticmethod
    async def create_object(...)
    @staticmethod
    async def get_object_by_id(...)
    @staticmethod
    async def list_objects(...)
    @staticmethod
    async def soft_delete_object(...)
    
    # Analytics
    @staticmethod
    async def get_storage_totals(...)
    @staticmethod
    async def get_largest_files(...)
    @staticmethod
    async def get_storage_growth(...)
```

## Database Indexes

Required for optimal performance:

```sql
-- Bucket resolution by slug
CREATE INDEX idx_storage_buckets_project_slug
ON storage_buckets(project_id, slug)
WHERE deleted_at IS NULL;

-- Object lookups
CREATE INDEX idx_storage_objects_bucket ON storage_objects(bucket_id);
CREATE INDEX idx_storage_objects_project ON storage_objects(project_id);

-- Search & sorting
CREATE INDEX idx_storage_objects_search 
ON storage_objects(bucket_id, original_name, file_name);

-- Analytics
CREATE INDEX idx_storage_objects_size ON storage_objects(project_id, file_size);
CREATE INDEX idx_storage_objects_created ON storage_objects(project_id, created_at DESC);
```

Run migration: `backend/database/storage_v3_indexes.sql`

## Security

### Validation Flow

```
1. Authenticate user
2. Resolve project from slug
3. Validate project ownership (if required)
4. Resolve bucket within project
5. Validate bucket permissions
6. Execute storage operation
```

### File Upload Security

- Extension blacklist (blocks executables)
- MIME type whitelist
- File size limits by plan
- Filename sanitization (prevents path traversal)
- Storage quota enforcement

### Cross-Project Isolation

All queries are scoped to `project_id`:

```sql
SELECT * FROM storage_objects
WHERE project_id = $1 AND id = $2
```

Users can never access files from other projects.

## Error Handling

Standardized HTTP status codes:

- `404` - Project not found
- `404` - Bucket not found
- `404` - File not found
- `403` - Permission denied
- `409` - Bucket already exists
- `413` - File too large / Quota exceeded
- `415` - Unsupported file type
- `500` - Storage provider unavailable
- `503` - Storage not configured

## Logging & Metrics

All operations emit structured logs:

```python
{
    "operation": "upload_file",
    "project_id": "...",
    "bucket_id": "...",
    "file_id": "...",
    "file_size": 1024000,
    "duration_ms": 234,
    "status": "success"
}
```

## SDK Integration

Simple, clean developer experience:

```javascript
import { ZendBXClient } from '@zendbx/sdk';

const client = new ZendBXClient({
  projectUrl: 'https://api.zendbx.com/p/demo'
});

// Bucket operations
const bucket = client.storage.bucket('resumes');
await bucket.upload(file);
await bucket.list();
await bucket.download('resume.pdf');
await bucket.delete('resume.pdf');

// Signed URLs
const url = await bucket.createSignedUrl('resume.pdf', '1h');
```

**No UUIDs, no project IDs, no lookups.**

## Legacy API Support

The legacy `/api/storage/*` endpoints remain functional but deprecated.

They internally call the same service layer as V2:

```python
# Legacy endpoint
@router.post("/api/storage/upload")
async def upload_file(...):
    # Calls the same UploadService
    return await services["upload"].upload_file(...)
```

Future removal planned after migration period.

## Migration Path

### For Existing Code

1. **Backend**: Legacy API still works - no immediate changes required
2. **Frontend/SDK**: Update to use project-scoped URLs:
   ```
   OLD: /api/storage/buckets?project_id=xxx
   NEW: /p/demo/storage/buckets
   ```
3. **Database**: Run `storage_v3_indexes.sql` migration
4. **Testing**: Verify all storage operations work as expected

### For New Code

Use V2 endpoints exclusively:
```
/p/{project_slug}/storage/*
```

## Future Enhancements

The V3 architecture supports:

- **ACLs**: Fine-grained access control
- **Object Versioning**: Keep file history
- **Lifecycle Rules**: Auto-delete old files
- **CDN Integration**: Edge caching
- **Multipart Uploads**: Large file support
- **Multi-Region Storage**: Geographic redundancy
- **Webhooks**: Storage event notifications
- **Image Transformations**: Resize on-the-fly

## Performance Optimizations

- Composite indexes for fast bucket resolution
- Soft deletes avoid hard deletions during requests
- Connection pooling for database operations
- Async I/O throughout the stack
- Provider-level parallelization ready

## Testing Checklist

- [x] Project resolution by slug
- [x] Project resolution by UUID
- [x] Bucket resolution by slug
- [x] Bucket resolution by UUID
- [x] Upload validation (extension, MIME, size)
- [x] Storage quota enforcement
- [x] Cross-project isolation
- [x] Soft delete operations
- [x] Download with counter increment
- [x] Signed URL generation
- [x] Analytics aggregation
- [x] Legacy API compatibility
- [x] Provider abstraction
- [ ] Multi-provider tests (when additional providers added)

## Conclusion

Storage V3 delivers:

✅ Clean architecture with proper layering  
✅ Single source of truth for business logic  
✅ Provider abstraction for flexibility  
✅ Project-scoped, human-readable APIs  
✅ Zero UUID leakage to clients  
✅ Legacy compatibility  
✅ Production-ready foundation  

The storage module is now **enterprise-grade** and aligned with ZendBX's long-term vision as a Backend-as-a-Service platform.
