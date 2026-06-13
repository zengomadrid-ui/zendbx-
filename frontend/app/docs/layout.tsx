'use client';

import { useState, useEffect } from 'react';
import Link from 'next/link';
import { usePathname } from 'next/navigation';

const nav = [
  {
    group: 'Getting Started',
    items: [
      { label: 'Introduction', href: '/docs' },
      { label: 'Quick Start', href: '/docs/quickstart' },
      { label: 'Installation', href: '/docs/installation' },
      { label: 'Dashboard', href: '/docs/dashboard' },
      { label: 'Environment Variables', href: '/docs/environment' },
    ],
  },
  {
    group: 'Authentication',
    items: [
      { label: 'Overview', href: '/docs/auth' },
      { label: 'Email & Password', href: '/docs/auth/email' },
      { label: 'OAuth Providers', href: '/docs/auth/oauth' },
      { label: 'Sessions & JWT', href: '/docs/auth/sessions' },
      { label: 'API Reference', href: '/docs/auth/api' },
    ],
  },
  {
    group: 'Database',
    items: [
      { label: 'Overview', href: '/docs/database' },
      { label: 'Tables & Schemas', href: '/docs/database/tables' },
      { label: 'CRUD Operations', href: '/docs/database/crud' },
      { label: 'Query Builder', href: '/docs/database/query-builder' },
      { label: 'Filters & Pagination', href: '/docs/database/filters' },
      { label: 'RLS Policies', href: '/docs/database/rls' },
      { label: 'API Reference', href: '/docs/database/api' },
    ],
  },
  {
    group: 'Storage',
    items: [
      { label: 'Overview', href: '/docs/storage' },
      { label: 'Buckets', href: '/docs/storage/buckets' },
      { label: 'Upload & Download', href: '/docs/storage/files' },
      { label: 'Signed URLs', href: '/docs/storage/signed-urls' },
      { label: 'API Reference', href: '/docs/storage/api' },
    ],
  },
  {
    group: 'Realtime',
    items: [
      { label: 'Overview', href: '/docs/realtime' },
      { label: 'Subscriptions', href: '/docs/realtime/subscriptions' },
      { label: 'API Reference', href: '/docs/realtime/api' },
    ],
  },
  {
    group: 'SDK',
    items: [
      { label: 'Overview', href: '/docs/sdk' },
      { label: 'createClient()', href: '/docs/sdk/client' },
      { label: 'Authentication', href: '/docs/sdk/auth' },
      { label: 'Database', href: '/docs/sdk/database' },
      { label: 'Storage', href: '/docs/sdk/storage' },
      { label: 'Realtime', href: '/docs/sdk/realtime' },
    ],
  },
  {
    group: 'REST API',
    items: [
      { label: 'Overview', href: '/docs/rest' },
      { label: 'Authentication', href: '/docs/rest/auth' },
      { label: 'CRUD Endpoints', href: '/docs/rest/crud' },
      { label: 'Schema-Qualified Tables', href: '/docs/rest/schemas' },
      { label: 'Error Codes', href: '/docs/rest/errors' },
    ],
  },
  {
    group: 'CLI',
    items: [
      { label: 'Installation', href: '/docs/cli' },
      { label: 'Commands', href: '/docs/cli/commands' },
    ],
  },
  {
    group: 'Security',
    items: [
      { label: 'Overview', href: '/docs/security' },
      { label: 'JWT & RLS', href: '/docs/security/jwt' },
      { label: 'Rate Limiting', href: '/docs/security/rate-limiting' },
    ],
  },
  {
    group: 'Architecture',
    items: [
      { label: 'Overview', href: '/docs/architecture' },
    ],
  },
  {
    group: 'Migration Guides',
    items: [
      { label: 'Supabase → ZendBX', href: '/docs/migrate/supabase' },
      { label: 'Firebase → ZendBX', href: '/docs/migrate/firebase' },
    ],
  },
];

