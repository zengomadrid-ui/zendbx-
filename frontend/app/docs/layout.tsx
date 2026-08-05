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
        <div className="max-w-screen-2xl mx-auto px-4 h-14 flex items-center gap-8">
          <button
            className="lg:hidden p-2 text-gray-400 hover:text-white"
            onClick={() => setSidebarOpen(!sidebarOpen)}
          >
            <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 6h16M4 12h16M4 18h16" />
            </svg>
          </button>
          <Link href="/" className="flex items-center gap-2">
            <div className="w-8 h-8 rounded-lg bg-orange-600 flex items-center justify-center">
              <span className="text-black font-bold text-xl">Z</span>
            </div>
            <span className="text-white font-semibold text-lg">ZendBX</span>
          </Link>
          <nav className="hidden lg:flex items-center gap-6 text-sm">
            <Link href="/docs/database" className="text-gray-400 hover:text-white transition-colors">
              Database
            </Link>
            <Link href="/docs/auth" className="text-gray-400 hover:text-white transition-colors">
              Auth
            </Link>
            <Link href="/docs/storage" className="text-gray-400 hover:text-white transition-colors">
              Storage
            </Link>
            <Link href="/docs/realtime" className="text-gray-400 hover:text-white transition-colors">
              Realtime
            </Link>
            <Link href="/docs" className="text-white font-medium">
              Docs
            </Link>
            <Link href="/docs/sdk" className="text-gray-400 hover:text-white transition-colors">
              SDK
            </Link>
            <Link href="/docs/rest" className="text-gray-400 hover:text-white transition-colors">
              REST API
            </Link>
            <Link href="/docs/cli" className="text-gray-400 hover:text-white transition-colors">
              CLI
            </Link>
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
              className="text-gray-400 hover:text-white text-sm transition-colors hidden sm:block"
            >
              Sign In
            </Link>
            <Link
              href="https://devapp.zendbx.in"
              target="_blank"
              rel="noopener noreferrer"
              className="px-4 py-1.5 bg-orange-600 hover:bg-orange-500 text-white text-sm font-medium rounded-lg transition-colors"
            >
              Get Started Free
            </Link>
          </div>
        </div>
      </header>

      <div className="flex flex-1 max-w-screen-2xl mx-auto w-full">
        {/* Left Sidebar */}
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
        <main className="flex-1 min-w-0 px-6 lg:px-12 py-10 max-w-3xl">
          {children}
        </main>

        {/* Right Sidebar - Resources & Tools */}
        <aside className="hidden xl:block w-72 px-6 py-10 border-l border-zinc-800">
          <div className="sticky top-24 space-y-6">
            {/* Quick Access */}
            <div>
              <p className="text-xs font-bold text-orange-500 uppercase tracking-widest mb-3">
                Quick Access
              </p>
              <div className="space-y-2">
                <a 
                  href="/dashboard"
                  className="flex items-center gap-3 p-3 rounded-lg border border-zinc-800 bg-zinc-950 hover:border-orange-500/40 hover:bg-zinc-900 transition-all group"
                >
                  <div className="p-2 rounded-lg bg-orange-500/10 group-hover:bg-orange-500/20 transition-colors">
                    <svg className="w-4 h-4 text-orange-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 5a1 1 0 011-1h4a1 1 0 011 1v7a1 1 0 01-1 1H5a1 1 0 01-1-1V5zM14 5a1 1 0 011-1h4a1 1 0 011 1v3a1 1 0 01-1 1h-4a1 1 0 01-1-1V5zM4 16a1 1 0 011-1h4a1 1 0 011 1v3a1 1 0 01-1 1H5a1 1 0 01-1-1v-3zM14 13a1 1 0 011-1h4a1 1 0 011 1v7a1 1 0 01-1 1h-4a1 1 0 01-1-1v-7z" />
                    </svg>
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-medium text-white group-hover:text-orange-400 transition-colors">Dashboard</p>
                    <p className="text-xs text-gray-500">Manage projects</p>
                  </div>
                </a>
              </div>
            </div>

            {/* Popular Guides */}
            <div className="pt-4 border-t border-zinc-800">
              <p className="text-xs font-bold text-orange-500 uppercase tracking-widest mb-3">
                Popular Guides
              </p>
              <ul className="space-y-2 text-sm">
                <li>
                  <a href="/docs/quickstart" className="flex items-center gap-2 text-gray-400 hover:text-orange-400 transition-colors">
                    <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 10V3L4 14h7v7l9-11h-7z" />
                    </svg>
                    Quick Start
                  </a>
                </li>
                <li>
                  <a href="/docs/auth" className="flex items-center gap-2 text-gray-400 hover:text-orange-400 transition-colors">
                    <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 15v2m-6 4h12a2 2 0 002-2v-6a2 2 0 00-2-2H6a2 2 0 00-2 2v6a2 2 0 002 2zm10-10V7a4 4 0 00-8 0v4h8z" />
                    </svg>
                    Authentication
                  </a>
                </li>
                <li>
                  <a href="/docs/database" className="flex items-center gap-2 text-gray-400 hover:text-orange-400 transition-colors">
                    <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 7v10c0 2.21 3.582 4 8 4s8-1.79 8-4V7M4 7c0 2.21 3.582 4 8 4s8-1.79 8-4M4 7c0-2.21 3.582-4 8-4s8 1.79 8 4" />
                    </svg>
                    Database Operations
                  </a>
                </li>
                <li>
                  <a href="/docs/realtime" className="flex items-center gap-2 text-gray-400 hover:text-orange-400 transition-colors">
                    <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 10V3L4 14h7v7l9-11h-7z" />
                    </svg>
                    Real-time Updates
                  </a>
                </li>
                <li>
                  <a href="/docs/storage" className="flex items-center gap-2 text-gray-400 hover:text-orange-400 transition-colors">
                    <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 19a2 2 0 01-2-2V7a2 2 0 012-2h4l2 2h4a2 2 0 012 2v1M5 19h14a2 2 0 002-2v-5a2 2 0 00-2-2H9a2 2 0 00-2 2v5a2 2 0 01-2 2z" />
                    </svg>
                    File Storage
                  </a>
                </li>
              </ul>
            </div>

            {/* Developer Resources */}
            <div className="pt-4 border-t border-zinc-800">
              <p className="text-xs font-bold text-orange-500 uppercase tracking-widest mb-3">
                Developer Resources
              </p>
              <ul className="space-y-2 text-sm">
                <li>
                  <a 
                    href="/docs/rest"
                    className="flex items-center gap-2 text-gray-400 hover:text-orange-400 transition-colors"
                  >
                    <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 9l3 3-3 3m5 0h3M5 20h14a2 2 0 002-2V6a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z" />
                    </svg>
                    REST API Reference
                  </a>
                </li>
                <li>
                  <a 
                    href="/docs/sdk"
                    className="flex items-center gap-2 text-gray-400 hover:text-orange-400 transition-colors"
                  >
                    <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10 20l4-16m4 4l4 4-4 4M6 16l-4-4 4-4" />
                    </svg>
                    SDK Documentation
                  </a>
                </li>
                <li>
                  <a 
                    href="/docs/cli"
                    className="flex items-center gap-2 text-gray-400 hover:text-orange-400 transition-colors"
                  >
                    <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 9l3 3-3 3m5 0h3M5 20h14a2 2 0 002-2V6a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z" />
                    </svg>
                    CLI Commands
                  </a>
                </li>
              </ul>
            </div>

            {/* Community & Support */}
            <div className="pt-4 border-t border-zinc-800">
              <div className="p-4 rounded-lg border border-orange-500/20 bg-gradient-to-br from-orange-500/10 to-orange-500/5">
                <div className="flex items-center gap-2 mb-3">
                  <div className="p-1.5 rounded-lg bg-orange-500/20">
                    <svg className="w-4 h-4 text-orange-400" fill="currentColor" viewBox="0 0 24 24">
                      <path d="M20.317 4.37a19.791 19.791 0 0 0-4.885-1.515.074.074 0 0 0-.079.037c-.21.375-.444.864-.608 1.25a18.27 18.27 0 0 0-5.487 0 12.64 12.64 0 0 0-.617-1.25.077.077 0 0 0-.079-.037A19.736 19.736 0 0 0 3.677 4.37a.07.07 0 0 0-.032.027C.533 9.046-.32 13.58.099 18.057a.082.082 0 0 0 .031.057 19.9 19.9 0 0 0 5.993 3.03.078.078 0 0 0 .084-.028c.462-.63.874-1.295 1.226-1.994a.076.076 0 0 0-.041-.106 13.107 13.107 0 0 1-1.872-.892.077.077 0 0 1-.008-.128 10.2 10.2 0 0 0 .372-.292.074.074 0 0 1 .077-.01c3.928 1.793 8.18 1.793 12.062 0a.074.074 0 0 1 .078.01c.12.098.246.198.373.292a.077.077 0 0 1-.006.127 12.299 12.299 0 0 1-1.873.892.077.077 0 0 0-.041.107c.36.698.772 1.362 1.225 1.993a.076.076 0 0 0 .084.028 19.839 19.839 0 0 0 6.002-3.03.077.077 0 0 0 .032-.054c.5-5.177-.838-9.674-3.549-13.66a.061.061 0 0 0-.031-.03zM8.02 15.33c-1.183 0-2.157-1.085-2.157-2.419 0-1.333.956-2.419 2.157-2.419 1.21 0 2.176 1.096 2.157 2.42 0 1.333-.956 2.418-2.157 2.418zm7.975 0c-1.183 0-2.157-1.085-2.157-2.419 0-1.333.955-2.419 2.157-2.419 1.21 0 2.176 1.096 2.157 2.42 0 1.333-.946 2.418-2.157 2.418z"/>
                    </svg>
                  </div>
                  <p className="text-xs font-bold text-orange-400">Need Help?</p>
                </div>
                <p className="text-xs text-gray-400 mb-3">
                  Join our Discord community for real-time support, discussions, and updates.
                </p>
                <a 
                  href="/community"
                  className="block w-full px-3 py-2 bg-orange-600 hover:bg-orange-500 text-white text-xs font-medium rounded-lg text-center transition-colors shadow-lg shadow-orange-500/20"
                >
                  Join Discord Community
                </a>
              </div>
            </div>

            {/* SDK Info */}
            <div className="pt-4 border-t border-zinc-800">
              <div className="space-y-3">
                <div>
                  <p className="text-xs text-gray-500 mb-2">Latest SDK Version</p>
                  <div className="flex items-center gap-2">
                    <span className="px-2 py-1 rounded text-xs font-mono bg-zinc-900 text-orange-400 border border-zinc-800">
                      @zendbx/sdk@1.1.0
                    </span>
                  </div>
                </div>
                <div>
                  <p className="text-xs text-gray-500 mb-2">Platform Version</p>
                  <div className="flex items-center gap-2">
                    <span className="px-2 py-1 rounded text-xs font-mono bg-zinc-900 text-blue-400 border border-zinc-800">
                      v1.1.0
                    </span>
                  </div>
                </div>
                <p className="text-xs text-gray-600">
                  Last updated: Dec 2024
                </p>
              </div>
            </div>

            {/* Useful Tips */}
            <div className="pt-4 border-t border-zinc-800">
              <div className="p-3 rounded-lg border border-blue-500/20 bg-blue-500/5">
                <div className="flex items-start gap-2">
                  <svg className="w-4 h-4 text-blue-400 mt-0.5 flex-shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                  </svg>
                  <div>
                    <p className="text-xs font-semibold text-blue-400 mb-1">Pro Tip</p>
                    <p className="text-xs text-blue-300">
                      Press <kbd className="px-1.5 py-0.5 text-[10px] rounded bg-zinc-900 border border-zinc-800 font-mono">Ctrl</kbd> + <kbd className="px-1.5 py-0.5 text-[10px] rounded bg-zinc-900 border border-zinc-800 font-mono">K</kbd> to quickly search the docs.
                    </p>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </aside>
      </div>
    </div>
  );
}
