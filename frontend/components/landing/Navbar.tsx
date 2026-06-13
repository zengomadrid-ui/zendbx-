'use client';

import { useState } from 'react';
import Link from 'next/link';
import { cn } from '@/lib/utils';

export default function Navbar() {
  const [isOpen, setIsOpen] = useState(false);

  return (
    <nav className="fixed top-0 w-full bg-zinc-900/95 backdrop-blur-md z-50 border-b border-zinc-800">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="flex justify-between items-center h-16">

          <Link href="/" className="text-2xl font-bold bg-gradient-to-r from-orange-400 to-orange-600 bg-clip-text text-transparent">
            ZENDBX
          </Link>

          <div className="hidden md:flex items-center space-x-8">
            {[
              { label: 'Features', href: '#features' },
              { label: 'Pricing', href: '#pricing' },
              { label: 'Demo', href: '#demo' },
              { label: 'Community', href: '/community' },
              { label: 'Docs', href: '/docs' },
            ].map(({ label, href }) => (
              <Link key={label} href={href} className="text-gray-300 hover:text-orange-400 transition-colors text-sm font-medium">
                {label}
              </Link>
            ))}
          </div>

          <div className="hidden md:flex items-center gap-3">
            <Link href="/login" className="text-gray-300 hover:text-orange-400 transition-colors text-sm font-medium px-2">
              Login
            </Link>
            <Link href="/signup" className="px-5 py-2 bg-gradient-to-r from-orange-600 to-orange-500 text-white rounded-xl text-sm font-semibold hover:opacity-90 transition-all shadow-lg shadow-orange-600/30 flex items-center gap-1">
              Start Building Free <span className="text-base leading-none">›</span>
            </Link>
          </div>

          <button onClick={() => setIsOpen(!isOpen)} className="md:hidden p-2 rounded-lg hover:bg-zinc-800 text-gray-300">
            <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              {isOpen
                ? <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                : <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 6h16M4 12h16M4 18h16" />
              }
            </svg>
          </button>
        </div>

        <div className={cn("md:hidden overflow-hidden transition-all duration-300", isOpen ? "max-h-96 pb-4" : "max-h-0")}>
          <div className="flex flex-col space-y-3 pt-4">
            {[
              { label: 'Features', href: '#features' },
              { label: 'Pricing', href: '#pricing' },
              { label: 'Demo', href: '#demo' },
              { label: 'Community', href: '/community' },
              { label: 'Docs', href: '/docs' },
            ].map(({ label, href }) => (
              <Link key={label} href={href} className="text-gray-300 hover:text-orange-400 text-sm font-medium py-1" onClick={() => setIsOpen(false)}>
                {label}
              </Link>
            ))}
            <div className="pt-3 border-t border-zinc-800 flex flex-col gap-2">
              <Link href="/login" className="text-center py-2 text-gray-300 hover:text-orange-400 text-sm font-medium">Login</Link>
              <Link href="/signup" className="text-center py-2.5 bg-gradient-to-r from-orange-600 to-orange-500 text-white rounded-xl text-sm font-semibold hover:opacity-90">
                Start Building Free
              </Link>
            </div>
          </div>
        </div>
      </div>
    </nav>
  );
}