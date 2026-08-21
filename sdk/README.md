# @zendbx/sdk

Official JavaScript / TypeScript SDK for [ZendBX](https://zendbx.in) — PostgreSQL Backend-as-a-Service.

Fluent, chainable query API with full TypeScript support. Works in Node.js, Bun, Deno, Next.js, React, Vue, Svelte, and any modern JavaScript/TypeScript project.

[![npm version](https://img.shields.io/npm/v/@zendbx/sdk.svg)](https://www.npmjs.com/package/@zendbx/sdk)
[![TypeScript](https://img.shields.io/badge/TypeScript-Ready-blue.svg)](https://www.typescriptlang.org/)
[![License: MIT](https://img.shields.io/badge/License-MIT-yellow.svg)](https://opensource.org/licenses/MIT)

## Features

- ✨ **Full TypeScript Support** - Complete type safety with generics
- 🔗 **Fluent API** - Chainable query builder interface
- 🔐 **Authentication** - Email/password, OAuth, session management
- 📦 **Storage** - File upload, download, and management
- ⚡ **Real-time** - WebSocket subscriptions (coming soon)
- 🛡️ **RLS** - Row-level security and project isolation built-in
- 🎯 **PostgREST Compatible** - Familiar filtering syntax
- 🚀 **Zero Dependencies** - Lightweight and fast

---

## Table of Contents

- [Installation](#installation)
- [Quick Start](#quick-start)
- [Client Initialization](#client-initialization)
- [Authentication](#authentication)
- [Database Operations](#database-operations)
  - [SELECT](#select)
  - [INSERT](#insert)
  - [BULK INSERT](#bulk-insert)
  - [UPDATE](#update)
  - [DELETE](#delete)
  - [UPSERT](#upsert)
- [Filtering](#filtering)
- [Ordering](#ordering)
- [Pagination](#pagination)
- [Single Row Operations](#single-row-operations)
- [Storage](#storage)
- [TypeScript Usage](#typescript-usage)
- [Error Handling](#error-handling)
- [Response Format](#response-format)
- [Prefer Header Support](#prefer-header-support)
- [RLS & Project Isolation](#rls--project-isolation)
- [Common Errors](#common-errors)
- [Best Practices](#best-practices)
- [API Reference](#api-reference)

---

## Installation

```bash
npm install @zendbx/sdk
# or
yarn add @zendbx/sdk
# or
pnpm add @zendbx/sdk
```

**Requirements:**
- Node.js 18+ (uses native `fetch`)
- TypeScript 5.0+ (for type support)

---

## Quick Start

```ts
import { createClient } from '@zendbx/sdk'

// Initialize client
const client = createClient({
  apiUrl: 'https://api.zendbx.in',
  projectSlug: 'my-project',
  anonKey: 'eyJ...'  // Get this from your ZendBX dashboard
})

// Query data
const { data, error } = await client.from('users').select('*')

if (error) {
  console.error('Error:', error.message)
} else {
  console.log('Users:', data)
}
```

---

## Client Initialization

### Basic Configuration

```ts
import { createClient } from '@zendbx/sdk'

const client = createClient({
  apiUrl: 'https://api.zendbx.in',
  projectSlug: 'my-project',      // Your project slug
  anonKey: 'your-anon-key',       // Anonymous key for client-side
})
```

### With Access Token

```ts
const client = createClient({
  apiUrl: 'https://api.zendbx.in',
  projectSlug: 'my-project',
  anonKey: 'your-anon-key',
  accessToken: 'user-jwt-token',  // For server-side or after login
})
```

### Configuration Options

```ts
interface ClientConfig {
  apiUrl: string;           // ZendBX API URL
  projectSlug: string;      // Your project identifier
  anonKey: string;          // Anonymous key (required)
  accessToken?: string;     // Optional JWT token
  autoRefreshToken?: boolean; // Auto-refresh expired tokens (default: false)
}
```

---

## Authentication

Complete authentication system with email/password and OAuth support.

### Sign Up

```ts
const { data, error } = await client.auth.signUp({
  email: 'user@example.com',
  password: 'secure-password-123',
  name: 'John Doe'  // optional
})

if (error) {
  console.error('Sign up failed:', error.message)
} else {
  console.log('User created:', data.user)
  console.log('Access token:', data.access_token)
}
```

**Response Type:**
```ts
interface AuthResponse {
  access_token: string;
  user: User;
}
```

### Sign In

```ts
const { data, error } = await client.auth.signIn({
  email: 'user@example.com',
  password: 'secure-password-123'
})

// Token is automatically stored in the client
console.log('Logged in:', data.user.email)
```

### Get Current User

```ts
const user = await client.auth.getUser()
console.log('Current user:', user.email)
```

### Get Session Token

```ts
const token = client.auth.getSession()
console.log('Current token:', token)
```

### Set Session Manually

```ts
// Useful for SSR or when restoring a session
client.auth.setSession('eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...')
```

### Sign Out

```ts
await client.auth.signOut()
// Token is cleared from the client
```

### Refresh Session

```ts
const { data } = await client.auth.refreshSession()
console.log('New token:', data.access_token)
```

### Password Reset

```ts
// Request password reset
await client.auth.resetPasswordForEmail('user@example.com')
// User receives email with reset token

// Update password with token
await client.auth.updatePassword('reset-token-from-email', 'new-password')
```

### Email Verification

```ts
await client.auth.verifyEmail('verification-token-from-email')
```

### Update User

```ts
const user = await client.auth.updateUser({
  name: 'Jane Doe',
  email: 'jane@example.com'
})
```

---

## Database Operations

All database operations use the `client.from(tableName)` method which returns a `TableBuilder` with chainable methods.

### SELECT

#### Basic Select

```ts
// Select all columns
const { data, error } = await client.from('users').select('*')

// Select specific columns
const { data } = await client.from('users').select('id, name, email')

// Select with TypeScript types
interface User {
  id: string;
  name: string;
  email: string;
  created_at: string;
}

const { data } = await client.from<User>('users').select('*')
// data is User[] | null
```

#### Select with Count

```ts
// Get total count with results
const { data, count } = await client.from('users')
  .select('*', { count: 'exact' })

console.log(`Found ${count} users`)
```

**Count Types:**
- `'exact'` - Precise count (slower on large tables)
- `'planned'` - Estimate from query planner
- `'estimated'` - Fast estimate from statistics

### INSERT

#### Single Row Insert

```ts
const { data, error } = await client.from('users').insert({
  name: 'John Doe',
  email: 'john@example.com',
  status: 'active'
})

// Insert returns empty array by default
// Chain .select() to return the inserted row
const { data } = await client.from('users')
  .insert({ name: 'John' })
  .select()

console.log('Inserted user:', data[0])
```

### BULK INSERT

#### Multiple Rows (Homogeneous)

```ts
const { data, error } = await client.from('users').insert([
  { name: 'Alice', email: 'alice@example.com' },
  { name: 'Bob', email: 'bob@example.com' },
  { name: 'Carol', email: 'carol@example.com' }
]).select()

console.log(`Inserted ${data.length} users`)
```

#### Heterogeneous Bulk Insert

ZendBX supports bulk inserts with different column sets. Missing columns receive database defaults or NULL:

```ts
const { data } = await client.from('products').insert([
  { name: 'Widget', price: 19.99, sku: 'WDG-001' },
  { name: 'Gadget', price: 29.99 }, // no SKU
  { name: 'Doohickey' } // no price or SKU
]).select()
```

**Important:** Bulk inserts are atomic - all rows insert or none do. If any row fails validation, the entire operation rolls back.

### UPDATE

```ts
// Update with filter
const { data, error } = await client.from('users')
  .update({ status: 'inactive' })
  .eq('id', '123')

// Update multiple rows
await client.from('users')
  .update({ verified: true })
  .gt('created_at', '2024-01-01')

// Update and return updated rows
const { data } = await client.from('users')
  .update({ email: 'newemail@example.com' })
  .eq('id', '123')
  .select()
```

### DELETE

```ts
// Delete with filter
await client.from('users').delete().eq('id', '123')

// Delete multiple rows
await client.from('logs')
  .delete()
  .lt('created_at', '2024-01-01')

// Delete with multiple conditions
await client.from('users')
  .delete()
  .eq('status', 'inactive')
  .lt('last_login', '2023-01-01')
```

### UPSERT

Insert or update on conflict:

```ts
const { data } = await client.from('user_settings')
  .upsert({
    user_id: '123',
    theme: 'dark',
    language: 'en'
  })
  .select()
```

**Note:** Upsert requires a unique constraint or primary key on the conflict column(s).

---

## Filtering

All filters are chainable and map to PostgREST query parameters.

### Filter Operators

| Method | SQL Operator | Description | Example |
|--------|--------------|-------------|---------|
| `.eq(col, val)` | `=` | Equals | `.eq('status', 'active')` |
| `.neq(col, val)` | `!=` | Not equals | `.neq('role', 'admin')` |
| `.gt(col, val)` | `>` | Greater than | `.gt('age', 18)` |
| `.gte(col, val)` | `>=` | Greater or equal | `.gte('score', 90)` |
| `.lt(col, val)` | `<` | Less than | `.lt('price', 100)` |
| `.lte(col, val)` | `<=` | Less or equal | `.lte('stock', 10)` |
| `.like(col, pat)` | `LIKE` | Pattern match | `.like('email', '%@gmail.com')` |
| `.ilike(col, pat)` | `ILIKE` | Case-insensitive pattern | `.ilike('name', '%john%')` |
| `.in(col, arr)` | `IN` | Value in array | `.in('status', ['active', 'pending'])` |
| `.is(col, val)` | `IS` | IS NULL/TRUE/FALSE | `.is('deleted_at', null)` |
| `.not(col, op, val)` | `NOT` | Negation | `.not('status', 'eq', 'deleted')` |

### Chaining Filters

```ts
// Multiple conditions (AND logic)
const { data } = await client.from('users')
  .select('*')
  .eq('country', 'India')
  .gt('age', 18)
  .like('email', '%@gmail.com')
  .is('verified', true)
```

### OR Conditions

```ts
// OR filter using PostgREST syntax
const { data } = await client.from('users')
  .select('*')
  .or('status.eq.active,status.eq.pending')
```

### Complex Filtering

```ts
const { data } = await client.from('orders')
  .select('*')
  .eq('status', 'shipped')
  .gte('total', 100)
  .in('payment_method', ['credit_card', 'paypal'])
  .not('customer_id', 'eq', 'banned-user-id')
```

---

## Ordering

```ts
// Ascending (default)
const { data } = await client.from('users')
  .select('*')
  .order('created_at')

// Descending
const { data } = await client.from('users')
  .select('*')
  .order('created_at', { ascending: false })

// Multiple order clauses
const { data } = await client.from('products')
  .select('*')
  .order('category')
  .order('price', { ascending: false })
```

---

## Pagination

### Limit

```ts
// Get first 20 rows
const { data } = await client.from('users')
  .select('*')
  .limit(20)
```

### Range (Offset + Limit)

```ts
// Get rows 0-19 (page 1)
const { data } = await client.from('users')
  .select('*')
  .range(0, 19)

// Get rows 20-39 (page 2)
const { data } = await client.from('users')
  .select('*')
  .range(20, 39)
```

### Pagination Example

```ts
const pageSize = 20
const page = 2  // 0-indexed

const { data, count } = await client.from('users')
  .select('*', { count: 'exact' })
  .range(page * pageSize, (page + 1) * pageSize - 1)

console.log(`Page ${page + 1} of ${Math.ceil(count / pageSize)}`)
```

---

## Single Row Operations

### `.single()`

Returns a single object instead of an array. Throws error if 0 or multiple rows found:

```ts
const { data, error } = await client.from('users')
  .select('*')
  .eq('id', '123')
  .single()

// data is User | null (not User[] | null)
```

### `.maybeSingle()`

Like `.single()` but returns `null` instead of error when no rows found:

```ts
const { data } = await client.from('users')
  .select('*')
  .eq('email', 'john@example.com')
  .maybeSingle()

// data is User | null, error is null even if no rows found
```

---

## Storage

File upload, download, and management.

### List Buckets

```ts
const { data: buckets } = await client.storage.listBuckets()
```

### Create Bucket

```ts
const { data } = await client.storage.createBucket('avatars', { 
  public: true 
})
```

### Upload File

```ts
const file = document.getElementById('file-input').files[0]

const { data, error } = await client.storage
  .from('avatars')
  .upload('user-123/profile.jpg', file, {
    contentType: 'image/jpeg',
    cacheControl: '3600',
    upsert: true  // Overwrite if exists
  })
```

### Download File

```ts
const { data: blob } = await client.storage
  .from('avatars')
  .download('user-123/profile.jpg')

// Create download URL
const url = URL.createObjectURL(blob)
```

### Get Public URL

```ts
const { data } = client.storage
  .from('avatars')
  .getPublicUrl('user-123/profile.jpg')

console.log(data.publicUrl)
// https://api.zendbx.in/p/my-project/v1/storage/buckets/avatars/files/user-123/profile.jpg
```

### Create Signed URL (Private Files)

```ts
const { data } = await client.storage
  .from('documents')
  .createSignedUrl('contract.pdf', 3600) // 1 hour

console.log(data.signedUrl)
```

### Delete File

```ts
await client.storage
  .from('avatars')
  .remove(['user-123/old-avatar.jpg'])
```

### List Files

```ts
const { data: files } = await client.storage
  .from('avatars')
  .list('user-123/')
```

---

## TypeScript Usage

### Generic Row Types

```ts
interface User {
  id: string;
  name: string;
  email: string;
  status: 'active' | 'inactive';
  created_at: string;
}

// Type-safe queries
const { data } = await client.from<User>('users')
  .select('*')
  .eq('status', 'active')

// data is User[] | null with full autocomplete
```

### Exported Types

```ts
import type {
  // Response types
  ZendbxResponse,
  ZendbxError,
  
  // Auth types
  User,
  Session,
  AuthData,
  SignUpCredentials,
  SignInCredentials,
  
  // Query types
  FilterOperator,
  OrderClause,
  SelectOptions,
  
  // Storage types
  StorageBucket,
  StorageObject,
  StorageUploadResult,
  
  // Database types
  DatabaseRow,
  JsonValue,
  
  // Error classes
  ZendbxSDKError,
  AuthExpiredError,
} from '@zendbx/sdk'
```

### Custom Row Types

```ts
// Extend DatabaseRow for type safety
interface Product extends DatabaseRow {
  id: string;
  name: string;
  price: number;
  category: 'electronics' | 'clothing' | 'food';
  in_stock: boolean;
}

const { data } = await client.from<Product>('products')
  .select('*')
  .eq('category', 'electronics')
  .gt('price', 100)

// Full IntelliSense support
if (data) {
  data.forEach(product => {
    console.log(product.name, product.price)
  })
}
```

---

## Error Handling

### Check Error Field

All operations return a response object with `error` field. **Never throws for database errors.**

```ts
const { data, error } = await client.from('users').select('*')

if (error) {
  console.error('Query failed:', error.message)
  console.error('Status:', error.status)
  console.error('Details:', error.details)
  return
}

// Safe to use data here
console.log('Users:', data)
```

### Error Object Structure

```ts
interface ZendbxError {
  message: string;   // Human-readable error message
  status?: number;   // HTTP status code
  details?: unknown; // Additional context
  code?: string;     // Error code for programmatic handling
  hint?: string;     // Suggestion for fixing the error
}
```

### SDK Error Classes

```ts
import { 
  ZendbxSDKError,
  MissingConfigError,
  InvalidUrlError,
  AuthExpiredError,
  ProjectNotFoundError,
  StorageProviderError 
} from '@zendbx/sdk'

try {
  const client = createClient({
    apiUrl: '',  // Invalid
    projectSlug: 'test',
    anonKey: 'key'
  })
} catch (error) {
  if (error instanceof MissingConfigError) {
    console.error('Configuration error:', error.message)
  }
}
```

### Try-Catch Pattern

```ts
async function fetchUsers() {
  try {
    const { data, error } = await client.from('users').select('*')
    
    if (error) {
      throw new Error(error.message)
    }
    
    return data
  } catch (error) {
    console.error('Failed to fetch users:', error)
    throw error
  }
}
```

---

## Response Format

### Standard Response

All operations return a consistent response shape:

```ts
interface ZendbxResponse<T> {
  data: T | null;
  error: ZendbxError | null;
}
```

**Key Points:**
- On success: `data` contains the result, `error` is `null`
- On failure: `data` is `null`, `error` contains details
- **Never throws** - always returns a response object

### Query Response

SELECT operations return additional metadata:

```ts
interface ZendbxQueryResponse<T> {
  data: T | null;
  error: ZendbxError | null;
  status: number;    // HTTP status code
  count?: number;    // Total row count (if requested)
}
```

### Examples

```ts
// SELECT - returns array
const { data, error, count } = await client.from('users')
  .select('*', { count: 'exact' })
// data: User[] | null

// INSERT with .select() - returns array
const { data, error } = await client.from('users')
  .insert({ name: 'John' })
  .select()
// data: User[] | null

// single() - returns object
const { data, error } = await client.from('users')
  .select('*')
  .eq('id', '123')
  .single()
// data: User | null
```

---

## Prefer Header Support

ZendBX supports PostgreSQL's Prefer header for controlling response behavior.

### Return Representation

```ts
// INSERT/UPDATE/DELETE without .select() returns empty array
const { data } = await client.from('users').insert({ name: 'John' })
// data: []

// Chain .select() to return inserted/updated rows
const { data } = await client.from('users')
  .insert({ name: 'John' })
  .select()
// data: [{ id: '...', name: 'John', ... }]
```

### Count Options

```ts
// Prefer: count=exact
const { data, count } = await client.from('users')
  .select('*', { count: 'exact' })

// Prefer: count=planned
const { data, count } = await client.from('users')
  .select('*', { count: 'planned' })

// Prefer: count=estimated
const { data, count } = await client.from('users')
  .select('*', { count: 'estimated' })
```

### Upsert Resolution

```ts
// Prefer: resolution=merge-duplicates
const { data } = await client.from('settings')
  .upsert({ user_id: '123', theme: 'dark' })
```

---

## RLS & Project Isolation

### Row-Level Security (RLS)

All queries automatically respect PostgreSQL RLS policies:

```ts
// Only returns rows the authenticated user can access
const { data } = await client.from('documents').select('*')
```

### Project Isolation

Each project is completely isolated:

```ts
// Project A client
const clientA = createClient({
  apiUrl: 'https://api.zendbx.in',
  projectSlug: 'project-a',
  anonKey: 'project-a-key'
})

// Project B client  
const clientB = createClient({
  apiUrl: 'https://api.zendbx.in',
  projectSlug: 'project-b',
  anonKey: 'project-b-key'
})

// These operate on completely separate databases
await clientA.from('users').select('*')  // Project A users
await clientB.from('users').select('*')  // Project B users
```

### Authentication Context

Queries use the authentication context from the client:

```ts
// Anonymous queries (using anon key)
const { data } = await client.from('public_posts').select('*')

// Authenticated queries (after sign in)
await client.auth.signIn({ email, password })
const { data } = await client.from('my_private_data').select('*')

// Different users see different data based on RLS
```

---

## Common Errors

### 401 Unauthorized

```
Authentication token expired or invalid
```

**Solution:** Call `client.auth.signIn()` or `client.auth.refreshSession()`

### 403 Forbidden

```
Permission denied
```

**Solution:** Check RLS policies or use service_role key for admin operations

### 404 Not Found

```
Resource not found
```

**Solution:** Verify table name, project slug, and that the resource exists

### 409 Conflict

```
Unique constraint violation
```

**Solution:** Use `.upsert()` instead of `.insert()` or handle duplicate keys

### 422 Validation Error

```
Invalid input data
```

**Solution:** Check required fields, data types, and constraints

---

## Best Practices

### 1. Use TypeScript Generics

```ts
interface User {
  id: string;
  email: string;
  created_at: string;
}

const { data } = await client.from<User>('users').select('*')
// Full type safety and autocomplete
```

### 2. Always Check Errors

```ts
const { data, error } = await client.from('users').select('*')

if (error) {
  // Handle error
  return
}

// Safe to use data
```

### 3. Use Environment Variables

```ts
const client = createClient({
  apiUrl: process.env.ZENDBX_URL!,
  projectSlug: process.env.ZENDBX_PROJECT_SLUG!,
  anonKey: process.env.ZENDBX_ANON_KEY!
})
```

### 4. Lazy Query Building

```ts
// Build query conditionally
let query = client.from('products').select('*')

if (category) query = query.eq('category', category)
if (minPrice) query = query.gte('price', minPrice)
if (inStock) query = query.eq('in_stock', true)

// Execute once
const { data } = await query
```

### 5. Use `.select()` for Returning Data

```ts
// Good - returns inserted data
const { data } = await client.from('users')
  .insert({ name: 'John' })
  .select()

// Returns empty array without .select()
const { data } = await client.from('users')
  .insert({ name: 'John' })
// data: []
```

### 6. Bulk Operations

```ts
// Efficient bulk insert
const users = [/* 1000 users */]
const { data } = await client.from('users')
  .insert(users)
  .select()

// All-or-nothing - atomic transaction
```

### 7. Storage Best Practices

```ts
// Use UUID or user-specific paths
await client.storage.from('avatars')
  .upload(`${userId}/avatar-${Date.now()}.jpg`, file)

// Set appropriate content types
await client.storage.from('documents')
  .upload('report.pdf', file, {
    contentType: 'application/pdf',
    cacheControl: '3600'
  })
```

---

## API Reference

### Client Methods

```ts
const client = createClient(config: ClientConfig): ZendbxClient

client.from<T>(tableName: string): TableBuilder<T>
client.auth: AuthAPI
client.storage: StorageAPI
client.realtime: RealtimeAPI
```

### Auth API

```ts
client.auth.signUp(credentials: SignUpCredentials): Promise<AuthResponse>
client.auth.signIn(credentials: SignInCredentials): Promise<AuthResponse>
client.auth.getUser(): Promise<User>
client.auth.getSession(): string | null
client.auth.setSession(token: string): void
client.auth.signOut(): Promise<void>
client.auth.refreshSession(): Promise<AuthResponse>
client.auth.resetPasswordForEmail(email: string): Promise<{ message: string }>
client.auth.updatePassword(token: string, password: string): Promise<{ message: string }>
client.auth.verifyEmail(token: string): Promise<{ message: string }>
client.auth.updateUser(data: Partial<User>): Promise<User>
```

### Table Builder

```ts
.select(columns?: string, options?: SelectOptions): SelectBuilder<T>
.insert(data: Partial<T> | Partial<T>[]): InsertBuilder<T>
.update(data: Partial<T>): UpdateBuilder<T>
.delete(): DeleteBuilder<T>
.upsert(data: Partial<T> | Partial<T>[]): InsertBuilder<T>
```

### Query Filters

```ts
.eq(column: string, value: unknown): this
.neq(column: string, value: unknown): this
.gt(column: string, value: unknown): this
.gte(column: string, value: unknown): this
.lt(column: string, value: unknown): this
.lte(column: string, value: unknown): this
.like(column: string, pattern: string): this
.ilike(column: string, pattern: string): this
.in(column: string, values: unknown[]): this
.is(column: string, value: null | boolean): this
.not(column: string, operator: string, value: unknown): this
.or(conditions: string): this
```

### Query Modifiers

```ts
.order(column: string, options?: { ascending?: boolean }): this
.limit(count: number): this
.range(from: number, to: number): this
.single(): SingleBuilder<T>
.maybeSingle(): MaybeSingleBuilder<T>
```

### Storage API

```ts
client.storage.listBuckets(): Promise<ZendbxResponse<StorageBucket[]>>
client.storage.createBucket(name: string, options?: { public?: boolean }): Promise<ZendbxResponse<StorageBucket>>
client.storage.getBucket(bucketId: string): Promise<ZendbxResponse<StorageBucket>>
client.storage.deleteBucket(bucketId: string): Promise<ZendbxResponse<void>>
client.storage.from(bucketId: string): StorageBucketRef
```

### Storage Bucket Operations

```ts
.list(path?: string): Promise<ZendbxResponse<StorageObject[]>>
.upload(path: string, file: File | Blob, options?: UploadOptions): Promise<ZendbxResponse<StorageUploadResult>>
.download(fileId: string): Promise<ZendbxResponse<Blob>>
.remove(paths: string[]): Promise<ZendbxResponse<void>>
.getPublicUrl(fileId: string): { data: { publicUrl: string } }
.createSignedUrl(fileId: string, expiresIn: number): Promise<ZendbxResponse<{ signedUrl: string }>>
.move(fromPath: string, toPath: string): Promise<ZendbxResponse<void>>
.copy(fromPath: string, toPath: string): Promise<ZendbxResponse<void>>
```

---

## Full Example

```ts
import { createClient } from '@zendbx/sdk'
import type { User, ZendbxError } from '@zendbx/sdk'

// Initialize client
const client = createClient({
  apiUrl: process.env.ZENDBX_URL!,
  projectSlug: process.env.ZENDBX_PROJECT_SLUG!,
  anonKey: process.env.ZENDBX_ANON_KEY!
})

// Type-safe user interface
interface AppUser extends User {
  subscription_tier: 'free' | 'pro' | 'enterprise';
  last_login: string;
}

async function main() {
  // Sign in
  const { data: authData, error: authError } = await client.auth.signIn({
    email: 'user@example.com',
    password: 'secure-password'
  })

  if (authError) {
    console.error('Login failed:', authError.message)
    return
  }

  console.log('Logged in as:', authData.user.email)

  // Fetch data with filters
  const { data: users, error, count } = await client
    .from<AppUser>('users')
    .select('*', { count: 'exact' })
    .eq('subscription_tier', 'pro')
    .gte('last_login', '2024-01-01')
    .order('last_login', { ascending: false })
    .range(0, 19)

  if (error) {
    console.error('Query failed:', error.message)
    return
  }

  console.log(`Found ${count} pro users, showing first 20:`)
  users?.forEach(user => {
    console.log(`- ${user.email} (${user.subscription_tier})`)
  })

  // Insert new record
  const { data: newUser, error: insertError } = await client
    .from<AppUser>('users')
    .insert({
      email: 'newuser@example.com',
      name: 'New User',
      subscription_tier: 'free'
    })
    .select()

  if (insertError) {
    console.error('Insert failed:', insertError.message)
  } else {
    console.log('Created user:', newUser[0].id)
  }

  // Bulk insert
  const bulkData = [
    { name: 'Alice', email: 'alice@example.com', subscription_tier: 'pro' },
    { name: 'Bob', email: 'bob@example.com', subscription_tier: 'free' },
    { name: 'Carol', email: 'carol@example.com', subscription_tier: 'enterprise' }
  ]

  const { data: bulkUsers, error: bulkError } = await client
    .from<AppUser>('users')
    .insert(bulkData)
    .select()

  if (!bulkError) {
    console.log(`Inserted ${bulkUsers.length} users`)
  }

  // Update
  await client
    .from<AppUser>('users')
    .update({ subscription_tier: 'pro' })
    .eq('email', 'newuser@example.com')

  // Upload file
  const file = new File(['Hello'], 'test.txt', { type: 'text/plain' })
  const { data: upload, error: uploadError } = await client.storage
    .from('documents')
    .upload(`user-${authData.user.id}/hello.txt`, file)

  if (!uploadError) {
    console.log('File uploaded:', upload.file_name)
  }

  // Sign out
  await client.auth.signOut()
  console.log('Signed out')
}

main().catch(console.error)
```

---

## Changelog

See [CHANGELOG.md](./CHANGELOG.md) for version history.

---

## Support

- 📧 **Email:** support@zendbx.in
- 📚 **Documentation:** [docs.zendbx.in](https://docs.zendbx.in)
- 💬 **Discord:** [Join our community](https://discord.gg/zendbx)
- 🐛 **Issues:** [GitHub Issues](https://github.com/zendbx/sdk/issues)
- 🌐 **Website:** [zendbx.in](https://zendbx.in)

---

## License

MIT © [ZendBX](https://zendbx.in)
