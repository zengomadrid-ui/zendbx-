import { CodeBlock, Note, Heading } from '../components';

export const metadata = { title: 'Quick Start — ZendBX Docs' };

const install = `npm install @zendbx/sdk`;

const envVars = `ZENDBX_URL=https://api.zendbx.in
ZENDBX_ANON_KEY=your-anon-key
ZENDBX_PROJECT_SLUG=my-project`;

const initClient = `import { createClient } from '@zendbx/sdk';

export const db = createClient({
  apiUrl: process.env.ZENDBX_URL!,
  anonKey: process.env.ZENDBX_ANON_KEY!,
  projectSlug: process.env.ZENDBX_PROJECT_SLUG!,
});`;

const signUp = `const { data, error } = await db.auth.signUp({
  email: 'user@example.com',
  password: 'supersecret',
});

if (error) console.error(error.message);
else console.log('User created:', data.user);`;

const insert = `const { data, error } = await db.from('todos').insert({
  title: 'Learn ZendBX',
  done: false,
});`;

const query = `const { data: todos, error } = await db
  .from('todos')
  .select('id, title, done')
  .eq('done', false)
  .order('created_at', { ascending: false })
  .limit(20);`;

const uploadFile = `const bucket = db.storage.bucket('avatars');
const { data, error } = await bucket.upload(file, 'user-123.png');`;

const realtime = `const sub = db.realtime
  .from('todos')
  .on('INSERT', (payload) => {
    console.log('New todo:', payload.new);
  })
  .subscribe();

// Clean up:
sub.unsubscribe();`;

