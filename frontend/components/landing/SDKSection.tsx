'use client';

import { useState } from 'react';
import Link from 'next/link';

const tabs = ['Database', 'Auth', 'Realtime', 'Storage'] as const;
type Tab = typeof tabs[number];

const snippets: Record<Tab, { label: string; lines: { text: string; type: string }[] }> = {
  Database: {
    label: 'Query your data — fully typed.',
    lines: [
      { text: "import { createClient } from '@zendbx/sdk'", type: 'import' },
      { text: '', type: '' },
      { text: 'const db = createClient({', type: 'code' },
      { text: "  apiUrl: process.env.ZENDBX_URL,", type: 'prop' },
      { text: "  anonKey: process.env.ZENDBX_ANON_KEY,", type: 'prop' },
      { text: "  projectSlug: 'my-project',", type: 'prop' },
      { text: '})', type: 'code' },
      { text: '', type: '' },
      { text: '// fetch active users', type: 'comment' },
      { text: "const { data } = await db.from('users')", type: 'code' },
      { text: "  .select('id, name, email')", type: 'chain' },
      { text: "  .eq('status', 'active')", type: 'chain' },
      { text: "  .order('created_at', { ascending: false })", type: 'chain' },
      { text: '  .limit(10)', type: 'chain' },
    ],
  },
  Auth: {
    label: 'Auth in minutes, not days.',
    lines: [
      { text: "import { createClient } from '@zendbx/sdk'", type: 'import' },
      { text: '', type: '' },
      { text: 'const db = createClient({', type: 'code' },
      { text: "  apiUrl: process.env.ZENDBX_URL,", type: 'prop' },
      { text: "  anonKey: process.env.ZENDBX_ANON_KEY,", type: 'prop' },
      { text: "  projectSlug: 'my-project',", type: 'prop' },
      { text: '})', type: 'code' },
      { text: '', type: '' },
      { text: '// sign up a new user', type: 'comment' },
      { text: 'const { data, error } = await db.auth.signUp({', type: 'code' },
      { text: "  email: 'user@example.com',", type: 'prop' },
      { text: "  password: 'supersecret123',", type: 'prop' },
      { text: '})', type: 'code' },
      { text: '', type: '' },
      { text: '// sign in', type: 'comment' },
      { text: 'await db.auth.signIn({ email, password })', type: 'code' },
    ],
  },
  Realtime: {
    label: 'Live data, zero polling.',
    lines: [
      { text: "import { createClient } from '@zendbx/sdk'", type: 'import' },
      { text: '', type: '' },
      { text: 'const db = createClient({', type: 'code' },
      { text: "  apiUrl: process.env.ZENDBX_URL,", type: 'prop' },
      { text: "  anonKey: process.env.ZENDBX_ANON_KEY,", type: 'prop' },
      { text: "  projectSlug: 'my-project',", type: 'prop' },
      { text: '})', type: 'code' },
      { text: '', type: '' },
      { text: '// subscribe to new messages', type: 'comment' },
      { text: "const sub = db.realtime.from('messages')", type: 'code' },
      { text: "  .on('INSERT', (payload) => {", type: 'chain' },
      { text: "    console.log('new message:', payload.new)", type: 'inner' },
      { text: '  })', type: 'chain' },
      { text: '  .subscribe()', type: 'chain' },
      { text: '', type: '' },
      { text: '// unsubscribe when done', type: 'comment' },
      { text: 'sub.unsubscribe()', type: 'code' },
    ],
  },
  Storage: {
    label: 'File uploads, one call.',
    lines: [
      { text: "import { createClient } from '@zendbx/sdk'", type: 'import' },
      { text: '', type: '' },
      { text: 'const db = createClient({', type: 'code' },
      { text: "  apiUrl: process.env.ZENDBX_URL,", type: 'prop' },
      { text: "  anonKey: process.env.ZENDBX_ANON_KEY,", type: 'prop' },
      { text: "  projectSlug: 'my-project',", type: 'prop' },
      { text: '})', type: 'code' },
      { text: '', type: '' },
      { text: '// upload a file to a bucket', type: 'comment' },
      { text: "const bucket = db.storage.bucket('avatars')", type: 'code' },
      { text: 'const { data, error } = await bucket.upload(', type: 'code' },
      { text: '  file,', type: 'prop' },
      { text: "  'user-123.png',", type: 'prop' },
      { text: ')', type: 'code' },
      { text: '', type: '' },
      { text: '// list files in the bucket', type: 'comment' },
      { text: 'const { data: files } = await bucket.list()', type: 'code' },
    ],
  },
};

const features = [
  'Auto-generated types',
  'Built-in auth helpers',
  'Realtime subscriptions',
  'Zero boilerplate',
];

const frameworks = ['React', 'Next.js', 'Vue', 'Svelte', 'Node.js', 'Python', 'Go'];

