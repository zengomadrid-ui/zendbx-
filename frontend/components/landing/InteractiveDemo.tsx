'use client';

import { useState } from 'react';
import Link from 'next/link';

const sampleQueries = [
  {
    label: 'Show all users created today',
    sql: 'SELECT id, email, name, created_at\nFROM users\nWHERE DATE(created_at) = CURRENT_DATE\nORDER BY created_at DESC;',
  },
  {
    label: 'Get products with price over 100',
    sql: 'SELECT id, name, price, category\nFROM products\nWHERE price > 100\nORDER BY price DESC;',
  },
  {
    label: 'List orders from last 7 days',
    sql: "SELECT id, customer_name, total, status, created_at\nFROM orders\nWHERE created_at >= CURRENT_DATE - INTERVAL '7 days'\nORDER BY created_at DESC;",
  },
  {
    label: 'Find users by email domain',
    sql: "SELECT id, email, name, provider\nFROM users\nWHERE email LIKE '%@gmail.com'\nLIMIT 10;",
  },
];

type MockRow = Record<string, string>;

interface MockResult {
  explanation: string;
  endpoint: string;
  rows: MockRow[];
}

const mockResults: Record<string, MockResult> = {
  'Show all users created today': {
    explanation: 'Retrieves all users created today by filtering created_at to the current date.',
    endpoint: '/api/v1/users?created_at=today',
    rows: [
      { id: '1234', email: 'john@example.com', name: 'John Doe', created_at: '2026-06-10 14:23:15' },
      { id: '1235', email: 'jane@example.com', name: 'Jane Smith', created_at: '2026-06-10 13:45:22' },
      { id: '1236', email: 'bob@example.com', name: 'Bob Wilson', created_at: '2026-06-10 12:10:08' },
    ],
  },
  'Get products with price over 100': {
    explanation: 'Filters products with a price greater than 100, sorted by price descending.',
    endpoint: '/api/v1/products?price=gt.100&order=price.desc',
    rows: [
      { id: '501', name: 'Premium Laptop', price: '$1,299.99', category: 'Electronics' },
      { id: '502', name: 'Wireless Headphones', price: '$249.99', category: 'Audio' },
      { id: '503', name: 'Smart Watch', price: '$199.99', category: 'Wearables' },
    ],
  },
  'List orders from last 7 days': {
    explanation: 'Retrieves all orders placed within the last 7 days.',
    endpoint: '/api/v1/orders?created_at=gte.7days',
    rows: [
      { id: '9001', customer_name: 'Alice Johnson', total: '$459.99', status: 'Shipped', created_at: '2026-06-09' },
      { id: '9002', customer_name: 'Mike Brown', total: '$129.50', status: 'Processing', created_at: '2026-06-08' },
      { id: '9003', customer_name: 'Sarah Davis', total: '$899.00', status: 'Delivered', created_at: '2026-06-07' },
    ],
  },
  'Find users by email domain': {
    explanation: 'Searches for users with Gmail addresses using pattern matching, returning up to 10 results.',
    endpoint: '/api/v1/users?email=like.*@gmail.com&limit=10',
    rows: [
      { id: '7701', email: 'alex@gmail.com', name: 'Alex Turner', provider: 'email' },
      { id: '7702', email: 'emma@gmail.com', name: 'Emma Wilson', provider: 'google' },
      { id: '7703', email: 'chris@gmail.com', name: 'Chris Martin', provider: 'email' },
    ],
  },
};

