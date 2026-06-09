# @zendbx/sdk

Official JavaScript / TypeScript SDK for [ZendBX](https://zendbx.in) — PostgreSQL Backend-as-a-Service.

Fluent, chainable query API comparable to Supabase. Works in Node.js, Bun, Deno, Next.js, React, Vue, Svelte, and any modern TypeScript project.

## Install

```bash
npm install @zendbx/sdk
# or
yarn add @zendbx/sdk
# or
pnpm add @zendbx/sdk
```

## Quick Start

```ts
import { createClient } from '@zendbx/sdk'

const db = createClient(
  process.env.ZENDBX_URL!,       // e.g. 'https://api.zendbx.in'
  process.env.ZENDBX_API_KEY!,   // your anon key
  { projectId: 'your-project-uuid' }
)

const { data, error } = await db.from('users').select('*')
```

---

## createClient

```ts
// Standard (with explicit projectId)
const db = createClient(url, anonKey, { projectId: 'uuid' })

// Options object
const db = createClient({ apiUrl, anonKey, projectId })
```

---

## CRUD Operations

### SELECT

```ts
// Select all columns
const { data, error } = await db.from('users').select('*')

// Select specific columns
const { data } = await db.from('users').select('id, name, email')

// With count
const { data, count } = await db.from('users').select('*', { count: 'exact' })
```

### INSERT

```ts
// Single row
const { data, error } = await db.from('users').insert({
  name: 'John',
  email: 'john@example.com'
})

// Bulk insert
const { data } = await db.from('users').insert([
  { name: 'Alice', email: 'alice@example.com' },
  { name: 'Bob',   email: 'bob@example.com' }
])

// Insert and return the created row
const { data } = await db.from('users').insert({ name: 'John' }).select()
```

### UPDATE

```ts
const { data, error } = await db
  .from('users')
  .update({ name: 'Jane' })
  .eq('id', 1)

// Update and return updated rows
const { data } = await db
  .from('users')
  .update({ email: 'jane@example.com' })
  .eq('id', 1)
  .select()
```

### UPSERT

```ts
const { data, error } = await db
  .from('users')
  .upsert({ id: 1, name: 'John' })
```

### DELETE

```ts
const { error } = await db.from('users').delete().eq('id', 1)
```

---

## Filtering

All filters are chainable and map directly to query parameters.

```ts
await db.from('users')
  .select('*')
  .eq('country', 'India')
  .gt('age', 18)
  .like('email', '%@gmail.com')
```

| Method | Operator | Example |
|--------|----------|---------|
| `.eq(col, val)` | `=` | `.eq('status', 'active')` |
| `.neq(col, val)` | `!=` | `.neq('status', 'deleted')` |
| `.gt(col, val)` | `>` | `.gt('age', 18)` |
| `.gte(col, val)` | `>=` | `.gte('score', 90)` |
| `.lt(col, val)` | `<` | `.lt('price', 100)` |
| `.lte(col, val)` | `<=` | `.lte('age', 65)` |
| `.like(col, pat)` | `LIKE` | `.like('name', '%John%')` |
| `.ilike(col, pat)` | `ILIKE` | `.ilike('email', '%@gmail.com')` |
| `.in(col, arr)` | `IN` | `.in('status', ['active', 'pending'])` |
| `.is(col, val)` | `IS` | `.is('deleted_at', null)` |
| `.not(col, op, val)` | `NOT` | `.not('status', 'eq', 'deleted')` |
| `.or(conditions)` | `OR` | `.or('status.eq.active,status.eq.pending')` |

---

## Ordering

```ts
// Ascending (default)
await db.from('users').select('*').order('created_at')

// Descending
await db.from('users').select('*').order('created_at', { ascending: false })
```

---

## Pagination

```ts
// Limit
await db.from('users').select('*').limit(20)

// Offset + limit
await db.from('users').select('*').limit(20).range(0, 19)

// Page 2 (rows 20–39)
await db.from('users').select('*').range(20, 39)
```

---

## Single Row Helpers

```ts
// Returns a single object — errors if 0 or >1 rows found
const { data, error } = await db
  .from('users')
  .select('*')
  .eq('id', 1)
  .single()

// Returns null instead of error when no row found
const { data } = await db
  .from('users')
  .select('*')
  .eq('email', 'john@example.com')
  .maybeSingle()
```

---

## Authentication

```ts
// Sign up
const { data, error } = await db.auth.signUp({
  email: 'john@example.com',
  password: 'password123'
})

// Sign in
const { data, error } = await db.auth.signIn({
  email: 'john@example.com',
  password: 'password123'
})

// Get current user
const { data: { user } } = await db.auth.getUser()

// Get current session
const { data: { session } } = await db.auth.getSession()

// Sign out
await db.auth.signOut()
```

---

## Response Format

Every operation returns:

```ts
interface ZendbxQueryResponse<T> {
  data: T | null
  error: { message: string; status?: number; details?: unknown } | null
  status: number
  count?: number | null
}
```

Never throws for database errors — check the `error` field.

```ts
const { data, error, status } = await db.from('users').select('*')

if (error) {
  console.error(error.message)
} else {
  console.log(data)
}
```

---

## TypeScript

Full generic typing throughout the query chain:

```ts
interface User {
  id: number
  name: string
  email: string
  status: 'active' | 'inactive'
}

const { data } = await db.from<User>('users').select('*').eq('status', 'active')
// data is User[] | null
```

---

## Lazy Execution

Queries execute only when `await`ed — build them up freely:

```ts
let query = db.from('users').select('*')

if (filter) query = query.eq('status', filter)
if (limit)  query = query.limit(limit)

const { data } = await query
```

---

## Full Example

```ts
import { createClient } from '@zendbx/sdk'

const db = createClient(
  process.env.ZENDBX_URL!,
  process.env.ZENDBX_API_KEY!,
  { projectId: process.env.ZENDBX_PROJECT_ID! }
)

// Sign in
const { data: auth, error: authErr } = await db.auth.signIn({
  email: 'john@example.com',
  password: 'password123'
})
if (authErr) throw authErr

// Fetch active users in India, sorted by name, paginated
const { data: users, error } = await db
  .from('users')
  .select('id, name, email, created_at')
  .eq('status', 'active')
  .eq('country', 'India')
  .order('name')
  .limit(20)

if (error) {
  console.error('Failed:', error.message)
} else {
  console.log(`Found ${users?.length} users`)
}

// Insert a record
const { data: newUser, error: insertErr } = await db
  .from('users')
  .insert({ name: 'Alice', email: 'alice@example.com', status: 'active' })
  .select()

// Update a record
await db.from('users').update({ status: 'inactive' }).eq('id', 42)

// Delete a record
await db.from('users').delete().eq('id', 42)
```

---

## License

MIT © [ZendBX](https://zendbx.in)
