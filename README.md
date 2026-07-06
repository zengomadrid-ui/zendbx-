# ZendBX

> PostgreSQL Backend-as-a-Service for modern applications

**ZendBX** is an open-source backend-as-a-service platform that provides everything you need to build production-ready applications: authentication, database, storage, realtime subscriptions, and AI-powered tools — all powered by PostgreSQL.

[![npm version](https://badge.fury.io/js/@zendbx%2Fsdk.svg)](https://www.npmjs.com/package/@zendbx/sdk)
[![License: MIT](https://img.shields.io/badge/License-MIT-blue.svg)](https://opensource.org/licenses/MIT)

## Features

- **🔐 Authentication** - Email/password, OAuth (Google, GitHub), JWT tokens, session management
- **🗄️ Database** - PostgreSQL with instant REST APIs, Row Level Security, SQL editor
- **📦 Storage** - Object storage with buckets, file uploads, signed URLs
- **⚡ Realtime** - WebSocket subscriptions for database changes
- **🤖 AI Tools** - Natural language to SQL, query explanations, auto-fix errors
- **🔑 API Keys** - Anon and service role keys for secure access
- **👥 Team Collaboration** - Multi-user projects with role-based access control
- **💾 Backups** - Automated database backups and restore
- **📊 Analytics** - Query performance tracking and usage metrics

## Why ZendBX?

- **Open Source** - Self-host or use our cloud platform
- **Developer First** - Fluent SDK, great docs, interactive playground
- **Supabase Compatible** - Easy migration with similar API design
- **AI-Powered** - Built-in AI tools for database management
- **Production Ready** - Multi-tenant architecture, RLS, audit logs
- **Fast** - PostgreSQL + asyncpg for maximum performance

## Quick Start

### 1. Create an Account

Sign up at [zendbx.in](https://zendbx.in) (or your self-hosted instance)

### 2. Create a Project

```bash
# From the dashboard, click "New Project"
# Copy your Project URL, Project ID, and Anon Key
```

### 3. Install the SDK

```bash
npm install @zendbx/sdk
```

### 4. Initialize the Client

```typescript
import { createClient } from '@zendbx/sdk'

const zendbx = createClient({
  apiUrl: 'https://api.zendbx.in',
  projectId: 'your-project-id',
  anonKey: 'your-anon-key',
})

// Query data
const { data, error } = await zendbx.from('users').select('*')

// Insert data
const { data } = await zendbx.from('users').insert({
  name: 'John Doe',
  email: 'john@example.com'
})

// Real-time subscriptions
zendbx.realtime
  .from('messages')
  .on('INSERT', (payload) => {
    console.log('New message:', payload.new)
  })
  .subscribe()
```

### 5. Deploy

Your app is ready! All APIs are automatically generated from your database schema.

📖 **[Read the full Getting Started guide →](./docs/GETTING_STARTED.md)**

## Architecture

```
┌──────────────────────────────────────────────────────────┐
│                  Your Application                         │
│         (React, Next.js, Vue, Node.js, etc.)            │
└────────────────────┬─────────────────────────────────────┘
                     │
                     │ @zendbx/sdk
                     ▼
┌──────────────────────────────────────────────────────────┐
│                   ZendBX Backend                          │
│  ┌─────────────┐  ┌──────────┐  ┌─────────────┐        │
│  │     Auth    │  │ Database │  │   Storage   │        │
│  └─────────────┘  └──────────┘  └─────────────┘        │
│  ┌─────────────┐  ┌──────────┐  ┌─────────────┐        │
│  │  Realtime   │  │ AI Tools │  │   Backups   │        │
│  └─────────────┘  └──────────┘  └─────────────┘        │
└────────────────────┬─────────────────────────────────────┘
                     │
        ┌────────────┴────────────┐
        ▼                         ▼
┌──────────────┐          ┌──────────────┐
│  PostgreSQL  │          │  WebSocket   │
│   Database   │          │    Server    │
└──────────────┘          └──────────────┘
```

**Multi-Tenant Architecture**
- Each project gets its own PostgreSQL database
- Complete data isolation between projects
- Automatic schema management and migrations

## Installation

### Using npm

```bash
npm install @zendbx/sdk
```

### Using yarn

```bash
yarn add @zendbx/sdk
```

### Using pnpm

```bash
pnpm add @zendbx/sdk
```

The SDK works in:
- ✅ React, Next.js, Vue, Nuxt, Angular, Svelte
- ✅ Node.js, Express, Fastify, NestJS
- ✅ Bun, Deno
- ✅ Edge runtimes (Cloudflare Workers, Vercel Edge)

## SDK Usage

### Authentication

```typescript
// Sign up
const { data, error } = await zendbx.auth.signUp({
  email: 'user@example.com',
  password: 'secure-password',
  name: 'John Doe'
})

// Sign in
const { data } = await zendbx.auth.signIn({
  email: 'user@example.com',
  password: 'secure-password'
})

// Get current user
const { data: { user } } = await zendbx.auth.getUser()

// Sign out
await zendbx.auth.signOut()

// Listen to auth changes
zendbx.auth.onAuthStateChange((event, session) => {
  console.log(event, session)
})
```

### Database

```typescript
// Select all
const { data } = await zendbx.from('users').select('*')

// Select specific columns
const { data } = await zendbx.from('users').select('id, name, email')

// Filters
const { data } = await zendbx
  .from('users')
  .select('*')
  .eq('status', 'active')
  .gt('age', 18)
  .like('email', '%@gmail.com')

// Sorting and pagination
const { data } = await zendbx
  .from('users')
  .select('*')
  .order('created_at', { ascending: false })
  .limit(20)
  .range(0, 19)

// Insert
const { data } = await zendbx.from('users').insert({
  name: 'Jane Smith',
  email: 'jane@example.com'
})

// Update
const { data } = await zendbx
  .from('users')
  .update({ status: 'inactive' })
  .eq('id', 123)

// Delete
await zendbx.from('users').delete().eq('id', 123)

// Raw SQL
const { data } = await zendbx.db.query('SELECT * FROM users WHERE age > 18')
```

### Storage

```typescript
// List buckets
const { data: buckets } = await zendbx.storage.listBuckets()

// Create bucket
await zendbx.storage.createBucket('avatars', { isPublic: true })

// Upload file
const bucket = zendbx.storage.bucket('avatars')
const { data } = await bucket.upload(file, 'user-123.png')

// List files
const { data: files } = await bucket.list()

// Download file
const response = await bucket.download('file-id')
const blob = await response.blob()

// Delete file
await bucket.delete('file-id')

// Create signed URL
const { data } = await bucket.createSignedUrl('file-id', '1h')
console.log(data.url)
```

### Realtime

```typescript
// Subscribe to table changes
const subscription = zendbx.realtime
  .from('messages')
  .on('INSERT', (payload) => {
    console.log('New message:', payload.new)
  })
  .subscribe()

// Unsubscribe
subscription.unsubscribe()

// Listen to all events
zendbx.realtime
  .from('users')
  .on('*', (payload) => {
    console.log('Event:', payload.event, payload.new)
  })
  .subscribe()
```

### AI Features

```typescript
// Generate SQL from natural language
const { data } = await zendbx.ai.generateSQL(
  'Show me all users who signed up this month'
)
console.log(data.sql)

// Explain SQL
const { data } = await zendbx.ai.explainSQL(
  'SELECT * FROM users WHERE age > 18'
)
console.log(data.explanation)

// Fix SQL errors
const { data } = await zendbx.ai.fixSQL(
  'SELECT * FROM user WHERE age > 18',
  'table "user" does not exist'
)
console.log(data.fixed_sql)
```

## Environment Variables

### React / Vite

```env
VITE_ZENDBX_URL=https://api.zendbx.in
VITE_ZENDBX_PROJECT_ID=your-project-id
VITE_ZENDBX_ANON_KEY=your-anon-key
```

### Next.js

```env
NEXT_PUBLIC_ZENDBX_URL=https://api.zendbx.in
NEXT_PUBLIC_ZENDBX_PROJECT_ID=your-project-id
NEXT_PUBLIC_ZENDBX_ANON_KEY=your-anon-key
```

### Node.js

```env
ZENDBX_URL=https://api.zendbx.in
ZENDBX_PROJECT_ID=your-project-id
ZENDBX_SERVICE_KEY=your-service-key  # For server-side operations
```

📖 **[See full environment configuration guide →](./docs/ENVIRONMENT_VARIABLES.md)**

## Example Application

Here's a complete Todo app in React:

```typescript
import { createClient } from '@zendbx/sdk'
import { useEffect, useState } from 'react'

const zendbx = createClient({
  apiUrl: import.meta.env.VITE_ZENDBX_URL,
  projectId: import.meta.env.VITE_ZENDBX_PROJECT_ID,
  anonKey: import.meta.env.VITE_ZENDBX_ANON_KEY,
})

function TodoApp() {
  const [todos, setTodos] = useState([])
  const [newTodo, setNewTodo] = useState('')

  useEffect(() => {
    loadTodos()
    
    // Subscribe to realtime updates
    const sub = zendbx.realtime
      .from('todos')
      .on('*', () => loadTodos())
      .subscribe()
    
    return () => sub.unsubscribe()
  }, [])

  async function loadTodos() {
    const { data } = await zendbx
      .from('todos')
      .select('*')
      .order('created_at', { ascending: false })
    setTodos(data || [])
  }

  async function addTodo() {
    await zendbx.from('todos').insert({ title: newTodo, completed: false })
    setNewTodo('')
  }

  async function toggleTodo(id, completed) {
    await zendbx.from('todos').update({ completed }).eq('id', id)
  }

  async function deleteTodo(id) {
    await zendbx.from('todos').delete().eq('id', id)
  }

  return (
    <div>
      <h1>Todos</h1>
      <input
        value={newTodo}
        onChange={(e) => setNewTodo(e.target.value)}
        placeholder="Add a todo"
      />
      <button onClick={addTodo}>Add</button>
      
      <ul>
        {todos.map((todo) => (
          <li key={todo.id}>
            <input
              type="checkbox"
              checked={todo.completed}
              onChange={(e) => toggleTodo(todo.id, e.target.checked)}
            />
            <span>{todo.title}</span>
            <button onClick={() => deleteTodo(todo.id)}>Delete</button>
          </li>
        ))}
      </ul>
    </div>
  )
}
```

📖 **[See more examples →](./docs/examples/)**

## Documentation

### Getting Started
- [Getting Started Guide](./docs/GETTING_STARTED.md) - Create your first app in 5 minutes
- [Quick Start](./docs/QUICK_START.md) - Complete walkthrough with React + Vite

### SDK Guides
- [React Guide](./docs/guides/REACT.md)
- [Next.js Guide](./docs/guides/NEXTJS.md)
- [Vue Guide](./docs/guides/VUE.md)
- [Node.js Guide](./docs/guides/NODE.md)
- [Express Guide](./docs/guides/EXPRESS.md)

### Core Features
- [Authentication](./docs/AUTH.md) - Email/password, OAuth, sessions
- [Database](./docs/DATABASE.md) - CRUD, filters, joins, RLS
- [Storage](./docs/STORAGE.md) - File uploads, buckets, signed URLs
- [Realtime](./docs/REALTIME.md) - WebSocket subscriptions
- [AI Features](./docs/AI.md) - Natural language to SQL

### API Reference
- [SDK API Reference](./docs/API_REFERENCE.md)
- [REST API Reference](./docs/REST_API.md)

### Migration & Troubleshooting
- [Migrate from Supabase](./docs/migration/SUPABASE.md)
- [Migrate from Firebase](./docs/migration/FIREBASE.md)
- [Common Errors](./docs/COMMON_ERRORS.md)
- [Troubleshooting Guide](./docs/TROUBLESHOOTING.md)

### Advanced
- [Best Practices](./docs/BEST_PRACTICES.md)
- [Row Level Security](./docs/RLS.md)
- [Performance Optimization](./docs/PERFORMANCE.md)
- [Self-Hosting Guide](./docs/SELF_HOSTING.md)

## Community

- **Website**: [zendbx.in](https://zendbx.in)
- **Documentation**: [docs.zendbx.in](https://docs.zendbx.in)
- **Discord**: [Join our Discord](https://discord.gg/zendbx)
- **Twitter**: [@zendbx](https://twitter.com/zendbx)
- **GitHub**: [github.com/zendbx](https://github.com/zendbx)

## Contributing

We welcome contributions! Please see our [Contributing Guide](./CONTRIBUTING.md) for details.

### Development Setup

```bash
# Clone the repository
git clone https://github.com/zendbx/zendbx.git
cd zendbx

# Install dependencies
npm install

# Set up the database
psql -U postgres -c "CREATE DATABASE zendbx_main"
psql -U postgres -d zendbx_main -f backend/database/init_main_database.sql

# Configure environment
cp backend/.env.example backend/.env
cp frontend/.env.local.example frontend/.env.local

# Start development servers
npm run dev
```

📖 **[Read the full development guide →](./DEVELOPMENT.md)**

## License

MIT License - see [LICENSE](./LICENSE) for details

## Acknowledgments

- Inspired by [Supabase](https://supabase.com)
- Powered by [PostgreSQL](https://postgresql.org)
- Built with [FastAPI](https://fastapi.tiangolo.com) and [Next.js](https://nextjs.org)

---

**Built with ❤️ for developers**

[Get Started](https://zendbx.in) · [Documentation](./docs) · [Community](https://discord.gg/zendbx)
