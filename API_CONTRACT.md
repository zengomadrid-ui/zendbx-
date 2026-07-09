# ZendBX Official API Contract v1.0

**Status:** Canonical  
**Date:** 2026-07-09  
**Breaking Changes:** Yes - This supersedes all previous routing patterns

---

## Core Principles

1. **Single Public Identity:** All public APIs use `project_slug`, never UUID
2. **Consistent Routing:** All project-scoped APIs follow `/p/{project_slug}/v1/...`
3. **No Manual URL Construction:** SDKs use route builders exclusively
4. **Version Control:** All APIs versioned (`/v1/`)

---

## Public API Routes

### Authentication
```
POST   /p/{project_slug}/v1/auth/signup
POST   /p/{project_slug}/v1/auth/login
GET    /p/{project_slug}/v1/auth/user
POST   /p/{project_slug}/v1/auth/logout
POST   /p/{project_slug}/v1/auth/refresh
POST   /p/{project_slug}/v1/auth/forgot-password
POST   /p/{project_slug}/v1/auth/reset-password
POST   /p/{project_slug}/v1/auth/verify-email
```

### REST API (Data Operations)
```
GET    /p/{project_slug}/v1/rest/{table}
POST   /p/{project_slug}/v1/rest/{table}
PATCH  /p/{project_slug}/v1/rest/{table}
DELETE /p/{project_slug}/v1/rest/{table}
```

### Storage
```
GET    /p/{project_slug}/v1/storage/buckets
POST   /p/{project_slug}/v1/storage/buckets
GET    /p/{project_slug}/v1/storage/buckets/{bucket_id}/files
POST   /p/{project_slug}/v1/storage/buckets/{bucket_id}/upload
DELETE /p/{project_slug}/v1/storage/buckets/{bucket_id}/files/{file_id}
```

### Functions (Future)
```
POST   /p/{project_slug}/v1/functions/{function_name}
```

### Realtime
```
WS     /p/{project_slug}/v1/realtime
```

---

## Internal/Admin Routes

These use UUIDs internally and require platform authentication:

```
GET    /api/projects
POST   /api/projects
GET    /api/projects/{project_id}
DELETE /api/projects/{project_id}
GET    /api/projects/{project_id}/keys
POST   /api/projects/{project_id}/keys
```

---

## Deprecated Routes (To Be Removed)

❌ `/v1/auth/{project_id}/...` (uses UUID)  
❌ `/api/auth/...` (platform auth, conflicts with project auth)  
❌ `/rest/v1/...` (missing project context)

---

## Migration Path

### Phase 1: Add New Routes (Parallel)
- Implement `/p/{slug}/v1/...` routes
- Keep old routes working
- Log deprecation warnings

### Phase 2: Update SDKs
- Release SDK with route builders
- Update all documentation
- Migrate examples

### Phase 3: Remove Old Routes
- Remove deprecated endpoints
- Clean up routing code
- Final verification

---

## SDK Initialization (Official Pattern)

```typescript
const client = createClient({
  apiUrl: "https://api.zendbx.in",
  projectSlug: "my-project",
  anonKey: "eyJ..."
});
```

**Rejected Patterns:**
- ❌ Using `projectId` (UUID)
- ❌ Using `projectRef` (ambiguous)
- ❌ Multiple initialization styles
