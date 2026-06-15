'use client';

import { useState, useEffect } from 'react';
import Link from 'next/link';

export default function Navbar() {
  const [scrolled, setScrolled] = useState(false);
  const [mobileOpen, setMobileOpen] = useState(false);

  useEffect(() => {
    const handler = () => setScrolled(window.scrollY > 24);
    window.addEventListener('scroll', handler, { passive: true });
    return () => window.removeEventListener('scroll', handler);
  }, []);

  const navLinks = [
    { label: 'Features',  href: '#features'  },
    { label: 'How it works', href: '#how'   },
    { label: 'Pricing',   href: '#pricing'   },
    { label: 'Docs',      href: '/docs'      },
    { label: 'Community', href: '/community' },
  ];

  return (
    <header className="fixed inset-x-0 top-0 z-50 flex justify-center px-4 pt-4">
      <nav
        className={`w-full max-w-5xl rounded-2xl border px-5 py-3 flex items-center justify-between transition-all duration-300 ${
          scrolled
            ? 'bg-black/90 border-orange-500/20 backdrop-blur-2xl shadow-2xl shadow-black/60'
            : 'bg-black/40 border-white/5 backdrop-blur-xl'
        }`}
      >
        {/* Logo */}
        <Link href="/" className="flex items-center gap-2.5 group">
          <div className="relative w-8 h-8">
            <div className="absolute inset-0 bg-orange-500 rounded-lg rotate-3 group-hover:rotate-6 transition-transform duration-300" />
            <div className="relative w-8 h-8 bg-orange-600 rounded-lg flex items-center justify-center">
              <span className="text-black font-black text-sm tracking-tighter">Z</span>
            </div>
          </div>
          <span className="text-white font-bold text-[15px] tracking-tight">ZendBX</span>
        </Link>

        {/* Desktop links */}
        <div className="hidden md:flex items-center gap-1">
          {navLinks.map(({ label, href }) => (
            <Link
              key={label}
              href={href}
              className="px-3.5 py-2 text-[13px] font-medium text-neutral-400 hover:text-white rounded-lg hover:bg-white/5 transition-all duration-200"
            >
              {label}
            </Link>
          ))}
        </div>

        {/* Desktop CTAs */}
        <div className="hidden md:flex items-center gap-2">
          <Link href="/login" className="px-3.5 py-2 text-[13px] font-medium text-neutral-400 hover:text-white transition-colors">
            Sign in
          </Link>
          <Link
            href="/signup"
            className="relative group px-4 py-2 text-[13px] font-bold text-black rounded-xl overflow-hidden"
          >
            <div className="absolute inset-0 bg-orange-500 group-hover:bg-orange-400 transition-colors duration-200" />
            <span className="relative flex items-center gap-1.5">
              Get started
              <svg className="w-3.5 h-3.5 group-hover:translate-x-0.5 transition-transform" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M13 7l5 5m0 0l-5 5m5-5H6" />
              </svg>
            </span>
          </Link>
        </div>

        {/* Mobile burger */}
        <button
          onClick={() => setMobileOpen(v => !v)}
          className="md:hidden w-9 h-9 flex flex-col items-center justify-center gap-[5px]"
          aria-label="Toggle menu"
        >
          <span className={`block h-px w-5 bg-white transition-all duration-300 ${mobileOpen ? 'rotate-45 translate-y-[6px]' : ''}`} />
          <span className={`block h-px w-5 bg-white transition-all duration-300 ${mobileOpen ? 'opacity-0 scale-x-0' : ''}`} />
          <span className={`block h-px w-5 bg-white transition-all duration-300 ${mobileOpen ? '-rotate-45 -translate-y-[6px]' : ''}`} />
        </button>
      </nav>

      {/* Mobile drawer */}
      <div className={`absolute top-full left-4 right-4 mt-2 rounded-2xl bg-black/95 border border-orange-500/15 backdrop-blur-2xl overflow-hidden transition-all duration-300 ${mobileOpen ? 'max-h-96 opacity-100' : 'max-h-0 opacity-0'}`}>
        <div className="p-4 flex flex-col gap-1">
          {navLinks.map(({ label, href }) => (
            <Link key={label} href={href} onClick={() => setMobileOpen(false)}
              className="px-4 py-2.5 text-sm text-neutral-400 hover:text-white rounded-xl hover:bg-white/5 transition-all">
              {label}
            </Link>
          ))}
          <div className="h-px bg-white/5 my-2" />
          <Link href="/login" onClick={() => setMobileOpen(false)}
            className="px-4 py-2.5 text-sm text-center text-neutral-400 hover:text-white rounded-xl hover:bg-white/5 transition-all">
            Sign in
          </Link>
          <Link href="/signup" onClick={() => setMobileOpen(false)}
            className="px-4 py-2.5 text-sm font-bold text-center text-black bg-orange-500 hover:bg-orange-400 rounded-xl transition-colors">
            Get started free
          </Link>
        </div>
      </div>
    </header>
  );
}
