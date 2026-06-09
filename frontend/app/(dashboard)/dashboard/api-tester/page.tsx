'use client';

import { useState } from 'react';

interface TestResult {
  endpoint: string;
  method: string;
  status?: number;
  success: boolean;
  message: string;
  data?: any;
  headers?: any;
  error?: string;
  timestamp: string;
}

export default function APITesterPage() {
  const [apiUrl, setApiUrl] = useState('https://devapp.zendbx.in/api/rest/v1');
  const [anonKey, setAnonKey] = useState('');
  const [serviceKey, setServiceKey] = useState('');
  const [testResults, setTestResults] = useState<TestResult[]>([]);
  const [testing, setTesting] = useState(false);
  const [selectedKey, setSelectedKey] = useState<'anon' | 'service'>('anon');

  const addResult = (result: TestResult) => {
    setTestResults(prev => [result, ...prev]);
  };

  const testEndpoint = async (
    endpoint: string,
    method: string,
    keyType: 'anon' | 'service',
    body?: any
  ) => {
    const key = keyType === 'anon' ? anonKey : serviceKey;
    const fullUrl = `${apiUrl}${endpoint}`;
    
    try {
      const options: RequestInit = {
        method,
        headers: {
          'Content-Type': 'application/json',
          'apikey': key,
          'Authorization': `Bearer ${key}`
        }
      };

      if (body && (method === 'POST' || method === 'PUT' || method === 'PATCH')) {
        options.body = JSON.stringify(body);
      }

      const response = await fetch(fullUrl, options);
      const data = await response.json().catch(() => null);

      addResult({
        endpoint: fullUrl,
        method,
        status: response.status,
        success: response.ok,
        message: response.ok ? 'Request successful' : `Request failed with status ${response.status}`,
        data,
        headers: {
          'Content-Type': response.headers.get('content-type'),
          'X-Request-Id': response.headers.get('x-request-id')
        },
        timestamp: new Date().toISOString()
      });

      return response.ok;
    } catch (error: any) {
      addResult({
        endpoint: fullUrl,
        method,
        success: false,
        message: 'Request failed',
        error: error.message || String(error),
        timestamp: new Date().toISOString()
      });
      return false;
    }
  };

  const runAllTests = async () => {
    setTesting(true);
    setTestResults([]);

    const keyType = selectedKey;

    // Test 1: GET - List tables (should work with both keys)
    await testEndpoint('/', 'GET', keyType);

    // Test 2: GET - Query test_users table
    await testEndpoint('/test_users?select=*&limit=5', 'GET', keyType);

    // Test 3: POST - Insert test data (requires service_role key for RLS bypass)
    if (keyType === 'service') {
      await testEndpoint('/test_users', 'POST', keyType, {
        name: 'API Test User',
        email: `test${Date.now()}@example.com`
      });
    }

    // Test 4: Health check
    await testEndpoint('/health', 'GET', keyType);

    setTesting(false);
  };

  const testCustomEndpoint = async () => {
    const customEndpoint = prompt('Enter endpoint path (e.g., /test_users?select=*):');
    if (!customEndpoint) return;

    const method = prompt('Enter HTTP method (GET, POST, PUT, DELETE):', 'GET')?.toUpperCase() || 'GET';
    
    let body = null;
    if (method === 'POST' || method === 'PUT' || method === 'PATCH') {
      const bodyStr = prompt('Enter request body (JSON):');
      if (bodyStr) {
        try {
          body = JSON.parse(bodyStr);
        } catch (e) {
          alert('Invalid JSON body');
          return;
        }
      }
    }

    setTesting(true);
    await testEndpoint(customEndpoint, method, selectedKey, body);
    setTesting(false);
  };

  return (
    <div className="p-8 max-w-7xl mx-auto">
      <div className="mb-8">
        <h1 className="text-2xl font-bold text-white mb-2">API Key Tester</h1>
        <p className="text-gray-400 text-sm">
          Test your project API keys and endpoints to verify they work for third-party applications
        </p>
      </div>

      {/* Configuration Section */}
      <div className="bg-[#181818] border border-[#2a2a2a] rounded-lg p-6 mb-6">
        <h2 className="text-lg font-semibold text-white mb-4">Configuration</h2>
        
        <div className="space-y-4">
          <div>
            <label className="block text-sm font-medium text-gray-300 mb-2">
              API URL
            </label>
            <input
              type="text"
              value={apiUrl}
              onChange={(e) => setApiUrl(e.target.value)}
              className="w-full px-4 py-2 bg-[#1c1c1c] border border-[#2a2a2a] rounded text-white text-sm font-mono"
              placeholder="https://devapp.zendbx.in/api/rest/v1"
            />
            <p className="text-xs text-gray-500 mt-1">
              Get this from your project page
            </p>
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-300 mb-2">
              Anon Key (Public)
              <span className="ml-2 text-xs text-green-400">Safe for client-side</span>
            </label>
            <input
              type="password"
              value={anonKey}
              onChange={(e) => setAnonKey(e.target.value)}
              className="w-full px-4 py-2 bg-[#1c1c1c] border border-[#2a2a2a] rounded text-white text-sm font-mono"
              placeholder="eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9..."
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-300 mb-2">
              Service Role Key (Secret)
              <span className="ml-2 text-xs text-orange-400">Full access, keep private</span>
            </label>
            <input
              type="password"
              value={serviceKey}
              onChange={(e) => setServiceKey(e.target.value)}
              className="w-full px-4 py-2 bg-[#1c1c1c] border border-[#2a2a2a] rounded text-white text-sm font-mono"
              placeholder="eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9..."
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-300 mb-2">
              Test with which key?
            </label>
            <div className="flex gap-4">
              <label className="flex items-center cursor-pointer">
                <input
                  type="radio"
                  value="anon"
                  checked={selectedKey === 'anon'}
                  onChange={(e) => setSelectedKey(e.target.value as 'anon')}
                  className="mr-2"
                />
                <span className="text-sm text-gray-300">Anon Key</span>
              </label>
              <label className="flex items-center cursor-pointer">
                <input
                  type="radio"
                  value="service"
                  checked={selectedKey === 'service'}
                  onChange={(e) => setSelectedKey(e.target.value as 'service')}
                  className="mr-2"
                />
                <span className="text-sm text-gray-300">Service Role Key</span>
              </label>
            </div>
          </div>
        </div>
      </div>

      {/* Action Buttons */}
      <div className="flex gap-3 mb-6">
        <button
          onClick={runAllTests}
          disabled={testing || !anonKey || !apiUrl}
          className="px-6 py-3 bg-green-600 hover:bg-green-700 disabled:bg-gray-600 text-white rounded text-sm font-medium transition-colors"
        >
          {testing ? 'Testing...' : 'Run All Tests'}
        </button>
        
        <button
          onClick={testCustomEndpoint}
          disabled={testing || !anonKey || !apiUrl}
          className="px-6 py-3 bg-blue-600 hover:bg-blue-700 disabled:bg-gray-600 text-white rounded text-sm font-medium transition-colors"
        >
          Test Custom Endpoint
        </button>

        <button
          onClick={() => setTestResults([])}
          className="px-6 py-3 bg-gray-700 hover:bg-gray-600 text-white rounded text-sm font-medium transition-colors"
        >
          Clear Results
        </button>
      </div>

      {/* Test Results */}
      {testResults.length > 0 && (
        <div className="bg-[#181818] border border-[#2a2a2a] rounded-lg p-6">
          <h2 className="text-lg font-semibold text-white mb-4">
            Test Results ({testResults.length})
          </h2>
          
          <div className="space-y-4">
            {testResults.map((result, idx) => (
              <div
                key={idx}
                className={`border rounded-lg p-4 ${
                  result.success
                    ? 'bg-green-900/10 border-green-800'
                    : 'bg-red-900/10 border-red-800'
                }`}
              >
                <div className="flex items-center justify-between mb-3">
                  <div className="flex items-center gap-3">
                    <span className={`text-xs px-2 py-1 rounded font-mono ${
                      result.success ? 'bg-green-900/30 text-green-400' : 'bg-red-900/30 text-red-400'
                    }`}>
                      {result.status || 'ERROR'}
                    </span>
                    <span className="text-xs px-2 py-1 rounded font-mono bg-[#2a2a2a] text-gray-300">
                      {result.method}
                    </span>
                    <span className={`text-xs font-semibold ${
                      result.success ? 'text-green-400' : 'text-red-400'
                    }`}>
                      {result.success ? '✓ SUCCESS' : '✗ FAILED'}
                    </span>
                  </div>
                  <span className="text-xs text-gray-500">
                    {new Date(result.timestamp).toLocaleTimeString()}
                  </span>
                </div>

                <div className="mb-2">
                  <p className="text-sm text-gray-400 mb-1">Endpoint:</p>
                  <code className="text-xs text-gray-300 bg-[#1c1c1c] px-2 py-1 rounded font-mono break-all">
                    {result.endpoint}
                  </code>
                </div>

                <div className="mb-2">
                  <p className="text-sm font-medium text-gray-300">{result.message}</p>
                  {result.error && (
                    <p className="text-xs text-red-400 mt-1">Error: {result.error}</p>
                  )}
                </div>

                {result.data && (
                  <details className="mt-3">
                    <summary className="text-xs text-gray-400 cursor-pointer hover:text-gray-300">
                      View Response Data
                    </summary>
                    <pre className="mt-2 text-xs text-gray-300 bg-[#1c1c1c] p-3 rounded overflow-auto max-h-64 font-mono">
                      {JSON.stringify(result.data, null, 2)}
                    </pre>
                  </details>
                )}
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Instructions */}
      {testResults.length === 0 && !testing && (
        <div className="bg-blue-900/10 border border-blue-800 rounded-lg p-6">
          <h3 className="text-sm font-semibold text-blue-400 mb-3">📘 How to use</h3>
          <ol className="text-sm text-gray-300 space-y-2 list-decimal list-inside">
            <li>Go to your Projects page and copy the API URL</li>
            <li>Click "Reveal Keys" and copy the anon key and/or service role key</li>
            <li>Paste them into the fields above</li>
            <li>Select which key to test with (anon or service_role)</li>
            <li>Click "Run All Tests" to test common endpoints</li>
            <li>Or click "Test Custom Endpoint" to test specific endpoints</li>
          </ol>
          
          <div className="mt-4 pt-4 border-t border-blue-800">
            <h4 className="text-xs font-semibold text-blue-400 mb-2">Example Endpoints:</h4>
            <ul className="text-xs text-gray-400 space-y-1 font-mono">
              <li>GET /test_users?select=*&limit=10</li>
              <li>GET /test_users?select=name,email&id=eq.1</li>
              <li>POST /test_users (with body: {`{"name": "John", "email": "john@example.com"}`})</li>
              <li>PATCH /test_users?id=eq.1 (with body: {`{"name": "Jane"}`})</li>
              <li>DELETE /test_users?id=eq.1</li>
            </ul>
          </div>
        </div>
      )}
    </div>
  );
}
