'use client';

import { useState } from 'react';
import Link from 'next/link';

export default function SavedQueriesPage() {
  const [view, setView] = useState<'grid' | 'list'>('grid');
  const [searchQuery, setSearchQuery] = useState('');

  const savedQueries = [
    {
      id: 1,
      name: 'Q3 Sales by Region',
      description: 'Total sales breakdown by geographic region for Q3',
      sql: 'SELECT region, SUM(amount) as total_sales FROM sales WHERE quarter = \'Q3\' GROUP BY region ORDER BY total_sales DESC',
      category: 'Sales',
      lastRun: '2 hours ago',
      runCount: 45,
      isFavorite: true,
      tags: ['sales', 'regional', 'quarterly'],
    },
    {
      id: 2,
      name: 'Top Customers',
      description: 'Top 10 customers ranked by total revenue',
      sql: 'SELECT customer_name, SUM(amount) as revenue FROM orders GROUP BY customer_name ORDER BY revenue DESC LIMIT 10',
      category: 'Customers',
      lastRun: '1 day ago',
      runCount: 128,
      isFavorite: true,
      tags: ['customers', 'revenue', 'top-performers'],
    },
    {
      id: 3,
      name: 'Product Performance',
      description: 'Product sales and units sold in last 90 days',
      sql: 'SELECT product_name, COUNT(*) as orders, SUM(quantity) as units FROM order_items WHERE date >= CURRENT_DATE - INTERVAL \'90 days\' GROUP BY product_name',
      category: 'Products',
      lastRun: '3 days ago',
      runCount: 67,
      isFavorite: false,
      tags: ['products', 'performance', '90-days'],
    },
    {
      id: 4,
      name: 'Monthly Revenue Trend',
      description: 'Revenue trends over the past 12 months',
      sql: 'SELECT DATE_TRUNC(\'month\', order_date) as month, SUM(amount) as revenue FROM orders WHERE order_date >= CURRENT_DATE - INTERVAL \'12 months\' GROUP BY month ORDER BY month',
      category: 'Analytics',
      lastRun: '5 days ago',
      runCount: 89,
      isFavorite: false,
      tags: ['revenue', 'trends', 'monthly'],
    },
    {
      id: 5,
      name: 'Customer Retention',
      description: 'Repeat customer analysis and retention metrics',
      sql: 'SELECT customer_id, COUNT(DISTINCT order_id) as order_count, MIN(order_date) as first_order, MAX(order_date) as last_order FROM orders GROUP BY customer_id HAVING COUNT(DISTINCT order_id) > 1',
      category: 'Customers',
      lastRun: '1 week ago',
      runCount: 34,
      isFavorite: true,
      tags: ['customers', 'retention', 'repeat'],
    },
    {
      id: 6,
      name: 'Inventory Status',
      description: 'Current inventory levels and low stock alerts',
      sql: 'SELECT product_name, current_stock, reorder_level, CASE WHEN current_stock < reorder_level THEN \'Low\' ELSE \'OK\' END as status FROM inventory ORDER BY current_stock ASC',
      category: 'Inventory',
      lastRun: '2 weeks ago',
      runCount: 156,
      isFavorite: false,
      tags: ['inventory', 'stock', 'alerts'],
    },
  ];

  const categories = ['All', 'Sales', 'Customers', 'Products', 'Analytics', 'Inventory'];
  const [selectedCategory, setSelectedCategory] = useState('All');

  const filteredQueries = savedQueries.filter(q => {
    if (selectedCategory !== 'All' && q.category !== selectedCategory) return false;
    if (searchQuery && !q.name.toLowerCase().includes(searchQuery.toLowerCase()) && 
        !q.description.toLowerCase().includes(searchQuery.toLowerCase())) return false;
    return true;
  });

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold text-white">Saved Queries</h1>
          <p className="text-gray-400 mt-2">Your collection of reusable queries</p>
        </div>
        <Link
          href="/dashboard/query"
          className="px-6 py-3 bg-gradient-to-r from-orange-600 to-orange-500 text-white rounded-lg font-semibold hover:from-orange-500 hover:to-orange-600 transition-all shadow-lg shadow-orange-600/30"
        >
          + New Query
        </Link>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
        <div className="bg-zinc-800 border border-gray-700 rounded-xl p-4">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm text-gray-400">Total Saved</p>
              <p className="text-2xl font-bold text-white mt-1">{savedQueries.length}</p>
            </div>
            <div className="w-10 h-10 bg-zinc-900 rounded-lg flex items-center justify-center">
              <svg className="w-5 h-5 text-orange-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 5a2 2 0 012-2h10a2 2 0 012 2v16l-7-3.5L5 21V5z" />
              </svg>
            </div>
          </div>
        </div>

        <div className="bg-zinc-800 border border-gray-700 rounded-xl p-4">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm text-gray-400">Favorites</p>
              <p className="text-2xl font-bold text-orange-500 mt-1">{savedQueries.filter(q => q.isFavorite).length}</p>
            </div>
            <div className="w-10 h-10 bg-orange-500/10 rounded-lg flex items-center justify-center">
              <svg className="w-5 h-5 text-orange-500" fill="currentColor" viewBox="0 0 24 24">
                <path d="M12 2l3.09 6.26L22 9.27l-5 4.87 1.18 6.88L12 17.77l-6.18 3.25L7 14.14 2 9.27l6.91-1.01L12 2z" />
              </svg>
            </div>
          </div>
        </div>

        <div className="bg-zinc-800 border border-gray-700 rounded-xl p-4">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm text-gray-400">Total Runs</p>
              <p className="text-2xl font-bold text-white mt-1">{savedQueries.reduce((sum, q) => sum + q.runCount, 0)}</p>
            </div>
            <div className="w-10 h-10 bg-zinc-900 rounded-lg flex items-center justify-center">
              <svg className="w-5 h-5 text-orange-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M14.752 11.168l-3.197-2.132A1 1 0 0010 9.87v4.263a1 1 0 001.555.832l3.197-2.132a1 1 0 000-1.664z" />
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
              </svg>
            </div>
          </div>
        </div>

        <div className="bg-zinc-800 border border-gray-700 rounded-xl p-4">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm text-gray-400">Categories</p>
              <p className="text-2xl font-bold text-white mt-1">{categories.length - 1}</p>
            </div>
            <div className="w-10 h-10 bg-zinc-900 rounded-lg flex items-center justify-center">
              <svg className="w-5 h-5 text-orange-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M7 7h.01M7 3h5c.512 0 1.024.195 1.414.586l7 7a2 2 0 010 2.828l-7 7a2 2 0 01-2.828 0l-7-7A1.994 1.994 0 013 12V7a4 4 0 014-4z" />
              </svg>
            </div>
          </div>
        </div>
      </div>

      {/* Filters and View Toggle */}
      <div className="bg-zinc-800 border border-gray-700 rounded-xl p-4">
        <div className="flex items-center justify-between flex-wrap gap-4">
          {/* Category Filter */}
          <div className="flex items-center space-x-2 flex-wrap">
            {categories.map((category) => (
              <button
                key={category}
                onClick={() => setSelectedCategory(category)}
                className={`px-4 py-2 rounded-lg text-sm font-medium transition-all ${
                  selectedCategory === category
                    ? 'bg-orange-600 text-white shadow-lg shadow-orange-600/30'
                    : 'bg-zinc-900 text-gray-400 hover:text-white'
                }`}
              >
                {category}
              </button>
            ))}
          </div>

          <div className="flex items-center space-x-2">
            {/* Search */}
            <div className="relative">
              <input
                type="text"
                placeholder="Search queries..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="w-64 px-4 py-2 pl-10 bg-zinc-900 border border-gray-700 text-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-orange-500 focus:border-transparent text-sm"
              />
              <svg className="w-5 h-5 text-gray-400 absolute left-3 top-2.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
              </svg>
            </div>

            {/* View Toggle */}
            <div className="flex items-center space-x-1 bg-zinc-900 rounded-lg p-1">
              <button
                onClick={() => setView('grid')}
                className={`p-2 rounded transition-all ${
                  view === 'grid' ? 'bg-orange-600 text-white' : 'text-gray-400 hover:text-white'
                }`}
              >
                <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 6a2 2 0 012-2h2a2 2 0 012 2v2a2 2 0 01-2 2H6a2 2 0 01-2-2V6zM14 6a2 2 0 012-2h2a2 2 0 012 2v2a2 2 0 01-2 2h-2a2 2 0 01-2-2V6zM4 16a2 2 0 012-2h2a2 2 0 012 2v2a2 2 0 01-2 2H6a2 2 0 01-2-2v-2zM14 16a2 2 0 012-2h2a2 2 0 012 2v2a2 2 0 01-2 2h-2a2 2 0 01-2-2v-2z" />
                </svg>
              </button>
              <button
                onClick={() => setView('list')}
                className={`p-2 rounded transition-all ${
                  view === 'list' ? 'bg-orange-600 text-white' : 'text-gray-400 hover:text-white'
                }`}
              >
                <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 6h16M4 12h16M4 18h16" />
                </svg>
              </button>
            </div>
          </div>
        </div>
      </div>

      {/* Queries Grid/List */}
      {view === 'grid' ? (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          {filteredQueries.map((query) => (
            <div
              key={query.id}
              className="bg-zinc-800 border border-gray-700 rounded-xl p-5 hover:border-orange-600/50 transition-all group"
            >
              <div className="flex items-start justify-between mb-3">
                <div className="flex-1">
                  <h3 className="text-lg font-semibold text-white group-hover:text-orange-500 transition-colors mb-1">
                    {query.name}
                  </h3>
                  <p className="text-sm text-gray-400 line-clamp-2">{query.description}</p>
                </div>
                <button className="p-1.5 rounded hover:bg-zinc-700 transition-colors">
                  <svg className={`w-5 h-5 ${query.isFavorite ? 'text-orange-500 fill-current' : 'text-gray-400'}`} fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M11.049 2.927c.3-.921 1.603-.921 1.902 0l1.519 4.674a1 1 0 00.95.69h4.915c.969 0 1.371 1.24.588 1.81l-3.976 2.888a1 1 0 00-.363 1.118l1.518 4.674c.3.922-.755 1.688-1.538 1.118l-3.976-2.888a1 1 0 00-1.176 0l-3.976 2.888c-.783.57-1.838-.197-1.538-1.118l1.518-4.674a1 1 0 00-.363-1.118l-3.976-2.888c-.784-.57-.38-1.81.588-1.81h4.914a1 1 0 00.951-.69l1.519-4.674z" />
                  </svg>
                </button>
              </div>

              <div className="bg-black rounded-lg p-3 mb-3">
                <code className="text-xs text-gray-300 font-mono line-clamp-3">{query.sql}</code>
              </div>

              <div className="flex items-center justify-between text-xs text-gray-400 mb-3">
                <span className="px-2 py-1 bg-zinc-900 rounded">{query.category}</span>
                <span>{query.runCount} runs</span>
              </div>

              <div className="flex items-center space-x-2">
                <Link
                  href="/dashboard/query"
                  className="flex-1 px-3 py-2 bg-gradient-to-r from-orange-600 to-orange-500 text-white rounded-lg font-medium hover:from-orange-500 hover:to-orange-600 transition-all text-sm text-center"
                >
                  Run Query
                </Link>
                <button className="p-2 rounded-lg hover:bg-zinc-700 text-gray-400 hover:text-orange-500 transition-colors">
                  <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 16H6a2 2 0 01-2-2V6a2 2 0 012-2h8a2 2 0 012 2v2m-6 12h8a2 2 0 002-2v-8a2 2 0 00-2-2h-8a2 2 0 00-2 2v8a2 2 0 002 2z" />
                  </svg>
                </button>
                <button className="p-2 rounded-lg hover:bg-zinc-700 text-gray-400 hover:text-red-500 transition-colors">
                  <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
                  </svg>
                </button>
              </div>

              <div className="flex flex-wrap gap-1 mt-3">
                {query.tags.map((tag) => (
                  <span key={tag} className="px-2 py-0.5 bg-zinc-900 text-gray-400 rounded text-xs">
                    #{tag}
                  </span>
                ))}
              </div>
            </div>
          ))}
        </div>
      ) : (
        <div className="space-y-3">
          {filteredQueries.map((query) => (
            <div
              key={query.id}
              className="bg-zinc-800 border border-gray-700 rounded-xl p-5 hover:border-orange-600/50 transition-all group"
            >
              <div className="flex items-start justify-between">
                <div className="flex-1">
                  <div className="flex items-center space-x-3 mb-2">
                    <h3 className="text-lg font-semibold text-white group-hover:text-orange-500 transition-colors">
                      {query.name}
                    </h3>
                    <span className="px-2 py-1 bg-zinc-900 text-gray-400 rounded text-xs">{query.category}</span>
                    {query.isFavorite && (
                      <svg className="w-5 h-5 text-orange-500 fill-current" viewBox="0 0 24 24">
                        <path d="M12 2l3.09 6.26L22 9.27l-5 4.87 1.18 6.88L12 17.77l-6.18 3.25L7 14.14 2 9.27l6.91-1.01L12 2z" />
                      </svg>
                    )}
                  </div>
                  <p className="text-sm text-gray-400 mb-3">{query.description}</p>
                  <div className="bg-black rounded-lg p-3 mb-3">
                    <code className="text-sm text-gray-300 font-mono">{query.sql}</code>
                  </div>
                  <div className="flex items-center space-x-4 text-sm text-gray-400">
                    <span>{query.runCount} runs</span>
                    <span>Last run: {query.lastRun}</span>
                    <div className="flex flex-wrap gap-1">
                      {query.tags.map((tag) => (
                        <span key={tag} className="px-2 py-0.5 bg-zinc-900 rounded text-xs">
                          #{tag}
                        </span>
                      ))}
                    </div>
                  </div>
                </div>

                <div className="flex items-center space-x-2 ml-4">
                  <Link
                    href="/dashboard/query"
                    className="px-4 py-2 bg-gradient-to-r from-orange-600 to-orange-500 text-white rounded-lg font-medium hover:from-orange-500 hover:to-orange-600 transition-all text-sm"
                  >
                    Run Query
                  </Link>
                  <button className="p-2 rounded-lg hover:bg-zinc-700 text-gray-400 hover:text-orange-500 transition-colors">
                    <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 16H6a2 2 0 01-2-2V6a2 2 0 012-2h8a2 2 0 012 2v2m-6 12h8a2 2 0 002-2v-8a2 2 0 00-2-2h-8a2 2 0 00-2 2v8a2 2 0 002 2z" />
                    </svg>
                  </button>
                  <button className="p-2 rounded-lg hover:bg-zinc-700 text-gray-400 hover:text-red-500 transition-colors">
                    <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
                    </svg>
                  </button>
                </div>
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Empty State */}
      {filteredQueries.length === 0 && (
        <div className="bg-zinc-800 border border-gray-700 rounded-xl p-12 text-center">
          <div className="w-16 h-16 bg-zinc-900 rounded-lg flex items-center justify-center mx-auto mb-4">
            <svg className="w-8 h-8 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 5a2 2 0 012-2h10a2 2 0 012 2v16l-7-3.5L5 21V5z" />
            </svg>
          </div>
          <h3 className="text-lg font-semibold text-white mb-2">No saved queries found</h3>
          <p className="text-sm text-gray-400 mb-4">Try adjusting your filters or create a new query</p>
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