export default function QuickStartPage() {
  return (
    <article>
      <Heading level={1}>Quick Start Guide</Heading>
      <p className="text-gray-400 text-sm mb-2">
        Build a fully functional app with authentication, database, storage, and real-time features in under 10 minutes.
      </p>
      <p className="text-gray-500 text-xs mb-8">
        This guide assumes you have Node.js installed and basic JavaScript knowledge. No backend experience needed.
      </p>

      <div className="mb-8 p-4 rounded-lg border border-blue-500/20 bg-blue-500/5">
        <p className="text-sm font-semibold text-blue-400 mb-2">What you'll learn</p>
        <ul className="space-y-1 text-xs text-blue-300">
          <li>✓ Create and configure a ZendBX project</li>
          <li>✓ Set up authentication (sign up & sign in)</li>
          <li>✓ Create database tables and insert data</li>
          <li>✓ Query data with filters and sorting</li>
          <li>✓ Upload files to storage</li>
          <li>✓ Subscribe to real-time database changes</li>
        </ul>
      </div>

      <Heading level={2} id="step-1">Step 1: Create a Project</Heading>
      <p className="text-sm text-gray-400 mb-3">
        First, you need a ZendBX project. Think of it as your backend workspace—it includes your database, authentication system, and all APIs.
      </p>
      <ol className="list-decimal list-inside space-y-2 text-sm text-gray-400 mb-4 ml-2">
        <li>Go to <a href="https://devapp.zendbx.in" className="text-orange-400 hover:underline" target="_blank" rel="noopener noreferrer">devapp.zendbx.in</a></li>
        <li>Click <strong className="text-white">Sign Up</strong> (or <strong className="text-white">Log In</strong> if you have an account)</li>
        <li>Click <strong className="text-white">New Project</strong></li>
        <li>Give your project a name (e.g., "My First App")</li>
        <li>Click <strong className="text-white">Create Project</strong></li>
      </ol>
      <Note type="info">
        Your project is created instantly with its own PostgreSQL database, authentication system, and API endpoints.
      </Note>

      <Heading level={3} id="get-api-keys">Get Your API Keys</Heading>
      <p className="text-sm text-gray-400 mb-3">After creating your project, you need three pieces of information:</p>
      <ol className="list-decimal list-inside space-y-2 text-sm text-gray-400 mb-4 ml-2">
        <li>In your project dashboard, click <strong className="text-white">Settings</strong> (⚙️ icon)</li>
        <li>Navigate to <strong className="text-white">API Keys</strong></li>
        <li>Copy these values:</li>
      </ol>
      <ul className="space-y-2 text-sm mb-4 ml-6">
        <li className="flex items-start gap-2">
          <span className="text-orange-500 font-mono text-xs mt-0.5">•</span>
          <div>
            <strong className="text-white">Project URL</strong> <span className="text-gray-500">(e.g., https://api.zendbx.in)</span>
          </div>
        </li>
        <li className="flex items-start gap-2">
          <span className="text-orange-500 font-mono text-xs mt-0.5">•</span>
          <div>
            <strong className="text-white">Anon Key</strong> <span className="text-gray-500">(a long JWT token - safe for browsers)</span>
          </div>
        </li>
        <li className="flex items-start gap-2">
          <span className="text-orange-500 font-mono text-xs mt-0.5">•</span>
          <div>
            <strong className="text-white">Project Slug</strong> <span className="text-gray-500">(your project's readable name, like "my-first-app")</span>
          </div>
        </li>
      </ul>

      <Heading level={2} id="step-2">Step 2: Install the SDK</Heading>
      <p className="text-sm text-gray-400 mb-3">
        The ZendBX SDK is a JavaScript/TypeScript library that makes it easy to interact with your backend.
      </p>
      <CodeBlock code={install} lang="bash" />
      <p className="text-xs text-gray-500 mt-2 mb-4">
        This works with npm, yarn, pnpm, or bun. The SDK is compatible with React, Next.js, Vue, Svelte, Node.js, and any modern JavaScript environment.
      </p>

      <Heading level={2} id="step-3">Step 3: Configure Environment Variables</Heading>
      <p className="text-sm text-gray-400 mb-3">
        Store your API keys in environment variables. This keeps them secure and makes it easy to switch between development and production.
      </p>
      <p className="text-sm text-gray-400 mb-3">
        Create a <code className="text-orange-400">.env.local</code> file in your project root:
      </p>
      <CodeBlock code={envVars} lang="bash" title=".env.local" />
      <Note type="warning">
        <strong>Important:</strong> Never commit your <code className="text-orange-400">service_role</code> key or expose it in browser code. 
        The <code className="text-orange-400">anon</code> key is safe for public use—it respects Row Level Security policies.
      </Note>

      <Heading level={2} id="step-4">Step 4: Initialize the Client</Heading>
      <p className="text-sm text-gray-400 mb-3">
        Create a file to initialize your ZendBX client. This creates the connection to your backend.
      </p>
      <CodeBlock code={initClient} lang="typescript" title="lib/zendbx.ts" />
      <div className="my-4 p-4 rounded-lg border border-blue-500/20 bg-blue-500/5 text-sm">
        <p className="font-semibold text-blue-400 mb-2">💡 What's happening here?</p>
        <ul className="space-y-1 text-xs text-blue-300">
          <li>• <code className="text-blue-400">createClient()</code> establishes a connection to your ZendBX project</li>
          <li>• <code className="text-blue-400">apiUrl</code> points to the ZendBX API server</li>
          <li>• <code className="text-blue-400">anonKey</code> authenticates your requests (respects RLS)</li>
          <li>• <code className="text-blue-400">projectSlug</code> identifies which project you're accessing</li>
        </ul>
      </div>

      <Heading level={2} id="step-5">Step 5: Add Authentication</Heading>
      <p className="text-sm text-gray-400 mb-3">
        Let's create a user account. ZendBX handles password hashing, JWT tokens, and session management automatically.
      </p>
      <CodeBlock code={signUp} lang="typescript" />
      <p className="text-xs text-gray-500 mt-2 mb-4">
        The user is created in the <code className="text-orange-400">auth.users</code> table. 
        Their password is automatically hashed with bcrypt, and a JWT token is returned for authentication.
      </p>

      <Heading level={2} id="step-6">Step 6: Create a Table and Insert Data</Heading>
      <p className="text-sm text-gray-400 mb-3">
        Before inserting data, you need to create a table. Go to your project dashboard → <strong className="text-white">Database</strong> → <strong className="text-white">SQL Editor</strong> and run:
      </p>
      <CodeBlock code={`CREATE TABLE todos (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID REFERENCES auth.users(id),
  title TEXT NOT NULL,
  done BOOLEAN DEFAULT false,
  created_at TIMESTAMPTZ DEFAULT NOW()
);`} lang="sql" />
      <p className="text-sm text-gray-400 mb-3 mt-4">
        Now insert data using the SDK:
      </p>
      <CodeBlock code={insert} lang="typescript" />
      <p className="text-xs text-gray-500 mt-2 mb-4">
        Behind the scenes, this sends a POST request to <code className="text-orange-400">/p/your-slug/v1/rest/todos</code> with your data. 
        The API was generated automatically when you created the table.
      </p>

      <Heading level={2} id="step-7">Step 7: Query Data with Filters</Heading>
      <p className="text-sm text-gray-400 mb-3">
        Fetch your data with powerful filtering, sorting, and pagination—all built into the SDK.
      </p>
      <CodeBlock code={query} lang="typescript" />
      <div className="my-4 p-4 rounded-lg border border-green-500/20 bg-green-500/5 text-sm">
        <p className="font-semibold text-green-400 mb-2">🎯 Query Builder Explained</p>
        <ul className="space-y-1 text-xs text-green-300">
          <li>• <code className="text-green-400">.select('id, title, done')</code> — Choose which columns to return</li>
          <li>• <code className="text-green-400">.eq('done', false)</code> — Filter where done equals false</li>
          <li>• <code className="text-green-400">.order('created_at', {'{'}ascending: false{'}'})</code> — Sort by newest first</li>
          <li>• <code className="text-green-400">.limit(20)</code> — Return maximum 20 rows</li>
        </ul>
        <p className="text-xs text-green-400 mt-2">
          This builds an optimized SQL query automatically. You never write SQL unless you want to.
        </p>
      </div>

      <Heading level={2} id="step-8">Step 8: Upload Files to Storage</Heading>
      <p className="text-sm text-gray-400 mb-3">
        ZendBX includes built-in file storage. First, create a bucket in your dashboard: <strong className="text-white">Storage</strong> → <strong className="text-white">Buckets</strong> → <strong className="text-white">New Bucket</strong>.
      </p>
      <CodeBlock code={uploadFile} lang="typescript" />
      <Note type="info">
        Buckets organize your files (like folders). You can set them as public (anyone can access) or private (requires authentication). 
        <br/>Create buckets in: Dashboard → Storage → Buckets → New Bucket.
      </Note>

      <Heading level={2} id="step-9">Step 9: Real-Time Subscriptions</Heading>
      <p className="text-sm text-gray-400 mb-3">
        Listen to database changes in real-time. Perfect for building chat apps, live dashboards, or collaborative tools.
      </p>
      <CodeBlock code={realtime} lang="typescript" />
      <div className="my-4 p-4 rounded-lg border border-purple-500/20 bg-purple-500/5 text-sm">
        <p className="font-semibold text-purple-400 mb-2">⚡ Real-Time Events</p>
        <p className="text-xs text-purple-300 mb-2">You can listen to specific events:</p>
        <ul className="space-y-1 text-xs text-purple-300 ml-4">
          <li>• <code className="text-purple-400">'INSERT'</code> — When a new row is added</li>
          <li>• <code className="text-purple-400">'UPDATE'</code> — When a row is modified</li>
          <li>• <code className="text-purple-400">'DELETE'</code> — When a row is removed</li>
          <li>• <code className="text-purple-400">'*'</code> — Listen to all events</li>
        </ul>
      </div>

      <div className="mt-10 p-5 rounded-xl border border-orange-500/30 bg-orange-500/10">
        <p className="text-base font-bold text-orange-400 mb-3">🎉 Congratulations!</p>
        <p className="text-sm text-gray-300 mb-4">
          You've built a complete backend with authentication, database operations, file storage, and real-time subscriptions—all in less than 10 minutes.
        </p>
        <p className="text-sm font-semibold text-white mb-2">What's Next?</p>
        <ul className="space-y-2 text-sm">
          <li>
            <a href="/docs/database" className="text-orange-400 hover:underline">📚 Database Guide</a>
            <span className="text-gray-500"> — Learn advanced querying, joins, and RLS policies</span>
          </li>
          <li>
            <a href="/docs/auth" className="text-orange-400 hover:underline">🔐 Authentication Guide</a>
            <span className="text-gray-500"> — Add OAuth, session management, and protected routes</span>
          </li>
          <li>
            <a href="/docs/sdk" className="text-orange-400 hover:underline">🛠️ SDK Reference</a>
            <span className="text-gray-500"> — Complete API reference with all methods</span>
          </li>
          <li>
            <a href="/docs/architecture" className="text-orange-400 hover:underline">🏗️ Architecture</a>
            <span className="text-gray-500"> — Understanding how ZendBX works under the hood</span>
          </li>
        </ul>
      </div>
    </article>
  );
}
