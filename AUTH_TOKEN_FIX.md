# Authentication Token Fix - 403 Forbidden Error

## Problem Identified

Frontend was getting `403 Forbidden` errors when creating projects because API calls were not consistently including the JWT authentication token in the `Authorization` header.

## Root Cause

The projects page was using direct `fetch()` calls instead of the centralized `apiFetch()` utility that automatically includes authentication headers.

### Before (Inconsistent):
```typescript
// Some calls used direct fetch without auth
const response = await fetch(`${process.env.NEXT_PUBLIC_API_URL!}/api/projects`, {
  method: 'POST',
  headers: {
    'Content-Type': 'application/json',
    'Authorization': `Bearer ${localStorage.getItem('token')}`, // Manual auth
  },
  body: JSON.stringify(data),
});
```

### After (Consistent):
```typescript
// All calls use apiFetch with automatic auth
const response = await apiFetch('api/projects', {
  method: 'POST',
  body: JSON.stringify(data),
});
```

## Fixes Applied

### 1. Updated Projects Page

**File:** `frontend/app/(dashboard)/dashboard/projects/page.tsx`

**Changes:**
- Imported `apiFetch` utility
- Replaced all direct `fetch()` calls with `apiFetch()`
- Removed manual Authorization header management
- Simplified API calls

**Functions Updated:**
- `fetchProjects()` - Get all projects
- `fetchProjectKeys()` - Get project API keys
- `handleDeleteProject()` - Delete a project
- `handleCreateProject()` - Create new project

### 2. Centralized Auth Utility

**File:** `frontend/lib/fetch-utils.ts`

**Features:**
- Automatically includes `Authorization: Bearer <token>` header
- Handles SSR safely (returns empty headers on server)
- Uses environment-aware API URLs
- Consistent error handling

```typescript
export const apiFetch = async (
  endpoint: string,
  options: RequestInit = {}
): Promise<Response> => {
  const url = getApiUrl(endpoint);
  
  const headers = {
    'Content-Type': 'application/json',
    ...getAuthHeaders(), // Automatically adds Authorization header
    ...(options.headers || {}),
  };
  
  return fetch(url, {
    ...options,
    headers,
  });
};
```

## How Authentication Works

### 1. Login/Signup Flow

```typescript
// User logs in
const response = await apiFetch('api/auth/login', {
  method: 'POST',
  body: JSON.stringify({ email, password }),
});

const data = await response.json();

// Token is stored in localStorage
localStorage.setItem('token', data.access_token);
localStorage.setItem('user', JSON.stringify(data.user));
```

### 2. Authenticated API Calls

```typescript
// apiFetch automatically includes token
const response = await apiFetch('api/projects', {
  method: 'POST',
  body: JSON.stringify({ name: 'My Project' }),
});

// Behind the scenes:
// Authorization: Bearer eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...
```

### 3. Backend Verification

```python
# Backend extracts and verifies token
@router.post("/projects")
async def create_project(
    project_data: ProjectCreate,
    current_user: dict = Depends(get_current_user)  # Requires valid token
):
    # current_user is populated from JWT token
    # If token is missing/invalid, returns 401/403
    pass
```

## Token Storage

### What's Stored:
```javascript
localStorage.setItem('token', 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...');
localStorage.setItem('user_id', 'uuid-here');
localStorage.setItem('user_email', 'user@example.com');
localStorage.setItem('user', JSON.stringify(userObject));
```

### Token Format:
```
Authorization: Bearer <JWT_TOKEN>
```

Where JWT_TOKEN is a signed token containing:
```json
{
  "sub": "user-id",
  "email": "user@example.com",
  "role": "user",
  "exp": 1234567890
}
```

## Error Handling

### 401 Unauthorized
**Cause:** Token is missing or invalid
**Solution:** Redirect to login page

### 403 Forbidden
**Cause:** Token is valid but user doesn't have permission
**Solution:** Show permission denied message

### Token Expiration
**Cause:** Token has expired (default: 24 hours)
**Solution:** Redirect to login, user must re-authenticate