export default function DocsLayout({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();
  const [sidebarOpen, setSidebarOpen] = useState(false);

  return (
    <div className="min-h-screen bg-black text-gray-100 flex flex-col">
      {/* Top nav */}
      <header className="sticky top-0 z-50 border-b border-zinc-800 bg-black/95 backdrop-blur">
        <div className="max-w-screen-2xl mx-auto px-4 h-14 flex items-center gap-4">
          <button
            className="lg:hidden p-2 text-gray-400 hover:text-white"
            onClick={() => setSidebarOpen(!sidebarOpen)}
          >
            <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 6h16M4 12h16M4 18h16" />
            </svg>
          </button>
          <Link href="/" className="flex items-center gap-2 mr-6">
            <img src="/logo.png" alt="ZendBX" className="h-7 w-auto" />
            <span className="text-sm font-semibold text-orange-400">Docs</span>
          </Link>
          <nav className="hidden lg:flex items-center gap-6 text-sm text-gray-400">
            <Link href="/docs" className="hover:text-white transition-colors">Guides</Link>
            <Link href="/docs/rest" className="hover:text-white transition-colors">API Reference</Link>
            <Link href="/docs/sdk" className="hover:text-white transition-colors">SDK</Link>
            <Link href="/docs/cli" className="hover:text-white transition-colors">CLI</Link>
          </nav>
          <div className="ml-auto flex items-center gap-3">
            <a
              href="https://github.com/zengomadrid-ui/zendbx-"
              target="_blank"
              rel="noopener noreferrer"
              className="text-gray-400 hover:text-white transition-colors"
            >
              <svg className="w-5 h-5" fill="currentColor" viewBox="0 0 24 24">
                <path d="M12 2C6.477 2 2 6.484 2 12.017c0 4.425 2.865 8.18 6.839 9.504.5.092.682-.217.682-.483 0-.237-.008-.868-.013-1.703-2.782.605-3.369-1.343-3.369-1.343-.454-1.158-1.11-1.466-1.11-1.466-.908-.62.069-.608.069-.608 1.003.07 1.531 1.032 1.531 1.032.892 1.53 2.341 1.088 2.91.832.092-.647.35-1.088.636-1.338-2.22-.253-4.555-1.113-4.555-4.951 0-1.093.39-1.988 1.029-2.688-.103-.253-.446-1.272.098-2.65 0 0 .84-.27 2.75 1.026A9.564 9.564 0 0112 6.844c.85.004 1.705.115 2.504.337 1.909-1.296 2.747-1.027 2.747-1.027.546 1.379.202 2.398.1 2.651.64.7 1.028 1.595 1.028 2.688 0 3.848-2.339 4.695-4.566 4.943.359.309.678.92.678 1.855 0 1.338-.012 2.419-.012 2.747 0 .268.18.58.688.482A10.019 10.019 0 0022 12.017C22 6.484 17.522 2 12 2z" />
              </svg>
            </a>
            <Link
              href="/login"
              className="px-3 py-1.5 bg-orange-600 hover:bg-orange-500 text-white text-sm font-medium rounded-lg transition-colors"
            >
              Dashboard
            </Link>
          </div>
        </div>
      </header>

      <div className="flex flex-1 max-w-screen-2xl mx-auto w-full">
        {/* Sidebar */}
        <aside className={`
          fixed inset-y-0 left-0 z-40 w-64 bg-black border-r border-zinc-800 pt-14 overflow-y-auto
          lg:sticky lg:top-14 lg:h-[calc(100vh-3.5rem)] lg:block
          ${sidebarOpen ? 'block' : 'hidden'}
        `}>
          <div className="px-4 py-6 space-y-6">
            {nav.map((section) => (
              <div key={section.group}>
                <p className="text-xs font-bold text-orange-500 uppercase tracking-widest mb-2 px-2">
                  {section.group}
                </p>
                <ul className="space-y-0.5">
                  {section.items.map((item) => {
                    const active = pathname === item.href;
                    return (
                      <li key={item.href}>
                        <Link
                          href={item.href}
                          onClick={() => setSidebarOpen(false)}
                          className={`block px-3 py-1.5 rounded-lg text-sm transition-all ${
                            active
                              ? 'bg-orange-500/10 text-orange-400 font-medium border-l-2 border-orange-500'
                              : 'text-gray-400 hover:text-white hover:bg-zinc-900'
                          }`}
                        >
                          {item.label}
                        </Link>
                      </li>
                    );
                  })}
                </ul>
              </div>
            ))}
          </div>
        </aside>

        {/* Overlay */}
        {sidebarOpen && (
          <div
            className="fixed inset-0 z-30 bg-black/60 lg:hidden"
            onClick={() => setSidebarOpen(false)}
          />
        )}

        {/* Main content */}
        <main className="flex-1 min-w-0 px-6 lg:px-12 py-10 max-w-4xl">
          {children}
        </main>
      </div>
    </div>
  );
}