export default function InteractiveDemo() {
  const [query, setQuery] = useState('');
  const [selectedExample, setSelectedExample] = useState('');
  const [isExecuting, setIsExecuting] = useState(false);
  const [hasExecuted, setHasExecuted] = useState(false);
  const [result, setResult] = useState<MockRow[] | null>(null);
  const [apiUrl, setApiUrl] = useState('');
  const [explanation, setExplanation] = useState('');

  const handleExampleClick = (example: (typeof sampleQueries)[0]) => {
    setQuery(example.sql);
    setSelectedExample(example.label);
    setHasExecuted(false);
    setResult(null);
    setApiUrl('');
    setExplanation('');
  };

  const handleExecute = () => {
    if (!query.trim()) return;
    setIsExecuting(true);
    setHasExecuted(false);
    setTimeout(() => {
      const mockData = mockResults[selectedExample] || mockResults['Show all users created today'];
      setResult(mockData.rows);
      setApiUrl(mockData.endpoint);
      setExplanation(mockData.explanation);
      setIsExecuting(false);
      setHasExecuted(true);
    }, 1200);
  };

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
      <div className="absolute inset-0 bg-[linear-gradient(to_right,#ea580c08_1px,transparent_1px),linear-gradient(to_bottom,#ea580c08_1px,transparent_1px)] bg-[size:40px_40px]" />
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 relative z-10">
        <div className="text-center mb-12">
          <span className="px-4 py-2 bg-orange-600/20 border border-orange-500/30 rounded-full text-sm font-semibold text-orange-300">
            Interactive Demo
          </span>
          <h2 className="text-4xl sm:text-5xl font-bold mt-4 mb-4">
            <span className="text-white">See It In </span>
            <span className="bg-gradient-to-r from-orange-400 to-orange-600 bg-clip-text text-transparent">Action</span>
          </h2>
          <p className="text-xl text-gray-400">Watch how queries become instant APIs</p>
        </div>

        <div className="max-w-6xl mx-auto">
          <div className="relative bg-black rounded-2xl shadow-2xl border-2 border-orange-500/30 overflow-hidden">
            {/* Window chrome */}
            <div className="bg-zinc-900 px-6 py-4 border-b-2 border-orange-500/30 flex items-center justify-between">
              <div className="flex items-center space-x-2">
                <div className="w-3 h-3 rounded-full bg-red-500" />
                <div className="w-3 h-3 rounded-full bg-yellow-500" />
                <div className="w-3 h-3 rounded-full bg-green-500" />
              </div>
              <div className="flex items-center gap-2">
                <div className="w-2 h-2 rounded-full bg-orange-500 animate-pulse" />
                <span className="text-sm font-semibold text-orange-400">Live Demo</span>
              </div>
            </div>

            {/* Editor */}
            <div className="p-8 bg-black">
              <div className="flex items-center justify-between mb-3">
                <label className="text-sm font-semibold text-orange-400 uppercase tracking-wider">SQL Query Editor:</label>
                <button
                  onClick={handleExecute}
                  disabled={!query.trim() || isExecuting}
                  className="px-6 py-2.5 bg-gradient-to-r from-orange-600 to-orange-500 text-white rounded-lg font-semibold hover:from-orange-500 hover:to-orange-400 transition-all disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  {isExecuting ? 'Executing...' : 'Execute Query'}
                </button>
              </div>
              <textarea
                value={query}
                onChange={(e) => handleQueryChange(e.target.value)}
                placeholder="Write your SQL query here or select an example below..."
                className="w-full h-40 px-4 py-4 bg-zinc-950 border-2 border-orange-500/30 text-gray-300 rounded-xl focus:outline-none focus:ring-2 focus:ring-orange-500 placeholder-gray-600 font-mono text-sm resize-none"
              />
              <div className="mt-4">
                <p className="text-xs text-gray-500 mb-3 uppercase tracking-wider">Quick Examples:</p>
                <div className="grid grid-cols-2 gap-2">
                  {sampleQueries.map((example) => (
                    <button
                      key={example.label}
                      onClick={() => handleExampleClick(example)}
                      className={`px-4 py-2.5 bg-zinc-950 border-2 ${
                        selectedExample === example.label ? 'border-orange-500 text-orange-400' : 'border-orange-500/20 text-gray-400'
                      } hover:border-orange-500/50 hover:text-orange-400 text-sm rounded-lg transition-all text-left`}
                    >
                      {example.label}
                    </button>
                  ))}
                </div>
              </div>
            </div>

            {/* Results */}
            {hasExecuted && !isExecuting && (
              <div className="border-t-2 border-orange-500/20">
                <div className="px-8 py-6 bg-zinc-950">
                  <p className="text-xs font-bold text-orange-400 uppercase tracking-wider mb-3">Generated SQL</p>
                  <pre className="text-sm text-orange-300 font-mono bg-black p-4 rounded-lg border-2 border-orange-500/20 overflow-x-auto">
                    {query}
                  </pre>
                </div>
                <div className="px-8 py-6 bg-black border-t-2 border-orange-500/20">
                  <p className="text-xs font-bold text-orange-400 uppercase tracking-wider mb-3">Auto-Generated REST API</p>
                  <div className="bg-zinc-950 p-4 rounded-lg border-2 border-orange-500/30 font-mono text-sm flex items-center gap-3 flex-wrap">
                    <span className="px-2 py-1 bg-green-500/20 text-green-400 rounded font-bold text-xs">GET</span>
                    <span className="text-orange-400">https://api.zendbx.com/v1/your-project</span>
                    <span className="text-gray-400">{apiUrl}</span>
                  </div>
                </div>
                <div className="px-8 py-6 bg-zinc-950 border-t-2 border-orange-500/20">
                  <p className="text-xs font-bold text-orange-400 uppercase tracking-wider mb-2">AI Explanation</p>
                  <p className="text-sm text-gray-300">{explanation}</p>
                </div>
                {result && result.length > 0 && (
                  <div className="px-8 py-6 bg-black border-t-2 border-orange-500/20">
                    <p className="text-xs font-bold text-orange-400 uppercase tracking-wider mb-4">
                      Query Results ({result.length} rows)
                    </p>
                    <div className="overflow-x-auto">
                      <table className="min-w-full border-2 border-orange-500/20 rounded-xl overflow-hidden">
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
                          {result.map((row, i) => (
                            <tr key={i} className="hover:bg-zinc-900 transition-colors">
                              {Object.values(row).map((value, j) => (
                                <td key={j} className="px-6 py-4 whitespace-nowrap text-sm text-gray-300">{value}</td>
                              ))}
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
                  </div>
                )}
              </div>
            )}

            {/* Empty state */}
            {!hasExecuted && !isExecuting && !query && (
              <div className="px-8 py-12 bg-zinc-950 border-t-2 border-orange-500/20 text-center text-gray-500">
                <p className="text-lg font-semibold text-gray-400 mb-2">No query executed yet</p>
                <p className="text-sm">Select an example or write your own SQL query, then click Execute</p>
              </div>
            )}
          </div>

          <div className="mt-12 text-center">
            <p className="text-gray-400 mb-6 text-lg">Ready to turn your data into instant APIs?</p>
            <Link
              href="/signup"
              className="inline-block px-10 py-4 bg-gradient-to-r from-orange-600 to-orange-500 text-white rounded-xl font-bold text-lg hover:from-orange-500 hover:to-orange-400 transition-all shadow-2xl shadow-orange-500/40"
            >
              Start Building Free →
            </Link>
            <p className="mt-4 text-sm text-gray-500">No credit card • 2 free projects • Setup in 30 seconds</p>
          </div>
        </div>
      </div>
    </section>
  );
}
