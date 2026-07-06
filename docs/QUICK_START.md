# Quick Start: Build Your First ZendBX App in 5 Minutes

Build a complete Todo app with authentication, database CRUD, and real-time updates in under 5 minutes.

## What You'll Build

A fully functional Todo app with:
- ✅ User authentication (sign up / sign in)
- ✅ Create, read, update, delete todos
- ✅ Real-time updates across tabs
- ✅ File attachments (optional)

## Prerequisites

- Node.js 18+
- A ZendBX account ([sign up](https://zendbx.in))

## Step 1: Create a New React App

```bash
npm create vite@latest my-zendbx-app -- --template react-ts
cd my-zendbx-app
npm install
```

## Step 2: Install ZendBX SDK

```bash
npm install @zendbx/sdk
```

## Step 3: Set Up Environment Variables

Create `.env.local`:

```env
VITE_ZENDBX_URL=https://api.zendbx.in
VITE_ZENDBX_PROJECT_ID=your-project-id
VITE_ZENDBX_ANON_KEY=your-anon-key
```

**Get your credentials:**
1. Log in to [zendbx.in](https://zendbx.in)
2. Create a new project
3. Go to **Settings → API** and copy your credentials

## Step 4: Initialize the ZendBX Client

Create `src/lib/zendbx.ts`:

```typescript
import { createClient } from '@zendbx/sdk'

export const zendbx = createClient({
  apiUrl: import.meta.env.VITE_ZENDBX_URL,
  projectId: import.meta.env.VITE_ZENDBX_PROJECT_ID,
  anonKey: import.meta.env.VITE_ZENDBX_ANON_KEY,
})
```

## Step 5: Create the Database Table

From your ZendBX dashboard:

1. Go to **Database → Tables**
2. Click **New Table**
3. Name: `todos`
4. Add columns:

| Column | Type | Constraints |
|--------|------|-------------|
| id | uuid | Primary Key, Default: `gen_random_uuid()` |
| user_id | uuid | Not Null |
| title | text | Not Null |
| completed | boolean | Default: `false` |
| created_at | timestamptz | Default: `now()` |

5. Click **Create Table**

## Step 6: Enable Row Level Security (RLS)

Still in the dashboard:

1. Go to **Database → RLS**
2. Enable RLS for the `todos` table
3. Add this policy:

**Name:** Users can manage their own todos

**SQL:**
```sql
CREATE POLICY "Users can manage their own todos"
ON todos
FOR ALL
USING (auth.uid() = user_id);
```

## Step 7: Build the Authentication Component

Create `src/components/Auth.tsx`:

```typescript
import { useState } from 'react'
import { zendbx } from '../lib/zendbx'

export function Auth() {
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [loading, setLoading] = useState(false)

  async function handleSignUp() {
    setLoading(true)
    const { error } = await zendbx.auth.signUp({ email, password })
    if (error) alert(error.message)
    else alert('Check your email for verification!')
    setLoading(false)
  }

  async function handleSignIn() {
    setLoading(true)
    const { error } = await zendbx.auth.signIn({ email, password })
    if (error) alert(error.message)
    setLoading(false)
  }

  return (
    <div style={{ maxWidth: 400, margin: '0 auto', padding: 20 }}>
      <h1>Welcome to ZendBX</h1>
      <input
        type="email"
        placeholder="Email"
        value={email}
        onChange={(e) => setEmail(e.target.value)}
        style={{ width: '100%', padding: 10, marginBottom: 10 }}
      />
      <input
        type="password"
        placeholder="Password"
        value={password}
        onChange={(e) => setPassword(e.target.value)}
        style={{ width: '100%', padding: 10, marginBottom: 10 }}
      />
      <button 
        onClick={handleSignIn} 
        disabled={loading}
        style={{ marginRight: 10, padding: '10px 20px' }}
      >
        Sign In
      </button>
      <button 
        onClick={handleSignUp} 
        disabled={loading}
        style={{ padding: '10px 20px' }}
      >
        Sign Up
      </button>
    </div>
  )
}
```

## Step 8: Build the Todo Component

Create `src/components/Todos.tsx`:

```typescript
import { useEffect, useState } from 'react'
import { zendbx } from '../lib/zendbx'

interface Todo {
  id: string
  title: string
  completed: boolean
  created_at: string
}

export function Todos({ onSignOut }: { onSignOut: () => void }) {
  const [todos, setTodos] = useState<Todo[]>([])
  const [newTodo, setNewTodo] = useState('')
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    loadTodos()
    
    // Subscribe to real-time changes
    const subscription = zendbx.realtime
      .from('todos')
      .on('*', (payload) => {
        console.log('Change received!', payload)
        loadTodos()
      })
      .subscribe()
    
    return () => subscription.unsubscribe()
  }, [])

  async function loadTodos() {
    const { data: user } = await zendbx.auth.getUser()
    if (!user) return

    const { data, error } = await zendbx
      .from<Todo>('todos')
      .select('*')
      .order('created_at', { ascending: false })

    if (error) {
      console.error('Error loading todos:', error.message)
    } else {
      setTodos(data || [])
    }
    setLoading(false)
  }

  async function addTodo() {
    if (!newTodo.trim()) return

    const { data: user } = await zendbx.auth.getUser()
    if (!user.user) return

    const { error } = await zendbx.from('todos').insert({
      title: newTodo,
      user_id: user.user.id,
      completed: false
    })

    if (error) {
      alert(error.message)
    } else {
      setNewTodo('')
      loadTodos()
    }
  }

  async function toggleTodo(id: string, completed: boolean) {
    const { error } = await zendbx
      .from('todos')
      .update({ completed: !completed })
      .eq('id', id)

    if (error) alert(error.message)
    else loadTodos()
  }

  async function deleteTodo(id: string) {
    const { error } = await zendbx.from('todos').delete().eq('id', id)
    if (error) alert(error.message)
    else loadTodos()
  }

  if (loading) return <div>Loading...</div>

  return (
    <div style={{ maxWidth: 600, margin: '0 auto', padding: 20 }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 20 }}>
        <h1>My Todos</h1>
        <button onClick={onSignOut}>Sign Out</button>
      </div>

      <div style={{ display: 'flex', marginBottom: 20 }}>
        <input
          type="text"
          placeholder="What needs to be done?"
          value={newTodo}
          onChange={(e) => setNewTodo(e.target.value)}
          onKeyPress={(e) => e.key === 'Enter' && addTodo()}
          style={{ flex: 1, padding: 10, marginRight: 10 }}
        />
        <button onClick={addTodo} style={{ padding: '10px 20px' }}>
          Add
        </button>
      </div>

      <ul style={{ listStyle: 'none', padding: 0 }}>
        {todos.map((todo) => (
          <li
            key={todo.id}
            style={{
              display: 'flex',
              alignItems: 'center',
              padding: 10,
              borderBottom: '1px solid #ddd'
            }}
          >
            <input
              type="checkbox"
              checked={todo.completed}
              onChange={() => toggleTodo(todo.id, todo.completed)}
              style={{ marginRight: 10 }}
            />
            <span
              style={{
                flex: 1,
                textDecoration: todo.completed ? 'line-through' : 'none',
                color: todo.completed ? '#999' : '#000'
              }}
            >
              {todo.title}
            </span>
            <button
              onClick={() => deleteTodo(todo.id)}
              style={{ padding: '5px 10px', color: 'red' }}
            >
              Delete
            </button>
          </li>
        ))}
      </ul>

      {todos.length === 0 && (
        <p style={{ textAlign: 'center', color: '#999' }}>
          No todos yet. Add one above!
        </p>
      )}
    </div>
  )
}
```

## Step 9: Put It All Together

Replace `src/App.tsx`:

```typescript
import { useEffect, useState } from 'react'
import { Auth } from './components/Auth'
import { Todos } from './components/Todos'
import { zendbx } from './lib/zendbx'

function App() {
  const [session, setSession] = useState<any>(null)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    // Check for existing session
    zendbx.auth.getSession().then(({ data: { session } }) => {
      setSession(session)
      setLoading(false)
    })

    // Listen for auth changes
    const { unsubscribe } = zendbx.auth.onAuthStateChange((event, session) => {
      setSession(session)
    })

    return () => unsubscribe()
  }, [])

  async function handleSignOut() {
    await zendbx.auth.signOut()
    setSession(null)
  }

  if (loading) {
    return <div style={{ textAlign: 'center', marginTop: 50 }}>Loading...</div>
  }

  return (
    <div>
      {!session ? <Auth /> : <Todos onSignOut={handleSignOut} />}
    </div>
  )
}

export default App
```

## Step 10: Run Your App

```bash
npm run dev
```

Open [http://localhost:5173](http://localhost:5173) in your browser.

## 🎉 You're Done!

You now have a fully functional Todo app with:

- ✅ User authentication
- ✅ Database CRUD operations
- ✅ Real-time updates
- ✅ Row-level security

## Try These Features

### 1. Test Real-Time Updates

Open the app in two browser windows and sign in with the same account. Add a todo in one window – it appears instantly in the other!

### 2. Add File Attachments

```typescript
// In Todos.tsx, add file upload
const [file, setFile] = useState<File | null>(null)

async function addTodoWithFile() {
  if (!newTodo.trim()) return

  const { data: user } = await zendbx.auth.getUser()
  if (!user.user) return

  let file_url = null

  // Upload file if provided
  if (file) {
    const bucket = zendbx.storage.bucket('todo-attachments')
    const { data, error } = await bucket.upload(file)
    if (error) {
      alert(error.message)
      return
    }
    file_url = data.public_url
  }

  // Insert todo
  await zendbx.from('todos').insert({
    title: newTodo,
    user_id: user.user.id,
    completed: false,
    file_url
  })

  setNewTodo('')
  setFile(null)
  loadTodos()
}
```

### 3. Add Filtering

```typescript
const [filter, setFilter] = useState<'all' | 'active' | 'completed'>('all')

async function loadTodos() {
  let query = zendbx.from<Todo>('todos').select('*')

  if (filter === 'active') query = query.eq('completed', false)
  if (filter === 'completed') query = query.eq('completed', true)

  const { data } = await query.order('created_at', { ascending: false })
  setTodos(data || [])
}
```

## Deploy to Production

Deploy to Vercel in one command:

```bash
npm install -g vercel
vercel
```

Or deploy to Netlify:

```bash
npm install -g netlify-cli
netlify deploy --prod
```

---

## Next Steps

- 📖 **[Learn about authentication →](./AUTH.md)**
- 📦 **[Add file storage →](./STORAGE.md)**
- 🤖 **[Use AI features →](./AI.md)**
- 🔒 **[Secure with RLS →](./RLS.md)**
- 📊 **[See all SDK methods →](./API_REFERENCE.md)**

## Troubleshooting

### Todos not appearing

Make sure:
1. You've created the `todos` table with the correct columns
2. RLS policy is set up correctly
3. You're signed in with a valid user

### Real-time not working

Check:
1. WebSocket server is running (default: port 8001)
2. Your firewall allows WebSocket connections
3. Browser console for connection errors

### CORS errors

Make sure your app domain is allowed in **Project Settings → CORS**.

---

**Need help?** Join our [Discord community](https://discord.gg/zendbx) or check the [troubleshooting guide](./TROUBLESHOOTING.md).
