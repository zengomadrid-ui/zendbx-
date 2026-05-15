'use client';

import { useState } from 'react';
import Link from 'next/link';
import { cn } from '@/lib/utils';

export default function Navbar() {
  const [isOpen, setIsOpen] = useState(false);

  return (
    <nav className="fixed top-0 w-full bg-zinc-900/95 backdrop-blur-md z-50 border-b border-gray-800">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="flex justify-between items-center h-16">
          {/* Logo */}
          <Link href="/" className="flex items-center gap-2">
            <div className="text-2xl font-bold bg-gradient-to-r from-orange-400 to-orange-600 bg-clip-text text-transparent">
              ZENDBX
            </div>
          </Link>

          {/* Desktop Navigation */}
          <div className="hidden md:flex items-center space-x-8">
            <Link href="#features" className="text-gray-300 hover:text-orange-400 transition-colors">
              Features
            </Link>
            <Link href="#pricing" className="text-gray-300 hover:text-orange-400 transition-colors">
              Pricing
            </Link>
            <Link href="#demo" className="text-gray-300 hover:text-orange-400 transition-colors">
              Demo
            </Link>
            <Link href="/community" className="text-gray-300 hover:text-orange-400 transition-colors">
              Community
            </Link>
            <Link href="/docs" className="text-gray-300 hover:text-orange-400 transition-colors">
              Docs
            </Link>
          </div>

          {/* CTA Buttons */}
          <div className="hidden md:flex items-center space-x-4">
            <Link 
              href="/login" 
              className="text-gray-300 hover:text-orange-400 transition-colors font-medium"
            >
              Login
            </Link>
            <Link 
              href="/signup" 
              className="px-4 py-2 bg-gradient-to-r from-orange-600 to-orange-500 text-white rounded-lg font-semibold hover:opacity-90 transition-all shadow-lg shadow-orange-600/30"
            >
              Start Building Free
            </Link>
          </div>

          {/* Mobile menu button */}
          <button
            onClick={() => setIsOpen(!isOpen)}
            className="md:hidden p-2 rounded-lg hover:bg-zinc-800 text-gray-300"
          >
            <svg
              className="w-6 h-6"
              fill="none"
              stroke="currentColor"
              viewBox="0 0 24 24"
            >
              {isOpen ? (
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth={2}
                  d="M6 18L18 6M6 6l12 12"
                />
              ) : (
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth={2}
                  d="M4 6h16M4 12h16M4 18h16"
                />
              )}
            </svg>
          </button>
        </div>

        {/* Mobile menu */}
        <div
          className={cn(
            "md:hidden overflow-hidden transition-all duration-300",
            isOpen ? "max-h-96 pb-4" : "max-h-0"
          )}
        >
          <div className="flex flex-col space-y-4 pt-4">
            <Link href="#features" className="text-gray-300 hover:text-orange-400">
              Features
            </Link>
            <Link href="#pricing" className="text-gray-300 hover:text-orange-400">
              Pricing
            </Link>
            <Link href="#demo" className="text-gray-300 hover:text-orange-400">
              Demo
            </Link>
            <Link href="/community" className="text-gray-300 hover:text-orange-400">
              Community
            </Link>
            <Link href="/docs" className="text-gray-300 hover:text-orange-400">
              Docs
            </Link>
            <div className="pt-4 border-t border-gray-800 flex flex-col space-y-2">
              <Link href="/login" className="text-center py-2 text-gray-300 hover:text-orange-400">
                Login
              </Link>
              <Link 
                href="/signup" 
                className="text-center py-2 bg-gradient-to-r from-orange-600 to-orange-500 text-white rounded-lg font-semibold hover:opacity-90"
              >
                Start Building Free
              </Link>
            </div>
          </div>
        </div>
      </div>
    </nav>
  );
}
