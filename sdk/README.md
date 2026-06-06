# @zendbx/sdk

Official JavaScript / TypeScript SDK for [ZENDBX](https://zendbx.in) — a PostgreSQL Backend-as-a-Service platform with auto-generated REST APIs, AI-powered SQL, authentication, realtime, and storage.

[![npm version](https://img.shields.io/npm/v/@zendbx/sdk)](https://www.npmjs.com/package/@zendbx/sdk)
[![License: MIT](https://img.shields.io/badge/License-MIT-yellow.svg)](https://opensource.org/licenses/MIT)
[![Node.js >= 18](https://img.shields.io/badge/node-%3E%3D18-brightgreen)](https://nodejs.org)

---

## Installation

```bash
npm install @zendbx/sdk
# or
yarn add @zendbx/sdk
# or
pnpm add @zendbx/sdk
```

---

## Quick Start

```ts
import { createClient } from '@zendbx/sdk'

const zendbx = createClient('https://api.zendbx.in', 'your-anon-key', {
  projectId: 'your-project-uuid',
})

// or using the options object form:
const zendbx = createClient({
  apiUrl: 'https://api.zendbx.in',
  anonKey: 'your-anon-key',
  projectId: 'your-project-uuid',
})
```

Find your `projectId` and `anonKey` in your ZENDBX dashboard under **Project Settings → API Keys**.

---

## Authentication

```ts
// Sign up
const { data, error } = await zendbx.auth.signUp({
  email: 'user@example.com',
  password: 'password123',
  name: 'Jane Doe',           // optional
})

// Sign in
const { data, error } = await zendbx.auth.signIn({
  email: 'user@example.com',
  password: 'password123',
})

if (data?.session) {
  console.log('Token:', data.session.access_token)
  console.log('User:', data.user)
}

// Get current user
const { data } = await zendbx.auth.getUser()

// Get current session
const { data } = await zendbx.auth.getSession()

// Sign out
await zendbx.auth.signOut()

// Password reset flow
await zendbx.auth.resetPassword('user@example.com')             // sends email
await zendbx.auth.updatePassword(resetToken, 'newPassword123')  // confirm reset
```

---

## Database Queries

All queries go through the Supabase-compatible REST API with **Row Level Security** enforced.

### SELECT

```ts
// All rows
const { data, error } = await zendbx.from('posts').select('*').execute()

// Specific columns
const { data } = await zendbx.from('posts').select('id, title, created_at').execute()

// With type safety
interface Post { id: string; title: string; published: boolean }
const { data } = await zendbx.from<Post>('posts').select('*').execute()
// data is Post[] | null
```

### Filters

```ts
const { data } = await zendbx
  .from('posts')
  .select('id, title')
  .eq('published', true)        // WHERE published = true
  .neq('status', 'deleted')     // AND status != 'deleted'
  .gt('views', 100)             // AND views > 100
  .gte('rating', 4)             // AND rating >= 4
  .lt('price', 50)              // AND price < 50
  .lte('age', 65)               // AND age <= 65
  .like('title', 'Hello%')      // AND title LIKE 'Hello%'
  .ilike('email', '%@gmail.com') // AND email ILIKE '%@gmail.com'
  .in('category', ['tech', 'science']) // AND category IN (...)
  .is('deleted_at', null)       // AND deleted_at IS NULL
  .execute()
```

### Sorting & Pagination

```ts
// Sort
const { data } = await zendbx
  .from('posts')
  .select('*')
  .order('created_at', { ascending: false })
  .limit(20)
  .execute()

// Paginate
const { data } = await zendbx
  .from('posts')
  .select('*')
  .range(0, 19)   // rows 0–19 (first 20)
  .execute()
```

### INSERT

```ts
const { data, error } = await zendbx.from('posts').insert({
  title: 'Hello World',
  body: 'My first post',
  published: false,
})

// Insert multiple rows
await zendbx.from('posts').insert([
  { title: 'Post 1' },
  { title: 'Post 2' },
])
```

### UPDATE

```ts
const { data, error } = await zendbx
  .from('posts')
  .eq('id', 'post-uuid')
  .update({ published: true, updated_at: new Date().toISOString() })
```

### DELETE

```ts
const { error } = await zendbx.from('posts').eq('id', 'post-uuid').delete()
```

---

## Projects

```ts
// List all projects
const { data } = await zendbx.projects.list()

// Create a project (provisions a new PostgreSQL database)
const { data } = await zendbx.projects.create({
  name: 'My App',
  description: 'Production database',
})

// Get a project
const { data } = await zendbx.projects.get('project-uuid')

// Update
await zendbx.projects.update('project-uuid', { name: 'New Name' })

// Delete (drops the database)
await zendbx.projects.delete('project-uuid')

// Get API keys
const { data } = await zendbx.projects.getKeys('project-uuid')
console.log(data?.anon_key, data?.service_role_key)

// Manage API keys
const { data } = await zendbx.projects.listApiKeys('project-uuid')
await zendbx.projects.createApiKey('project-uuid', { name: 'Mobile App' })
await zendbx.projects.deleteApiKey('project-uuid', 'key-uuid')
await zendbx.projects.toggleApiKey('project-uuid', 'key-uuid')
```

---

## AI APIs

```ts
// Natural language → SQL
const { data, error } = await zendbx.ai.generateSQL(
  'show me all users who signed up in the last 30 days'
)
console.log(data?.sql)
// SELECT * FROM users WHERE created_at >= NOW() - INTERVAL '30 days'

// Explain what a query does
const { data } = await zendbx.ai.explainSQL(
  'SELECT COUNT(*) FROM orders WHERE status = $1'
)
console.log(data?.explanation)

// Explain an error
const { data } = await zendbx.ai.explainError(
  'SLECT * FORM users',
  'syntax error at or near "SLECT"'
)

// Auto-fix broken SQL
const { data } = await zendbx.ai.fixSQL('SLECT * FORM users')
console.log(data?.fixed_sql)  // SELECT * FROM users

// Get insights about your data
const { data } = await zendbx.ai.getInsights()
console.log(data?.insights)
```

---

## Realtime

Subscribe to live table changes via WebSocket.

```ts
// Listen for any change on a table
const sub = zendbx.realtime
  .from('messages')
  .on('*', (payload) => {
    console.log('Change:', payload.event, payload.new)
  })
  .subscribe()

// Listen for specific events
const insertSub = zendbx.realtime
  .from('messages')
  .on('INSERT', (payload) => {
    console.log('New message:', payload.new)
  })
  .subscribe()

const updateSub = zendbx.realtime
  .from('posts')
  .on('UPDATE', (payload) => {
    console.log('Updated from:', payload.old, 'to:', payload.new)
  })
  .subscribe()

// Unsubscribe
sub.unsubscribe()
```

The connection auto-reconnects on disconnect (2s backoff).

---

## Storage

```ts
// List buckets
const { data } = await zendbx.storage.listBuckets()

// Create a bucket
await zendbx.storage.createBucket('avatars', { public: true })

// Delete a bucket
await zendbx.storage.deleteBucket('avatars')

// Upload a file (browser)
const file = document.querySelector('input[type=file]').files[0]
const { data, error } = await zendbx.storage.from('avatars').upload('user-123.png', file)

// Upload a string / buffer
await zendbx.storage.from('data').upload('export.json', JSON.stringify({ foo: 'bar' }), {
  contentType: 'application/json',
})

// Get public URL
const url = zendbx.storage.from('avatars').getPublicUrl('user-123.png')

// List objects
const { data } = await zendbx.storage.from('avatars').list()
const { data } = await zendbx.storage.from('avatars').list('users/') // with prefix

// Delete an object
await zendbx.storage.from('avatars').remove('user-123.png')
```

---

## Team Management

```ts
// List members
const { data } = await zendbx.team.list()

// Invite a member
const { data, error } = await zendbx.team.invite('colleague@example.com', 'admin')
// roles: 'owner' | 'admin' | 'member' | 'viewer'

// Update role
await zendbx.team.updateRole('member-uuid', 'viewer')

// Remove member
await zendbx.team.remove('member-uuid')
```

---

## Raw SQL & Database Management

```ts
// Execute raw SQL (auto-fix on error)
const { data, error } = await zendbx.db.query('SELECT count(*) FROM users')

// Query history
const { data } = await zendbx.db.getHistory()

// Save and reuse queries
await zendbx.db.saveQuery('Active users', 'SELECT * FROM users WHERE active = true')
const { data } = await zendbx.db.listSaved()
await zendbx.db.runSaved('saved-query-uuid')

// Schema inspection
const { data } = await zendbx.db.getSchema()
const { data } = await zendbx.db.listTables()
const { data } = await zendbx.db.getTable('users')

// Table management
await zendbx.db.createTable('products', [
  { name: 'id', type: 'uuid', primary_key: true },
  { name: 'name', type: 'text', nullable: false },
  { name: 'price', type: 'numeric' },
])
await zendbx.db.addColumn('products', { name: 'description', type: 'text' })
await zendbx.db.dropTable('old_table')

// RLS policies
const { data } = await zendbx.db.listPolicies()
await zendbx.db.createPolicy({
  table_name: 'posts',
  name: 'Users see own posts',
  command: 'SELECT',
  using_expression: 'auth.uid() = user_id',
})
await zendbx.db.deletePolicy('policy-uuid')
```

---

## Backups

```ts
// Create a backup
await zendbx.backups.create('project-uuid')

// List backups
const { data } = await zendbx.backups.list('project-uuid')

// Restore
await zendbx.backups.restore('backup-uuid')

// Delete
await zendbx.backups.delete('backup-uuid')
```

---

## Error Handling

Every method returns `{ data, error }`. Always check `error` before using `data`.

```ts
const { data, error } = await zendbx.auth.signIn({ email, password })

if (error) {
  console.error(error.message)   // human-readable message
  console.error(error.status)    // HTTP status code (e.g. 401)
  console.error(error.details)   // raw server response
  return
}

console.log(data.user)
```

---

## TypeScript

All modules are fully typed. Pass a row type to `from<T>()` for end-to-end type safety:

```ts
interface Post {
  id: string
  title: string
  published: boolean
  created_at: string
}

const { data, error } = await zendbx.from<Post>('posts')
  .select('id, title, published')
  .eq('published', true)
  .execute()

// data is Post[] | null — fully typed
data?.forEach(post => console.log(post.title))
```

---

## License

MIT © [ZENDBX](https://zendbx.in)
