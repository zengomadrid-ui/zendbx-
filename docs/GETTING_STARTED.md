# Getting Started with ZendBX

Get up and running with ZendBX in under 5 minutes.

## Prerequisites

- Node.js 18+ or Bun
- A ZendBX account ([sign up here](https://zendbx.in))

## Step 1: Create an Account

1. Go to [zendbx.in](https://zendbx.in)
2. Click **Sign Up**
3. Enter your email and password
4. Verify your email (check your inbox)

## Step 2: Create a Project

1. Log in to your dashboard
2. Click **New Project**
3. Enter a project name (e.g., "My Todo App")
4. Click **Create Project**

Your project database is automatically created and ready to use!

## Step 3: Copy Your Credentials

From your project dashboard, copy:

- **Project URL**: `https://api.zendbx.in`
- **Project ID**: `abc-123-def-456` (UUID format)
- **Anon Key**: `eyJhbGciOiJIUzI1NiIs...` (public API key)

💡 **Tip**: You can find these in **Project Settings → API Keys**

## Step 4: Install the SDK

```bash
npm install @zendbx/sdk
```

Or with other package managers:

```bash
# Yarn
yarn add @zendbx/sdk

# pnpm
pnpm add @zendbx/sdk

# Bun
bun add @zendbx/sdk
```

## Step 5: Configure Environment Variables

Create a `.env.local` file (React/Vite) or `.env` (Node.js):

### For React / Vite

```env
VITE_ZENDBX_URL=https://api.zendbx.in
VITE_ZENDBX_PROJECT_ID=your-project-id
VITE_ZENDBX_ANON_KEY=your-anon-key
```

### For Next.js

```env
NEXT_PUBLIC_ZENDBX_URL=https://api.zendbx.in
NEXT_PUBLIC_ZENDBX_PROJECT_ID=your-project-id
NEXT_PUBLIC_ZENDBX_ANON_KEY=your-anon-key
```

### For Node.js

```env
ZENDBX_URL=https://api.zendbx.in
ZENDBX_PROJECT_ID=your-project-id
ZENDBX_ANON_KEY=your-anon-key
```

## Step 6: Initialize the SDK

Create a `lib/zendbx.ts` file:

```typescript
import { createClient } from '@zendbx/sdk'

export const zendbx = createClient({
  apiUrl: import.meta.env.VITE_ZENDBX_URL,      // or process.env
  projectId: import.meta.env.VITE_ZENDBX_PROJECT_ID,
  anonKey: import.meta.env.VITE_ZENDBX_ANON_KEY,
})
```

## Step 7: Create Your First Table

You can create tables from the dashboard or programmatically:

### From the Dashboard

1. Go to **Database → Tables**
2. Click **New Table**
3. Name it `todos`
4. Add columns:
   - `id` (UUID, Primary Key)
   - `title` (Text)
   - `completed` (Boolean, default false)
   - `created_at` (Timestamp, default now())
5. Click **Create Table**

### Programmatically

```typescript
import { zendbx } from './lib/zendbx'

await zendbx.db.createTable('todos', [
  { name: 'id', type: 'uuid', primary_key: true, default: 'gen_random_uuid()' },
  { name: 'title', type: 'text', nullable: false },
  { name: 'completed', type: 'boolean', default: 'false' },
  { name: 'created_at', type: 'timestamptz', default: 'now()' }
])
```

## Step 8: Insert Data

```typescript
import { zendbx } from './lib/zendbx'

const { data, error } = await zendbx.from('todos').insert({
  title: 'Learn ZendBX',
  completed: false
})

if (error) {
  console.error('Error:', error.message)
} else {
  console.log('Created:', data)
}
```

## Step 9: Query Data

```typescript
import { zendbx } from './lib/zendbx'

// Get all todos
const { data: todos } = await zendbx.from('todos').select('*')
console.log('Todos:', todos)

// Get incomplete todos
const { data: incomplete } = await zendbx
  .from('todos')
  .select('*')
  .eq('completed', false)

// Get with sorting
const { data: sorted } = await zendbx
  .from('todos')
  .select('*')
  .order('created_at', { ascending: false })
```

## Step 10: Deploy Your App

Your app is now ready to deploy! ZendBX handles:

- ✅ Database hosting
- ✅ Auto-generated REST APIs
- ✅ Authentication (when you enable it)
- ✅ Real-time subscriptions
- ✅ File storage

Deploy to:
- **Vercel** (recommended for Next.js)
- **Netlify**
- **Cloudflare Pages**
- Any Node.js hosting

---

## Next Steps

- 📖 **[Build a complete app in 5 minutes →](./QUICK_START.md)**
- 🔐 **[Add authentication →](./AUTH.md)**
- 📦 **[Upload files with Storage →](./STORAGE.md)**
- ⚡ **[Enable real-time updates →](./REALTIME.md)**
- 🤖 **[Use AI features →](./AI.md)**

## Common Issues

### Missing Project ID

**Error:** `MissingConfigError: projectId or projectSlug`

**Solution:** Make sure you provide either `projectId` or `projectSlug` when creating the client:

```typescript
createClient({
  apiUrl: '...',
  projectId: 'your-project-id',  // Required
  anonKey: '...'
})
```

### Invalid URL

**Error:** `InvalidUrlError: Invalid apiUrl`

**Solution:** Ensure the URL is complete with protocol:

```typescript
// ✅ Correct
apiUrl: 'https://api.zendbx.in'

// ❌ Wrong
apiUrl: 'api.zendbx.in'
```

### CORS Errors

If you see CORS errors in the browser, make sure:

1. Your domain is allowed in **Project Settings → CORS**
2. You're using the `anonKey`, not the `serviceKey` (which is server-only)

---

**Need help?** Join our [Discord community](https://discord.gg/zendbx) or check the [troubleshooting guide](./TROUBLESHOOTING.md).
