# Frontend URL Fix - Remove /p/{slug}/ Prefix

## ❌ Problem:
Your frontend is calling:
```
https://zendbx-2-zpp9.onrender.com/p/zenhire-718af5ef/v1/auth/718af5ef-8ffb-49ba-b54a-26cc37755d2c/signup
```

## ✅ Solution:
Should call:
```
https://zendbx-2-zpp9.onrender.com/v1/auth/718af5ef-8ffb-49ba-b54a-26cc37755d2c/signup
```

## Why?
The `/p/{slug}/` prefix is for **project data endpoints** (tables, queries, etc.), NOT for authentication endpoints.

Auth endpoints are registered at the root level:
- `/v1/auth/{project_id}/signup`
- `/v1/auth/{project_id}/login`
- `/v1/auth/{project_id}/user`

## Fix Your Frontend Code:

### Option 1: Update ZendBXService.ts
Find where you're constructing the URL and remove the `/p/{slug}/` part.

**Before:**
```typescript
const url = `${baseURL}/p/${projectSlug}/v1/auth/${projectId}/signup`;
```

**After:**
```typescript
const url = `${baseURL}/v1/auth/${projectId}/signup`;
```

### Option 2: Update the SDK
If you're using the ZendBX SDK, make sure it's pointing to the correct URL pattern.

## Complete Auth Endpoints:

### Signup
```
POST https://zendbx-2-zpp9.onrender.com/v1/auth/718af5ef-8ffb-49ba-b54a-26cc37755d2c/signup

Headers:
  Content-Type: application/json
  Authorization: Bearer {ANON_KEY}
  Origin: http://localhost:5173

Body:
{
  "email": "user@example.com",
  "password": "password123",
  "name": "User Name"
}
```

### Login
```
POST https://zendbx-2-zpp9.onrender.com/v1/auth/718af5ef-8ffb-49ba-b54a-26cc37755d2c/login

Headers:
  Content-Type: application/json
  Authorization: Bearer {ANON_KEY}
  Origin: http://localhost:5173

Body:
{
  "email": "user@example.com",
  "password": "password123"
}
```

### Get User
```
GET https://zendbx-2-zpp9.onrender.com/v1/auth/718af5ef-8ffb-49ba-b54a-26cc37755d2c/user

Headers:
  Authorization: Bearer {JWT_TOKEN}
  Origin: http://localhost:5173
```

## Test It:
After fixing your frontend URLs, you should see:
1. ✅ OPTIONS request succeeds (200 OK)
2. ✅ POST request succeeds (200 OK)
3. ✅ User is created and JWT token returned
4. ✅ No CORS errors

## Summary:
**Remove `/p/zenhire-718af5ef/` from your auth endpoint URLs!**
