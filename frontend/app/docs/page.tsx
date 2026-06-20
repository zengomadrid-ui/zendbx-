import Link from 'next/link';
import { CodeBlock, Note } from './components';
import type { Metadata } from 'next';

export const metadata: Metadata = {
  title: 'Zendbx Documentation — AI-Native Backend Platform',
  description:
    'Complete documentation for Zendbx: PostgreSQL, Authentication, Storage, Realtime APIs, REST, SDK, and CLI.',
  alternates: { canonical: 'https://zendbx.in/docs' },
  openGraph: {
    title: 'Zendbx Documentation',
    description: 'Complete docs for Zendbx BaaS: PostgreSQL, Auth, Storage, Realtime, REST API, SDK.',
    url: 'https://zendbx.in/docs',
    siteName: 'Zendbx',
    type: 'website',
  },
};

const cards = [
  { label: 'Authentication', desc: 'Email, OAuth, sessions, JWT, and MFA.', href: '/docs/auth' },
  { label: 'Database', desc: 'PostgreSQL with row-level security and a fluent query builder.', href: '/docs/database' },
  { label: 'Storage', desc: 'Bucket-based file storage with signed URLs.', href: '/docs/storage' },
  { label: 'Realtime', desc: 'WebSocket subscriptions for live database changes.', href: '/docs/realtime' },
  { label: 'SDK', desc: 'Official TypeScript SDK — npm install @zendbx/sdk.', href: '/docs/sdk' },
  { label: 'REST API', desc: 'Universal REST endpoints for any table.', href: '/docs/rest' },
  { label: 'CLI', desc: 'Manage projects, backups, and migrations from the terminal.', href: '/docs/cli' },
  { label: 'Architecture', desc: 'How ZendBX works under the hood.', href: '/docs/architecture' },
];

const quickStart = `npm install @zendbx/sdk`;

const helloWorld = `import { createClient } from '@zendbx/sdk';

const db = createClient({
  apiUrl: process.env.ZENDBX_URL!,
  anonKey: process.env.ZENDBX_ANON_KEY!,
  projectSlug: 'my-project',
});

// Sign up a user
const { data, error } = await db.auth.signUp({
  email: 'user@example.com',
  password: 'password123',
});

// Insert a row
await db.from('todos').insert({ title: 'Build something', done: false });

// Query with filters
const { data: todos } = await db
  .from('todos')
  .select('*')
  .eq('done', false)
  .order('created_at', { ascending: false });`;

export default function DocsPage() {
  return (
    <article className="prose-docs">
      {/* Hero */}
      <div className="mb-10">
        <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-orange-500/10 border border-orange-500/20 text-orange-400 text-xs font-semibold mb-4">
          <span className="w-1.5 h-1.5 rounded-full bg-orange-400" />
          ZendBX v1.1.0
        </div>
        <h1 className="text-4xl font-extrabold text-white mb-3">ZendBX Documentation</h1>
        <p className="text-lg text-gray-400 max-w-2xl">
          ZendBX is an open Backend-as-a-Service platform built on PostgreSQL.
          Authentication, database, storage, realtime, AI, and REST APIs — all in one place.
        </p>
      </div>

      {/* Feature grid */}
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 mb-12">
        {cards.map((c) => (
          <Link
            key={c.label}
            href={c.href}
            className="flex items-start gap-3 p-4 rounded-xl border border-zinc-800 bg-zinc-950 hover:border-orange-500/40 hover:bg-zinc-900 transition-all group"
          >
            <div>
              <p className="text-sm font-semibold text-white group-hover:text-orange-400 transition-colors">{c.label}</p>
              <p className="text-xs text-gray-500 mt-0.5">{c.desc}</p>
            </div>
          </Link>
        ))}
      </div>

      {/* Install */}
      <h2 className="text-xl font-bold text-white mt-10 mb-3 pb-2 border-b border-zinc-800">
        Install the SDK
      </h2>
      <CodeBlock code={quickStart} lang="bash" />

      <Note>
        The SDK is published to npm as <code className="text-orange-400">@zendbx/sdk</code>. 
        It works in React, Next.js, Vue, Svelte, Node.js, and any modern JavaScript environment.
      </Note>

      {/* Hello world */}
      <h2 className="text-xl font-bold text-white mt-10 mb-3 pb-2 border-b border-zinc-800">
        Hello World
      </h2>
      <p className="text-gray-400 text-sm mb-2">Three operations in ten lines — sign up, insert, and query.</p>
      <CodeBlock code={helloWorld} lang="typescript" />

      {/* Core concepts */}
      <h2 className="text-xl font-bold text-white mt-10 mb-3 pb-2 border-b border-zinc-800">
        Core Concepts
      </h2>
      <div className="space-y-3 text-sm text-gray-400">
        <div className="flex gap-3">
          <span className="text-orange-500 font-bold mt-0.5">→</span>
          <div><span className="text-white font-medium">Projects</span> — each project gets its own PostgreSQL schema, API keys, and isolated data.</div>
        </div>
        <div className="flex gap-3">
          <span className="text-orange-500 font-bold mt-0.5">→</span>
          <div><span className="text-white font-medium">API Keys</span> — every project has an <code className="text-orange-400">anon</code> key (public) and a <code className="text-orange-400">service_role</code> key (private, bypasses RLS).</div>
        </div>
        <div className="flex gap-3">
          <span className="text-orange-500 font-bold mt-0.5">→</span>
          <div><span className="text-white font-medium">Row Level Security (RLS)</span> — PostgreSQL policies control which rows each user can read or write. Enabled by default.</div>
        </div>
        <div className="flex gap-3">
          <span className="text-orange-500 font-bold mt-0.5">→</span>
          <div><span className="text-white font-medium">Project Slug</span> — human-readable identifier for your project, used in all API URLs: <code className="text-orange-400">/p/{'{'}slug{'}'}/...</code>.</div>
        </div>
      </div>

      {/* Next steps */}
      <h2 className="text-xl font-bold text-white mt-10 mb-3 pb-2 border-b border-zinc-800">
        Next Steps
      </h2>
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
        {[
          { label: 'Quick Start →', href: '/docs/quickstart', desc: 'Build your first app in 5 minutes' },
          { label: 'SDK Reference →', href: '/docs/sdk', desc: 'Every method documented with examples' },
          { label: 'REST API →', href: '/docs/rest', desc: 'Use ZendBX from any language' },
        ].map((n) => (
          <Link key={n.href} href={n.href} className="p-4 rounded-xl border border-zinc-800 bg-zinc-950 hover:border-orange-500/40 transition-colors">
            <p className="text-sm font-semibold text-orange-400">{n.label}</p>
            <p className="text-xs text-gray-500 mt-1">{n.desc}</p>
          </Link>
        ))}
      </div>
    </article>
  );
}
