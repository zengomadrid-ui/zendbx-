'use client';

// Prevent static generation - this page needs client-side rendering
export const dynamic = 'force-dynamic';

import { useState } from 'react';
import Link from 'next/link';

export default function HistoryPage() {
  const [filter, setFilter] = useState<'all' | 'success' | 'failed'>('all');
  const [searchQuery, setSearchQuery] = useState('');

  const queryHistory = [
    {
      id: 1,
      question: 'What were total sales in Q3 by region?',
      sql: 'SELECT region, SUM(amount) as total_sales FROM sales WHERE quarter = \'Q3\' GROUP BY region',
      status: 'success',
      executionTime: '1.2s',
      rowsReturned: 3,
      timestamp: '2 minutes ago',
      project: 'Sales Analytics',
    },
    {
      id: 2,
      question: 'Show top 10 customers by revenue',
      sql: 'SELECT customer_name, SUM(amount) as revenue FROM orders GROUP BY customer_name ORDER BY revenue DESC LIMIT 10',
      status: 'success',
      executionTime: '0.8s',
      rowsReturned: 10,
      timestamp: '15 minutes ago',
      project: 'Customer Data',
    },
    {
      id: 3,
      question: 'Average order value by region',
      sql: 'SELECT region, AVG(order_value) as avg_value FROM orders GROUP BY region',
      status: 'success',
      executionTime: '1.5s',
      rowsReturned: 5,
      timestamp: '1 hour ago',
      project: 'Sales Analytics',
    },
    {
      id: 4,
      question: 'Monthly growth rate',
      sql: 'SELECT month, (current_month - previous_month) / previous_month * 100 as growth FROM metrics',
      status: 'failed',
      executionTime: '0.3s',
      rowsReturned: 0,
      timestamp: '2 hours ago',
      project: 'Marketing Metrics',
      error: 'Column "previous_month" does not exist',
    },
    {
      id: 5,
      question: 'Product performance last quarter',
      sql: 'SELECT product_name, COUNT(*) as orders, SUM(quantity) as units FROM order_items WHERE date >= CURRENT_DATE - INTERVAL \'90 days\' GROUP BY product_name',
      status: 'success',
      executionTime: '2.1s',
      rowsReturned: 45,
      timestamp: '3 hours ago',
      project: 'Sales Analytics',
    },
  ];

  const filteredHistory = queryHistory.filter(q => {
    if (filter !== 'all' && q.status !== filter) return false;
    if (searchQuery && !q.question.toLowerCase().includes(searchQuery.toLowerCase())) return false;
    return true;
  });

  const stats = {
    total: queryHistory.length,
    success: queryHistory.filter(q => q.status === 'success').length,
    failed: queryHistory.filter(q => q.status === 'failed').length,
    avgTime: '1.4s',
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div>
        <h1 className="text-3xl font-bold text-white">Query History</h1>
        <p className="text-gray-400 mt-2">View and rerun your past queries</p>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
        <div className="bg-zinc-800 border border-gray-700 rounded-xl p-4">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm text-gray-400">Total Queries</p>
              <p className="text-2xl font-bold text-white mt-1">{stats.total}</p>
            </div>
            <div className="w-10 h-10 bg-zinc-900 rounded-lg flex items-center justify-center">
              <svg className="w-5 h-5 text-orange-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 19v-6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2a2 2 0 002-2zm0 0V9a2 2 0 012-2h2a2 2 0 012 2v10m-6 0a2 2 0 002 2h2a2 2 0 002-2m0 0V5a2 2 0 012-2h2a2 2 0 012 2v14a2 2 0 01-2 2h-2a2 2 0 01-2-2z" />
              </svg>
            </div>
          </div>
        </div>

        <div className="bg-zinc-800 border border-gray-700 rounded-xl p-4">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm text-gray-400">Successful</p>
              <p className="text-2xl font-bold text-green-500 mt-1">{stats.success}</p>
            </div>
            <div className="w-10 h-10 bg-green-500/10 rounded-lg flex items-center justify-center">
              <svg className="w-5 h-5 text-green-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
              </svg>
            </div>
          </div>
        </div>

        <div className="bg-zinc-800 border border-gray-700 rounded-xl p-4">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm text-gray-400">Failed</p>
              <p className="text-2xl font-bold text-red-500 mt-1">{stats.failed}</p>
            </div>
            <div className="w-10 h-10 bg-red-500/10 rounded-lg flex items-center justify-center">
              <svg className="w-5 h-5 text-red-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10 14l2-2m0 0l2-2m-2 2l-2-2m2 2l2 2m7-2a9 9 0 11-18 0 9 9 0 0118 0z" />
              </svg>
            </div>
          </div>
        </div>

        <div className="bg-zinc-800 border border-gray-700 rounded-xl p-4">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm text-gray-400">Avg Time</p>
              <p className="text-2xl font-bold text-white mt-1">{stats.avgTime}</p>
            </div>
            <div className="w-10 h-10 bg-zinc-900 rounded-lg flex items-center justify-center">
              <svg className="w-5 h-5 text-orange-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 10V3L4 14h7v7l9-11h-7z" />
              </svg>
            </div>
          </div>
        </div>
      </div>

      {/* Filters */}
      <div className="bg-zinc-800 border border-gray-700 rounded-xl p-4">
        <div className="flex items-center justify-between flex-wrap gap-4">
          <div className="flex items-center space-x-2">
            <button
              onClick={() => setFilter('all')}
              className={`px-4 py-2 rounded-lg text-sm font-medium transition-all ${
                filter === 'all'
                  ? 'bg-orange-600 text-white shadow-lg shadow-orange-600/30'
                  : 'bg-zinc-900 text-gray-400 hover:text-white'
              }`}
            >
              All
            </button>
            <button
              onClick={() => setFilter('success')}
              className={`px-4 py-2 rounded-lg text-sm font-medium transition-all ${
                filter === 'success'
                  ? 'bg-green-600 text-white'
                  : 'bg-zinc-900 text-gray-400 hover:text-white'
              }`}
            >
              Success
            </button>
            <button
              onClick={() => setFilter('failed')}
              className={`px-4 py-2 rounded-lg text-sm font-medium transition-all ${
                filter === 'failed'
                  ? 'bg-red-600 text-white'
                  : 'bg-zinc-900 text-gray-400 hover:text-white'
              }`}
            >
              Failed
            </button>
          </div>

          <div className="relative flex-1 max-w-md">
            <input
              type="text"
              placeholder="Search queries..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="w-full px-4 py-2 pl-10 bg-zinc-900 border border-gray-700 text-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-orange-500 focus:border-transparent text-sm"
            />
            <svg className="w-5 h-5 text-gray-400 absolute left-3 top-2.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
            </svg>
          </div>

          <button className="px-4 py-2 bg-zinc-900 border border-gray-700 text-gray-300 rounded-lg hover:border-orange-600/50 transition-all text-sm font-medium">
            <svg className="w-4 h-4 inline mr-2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-4l-4 4m0 0l-4-4m4 4V4" />
            </svg>
            Export
          </button>
        </div>
      </div>

      {/* Query List */}
      <div className="space-y-3">
        {filteredHistory.map((query) => (
          <div
            key={query.id}
            className="bg-zinc-800 border border-gray-700 rounded-xl p-5 hover:border-orange-600/50 transition-all group"
          >
            <div className="flex items-start justify-between mb-3">
              <div className="flex-1">
                <div className="flex items-center space-x-3 mb-2">
                  <h3 className="text-lg font-semibold text-white group-hover:text-orange-500 transition-colors">
                    {query.question}
                  </h3>
                  <span className={`px-2 py-1 rounded-full text-xs font-medium ${
                    query.status === 'success'
                      ? 'bg-green-500/10 text-green-500'
                      : 'bg-red-500/10 text-red-500'
                  }`}>
                    {query.status}
                  </span>
                </div>
                <div className="flex items-center space-x-4 text-sm text-gray-400">
                  <span className="flex items-center space-x-1">
                    <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" />
                    </svg>
                    <span>{query.timestamp}</span>
                  </span>
                  <span className="flex items-center space-x-1">
                    <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 7v10a2 2 0 002 2h14a2 2 0 002-2V9a2 2 0 00-2-2h-6l-2-2H5a2 2 0 00-2 2z" />
                    </svg>
                    <span>{query.project}</span>
                  </span>
                  <span className="flex items-center space-x-1">
                    <svg className="w-4 h-4 text-orange-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 10V3L4 14h7v7l9-11h-7z" />
                    </svg>
                    <span>{query.executionTime}</span>
                  </span>
                  {query.status === 'success' && (
                    <span className="flex items-center space-x-1">
                      <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 10h18M3 14h18m-9-4v8m-7 0h14a2 2 0 002-2V8a2 2 0 00-2-2H5a2 2 0 00-2 2v8a2 2 0 002 2z" />
                      </svg>
                      <span>{query.rowsReturned} rows</span>
                    </span>
                  )}
                </div>
              </div>

              <div className="flex items-center space-x-2">
                <Link
                  href="/dashboard/query"
                  className="p-2 rounded-lg hover:bg-zinc-700 text-gray-400 hover:text-orange-500 transition-colors"
                  title="Rerun query"
                >
                  <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M14.752 11.168l-3.197-2.132A1 1 0 0010 9.87v4.263a1 1 0 001.555.832l3.197-2.132a1 1 0 000-1.664z" />
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                  </svg>
                </Link>
                <button className="p-2 rounded-lg hover:bg-zinc-700 text-gray-400 hover:text-orange-500 transition-colors" title="Save query">
                  <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 5a2 2 0 012-2h10a2 2 0 012 2v16l-7-3.5L5 21V5z" />
                  </svg>
                </button>
                <button className="p-2 rounded-lg hover:bg-zinc-700 text-gray-400 hover:text-orange-500 transition-colors" title="Copy SQL">
                  <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 16H6a2 2 0 01-2-2V6a2 2 0 012-2h8a2 2 0 012 2v2m-6 12h8a2 2 0 002-2v-8a2 2 0 00-2-2h-8a2 2 0 00-2 2v8a2 2 0 002 2z" />
                  </svg>
                </button>
              </div>
            </div>

            {/* SQL Code */}
            <div className="bg-black rounded-lg p-3 mb-3">
              <code className="text-sm text-gray-300 font-mono">{query.sql}</code>
            </div>

            {/* Error Message */}
            {query.error && (
              <div className="bg-red-500/10 border border-red-500/20 rounded-lg p-3">
                <div className="flex items-start space-x-2">
                  <svg className="w-5 h-5 text-red-500 flex-shrink-0 mt-0.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4m0 4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                  </svg>
                  <div>
                    <p className="text-sm font-medium text-red-500">Error</p>
                    <p className="text-sm text-gray-300 mt-1">{query.error}</p>
                  </div>
                </div>
              </div>
            )}
          </div>
        ))}
      </div>

      {/* Empty State */}
      {filteredHistory.length === 0 && (
        <div className="bg-zinc-800 border border-gray-700 rounded-xl p-12 text-center">
          <div className="w-16 h-16 bg-zinc-900 rounded-lg flex items-center justify-center mx-auto mb-4">
            <svg className="w-8 h-8 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
            </svg>
          </div>
          <h3 className="text-lg font-semibold text-white mb-2">No queries found</h3>
          <p className="text-sm text-gray-400 mb-4">Try adjusting your filters or search query</p>
          <Link
            href="/dashboard/query"
            className="inline-flex items-center px-4 py-2 bg-gradient-to-r from-orange-600 to-orange-500 text-white rounded-lg font-semibold hover:from-orange-500 hover:to-orange-600 transition-all shadow-lg shadow-orange-600/30"
          >
            Create New Query
          </Link>
        </div>
      )}
    </div>
  );
}
