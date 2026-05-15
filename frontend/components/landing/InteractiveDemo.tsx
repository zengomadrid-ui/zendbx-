'use client';

import { useState } from 'react';
import Link from 'next/link';

const sampleQueries = [
  {
    label: 'Show all users created today',
    sql: `SELECT id, email, name, created_at
FROM users
WHERE DATE(created_at) = CURRENT_DATE
ORDER BY created_at DESC;`
  },
  {
    label: 'Get products with price > $100',
    sql: `SELECT id, name, price, category
FROM products
WHERE price > 100
ORDER BY price DESC;`
  },
  {
    label: 'List orders from last 7 days',
    sql: `SELECT id, customer_name, total, status, created_at
FROM orders
WHERE created_at >= CURRENT_DATE - INTERVAL '7 days'
ORDER BY created_at DESC;`
  },
  {
    label: 'Find users by email domain',
    sql: `SELECT id, email, name, provider
FROM users
WHERE email LIKE '%@gmail.com'
LIMIT 10;`
  }
];

const mockResults: Record<string, any> = {
  'Show all users created today': {
    explanation: 'This query retrieves all users created today by filtering the created_at timestamp to match the current date, returning their ID, email, name, and creation time in descending order.',
    endpoint: '/api/v1/users?created_at=today',
    rows: [
      { id: '1234', email: 'john@example.com', name: 'John Doe', created_at: '2026-04-10 14:23:15' },
      { id: '1235', email: 'jane@example.com', name: 'Jane Smith', created_at: '2026-04-10 13:45:22' },
      { id: '1236', email: 'bob@example.com', name: 'Bob Wilson', created_at: '2026-04-10 12:10:08' },
    ]
  },
  'Get products with price > $100': {
    explanation: 'This query filters products with a price greater than $100, returning their details sorted by price from highest to lowest.',
    endpoint: '/api/v1/products?price=gt.100&order=price.desc',
    rows: [
      { id: '501', name: 'Premium Laptop', price: '$1,299.99', category: 'Electronics' },
      { id: '502', name: 'Wireless Headphones', price: '$249.99', category: 'Audio' },
      { id: '503', name: 'Smart Watch', price: '$199.99', category: 'Wearables' },
    ]
  },
  'List orders from last 7 days': {
    explanation: 'This query retrieves all orders placed within the last 7 days, showing customer information, order total, status, and timestamp.',
    endpoint: '/api/v1/orders?created_at=gte.7days',
    rows: [
      { id: '9001', customer_name: 'Alice Johnson', total: '$459.99', status: 'Shipped', created_at: '2026-04-09' },
      { id: '9002', customer_name: 'Mike Brown', total: '$129.50', status: 'Processing', created_at: '2026-04-08' },
      { id: '9003', customer_name: 'Sarah Davis', total: '$899.00', status: 'Delivered', created_at: '2026-04-07' },
    ]
  },
  'Find users by email domain': {
    explanation: 'This query searches for users with Gmail email addresses using pattern matching, returning up to 10 results with their authentication provider.',
    endpoint: '/api/v1/users?email=like.*@gmail.com&limit=10',
    rows: [
      { id: '7701', email: 'alex@gmail.com', name: 'Alex Turner', provider: 'email' },
      { id: '7702', email: 'emma@gmail.com', name: 'Emma Wilson', provider: 'google' },
      { id: '7703', email: 'chris@gmail.com', name: 'Chris Martin', provider: 'email' },
    ]
  }
};

