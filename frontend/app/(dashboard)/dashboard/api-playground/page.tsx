'use client';

import { apiFetch, getApiUrl } from '@/lib/fetch-utils';
import { useState, useEffect } from 'react';

interface Project {
  id: string;
  name: string;
  slug: string;
}

interface APIKey {
  id: string;
  name: string;
  key: string;
  key_prefix: string;
}

export default function APIPlaygroundPage() {
  const [projects, setProjects] = useState<Project[]>([]);
  const [selectedProject, setSelectedProject] = useState<string>('');
  const [apiKeys, setApiKeys] = useState<APIKey[]>([]);
  const [selectedKey, setSelectedKey] = useState<string>('');
  const [tables, setTables] = useState<string[]>([]);
  const [selectedTable, setSelectedTable] = useState<string>('');
  const [loadingProjects, setLoadingProjects] = useState(true);
  
  // Request configuration
  const [method, setMethod] = useState<'GET' | 'POST' | 'PUT' | 'DELETE'>('GET');
  const [endpoint, setEndpoint] = useState('');
  const [requestBody, setRequestBody] = useState('{\n  \n}');
  const [queryParams, setQueryParams] = useState('');
  
  // Response
  const [loading, setLoading] = useState(false);
  const [response, setResponse] = useState<any>(null);
  const [responseTime, setResponseTime] = useState<number>(0);
  const [statusCode, setStatusCode] = useState<number>(0);
  const [error, setError] = useState<string>('');

  useEffect(() => {
    fetchProjects();
  }, []);

  useEffect(() => {
    if (selectedProject) {
      fetchAPIKeys();
      fetchTables();
    }
  }, [selectedProject]);

  useEffect(() => {
    if (selectedTable && selectedProject) {
      const project = projects.find(p => p.id === selectedProject);
      if (project) {
        setEndpoint(`/p/${project.slug}/${selectedTable}`);
      }
    }
  }, [selectedTable, selectedProject, projects]);

  const fetchProjects = async () => {
    setLoadingProjects(true);
    try {
      const token = localStorage.getItem('token');
      const res = await fetch(`${API_URL}/api/projects`, {
        headers: { 'Authorization': `Bearer ${token}` }
      });
      
      if (!res.ok) {
        throw new Error('Failed to fetch projects');
      }
      
      const data = await res.json();
      console.log('Projects response:', data);
      
      // Handle both array and object with projects property
      const projectsList = Array.isArray(data) ? data : (data.projects || []);
      
      setProjects(projectsList);
      if (projectsList.length > 0) {
        setSelectedProject(projectsList[0].id);
      }
    } catch (err) {
      console.error('Failed to fetch projects:', err);
      setError('Failed to load projects. Please refresh the page.');
    } finally {
      setLoadingProjects(false);
    }
  };

  const fetchAPIKeys = async () => {
    try {
      const token = localStorage.getItem('token');
      const res = await fetch(`${API_URL}/api/projects/${selectedProject}/api-keys`, {
        headers: { 'Authorization': `Bearer ${token}` }
      });
      
      if (!res.ok) {
        throw new Error('Failed to fetch API keys');
      }
      
      const data = await res.json();
      console.log('API Keys response:', data);
      
      setApiKeys(data.keys || []);
      if (data.keys && data.keys.length > 0) {
        setSelectedKey(data.keys[0].key || data.keys[0].key_prefix);
      }
    } catch (err) {
      console.error('Failed to fetch API keys:', err);
      setError('Failed to load API keys.');
    }
  };

  const fetchTables = async () => {
    try {
      const token = localStorage.getItem('token');
      const res = await fetch(`${API_URL}/api/projects/${selectedProject}/tables`, {
        headers: { 'Authorization': `Bearer ${token}` }
      });
      
      if (!res.ok) {
        throw new Error('Failed to fetch tables');
      }
      
      const data = await res.json();
      console.log('Tables response:', data);
      
      // Handle both array and object with tables property
      const tablesList = Array.isArray(data) ? data : (data.tables || []);
      
      setTables(tablesList.map((t: any) => t.table_name));
    } catch (err) {
      console.error('Failed to fetch tables:', err);
    }
  };

  const sendRequest = async () => {
    if (!selectedKey) {
      setError('Please select an API key');
      return;
    }

    setLoading(true);
    setError('');
    setResponse(null);

    const startTime = performance.now();

    try {
      const url = `${API_URL}${endpoint}${queryParams ? '?' + queryParams : ''}`;
      
      const options: RequestInit = {
        method,
        headers: {
          'x-api-key': selectedKey,
          'Content-Type': 'application/json'
        }
      };

      if (method !== 'GET' && method !== 'DELETE') {
        options.body = requestBody;
      }

      const res = await fetch(url, options);
      const endTime = performance.now();
      setResponseTime(Math.round(endTime - startTime));
      setStatusCode(res.status);

      const data = await res.json();
      setResponse(data);

      if (!res.ok) {
        setError(data.detail || 'Request failed');
      }
    } catch (err: any) {
      const endTime = performance.now();
      setResponseTime(Math.round(endTime - startTime));
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  const loadExample = (example: string) => {
    switch (example) {
      case 'list':
        setMethod('GET');
        setQueryParams('limit=10&offset=0');
        setRequestBody('');
        break;
      case 'filter':
        setMethod('GET');
        setQueryParams('status=active&limit=20');
        setRequestBody('');
        break;
      case 'create':
        setMethod('POST');
        setQueryParams('');
        setRequestBody('{\n  "name": "New Item",\n  "status": "active"\n}');
        break;
      case 'update':
        setMethod('PUT');
        setQueryParams('');
        setRequestBody('{\n  "status": "inactive"\n}');
        break;
      case 'delete':
        setMethod('DELETE');
        setQueryParams('');
        setRequestBody('');
        break;
    }
  };

  return (
    <div className="h-full flex flex-col bg-[#0a0a0a]">
      {/* Header */}
      <div className="p-6 border-b border-[#2a2a2a]">
        <h1 className="text-2xl font-bold bg-gradient-to-r from-purple-400 to-orange-400 bg-clip-text text-transparent mb-2">
          API Playground
        </h1>
        <p className="text-sm text-[#a1a1a1]">Test your auto-generated REST API</p>
      </div>

      <div className="flex-1 flex overflow-hidden">
        {/* Left Panel - Request */}
        <div className="flex-1 flex flex-col border-r border-[#2a2a2a] overflow-auto">
          {/* Configuration */}
          <div className="p-6 space-y-4">
            {/* Project & API Key Selection */}
            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className="block text-xs font-medium text-[#ededed] mb-2">Project</label>
                <select
                  value={selectedProject}
                  onChange={(e) => setSelectedProject(e.target.value)}
                  disabled={loadingProjects || projects.length === 0}
                  className="w-full px-3 py-2 bg-[#1c1c1c] border border-[#2a2a2a] rounded text-sm text-[#ededed] focus:outline-none focus:border-orange-600 disabled:opacity-50"
                >
                  {loadingProjects && <option>Loading projects...</option>}
                  {!loadingProjects && projects.length === 0 && <option>No projects found</option>}
                  {projects.map(p => (
                    <option key={p.id} value={p.id}>{p.name}</option>
                  ))}
                </select>
                {!loadingProjects && projects.length === 0 && (
                  <p className="text-xs text-red-400 mt-1">
                    Please create a project first in the Projects page
                  </p>
                )}
              </div>

              <div>
                <label className="block text-xs font-medium text-[#ededed] mb-2">API Key</label>
                <select
                  value={selectedKey}
                  onChange={(e) => setSelectedKey(e.target.value)}
                  disabled={apiKeys.length === 0}
                  className="w-full px-3 py-2 bg-[#1c1c1c] border border-[#2a2a2a] rounded text-sm text-[#ededed] focus:outline-none focus:border-orange-600 disabled:opacity-50"
                >
                  {apiKeys.length === 0 && <option>No API keys found</option>}
                  {apiKeys.map(k => (
                    <option key={k.id} value={k.key || k.key_prefix}>
                      {k.name} ({k.key_prefix})
                    </option>
                  ))}
                </select>
                {apiKeys.length === 0 && selectedProject && (
                  <p className="text-xs text-red-400 mt-1">
                    No API keys found for this project
                  </p>
                )}
              </div>
            </div>

            {/* Table Selection */}
            <div>
              <label className="block text-xs font-medium text-[#ededed] mb-2">Table (Optional)</label>
              <select
                value={selectedTable}
                onChange={(e) => setSelectedTable(e.target.value)}
                className="w-full px-3 py-2 bg-[#1c1c1c] border border-[#2a2a2a] rounded text-sm text-[#ededed] focus:outline-none focus:border-orange-600"
              >
                <option value="">Select a table...</option>
                {tables.map(t => (
                  <option key={t} value={t}>{t}</option>
                ))}
              </select>
            </div>

            {/* Quick Examples */}
            <div>
              <label className="block text-xs font-medium text-[#ededed] mb-2">Quick Examples</label>
              <div className="flex flex-wrap gap-2">
                {[
                  { label: 'List All', value: 'list' },
                  { label: 'Filter', value: 'filter' },
                  { label: 'Create', value: 'create' },
                  { label: 'Update', value: 'update' },
                  { label: 'Delete', value: 'delete' }
                ].map(ex => (
                  <button
                    key={ex.value}
                    onClick={() => loadExample(ex.value)}
                    className="px-3 py-1.5 bg-[#2a2a2a] hover:bg-[#3a3a3a] text-[#ededed] rounded text-xs transition-colors"
                  >
                    {ex.label}
                  </button>
                ))}
              </div>
            </div>

            {/* Method & Endpoint */}
            <div>
              <label className="block text-xs font-medium text-[#ededed] mb-2">Request</label>
              <div className="flex space-x-2">
                <select
                  value={method}
                  onChange={(e) => setMethod(e.target.value as any)}
                  className="px-3 py-2 bg-[#1c1c1c] border border-[#2a2a2a] rounded text-sm text-[#ededed] focus:outline-none focus:border-orange-600"
                >
                  <option value="GET">GET</option>
                  <option value="POST">POST</option>
                  <option value="PUT">PUT</option>
                  <option value="DELETE">DELETE</option>
                </select>

                <input
                  type="text"
                  value={endpoint}
                  onChange={(e) => setEndpoint(e.target.value)}
                  placeholder="/p/{slug}/{table}"
                  className="flex-1 px-3 py-2 bg-[#1c1c1c] border border-[#2a2a2a] rounded text-sm text-[#ededed] placeholder-[#6b6b6b] focus:outline-none focus:border-orange-600 font-mono"
                />
              </div>
            </div>

            {/* Query Parameters */}
            <div>
              <label className="block text-xs font-medium text-[#ededed] mb-2">Query Parameters</label>
              <input
                type="text"
                value={queryParams}
                onChange={(e) => setQueryParams(e.target.value)}
                placeholder="limit=10&status=active"
                className="w-full px-3 py-2 bg-[#1c1c1c] border border-[#2a2a2a] rounded text-sm text-[#ededed] placeholder-[#6b6b6b] focus:outline-none focus:border-orange-600 font-mono"
              />
            </div>

            {/* Request Body */}
            {method !== 'GET' && method !== 'DELETE' && (
              <div>
                <label className="block text-xs font-medium text-[#ededed] mb-2">Request Body (JSON)</label>
                <textarea
                  value={requestBody}
                  onChange={(e) => setRequestBody(e.target.value)}
                  className="w-full h-48 px-3 py-2 bg-[#1c1c1c] border border-[#2a2a2a] rounded text-sm text-[#ededed] placeholder-[#6b6b6b] focus:outline-none focus:border-orange-600 font-mono resize-none"
                  placeholder='{\n  "key": "value"\n}'
                />
              </div>
            )}

            {/* Send Button */}
            <button
              onClick={sendRequest}
              disabled={loading}
              className="w-full px-6 py-3 bg-gradient-to-r from-orange-600 to-orange-500 hover:from-orange-500 hover:to-orange-600 text-white rounded-lg font-semibold disabled:opacity-50 transition-all shadow-lg shadow-orange-600/30"
            >
              {loading ? 'Sending...' : 'Send Request'}
            </button>
          </div>
        </div>

        {/* Right Panel - Response */}
        <div className="flex-1 flex flex-col overflow-auto">
          <div className="p-6">
            <div className="flex items-center justify-between mb-4">
              <h2 className="text-lg font-semibold text-[#ededed]">Response</h2>
              {statusCode > 0 && (
                <div className="flex items-center space-x-4">
                  <span className={`px-3 py-1 rounded text-xs font-bold ${
                    statusCode >= 200 && statusCode < 300
                      ? 'bg-green-500/10 text-green-500'
                      : 'bg-red-500/10 text-red-500'
                  }`}>
                    {statusCode}
                  </span>
                  <span className="text-xs text-[#6b6b6b]">{responseTime}ms</span>
                </div>
              )}
            </div>

            {error && (
              <div className="mb-4 p-4 bg-red-500/10 border border-red-500/20 rounded-lg">
                <p className="text-sm font-semibold text-red-500 mb-1">Error</p>
                <p className="text-xs text-red-400">{error}</p>
              </div>
            )}

            {response && (
              <div className="bg-[#1c1c1c] border border-[#2a2a2a] rounded-lg overflow-hidden">
                <div className="p-3 border-b border-[#2a2a2a] flex items-center justify-between">
                  <span className="text-xs font-medium text-[#a1a1a1]">Response Body</span>
                  <button
                    onClick={() => navigator.clipboard.writeText(JSON.stringify(response, null, 2))}
                    className="px-2 py-1 bg-[#2a2a2a] hover:bg-[#3a3a3a] text-[#ededed] rounded text-xs transition-colors"
                  >
                    📋 Copy
                  </button>
                </div>
                <pre className="p-4 text-xs text-[#ededed] font-mono overflow-auto max-h-[600px]">
                  {JSON.stringify(response, null, 2)}
                </pre>
              </div>
            )}

            {!response && !error && !loading && (
              <div className="flex items-center justify-center h-64 text-[#6b6b6b]">
                <div className="text-center">
                  <svg className="w-16 h-16 mx-auto mb-4 opacity-50" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 9l3 3-3 3m5 0h3M5 20h14a2 2 0 002-2V6a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z" />
                  </svg>
                  <p className="text-sm">Send a request to see the response</p>
                </div>
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