## Testing

### 1. Test Login
```bash
# Open browser console
localStorage.getItem('token')
# Should return: "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9..."
```

### 2. Test API Call
```bash
# Open Network tab in DevTools
# Make a project creation request
# Check request headers:
# Authorization: Bearer eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...
```

### 3. Test Without Token
```bash
# Clear token
localStorage.removeItem('token')

# Try to create project
# Should get 401 Unauthorized
```

## Best Practices

### ✅ DO:
- Use `apiFetch()` for all authenticated API calls
- Store token in localStorage after login
- Clear token on logout
- Check token exists before making authenticated calls
- Handle 401/403 errors gracefully

### ❌ DON'T:
- Use direct `fetch()` for authenticated endpoints
- Hardcode Authorization headers manually
- Store sensitive data in localStorage (only tokens)
- Expose tokens in console.log (in production)
- Share tokens between users

## Security Notes

### Token Security:
- Tokens are signed with SECRET_KEY on backend
- Tokens expire after 24 hours (configurable)
- Tokens are validated on every request
- Invalid tokens are rejected with 401

### XSS Protection:
- Tokens in localStorage are vulnerable to XSS
- Always sanitize user input
- Use Content Security Policy (CSP)
- Never execute untrusted code

### HTTPS Required:
- Always use HTTPS in production
- Tokens sent over HTTP can be intercepted
- Render provides HTTPS by default

## Debugging

### Check if token exists:
```javascript
console.log('Token exists:', !!localStorage.getItem('token'));
console.log('Token length:', localStorage.getItem('token')?.length);
```

### Check request headers:
```javascript
// Open DevTools → Network tab
// Click on API request
// Check "Request Headers" section
// Look for: Authorization: Bearer ...
```

### Decode JWT token:
```javascript
// Copy token from localStorage
// Go to https://jwt.io
// Paste token to see decoded payload
// Check expiration time (exp field)
```

## Common Issues

### Issue: "403 Forbidden" on API calls

**Cause:** Token not included in request

**Solution:**
1. Check token exists: `localStorage.getItem('token')`
2. Use `apiFetch()` instead of direct `fetch()`
3. Verify `getAuthHeaders()` is working

### Issue: "401 Unauthorized" after login

**Cause:** Token not stored correctly

**Solution:**
1. Check login response includes `access_token`
2. Verify `localStorage.setItem('token', ...)` is called
3. Check for typos in storage key name

### Issue: Token expires too quickly

**Cause:** Backend token expiration is too short

**Solution:**
1. Check `ACCESS_TOKEN_EXPIRE_MINUTES` in backend config
2. Default is 1440 minutes (24 hours)
3. Increase if needed for development

## Files Modified

1. `frontend/app/(dashboard)/dashboard/projects/page.tsx` - Use apiFetch
2. `frontend/lib/fetch-utils.ts` - Already had apiFetch (no changes)
3. `frontend/lib/config.ts` - Already configured (no changes)

## Deployment

### Frontend:
```bash
# Commit changes
git add frontend/app/(dashboard)/dashboard/projects/page.tsx
git commit -m "fix: Use apiFetch for consistent auth headers in projects page

- Replace direct fetch() calls with apiFetch()
- Automatically include Authorization header
- Fix 403 Forbidden errors on project creation
- Simplify API call code"

# Push to GitHub
git push origin main

# Vercel will auto-deploy
```

### Verification:
1. Go to https://devapp.zendbx.in
2. Login with your account
3. Try to create a new project
4. Should succeed without 403 error
5. Check Network tab - Authorization header should be present

## Success Indicators

After deployment:
- ✅ Login stores token in localStorage
- ✅ All API calls include Authorization header
- ✅ Project creation works without 403 errors
- ✅ Token is automatically included in all requests
- ✅ No manual header management needed

---

**TL;DR:**
- Replaced direct `fetch()` with `apiFetch()` in projects page
- `apiFetch()` automatically includes JWT token in Authorization header
- Fixes 403 Forbidden errors on protected endpoints
- Consistent authentication across all API calls
