# Changelog

All notable changes to the ZendBX SDK will be documented in this file.

## [1.3.0] - 2026-08-21

### 🔄 Session Token Format Standardization (Issue #6 Fix)

This release fixes the session token format inconsistency and adds refresh token support.

### ✨ Added

- **Refresh Token Support**: All authentication responses now include `refresh_token`
  - `signUp()` returns `refresh_token` in session
  - `signIn()` returns `refresh_token` in session
  - New `refreshSession(refreshToken)` method for token renewal
- **Session Type Enhancement**: `Session` interface now includes `refresh_token: string`
- **Token Lifecycle Management**: Proper refresh token handling for long-lived sessions

### 🔧 Changed

- **Session Interface**: Added required `refresh_token` field
  ```typescript
  interface Session {
    access_token: string;
    refresh_token: string;  // NEW
    token_type: 'bearer';
    user: User;
    expires_in: number;
  }
  ```
- **Auth Response Format**: Now returns canonical format from backend
  ```json
  {
    "access_token": "eyJ...",
    "refresh_token": "abc...",
    "token_type": "bearer",
    "expires_in": 604800,
    "user": {...}
  }
  ```

### 🐛 Fixed

- **Issue #6**: Session token format inconsistency between platform and project auth
- **Token Expiration**: Apps can now refresh tokens before expiration instead of forcing re-login
- **SDK Compatibility**: Full compatibility with Python SDK token format

### 📚 Migration Guide

No breaking changes - existing code continues to work. To use refresh tokens:

```typescript
// Sign in and store the session
const { data, error } = await client.auth.signIn({ email, password });
if (data?.session) {
  // Store refresh_token for later use
  localStorage.setItem('refresh_token', data.session.refresh_token);
}

// Later, refresh the session
const refreshToken = localStorage.getItem('refresh_token');
if (refreshToken) {
  const { data, error } = await client.auth.refreshSession(refreshToken);
  // Session refreshed with new tokens
}
```

### 🔒 Security

- Refresh tokens are secure random strings (not JWTs)
- Token rotation implemented (old refresh token revoked on use)
- Server-side token revocation on logout

---

## [1.2.0] - 2026-07-10

### 🚀 Major Update: Canonical API Alignment

This release brings the SDK into full alignment with the ZendBX Backend API Contract v1.0, eliminating all legacy routing patterns.

### ✨ Added

- **RouteBuilder Integration**: All authentication methods now use the centralized RouteBuilder
- **Slug-Based Routing**: Complete migration from UUID-based routes (`/v1/auth/{projectId}`) to slug-based routes (`/p/{projectSlug}/v1/auth/...`)
- **Type Safety**: Enhanced TypeScript support with proper route builder types
- **Backward Compatibility**: Legacy exports maintained for gradual migration

### 🔧 Changed

- **AuthModule**: Refactored to use RouteBuilder instead of manual URL construction
  - `signUp()` now uses `routes.auth.signup()`
  - `signIn()` now uses `routes.auth.login()`
  - `getUser()` now uses `routes.auth.user()`
  - `updateUser()` now uses `routes.auth.user()` with PATCH
- **Client Initialization**: Now requires `projectSlug` instead of `projectId`
- **HTTP Client**: Automatically manages all required headers (`apikey`, `Authorization`, `Content-Type`)

### 🗑️ Deprecated

- Manual URL construction patterns (removed from codebase)
- UUID-based project identifiers in public APIs

### 📚 Documentation

- Added comprehensive CHANGELOG.md
- Updated package.json with CHANGELOG.md in published files

### 🔒 Security

- Automatic header management prevents missing authentication headers
- Proper token lifecycle management

### Migration Guide

**Before (v1.1.0):**
```typescript
const client = createClient({
  apiUrl: "https://api.zendbx.in",
  projectId: "550e8400-e29b-41d4-a716-446655440000", // UUID
  anonKey: "eyJ..."
});
```

**After (v1.2.0):**
```typescript
const client = createClient({
  apiUrl: "https://api.zendbx.in",
  projectSlug: "my-project", // Slug
  anonKey: "eyJ..."
});
```

All authentication methods work identically - no code changes required beyond initialization.

---

## [1.1.0] - 2026-07-08

### Added
- Initial RouteBuilder architecture
- New ZendbxClient implementation
- HTTP client with automatic header management

### Changed
- Migrated from legacy client patterns
- Improved error handling

---

## [1.0.0] - 2026-06-15

### Added
- Initial public release
- Authentication module
- REST API operations
- Storage API
- Realtime subscriptions
- TypeScript support
