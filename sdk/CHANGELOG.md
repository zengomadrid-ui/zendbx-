# Changelog

All notable changes to the ZendBX SDK will be documented in this file.

## [1.3.0] - 2026-08-21

### 🚀 Major Update: Complete Documentation & TypeScript Types

This release provides comprehensive SDK documentation and full TypeScript type coverage with generic support.

### ✨ Added

#### Issue #10 - SDK Documentation Complete
- **Complete SDK README**: Comprehensive documentation covering all functionality
  - Installation and setup
  - Client initialization with all options
  - Full authentication API reference
  - Database operations (SELECT, INSERT, BULK INSERT, UPDATE, DELETE, UPSERT)
  - Filtering, ordering, and pagination
  - Single row operations (.single(), .maybeSingle())
  - Storage API complete reference
  - TypeScript usage with generics
  - Error handling patterns
  - Response format documentation
  - Prefer header support
  - RLS & project isolation
  - Common errors reference
  - Best practices
  - Complete working examples

- **Frontend Documentation Page**: Updated docs/sdk page with all new examples
- **SDK_DOCUMENTATION.md**: Created comprehensive reference for TypeScript and Python SDKs
- **API Endpoints Reference**: Complete documentation of all REST endpoints
- **40+ Methods Documented**: Every public method with signature, parameters, and examples
- **50+ Code Examples**: All examples verified to work with actual SDK

#### Issue #11 - TypeScript Types Complete
- **60+ TypeScript Types**: Comprehensive type definitions for all SDK operations
  - Core response types: `ZendbxResponse<T>`, `ZendbxError`
  - Generic database types: `DatabaseRow`, `JsonValue`, `JsonPrimitive`
  - Enhanced auth types: `User`, `Session`, `AuthData`, `SignUpCredentials`, etc.
  - Complete query builder types: `FilterOperator` (20+ operators), `QueryFilter`, `OrderClause`
  - Storage types: `StorageBucket`, `StorageObject`, `StorageUploadResult`, `StorageSignedUrl`
  - Error types: 7 error classes with proper inheritance
  - Project types: `Project`, `ProjectKeys`, `CreateProjectInput`
  - Analytics types: `QueryAnalytics`, `UsageQuota`
  - Realtime types: `RealtimeEvent`, `RealtimePayload`, `RealtimeCallback`

- **Generic Database Row Support**: Full type-safe queries
  ```typescript
  interface User extends DatabaseRow {
    id: string;
    email: string;
    created_at: string;
  }
  
  const { data } = await client.from<User>('users').select('*')
  // data: User[] | null with full IntelliSense
  ```

- **Complete Error Type System**: Proper error classes with typed properties
  ```typescript
  class ZendbxSDKError extends Error {
    readonly code: string;
    readonly status?: number;
    readonly details?: unknown;
  }
  ```

- **All Types Exported**: Properly categorized exports from `@zendbx/sdk`
  - Response wrappers
  - Generic database types
  - Auth types
  - Query builder types
  - Storage types
  - Error classes
  - Project types
  - Analytics types

### 🔄 Session Token Format Standardization (Issue #6 Fix)

- **Refresh Token Support**: All authentication responses now include `refresh_token`
- **Session Type Enhancement**: `Session` interface now includes `refresh_token: string`
- **Token Lifecycle Management**: Proper refresh token handling for long-lived sessions

### 🔧 Changed

- **Enhanced Type Definitions**: `User`, `Session`, and all response types now have complete fields
- **Filter Operators**: Expanded from 10 to 20+ operators including full-text search
- **Type Exports**: All types now properly exported and categorized
- **Documentation**: Complete rewrite of README with verified examples

### 🐛 Fixed

- **Issue #10**: SDK documentation incomplete - now comprehensive
- **Issue #11**: TypeScript types incomplete - now full coverage with generics
- **Issue #6**: Session token format inconsistency
- **Type Safety**: Removed all `any` types, replaced with proper TypeScript types
- **Generic Support**: Full generic type inference for database operations

### 📚 Documentation Coverage

- Methods documented: 40+
- Code examples: 50+
- TypeScript examples: 30+
- Python examples: 15+
- API endpoints: All documented
- Error codes: Complete reference

### 🔒 Type Safety

- TypeScript compilation: ✅ Zero errors
- Type coverage: ✅ 100% of public API
- Generic support: ✅ Full inference
- Error types: ✅ Complete hierarchy

### 💡 Benefits

**For TypeScript Developers:**
- Full IntelliSense/autocomplete support
- Compile-time type safety
- Generic type inference
- Better refactoring support
- Fewer runtime errors

**For JavaScript Developers:**
- Comprehensive documentation
- Clear method signatures
- Working examples
- Error handling patterns
- JSDoc support

### 🔄 Backward Compatibility

✅ **No Breaking Changes**
- All existing exports maintained
- No methods renamed
- No parameters changed
- Legacy patterns still work
- Migration is optional

### Migration to Generic Types (Optional)

**Before (still works):**
```typescript
const { data } = await client.from('users').select('*')
// data: Record<string, unknown>[] | null
```

**After (enhanced):**
```typescript
interface User extends DatabaseRow {
  id: string;
  email: string;
}

const { data } = await client.from<User>('users').select('*')
// data: User[] | null
```

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
