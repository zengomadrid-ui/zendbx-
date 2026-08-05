import Link from 'next/link';
import type { Metadata } from 'next';

export const metadata: Metadata = {
  title: 'ZendBX Documentation — AI-Native Backend Platform',
  description:
    'Everything you need to build with ZendBX — from quick starts to advanced guides on database, auth, storage, and realtime.',
  alternates: { canonical: 'https://zendbx.in/docs' },
  openGraph: {
    title: 'ZendBX Documentation',
    description: 'Complete docs for ZendBX BaaS: PostgreSQL, Auth, Storage, Realtime, REST API, SDK.',
    url: 'https://zendbx.in/docs',
    siteName: 'ZendBX',
    type: 'website',
  },
};

const docSections = [
  {
    title: 'Getting Started',
    pageCount: 5,
    description: 'Everything you need to start building with ZendBX, from installation to your first project.',
    pages: [
      'Introduction',
      'Quick Start',
      'Installation',
      'Dashboard',
    ],
    moreCount: 1,
    exploreHref: '/docs',
    icon: (
      <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 10V3L4 14h7v7l9-11h-7z" />
      </svg>
    ),
  },
  {
    title: 'Authentication',
    pageCount: 5,
    description: 'Secure user authentication with email/password, OAuth providers, sessions, and JWT.',
    pages: [
      'Overview',
      'Email & Password',
      'OAuth Providers',
      'Sessions & JWT',
    ],
    moreCount: 1,
    exploreHref: '/docs/auth',
    icon: (
      <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 15v2m-6 4h12a2 2 0 002-2v-6a2 2 0 00-2-2H6a2 2 0 00-2 2v6a2 2 0 002 2zm10-10V7a4 4 0 00-8 0v4h8z" />
      </svg>
    ),
  },
  {
    title: 'Database',
    pageCount: 7,
    description: 'PostgreSQL database with row-level security, query builder, filters, and realtime subscriptions.',
    pages: [
      'Overview',
      'Tables & Schemas',
      'CRUD Operations',
      'Query Builder',
    ],
    moreCount: 3,
    exploreHref: '/docs/database',
    icon: (
      <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 7v10c0 2.21 3.582 4 8 4s8-1.79 8-4V7M4 7c0 2.21 3.582 4 8 4s8-1.79 8-4M4 7c0-2.21 3.582-4 8-4s8 1.79 8 4" />
      </svg>
    ),
  },
  {
    title: 'Storage',
    pageCount: 5,
    description: 'Bucket-based file storage with signed URLs, upload, download, and access control.',
    pages: [
      'Overview',
      'Buckets',
      'Upload & Download',
      'Signed URLs',
    ],
    moreCount: 1,
    exploreHref: '/docs/storage',
    icon: (
      <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 19a2 2 0 01-2-2V7a2 2 0 012-2h4l2 2h4a2 2 0 012 2v1M5 19h14a2 2 0 002-2v-5a2 2 0 00-2-2H9a2 2 0 00-2 2v5a2 2 0 01-2 2z" />
      </svg>
    ),
  },
  {
    title: 'Realtime',
    pageCount: 3,
    description: 'WebSocket subscriptions for live database changes and realtime collaboration features.',
    pages: [
      'Overview',
      'Subscriptions',
      'API Reference',
    ],
    moreCount: 0,
    exploreHref: '/docs/realtime',
    icon: (
      <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 10V3L4 14h7v7l9-11h-7z" />
      </svg>
    ),
  },
  {
    title: 'SDK',
    pageCount: 6,
    description: 'Official TypeScript SDK with full type safety and IntelliSense support.',
    pages: [
      'Overview',
      'createClient()',
      'Authentication',
      'Database',
    ],
    moreCount: 2,
    exploreHref: '/docs/sdk',
    icon: (
      <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10 20l4-16m4 4l4 4-4 4M6 16l-4-4 4-4" />
      </svg>
    ),
  },
  {
    title: 'REST API',
    pageCount: 5,
    description: 'Universal REST endpoints for every table with automatic CRUD, filtering, and pagination.',
    pages: [
      'Overview',
      'Authentication',
      'CRUD Endpoints',
      'Schema-Qualified Tables',
    ],
    moreCount: 1,
    exploreHref: '/docs/rest',
    icon: (
      <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 9l3 3-3 3m5 0h3M5 20h14a2 2 0 002-2V6a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z" />
      </svg>
    ),
  },
  {
    title: 'CLI',
    pageCount: 2,
    description: 'Command-line interface to manage projects, backups, and migrations from your terminal.',
    pages: [
      'Installation',
      'Commands',
    ],
    moreCount: 0,
    exploreHref: '/docs/cli',
    icon: (
      <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 9l3 3-3 3m5 0h3M5 20h14a2 2 0 002-2V6a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z" />
      </svg>
    ),
  },
  {
    title: 'Security',
    pageCount: 3,
    description: 'Learn about JWT authentication, row-level security, rate limiting, and best practices.',
    pages: [
      'Overview',
      'JWT & RLS',
      'Rate Limiting',
    ],
    moreCount: 0,
    exploreHref: '/docs/security',
    icon: (
      <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m5.618-4.016A11.955 11.955 0 0112 2.944a11.955 11.955 0 01-8.618 3.04A12.02 12.02 0 003 9c0 5.591 3.824 10.29 9 11.622 5.176-1.332 9-6.03 9-11.622 0-1.042-.133-2.052-.382-3.016z" />
      </svg>
    ),
  },
  {
    title: 'Migration Guides',
    pageCount: 2,
    description: 'Step-by-step guides to migrate from Supabase, Firebase, or other backend platforms.',
    pages: [
      'Supabase → ZendBX',
      'Firebase → ZendBX',
    ],
    moreCount: 0,
    exploreHref: '/docs/migrate/supabase',
    icon: (
      <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 7h12m0 0l-4-4m4 4l-4 4m0 6H4m0 0l4 4m-4-4l4-4" />
      </svg>
    ),
  },
];

