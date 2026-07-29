# @zendbx/react

> Official React SDK for ZendBX - PostgreSQL Backend-as-a-Service

[![npm version](https://badge.fury.io/js/@zendbx%2Freact.svg)](https://www.npmjs.com/package/@zendbx/react)
[![License: MIT](https://img.shields.io/badge/License-MIT-blue.svg)](https://opensource.org/licenses/MIT)

A lightweight React wrapper around [@zendbx/sdk](https://www.npmjs.com/package/@zendbx/sdk) providing React Hooks, automatic caching, and optimistic updates.

## Features

- ✅ **React Hooks** - useAuth, useQuery, useInsert, useUpdate, etc.
- ✅ **Automatic Caching** - Built-in query and mutation caching
- ✅ **TypeScript First** - Full type inference and type safety
- ✅ **SSR Compatible** - Works with Next.js, Remix, and other SSR frameworks
- ✅ **Zero Dependencies** - Only peer dependencies on React and @zendbx/sdk
- ✅ **Tiny Bundle** - < 10KB gzipped
- ✅ **Optimistic Updates** - Instant UI updates with automatic rollback
- ✅ **Guard Components** - AuthGuard, GuestGuard for route protection

## Installation

```bash
npm install @zendbx/react @zendbx/sdk
```

```bash
yarn add @zendbx/react @zendbx/sdk
```

```bash
pnpm add @zendbx/react @zendbx/sdk
```

## Quick Start

### 1. Setup Provider

```tsx
import { createClient } from '@zendbx/sdk';
import { ZendbxProvider } from '@zendbx/react';

// Create SDK client
const client = createClient({
  apiUrl: 'https://api.zendbx.in',
  projectSlug: 'my-project',
  anonKey: 'your-anon-key',
});

function App() {
  return (
    <ZendbxProvider client={client}>
      <YourApp />
    </ZendbxProvider>
  );
}
```

### 2. Use Hooks

```tsx
import { useAuth, useSignIn, useSignOut } from '@zendbx/react';

function Dashboard() {
  const { user, isAuthenticated, loading } = useAuth();
  const { mutate: signOut } = useSignOut();

  if (loading) return <div>Loading...</div>;
  if (!isAuthenticated) return <div>Please sign in</div>;

  return (
    <div>
      <h1>Welcome, {user?.email}</h1>
      <button onClick={() => signOut()}>Sign Out</button>
    </div>
  );
}
```

## Authentication

### useAuth()

Get reactive authentication state:

```tsx
function Header() {
  const { user, session, loading, isAuthenticated } = useAuth();

  if (loading) return <div>Loading...</div>;

  return (
    <div>
      {isAuthenticated ? (
        <span>Welcome, {user?.email}</span>
      ) : (
        <Link to="/login">Sign In</Link>
      )}
    </div>
  );
}
```

### useSignIn()

Sign in mutation:

```tsx
function LoginForm() {
  const { mutate: signIn, loading, error } = useSignIn({
    onSuccess: (data) => {
      console.log('Signed in:', data.user);
      navigate('/dashboard');
    },
  });

  const handleSubmit = (e) => {
    e.preventDefault();
    signIn({ email: 'user@example.com', password: 'password' });
  };

  return (
    <form onSubmit={handleSubmit}>
      <input type="email" name="email" />
      <input type="password" name="password" />
      <button type="submit" disabled={loading}>
        {loading ? 'Signing in...' : 'Sign In'}
      </button>
      {error && <div className="error">{error.message}</div>}
    </form>
  );
}
```

### useSignUp()

Sign up mutation:

```tsx
function SignUpForm() {
  const { mutate: signUp, loading, error } = useSignUp({
    onSuccess: (data) => {
      navigate('/dashboard');
    },
  });

  const handleSubmit = (e) => {
    e.preventDefault();
    signUp({
      email: 'user@example.com',
      password: 'securepassword',
      name: 'John Doe',
    });
  };

  return <form onSubmit={handleSubmit}>{/* ... */}</form>;
}
```

### useSignOut()

Sign out mutation:

```tsx
function Header() {
  const { mutate: signOut, loading } = useSignOut({
    onSuccess: () => {
      navigate('/login');
    },
  });

  return (
    <button onClick={() => signOut()} disabled={loading}>
      {loading ? 'Signing out...' : 'Sign Out'}
    </button>
  );
}
```

### useUser()

Get current user with caching:

```tsx
function ProfilePage() {
  const { data: user, loading, error, refetch } = useUser();

  if (loading) return <div>Loading...</div>;
  if (error) return <div>Error: {error.message}</div>;
  if (!user) return <div>Not authenticated</div>;

  return (
    <div>
      <h1>{user.email}</h1>
      <button onClick={refetch}>Refresh</button>
    </div>
  );
}
```

## Guard Components

### AuthGuard

Protect routes that require authentication:

```tsx
import { AuthGuard } from '@zendbx/react';
import { Navigate } from 'react-router-dom';

function App() {
  return (
    <AuthGuard
      fallback={<Navigate to="/login" />}
      loading={<div>Loading...</div>}
    >
      <Dashboard />
    </AuthGuard>
  );
}
```

### GuestGuard

Protect routes that should only be accessible to guests:

```tsx
import { GuestGuard } from '@zendbx/react';
import { Navigate } from 'react-router-dom';

function App() {
  return (
    <GuestGuard fallback={<Navigate to="/dashboard" />}>
      <LoginPage />
    </GuestGuard>
  );
}
```

## Core Hooks

### useZendbx()

Access the SDK client directly:

```tsx
import { useZendbx } from '@zendbx/react';

function MyComponent() {
  const client = useZendbx();

  const handleFetch = async () => {
    const { data, error } = await client.from('posts').select('*');
    console.log(data);
  };

  return <button onClick={handleFetch}>Fetch Posts</button>;
}
```

### useConfig()

Access cache configuration:

```tsx
import { useConfig } from '@zendbx/react';

function DebugPanel() {
  const config = useConfig();

  return (
    <div>
      <p>Stale Time: {config.staleTime}ms</p>
      <p>Cache Time: {config.cacheTime}ms</p>
      <p>Retry: {config.retry} attempts</p>
    </div>
  );
}
```

## TypeScript

All hooks are fully typed with TypeScript:

```tsx
import { useAuth, useSignIn, type User } from '@zendbx/react';

function Profile() {
  const { user } = useAuth();
  // user is typed as User | null

  const { mutate } = useSignIn();
  // mutate is typed as (variables: SignInData) => Promise<AuthResponse | undefined>
}
```

## Provider Configuration

Configure caching and retry behavior:

```tsx
<ZendbxProvider
  client={client}
  staleTime={60000} // 1 minute
  cacheTime={300000} // 5 minutes
  retry={3}
  retryDelay={1000}
>
  <App />
</ZendbxProvider>
```

## SSR Support

Works with Next.js App Router, Pages Router, and Remix:

```tsx
// app/layout.tsx (Next.js App Router)
import { createClient } from '@zendbx/sdk';
import { ZendbxProvider } from '@zendbx/react';

const client = createClient({
  apiUrl: process.env.NEXT_PUBLIC_ZENDBX_URL,
  projectSlug: process.env.NEXT_PUBLIC_ZENDBX_PROJECT_SLUG,
  anonKey: process.env.NEXT_PUBLIC_ZENDBX_ANON_KEY,
});

export default function RootLayout({ children }) {
  return (
    <html>
      <body>
        <ZendbxProvider client={client}>{children}</ZendbxProvider>
      </body>
    </html>
  );
}
```

## API Reference

### Hooks

#### Authentication
- `useAuth()` - Reactive auth state
- `useUser()` - Current user with cache
- `useSession()` - Session management
- `useSignIn(options?)` - Sign in mutation
- `useSignUp(options?)` - Sign up mutation
- `useSignOut(options?)` - Sign out mutation

#### Core
- `useZendbx()` - Access SDK client
- `useConfig()` - Access cache config

### Components

- `<AuthGuard>` - Require authentication
- `<GuestGuard>` - Require no authentication

### Types

All TypeScript types are exported for use in your application.

## Examples

See the [examples directory](./examples) for complete working examples:

- Next.js App Router
- Vite + React Router
- Todo App
- Social App

## Contributing

Contributions are welcome! Please see [CONTRIBUTING.md](./CONTRIBUTING.md).

## License

MIT © ZENDBX

## Links

- [Documentation](https://docs.zendbx.in)
- [GitHub](https://github.com/zendbx/react)
- [Discord](https://discord.gg/zendbx)
