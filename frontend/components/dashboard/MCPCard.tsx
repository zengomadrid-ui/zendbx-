'use client';

import { useState } from 'react';
import Link from 'next/link';

// Updated: 2026-06-23 20:31 - FORCE REBUILD - Inline styles for black/orange theme

interface MCPCardProps {
  projectId: string;
}

export function MCPCard({ projectId }: MCPCardProps) {
  const [isHovered, setIsHovered] = useState(false);

  return (
    <div 
      className="rounded-xl p-6 border transition-all duration-200"
      style={{
        background: 'linear-gradient(135deg, rgba(0,0,0,0.9), rgba(20,20,20,0.95))',
        borderColor: 'rgba(255,107,0,0.25)',
        boxShadow: isHovered 
          ? '0 8px 32px rgba(255,107,0,0.15), 0 0 0 1px rgba(255,107,0,0.3)' 
          : '0 4px 16px rgba(0,0,0,0.3)'
      }}
      onMouseEnter={() => setIsHovered(true)}
      onMouseLeave={() => setIsHovered(false)}
    >
      <div className="flex items-center justify-between mb-4">
        <div className="flex items-center gap-3">
          <div 
            className="p-2 rounded-lg border"
            style={{
              background: 'rgba(255,107,0,0.2)',
              borderColor: 'rgba(255,107,0,0.4)'
            }}
          >
            <svg
              className="w-6 h-6"
              style={{ color: '#FF6B00' }}
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
            <h3 className="text-lg font-semibold" style={{ color: 'white' }}>
              MCP Integration
            </h3>
            <p className="text-sm font-medium" style={{ color: '#FF9500' }}>
              Model Context Protocol
            </p>
          </div>
        </div>
        <div className="flex items-center gap-2">
          <span 
            className="px-2 py-1 text-xs font-medium rounded-full border"
            style={{
              background: 'rgba(255,107,0,0.25)',
              color: '#FF6B00',
              borderColor: 'rgba(255,107,0,0.4)'
            }}
          >
            NEW
          </span>
        </div>
      </div>

      <p className="text-sm mb-4 leading-relaxed" style={{ color: '#D1D5DB' }}>
        Connect your database to AI tools and agents through MCP. Enable seamless data access, 
        real-time queries, and intelligent automation.
      </p>

      <div className="grid grid-cols-2 gap-4 mb-4">
        <div 
          className="text-center p-3 rounded-lg border"
          style={{
            background: 'rgba(0,0,0,0.7)',
            borderColor: 'rgba(255,107,0,0.2)'
          }}
        >
          <div className="text-2xl font-bold" style={{ color: '#FF6B00' }}>0</div>
          <div className="text-xs mt-1" style={{ color: '#9CA3AF' }}>Active Connections</div>
        </div>
        <div 
          className="text-center p-3 rounded-lg border"
          style={{
            background: 'rgba(0,0,0,0.7)',
            borderColor: 'rgba(255,107,0,0.2)'
          }}
        >
          <div className="text-2xl font-bold" style={{ color: '#10B981' }}>Ready</div>
          <div className="text-xs mt-1" style={{ color: '#9CA3AF' }}>Status</div>
        </div>
      </div>

      <Link
        href="/dashboard/mcp"
        className="flex items-center justify-center gap-2 w-full px-4 py-3 rounded-lg font-medium transition-all duration-200 border"
        style={{
          background: isHovered 
            ? 'linear-gradient(135deg, #E85E00, #CC5500)' 
            : 'linear-gradient(135deg, #FF6B00, #E85E00)',
          color: 'white',
          borderColor: 'rgba(255,107,0,0.5)',
          transform: isHovered ? 'translateY(-1px)' : 'translateY(0)',
          boxShadow: isHovered 
            ? '0 8px 25px rgba(255,107,0,0.3)' 
            : '0 4px 15px rgba(255,107,0,0.2)'
        }}
      >
        <span>Configure MCP</span>
        <svg
          className="w-4 h-4 transition-transform duration-200"
          style={{ 
            transform: isHovered ? 'translateX(4px)' : 'translateX(0)' 
          }}
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