export default function DocsPage() {
  return (
    <div className="max-w-6xl">
      {/* Hero Section */}
      <div className="mb-12">
        <h1 className="text-4xl md:text-5xl font-extrabold text-white mb-4">
          Documentation
        </h1>
        <p className="text-lg text-gray-400 max-w-3xl mb-8">
          Everything you need to build with ZendBX — from quick starts to advanced guides on database, auth, storage, and realtime.
        </p>

        {/* Featured Actions */}
        <div className="flex flex-wrap items-center gap-3">
          <Link
            href="/docs/quickstart"
            className="px-5 py-2.5 bg-orange-600 hover:bg-orange-500 text-white font-medium rounded-lg transition-colors shadow-lg shadow-orange-500/20"
          >
            Get Started
          </Link>
          <Link
            href="/docs/sdk"
            className="px-5 py-2.5 bg-zinc-800 hover:bg-zinc-700 text-white font-medium rounded-lg transition-colors border border-zinc-700"
          >
            SDK Documentation
          </Link>
          <button className="ml-auto hidden md:flex items-center gap-2 px-4 py-2 bg-zinc-900 hover:bg-zinc-800 text-gray-400 rounded-lg transition-colors border border-zinc-800">
            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
            </svg>
            <span className="text-sm">Search docs...</span>
            <kbd className="ml-2 px-2 py-0.5 text-xs rounded bg-zinc-800 border border-zinc-700 font-mono">⌘K</kbd>
          </button>
        </div>
      </div>

      {/* Documentation Sections Grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        {docSections.map((section) => (
          <div
            key={section.title}
            className="p-6 rounded-xl border border-zinc-800 bg-zinc-950 hover:border-orange-500/40 transition-all group"
          >
            {/* Section Header */}
            <div className="flex items-start gap-4 mb-4">
              <div className="p-3 rounded-lg bg-orange-500/10 text-orange-400 group-hover:bg-orange-500/20 transition-colors">
                {section.icon}
              </div>
              <div className="flex-1">
                <div className="flex items-center gap-2 mb-1">
                  <h3 className="text-lg font-bold text-white group-hover:text-orange-400 transition-colors">
                    {section.title}
                  </h3>
                  <span className="px-2 py-0.5 text-xs rounded-full bg-zinc-800 text-gray-400">
                    {section.pageCount} pages
                  </span>
                </div>
                <p className="text-sm text-gray-400">
                  {section.description}
                </p>
              </div>
            </div>

            {/* Page List */}
            <ul className="space-y-2 mb-4">
              {section.pages.map((page) => (
                <li key={page} className="text-sm text-gray-500 flex items-center gap-2">
                  <svg className="w-3 h-3 text-orange-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
                  </svg>
                  {page}
                </li>
              ))}
              {section.moreCount > 0 && (
                <li className="text-sm text-gray-600 italic ml-5">
                  +{section.moreCount} more
                </li>
              )}
            </ul>

            {/* Explore Button */}
            <Link
              href={section.exploreHref}
              className="inline-flex items-center gap-2 text-sm font-medium text-orange-400 hover:text-orange-300 transition-colors"
            >
              Explore
              <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
              </svg>
            </Link>
          </div>
        ))}
      </div>

      {/* Bottom CTA */}
      <div className="mt-12 p-6 rounded-xl border border-orange-500/20 bg-gradient-to-br from-orange-500/10 to-orange-500/5">
        <div className="flex flex-col md:flex-row items-start md:items-center justify-between gap-4">
          <div>
            <h3 className="text-lg font-bold text-white mb-1">Ready to build?</h3>
            <p className="text-sm text-gray-400">
              Create your first project and start shipping in minutes.
            </p>
          </div>
          <Link
            href="https://devapp.zendbx.in"
            target="_blank"
            rel="noopener noreferrer"
            className="px-5 py-2.5 bg-orange-600 hover:bg-orange-500 text-white font-medium rounded-lg transition-colors shadow-lg shadow-orange-500/20 whitespace-nowrap"
          >
            Get Started Free
          </Link>
        </div>
      </div>
    </div>
  );
}