export default function InteractiveDemo() {
  // State management
  const [query, setQuery] = useState('');
  const [selectedExample, setSelectedExample] = useState('');
  const [isExecuting, setIsExecuting] = useState(false);
  const [hasExecuted, setHasExecuted] = useState(false);
  const [result, setResult] = useState<any>(null);
  const [apiUrl, setApiUrl] = useState('');
  const [explanation, setExplanation] = useState('');

  // Handle example click - ONLY populate editor
  const handleExampleClick = (example: typeof sampleQueries[0]) => {
    setQuery(example.sql);
    setSelectedExample(example.label);
    // Clear previous results
    setHasExecuted(false);
    setResult(null);
    setApiUrl('');
    setExplanation('');
  };

  // Handle execute - Show loading then results
  const handleExecute = async () => {
    if (!query.trim()) return;

    setIsExecuting(true);
    setHasExecuted(false);

    // Simulate API call
    setTimeout(() => {
      const mockData = mockResults[selectedExample] || mockResults['Show all users created today'];
      
      setResult(mockData.rows);
      setApiUrl(mockData.endpoint);
      setExplanation(mockData.explanation);
      setIsExecuting(false);
      setHasExecuted(true);
    }, 1200);
  };

  // Handle query change - Clear results if user edits
  const handleQueryChange = (value: string) => {
    setQuery(value);
    if (hasExecuted) {
      setHasExecuted(false);
      setResult(null);
      setApiUrl('');
      setExplanation('');
    }
  };

  return (
    <section id="demo" className="py-24 bg-black relative overflow-hidden">
      {/* Background decoration */}
      <div className="absolute inset-0 bg-[linear-gradient(to_right,#ea580c08_1px,transparent_1px),linear-gradient(to_bottom,#ea580c08_1px,transparent_1px)] bg-[size:40px_40px]" />
      <div className="absolute top-1/2 left-1/4 w-96 h-96 bg-orange-600 rounded-full mix-blend-screen filter blur-[120px] opacity-20" />
      
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 relative z-10">
        <div className="text-center mb-12">
          <div className="inline-block mb-4">
            <span className="px-4 py-2 bg-gradient-to-r from-orange-600/20 to-orange-500/20 border border-orange-500/30 rounded-full text-sm font-semibold text-orange-300 backdrop-blur-sm">
              Interactive Demo
            </span>
          </div>
          <h2 className="text-4xl sm:text-5xl font-bold mb-4">
            <span className="text-white">See It In</span>
            <br />
            <span className="bg-gradient-to-r from-orange-400 to-orange-600 bg-clip-text text-transparent">
              Action
            </span>
          </h2>
          <p className="text-xl text-gray-400">
            Watch how queries become instant APIs
          </p>
        </div>

        <div className="max-w-6xl mx-auto">
          <div className="relative">
            {/* Glow effect */}
            <div className="absolute -inset-2 bg-gradient-to-r from-orange-600 to-orange-500 rounded-3xl blur-3xl opacity-30" />
            
            <div className="relative bg-black rounded-2xl shadow-2xl border-2 border-orange-500/30 overflow-hidden">
              {/* Demo Header */}
              <div className="bg-gradient-to-r from-zinc-900 to-black px-6 py-4 border-b-2 border-orange-500/30">
                <div className="flex items-center justify-between">
                  <div className="flex items-center space-x-2">
                    <div className="w-3 h-3 rounded-full bg-red-500 shadow-lg shadow-red-500/50" />
                    <div className="w-3 h-3 rounded-full bg-yellow-500 shadow-lg shadow-yellow-500/50" />
                    <div className="w-3 h-3 rounded-full bg-green-500 shadow-lg shadow-green-500/50" />
                  </div>
                  <div className="flex items-center gap-2">
                    <div className="w-2 h-2 rounded-full bg-orange-500 animate-pulse shadow-lg shadow-orange-500/50" />
                    <span className="text-sm font-semibold text-orange-400">Live Demo</span>
                  </div>
                </div>
              </div>

              {/* Query Input */}
              <div className="p-8 bg-black">
                <div className="flex items-center justify-between mb-3">
                  <label className="block text-sm font-semibold text-orange-400 uppercase tracking-wider">
                    SQL Query Editor:
                  </label>
                  <button
                    onClick={handleExecute}
                    disabled={!query.trim() || isExecuting}
                    className="px-6 py-2.5 bg-gradient-to-r from-orange-600 to-orange-500 text-white rounded-lg font-semibold hover:from-orange-500 hover:to-orange-400 transition-all disabled:opacity-50 disabled:cursor-not-allowed shadow-lg shadow-orange-500/30 flex items-center gap-2"
                  >
                    {isExecuting ? (
                      <>
                        <svg className="animate-spin h-4 w-4" fill="none" viewBox="0 0 24 24">
                          <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                          <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                        </svg>
                        Executing...
                      </>
                    ) : (
                      <>
                        <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M14.752 11.168l-3.197-2.132A1 1 0 0010 9.87v4.263a1 1 0 001.555.832l3.197-2.132a1 1 0 000-1.664z" />
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                        </svg>
                        Execute Query
                      </>
                    )}
                  </button>
                </div>
                
                <div className="relative">
                  <textarea
                    value={query}
                    onChange={(e) => handleQueryChange(e.target.value)}
                    placeholder="Write your SQL query here or select an example below..."
                    className="w-full h-40 px-4 py-4 bg-zinc-950 border-2 border-orange-500/30 text-gray-300 rounded-xl focus:outline-none focus:ring-2 focus:ring-orange-500 focus:border-orange-500 placeholder-gray-600 font-mono text-sm resize-none"
                  />
                </div>

                {/* Example Queries */}
                <div className="mt-4">
                  <p className="text-xs text-gray-500 mb-3 uppercase tracking-wider">Quick Examples (Click to load):</p>
                  <div className="grid grid-cols-2 gap-2">
                    {sampleQueries.map((example) => (
                      <button
                        key={example.label}
                        onClick={() => handleExampleClick(example)}
                        className={`px-4 py-2.5 bg-zinc-950 hover:bg-zinc-900 border-2 ${
                          selectedExample === example.label ? 'border-orange-500 text-orange-400' : 'border-orange-500/20 text-gray-400'
                        } hover:border-orange-500/50 hover:text-orange-400 text-sm rounded-lg transition-all text-left`}
                      >
                        {example.label}
                      </button>
                    ))}
                  </div>
                </div>
              </div>

              {/* Loading State */}
              {isExecuting && (
                <div className="px-8 py-12 bg-zinc-950 border-t-2 border-orange-500/20">
                  <div className="flex flex-col items-center justify-center gap-4">
                    <svg className="animate-spin h-12 w-12 text-orange-500" fill="none" viewBox="0 0 24 24">
                      <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                      <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                    </svg>
                    <p className="text-orange-400 font-semibold">Executing query...</p>
                    <p className="text-gray-500 text-sm">Generating SQL, API endpoint, and fetching results</p>
                  </div>
                </div>
              )}

              {/* Results Section - ONLY SHOW IF hasExecuted === true */}
              {hasExecuted && !isExecuting && (
                <div className="animate-slide-up">
                  {/* Generated SQL */}
                  <div className="px-8 py-6 bg-zinc-950 border-t-2 border-orange-500/20">
                    <div className="flex items-center justify-between mb-4">
                      <span className="text-xs font-bold text-orange-400 uppercase tracking-wider flex items-center gap-2">
                        <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10 20l4-16m4 4l4 4-4 4M6 16l-4-4 4-4" />
                        </svg>
                        Generated SQL
                      </span>
                      <button className="text-xs text-gray-500 hover:text-orange-400 transition-colors flex items-center gap-1.5 px-3 py-1.5 bg-zinc-900 rounded-lg border border-orange-500/20 hover:border-orange-500/50">
                        <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 16H6a2 2 0 01-2-2V6a2 2 0 012-2h8a2 2 0 012 2v2m-6 12h8a2 2 0 002-2v-8a2 2 0 00-2-2h-8a2 2 0 00-2 2v8a2 2 0 002 2z" />
                        </svg>
                        Copy SQL
                      </button>
                    </div>
                    <pre className="text-sm text-gray-300 font-mono overflow-x-auto bg-black p-4 rounded-lg border-2 border-orange-500/20">
                      <code className="text-orange-300">{query}</code>
                    </pre>
                  </div>

                  {/* Auto-Generated API Endpoint */}
                  <div className="px-8 py-6 bg-black border-t-2 border-orange-500/20">
                    <div className="flex items-center justify-between mb-4">
                      <span className="text-xs font-bold text-orange-400 uppercase tracking-wider flex items-center gap-2">
                        <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 10V3L4 14h7v7l9-11h-7z" />
                        </svg>
                        Auto-Generated REST API
                      </span>
                      <button className="text-xs text-gray-500 hover:text-orange-400 transition-colors flex items-center gap-1.5 px-3 py-1.5 bg-zinc-950 rounded-lg border border-orange-500/20 hover:border-orange-500/50">
                        <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 16H6a2 2 0 01-2-2V6a2 2 0 012-2h8a2 2 0 012 2v2m-6 12h8a2 2 0 002-2v-8a2 2 0 00-2-2h-8a2 2 0 00-2 2v8a2 2 0 002 2z" />
                        </svg>
                        Copy URL
                      </button>
                    </div>
                    <div className="bg-zinc-950 p-4 rounded-lg border-2 border-orange-500/30 font-mono text-sm">
                      <div className="flex items-center gap-3 flex-wrap">
                        <span className="px-2 py-1 bg-green-500/20 text-green-400 rounded font-bold text-xs">GET</span>
                        <span className="text-orange-400">https://api.zendbx.com/v1/your-project</span>
                        <span className="text-gray-400">{apiUrl}</span>
                      </div>
                    </div>
                  </div>

                  {/* AI Explanation */}
                  <div className="px-8 py-6 bg-gradient-to-br from-orange-600/10 to-orange-500/5 border-t-2 border-orange-500/30">
                    <div className="flex items-start gap-3">
                      <div className="flex-shrink-0 w-8 h-8 bg-gradient-to-br from-orange-600 to-orange-500 rounded-lg flex items-center justify-center shadow-lg shadow-orange-500/30">
                        <svg className="w-5 h-5 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                        </svg>
                      </div>
                      <div>
                        <h4 className="text-sm font-bold text-orange-400 mb-2 uppercase tracking-wider">AI Explanation</h4>
                        <p className="text-sm text-gray-300 leading-relaxed">
                          {explanation}
                        </p>
                      </div>
                    </div>
                  </div>

                  {/* Results Table */}
                  <div className="px-8 py-6 bg-black border-t-2 border-orange-500/20">
                    <div className="flex items-center justify-between mb-4">
                      <h4 className="text-sm font-bold text-orange-400 uppercase tracking-wider flex items-center gap-2">
                        <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 19v-6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2a2 2 0 002-2zm0 0V9a2 2 0 012-2h2a2 2 0 012 2v10m-6 0a2 2 0 002 2h2a2 2 0 002-2m0 0V5a2 2 0 012-2h2a2 2 0 012 2v14a2 2 0 01-2 2h-2a2 2 0 01-2-2z" />
                        </svg>
                        Query Results ({result?.length || 0} rows)
                      </h4>
                      <button className="text-sm text-orange-400 hover:text-orange-300 font-semibold flex items-center gap-1.5 px-3 py-1.5 bg-zinc-950 rounded-lg border border-orange-500/30 hover:border-orange-500/50 transition-all">
                        <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 10v6m0 0l-3-3m3 3l3-3m2 8H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
                        </svg>
                        Export CSV
                      </button>
                    </div>
                    {result && result.length > 0 && (
                      <div className="overflow-x-auto">
                        <table className="min-w-full divide-y-2 divide-orange-500/20 border-2 border-orange-500/20 rounded-xl overflow-hidden">
                          <thead className="bg-zinc-950">
                            <tr>
                              {Object.keys(result[0]).map((key) => (
                                <th key={key} className="px-6 py-4 text-left text-xs font-bold text-orange-400 uppercase tracking-wider">
                                  {key.replace('_', ' ')}
                                </th>
                              ))}
                            </tr>
                          </thead>
                          <tbody className="bg-zinc-950 divide-y divide-orange-500/10">
                            {result.map((row: any, i: number) => (
                              <tr key={i} className="hover:bg-zinc-900 transition-colors">
                                {Object.values(row).map((value: any, j: number) => (
                                  <td key={j} className="px-6 py-4 whitespace-nowrap text-sm text-gray-300">
                                    {value}
                                  </td>
                                ))}
                              </tr>
                            ))}
                          </tbody>
                        </table>
                      </div>
                    )}
                    <div className="mt-4 flex items-center justify-between text-xs">
                      <span className="flex items-center gap-2 text-gray-500">
                        <div className="flex items-center gap-1.5 px-3 py-1.5 bg-zinc-950 rounded-lg border border-orange-500/20">
                          <svg className="w-4 h-4 text-orange-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 10V3L4 14h7v7l9-11h-7z" />
                          </svg>
                          <span className="text-orange-400 font-semibold">Executed in 0.12s</span>
                        </div>
                      </span>
                      <span className="text-gray-500">Showing {result?.length || 0} of {result?.length || 0} rows</span>
                    </div>
                  </div>
                </div>
              )}

              {/* Empty State - Show when no query executed */}
              {!hasExecuted && !isExecuting && !query && (
                <div className="px-8 py-12 bg-zinc-950 border-t-2 border-orange-500/20">
                  <div className="text-center text-gray-500">
                    <svg className="w-16 h-16 mx-auto mb-4 text-orange-500/30" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
                    </svg>
                    <p className="text-lg font-semibold text-gray-400 mb-2">No query executed yet</p>
                    <p className="text-sm text-gray-500">Select an example or write your own SQL query, then click Execute</p>
                  </div>
                </div>
              )}
            </div>
          </div>

          {/* CTA below demo */}
          <div className="mt-12 text-center">
            <p className="text-gray-400 mb-6 text-lg">
              Ready to turn your data into instant APIs?
            </p>
            <Link
              href="/signup"
              className="inline-block px-10 py-4 bg-gradient-to-r from-orange-600 to-orange-500 text-white rounded-xl font-bold text-lg hover:from-orange-500 hover:to-orange-400 transition-all shadow-2xl shadow-orange-500/40 hover:shadow-orange-500/60 transform hover:-translate-y-1"
            >
              Start Building Free →
            </Link>
            <p className="mt-4 text-sm text-gray-500">
              No credit card • 2 free projects • Setup in 30 seconds
            </p>
          </div>
        </div>
      </div>
    </section>
  );
}