function getColor(type: string): string {
  switch (type) {
    case 'import': return 'text-orange-400';
    case 'comment': return 'text-zinc-500 italic';
    case 'chain': return 'text-yellow-300';
    case 'inner': return 'text-gray-300 pl-4';
    case 'prop': return 'text-green-400';
    default: return 'text-gray-200';
  }
}

export default function SDKSection() {
  const [activeTab, setActiveTab] = useState<Tab>('Database');
  const snippet = snippets[activeTab];

  return (
    <section className="py-24 bg-zinc-900 relative overflow-hidden">
      <div className="absolute inset-0 bg-[linear-gradient(to_right,#ea580c06_1px,transparent_1px),linear-gradient(to_bottom,#ea580c06_1px,transparent_1px)] bg-[size:40px_40px]" />
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 relative z-10">
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-16 items-center">

          {/* Left */}
          <div>
            <div className="inline-flex items-center gap-2 px-3 py-1.5 bg-orange-500/10 border border-orange-500/30 rounded-full text-sm font-semibold text-orange-400 mb-6">
              <span className="text-xs">&lt;/&gt;</span>
              Developer Experience
            </div>

            <h2 className="text-5xl sm:text-6xl font-extrabold leading-tight mb-6">
              <span className="text-white">From zero to</span>
              <br />
              <span className="bg-gradient-to-r from-orange-400 to-orange-600 bg-clip-text text-transparent">backend</span>
              <br />
              <span className="text-white">in 3 lines.</span>
            </h2>

            <p className="text-gray-400 text-lg mb-2 leading-relaxed">
              No cap — init your client, query your database, ship it.
              Works with every framework you already vibe with.
            </p>
            <p className="text-gray-500 text-sm mb-8">
              Fully typed. Zero boilerplate. Lowkey the fastest way to get a backend running.
            </p>

            <div className="flex flex-wrap gap-2 mb-8">
              {frameworks.map((fw) => (
                <span key={fw} className="px-3 py-1.5 bg-zinc-800 border border-zinc-700 hover:border-orange-500/40 text-gray-300 text-sm rounded-lg transition-colors cursor-default">
                  {fw}
                </span>
              ))}
            </div>

            <Link href="/docs/sdk" className="inline-flex items-center gap-2 text-orange-400 hover:text-orange-300 font-semibold transition-colors group">
              Explore all SDKs
              <svg className="w-4 h-4 group-hover:translate-x-1 transition-transform" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17 8l4 4m0 0l-4 4m4-4H3" />
              </svg>
            </Link>
          </div>

          {/* Right — code window */}
          <div className="relative">
            <div className="absolute -inset-2 bg-gradient-to-r from-orange-600/20 to-orange-500/10 rounded-2xl blur-2xl" />
            <div className="relative bg-zinc-950 rounded-2xl border border-zinc-800 overflow-hidden shadow-2xl">

              {/* Window chrome */}
              <div className="flex items-center gap-1.5 px-4 py-3 border-b border-zinc-800 bg-zinc-900">
                <div className="w-3 h-3 rounded-full bg-red-500/80" />
                <div className="w-3 h-3 rounded-full bg-yellow-500/80" />
                <div className="w-3 h-3 rounded-full bg-green-500/80" />
                <span className="ml-auto text-xs text-zinc-500 font-mono">zendbx-sdk</span>
              </div>

              {/* Tabs */}
              <div className="flex border-b border-zinc-800 bg-zinc-900/50">
                {tabs.map((tab) => (
                  <button
                    key={tab}
                    onClick={() => setActiveTab(tab)}
                    className={`px-4 py-2.5 text-sm font-medium transition-all border-b-2 ${
                      activeTab === tab
                        ? 'text-white border-orange-500 bg-zinc-800/50'
                        : 'text-zinc-500 border-transparent hover:text-zinc-300'
                    }`}
                  >
                    {tab}
                  </button>
                ))}
              </div>

              {/* Label */}
              <div className="px-5 pt-4 pb-1">
                <span className="text-xs text-orange-400 font-semibold">{snippet.label}</span>
              </div>

              {/* Code */}
              <div className="px-5 pb-5 font-mono text-sm leading-7 overflow-x-auto">
                {snippet.lines.map((line, i) => (
                  <div key={i} className="flex gap-4 min-w-0">
                    <span className="select-none text-zinc-700 w-5 text-right flex-shrink-0 text-xs pt-0.5">
                      {line.text ? i + 1 : ''}
                    </span>
                    <span className={`whitespace-pre ${getColor(line.type)}`}>
                      {line.text || '\u00A0'}
                    </span>
                  </div>
                ))}
              </div>

              {/* Footer */}
              <div className="px-5 py-3 border-t border-zinc-800 bg-zinc-900 flex flex-wrap gap-4">
                {features.map((f) => (
                  <span key={f} className="flex items-center gap-1.5 text-xs text-zinc-400">
                    <span className="w-1.5 h-1.5 rounded-full bg-orange-500 flex-shrink-0" />
                    {f}
                  </span>
                ))}
              </div>
            </div>
          </div>

        </div>
      </div>
    </section>
  );
}