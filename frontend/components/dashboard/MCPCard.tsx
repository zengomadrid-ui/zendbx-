'use client';

import { useState } from 'react';
import Link from 'next/link';

interface MCPCardProps {
  projectId: string;
}

export function MCPCard({ projectId }: MCPCardProps) {
  const [isHovered, setIsHovered] = useState(false);

  return (
    <div 
      className="bg-gradient-to-br from-purple-50 to-indigo-50 dark:from-purple-900/20 dark:to-indigo-900/20 rounded-xl p-6 border border-purple-200 dark:border-purple-700 hover:shadow-lg transition-all duration-200"
      onMouseEnter={() => setIsHovered(true)}
      onMouseLeave={() => setIsHovered(false)}
    >
      <div className="flex items-center justify-between mb-4">
        <div className="flex items-center gap-3">
          <div className="p-2 bg-purple-100 dark:bg-purple-800 rounded-lg">
            <svg
              className="w-6 h-6 text-purple-600 dark:text-purple-300"
              fill="none"
              stroke="currentColor"
              viewBox="0 0 24 24"
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth={2}
                d="M13 10V3L4 14h7v7l9-11h-7z"
              />
            </svg>
          </div>
          <div>
            <h3 className="text-lg font-semibold text-gray-900 dark:text-white">
              MCP Integration
            </h3>
            <p className="text-sm text-purple-600 dark:text-purple-300 font-medium">
              Model Context Protocol
            </p>
          </div>
        </div>
        <div className="flex items-center gap-2">
          <span className="px-2 py-1 text-xs font-medium bg-green-100 text-green-800 dark:bg-green-900/30 dark:text-green-300 rounded-full">
            NEW
          </span>
        </div>
      </div>

      <p className="text-gray-600 dark:text-gray-300 text-sm mb-4 leading-relaxed">
        Connect your database to AI tools and agents through MCP. Enable seamless data access, 
        real-time queries, and intelligent automation.
      </p>

      <div className="grid grid-cols-2 gap-4 mb-4">
        <div className="text-center p-3 bg-white dark:bg-gray-800 rounded-lg border border-gray-100 dark:border-gray-700">
          <div className="text-2xl font-bold text-purple-600 dark:text-purple-300">0</div>
          <div className="text-xs text-gray-500 dark:text-gray-400 mt-1">Active Connections</div>
        </div>
        <div className="text-center p-3 bg-white dark:bg-gray-800 rounded-lg border border-gray-100 dark:border-gray-700">
          <div className="text-2xl font-bold text-green-600 dark:text-green-400">Ready</div>
          <div className="text-xs text-gray-500 dark:text-gray-400 mt-1">Status</div>
        </div>
      </div>

      <Link
        href="/dashboard/mcp"
        className={`
          flex items-center justify-center gap-2 w-full px-4 py-3 
          bg-purple-600 hover:bg-purple-700 text-white rounded-lg 
          font-medium transition-all duration-200
          ${isHovered ? 'transform translate-y-[-1px] shadow-md' : ''}
        `}
      >
        <span>Configure MCP</span>
        <svg
          className={`w-4 h-4 transition-transform duration-200 ${isHovered ? 'translate-x-1' : ''}`}
          fill="none"
          stroke="currentColor"
          viewBox="0 0 24 24"
        >
          <path
            strokeLinecap="round"
            strokeLinejoin="round"
            strokeWidth={2}
            d="M9 5l7 7-7 7"
          />
        </svg>
      </Link>
    </div>
  );
}