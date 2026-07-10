# Changelog

All notable changes to the ZendBX SDK will be documented in this file.

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
