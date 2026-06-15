'use client';


import { useState, useEffect } from 'react';

const API_URL = process.env.NEXT_PUBLIC_API_URL!;

interface APIKey {
  id: string;
  name: string;
  key?: string;
  key_prefix: string;
  role: string;
  created_at: string;
  last_used_at: string | null;
  is_active: boolean;
}

interface Project {
  id: string;
  name: string;
  slug?: string;
}

export default function APIKeysPage() {
  const [showCreateModal, setShowCreateModal] = useState(false);
  const [visibleKeys, setVisibleKeys] = useState<Set<string>>(new Set());
  const [copiedKeys, setCopiedKeys] = useState<Set<string>>(new Set());
  const [apiKeys, setApiKeys] = useState<APIKey[]>([]);
  const [projects, setProjects] = useState<Project[]>([]);
  const [selectedProject, setSelectedProject] = useState<string>('');
  const [projectSlug, setProjectSlug] = useState<string>('');
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [newKey, setNewKey] = useState<APIKey | null>(null);
  
  // Form state
  const [keyName, setKeyName] = useState('');
  const [keyRole, setKeyRole] = useState('read');

  // Fetch projects on mount
  useEffect(() => {
    fetchProjects();
  }, []);

  // Fetch API keys when project is selected
  useEffect(() => {
    if (selectedProject) {
      fetchAPIKeys();
    }
  }, [selectedProject]);

  const fetchProjects = async () => {
    try {
      const token = localStorage.getItem('token');
      
      const url = `${API_URL}/api/projects`;
      
      const response = await fetch(url, {
        headers: {
          'Authorization': `Bearer ${token}`
        }
      });
      
      if (!response.ok) {
        throw new Error('Failed to fetch projects');
      }
      
      const data = await response.json();
      setProjects(data);
      
      if (data.length > 0 && !selectedProject) {
        setSelectedProject(data[0].id);
        setProjectSlug(data[0].slug || '');
      }
    } catch (err: any) {
      setError(err.message);
    }
  };

  const fetchAPIKeys = async () => {
    if (!selectedProject) return;
    
    setLoading(true);
    setError(null);
    
    try {
      const token = localStorage.getItem('token');
      
      // Use the /keys endpoint with reveal=true to get FULL keys
      const url = `${API_URL}/api/projects/${selectedProject}/keys?reveal=true`;
      
      console.log('Fetching FULL API keys from:', url);
      
      const response = await fetch(url, {
        headers: {
          'Authorization': `Bearer ${token}`
        }
      });
      
      if (!response.ok) {
        throw new Error('Failed to fetch API keys');
      }
      
      const data = await response.json();
      console.log('API Response:', data);
      
      // Transform the response format from {keys: {anon: {...}, service_role: {...}}}
      // to an array format
      const keysArray = [];
      
      if (data.keys?.anon) {
        // Priority: encrypted_key > full_key > key_prefix
        const fullKey = data.keys.anon.encrypted_key || data.keys.anon.full_key || data.keys.anon.key_prefix || 'No key available';
        console.log('Anon key length:', fullKey.length);
        console.log('Anon key:', fullKey.substring(0, 50) + '...');
        keysArray.push({
          id: data.keys.anon.id,
          name: data.keys.anon.name,
          key: fullKey,  // Store the FULL key here
          key_prefix: data.keys.anon.key_prefix,  // Keep prefix for masking
          role: data.keys.anon.role,
          is_active: data.keys.anon.is_active,
          created_at: data.keys.anon.created_at,
          last_used_at: null
        });
      }
      
      if (data.keys?.service_role) {
        // Priority: encrypted_key > full_key > key_prefix
        const fullKey = data.keys.service_role.encrypted_key || data.keys.service_role.full_key || data.keys.service_role.key_prefix || 'No key available';
        console.log('Service role key length:', fullKey.length);
        console.log('Service role key:', fullKey.substring(0, 50) + '...');
        keysArray.push({
          id: data.keys.service_role.id,
          name: data.keys.service_role.name,
          key: fullKey,  // Store the FULL key here
          key_prefix: data.keys.service_role.key_prefix,  // Keep prefix for masking
          role: data.keys.service_role.role,
          is_active: data.keys.service_role.is_active,
          created_at: data.keys.service_role.created_at,
          last_used_at: null
        });
      }
      
      console.log('Transformed keys:', keysArray);
      setApiKeys(keysArray);
    } catch (err: any) {
      console.error('Error fetching keys:', err);
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  const createAPIKey = async () => {
    if (!keyName.trim() || !selectedProject) {
      setError('Please enter a key name and select a project');
      return;
    }
    
    try {
      const token = localStorage.getItem('token');
      
      const url = `${API_URL}/api/projects/${selectedProject}/api-keys`;
      
      const body = {
        name: keyName,
        role: keyRole
      };
      
      const response = await fetch(url, {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${token}`,
          'Content-Type': 'application/json'
        },
        body: JSON.stringify(body)
      });
      
      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.detail || 'Failed to create API key');
      }
      
      const data = await response.json();
      setNewKey(data);
      setShowCreateModal(false);
      setKeyName('');
      setKeyRole('read');
      
      fetchAPIKeys();
    } catch (err: any) {
      setError(err.message);
    }
  };

  const revokeAPIKey = async (keyId: string) => {
    if (!confirm('Are you sure you want to revoke this API key? This action cannot be undone.')) {
      return;
    }
    
    try {
      const token = localStorage.getItem('token');
      const response = await fetch(
        `${API_URL}/api/projects/${selectedProject}/api-keys/${keyId}`,
        {
          method: 'DELETE',
          headers: {
            'Authorization': `Bearer ${token}`
          }
        }
      );
      
      if (!response.ok) throw new Error('Failed to revoke API key');
      
      fetchAPIKeys();
    } catch (err: any) {
      setError(err.message);
    }
  };

  const toggleAPIKey = async (keyId: string) => {
    try {
      const token = localStorage.getItem('token');
      const response = await fetch(
        `${API_URL}/api/projects/${selectedProject}/api-keys/${keyId}/toggle`,
        {
          method: 'PATCH',
          headers: {
            'Authorization': `Bearer ${token}`
          }
        }
      );
      
      if (!response.ok) throw new Error('Failed to toggle API key');
      
      fetchAPIKeys();
    } catch (err: any) {
      setError(err.message);
    }
  };

  const toggleKeyVisibility = (keyId: string) => {
    setVisibleKeys(prev => {
      const newSet = new Set(prev);
      if (newSet.has(keyId)) {
        newSet.delete(keyId);
      } else {
        newSet.add(keyId);
      }
      return newSet;
    });
  };

  // Visual-only preview — full key is always in apiKey.key for copy
  const maskKey = (key: string) => {
    if (!key || key.length <= 30) return key;
    return key.substring(0, 20) + '…' + key.substring(key.length - 8);
  };

  const copyToClipboard = (text: string, keyId?: string) => {
    navigator.clipboard.writeText(text);
    if (keyId) {
      setCopiedKeys(prev => { const s = new Set(prev); s.add(keyId); return s; });
      setTimeout(() => setCopiedKeys(prev => { const s = new Set(prev); s.delete(keyId); return s; }), 2000);
    }
  };

  const formatDate = (dateString: string) => {
    return new Date(dateString).toLocaleDateString();
  };

  const formatLastUsed = (dateString: string | null) => {
    if (!dateString) return 'Never';
    const date = new Date(dateString);
    const now = new Date();
    const diffMs = now.getTime() - date.getTime();
    const diffMins = Math.floor(diffMs / 60000);
    const diffHours = Math.floor(diffMs / 3600000);
    const diffDays = Math.floor(diffMs / 86400000);
    
    if (diffMins < 60) return `${diffMins} minutes ago`;
    if (diffHours < 24) return `${diffHours} hours ago`;
    return `${diffDays} days ago`;
  };

  return (
    <div className="p-6 space-y-6 max-w-7xl">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-xl font-semibold text-[#ededed]">API Keys</h1>
          <p className="text-xs text-[#a1a1a1] mt-1">Manage your API keys for programmatic access</p>
        </div>
        <div className="flex items-center space-x-3">
          {/* Project Selector */}
          {projects.length > 0 && (
            <select
              value={selectedProject}
              onChange={(e) => {
                setSelectedProject(e.target.value);
                const proj = projects.find(p => p.id === e.target.value);
                setProjectSlug(proj?.slug || '');
              }}
              className="px-3 py-1.5 bg-[#1c1c1c] border border-[#2a2a2a] rounded text-xs text-[#ededed] focus:outline-none focus:border-orange-600"
            >
              <option value="">Select Project</option>
              {projects.map((project) => (
                <option key={project.id} value={project.id}>
                  {project.name}
                </option>
              ))}
            </select>
          )}
          <button
            onClick={() => setShowCreateModal(true)}
            disabled={!selectedProject}
            className="flex items-center space-x-1.5 px-3 py-1.5 bg-orange-600 hover:bg-orange-500 text-white rounded text-xs font-medium transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
          >
            <svg className="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
            </svg>
            <span>Create API Key</span>
          </button>
        </div>
      </div>

      {/* Error Message */}
      {error && (
        <div className="bg-red-500/10 border border-red-500/20 rounded-lg p-4">
          <p className="text-xs text-red-500">{error}</p>
        </div>
      )}

      {/* New Key Alert */}
      {newKey && newKey.key && (
        <div className="bg-green-500/10 border border-green-500/20 rounded-lg p-4">
          <div className="flex items-start space-x-3">
            <svg className="w-5 h-5 text-green-500 flex-shrink-0 mt-0.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
            </svg>
            <div className="flex-1">
              <p className="text-xs font-semibold text-green-500 mb-2">API Key Created Successfully!</p>
              <p className="text-xs text-[#a1a1a1] mb-3">
                Save this key securely. It won't be shown again.
              </p>
              <div className="bg-black rounded p-3 flex items-center justify-between">
                <code className="text-[10px] text-green-500 font-mono break-all">{newKey.key}</code>
                <button
                  onClick={() => copyToClipboard(newKey.key!)}
                  className="ml-3 p-1 rounded hover:bg-[#2a2a2a] text-green-500 hover:text-green-400 transition-colors"
                  title="Copy"
                >
                  <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 16H6a2 2 0 01-2-2V6a2 2 0 012-2h8a2 2 0 012 2v2m-6 12h8a2 2 0 002-2v-8a2 2 0 00-2-2h-8a2 2 0 00-2 2v8a2 2 0 002 2z" />
                  </svg>
                </button>
              </div>
              <button
                onClick={() => setNewKey(null)}
                className="mt-3 text-xs text-green-500 hover:text-green-400"
              >
                Dismiss
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Project URL + Project ID */}
      {selectedProject && (
        <div className="space-y-3">
          {/* Project URL */}
          <div className="bg-[#181818] border border-[#2a2a2a] rounded-lg p-4">
            <p className="text-xs font-semibold text-[#ededed] mb-1">Project URL</p>
            <p className="text-[10px] text-[#a1a1a1] mb-2">
              Base URL for all API requests to this project
            </p>
            <div className="flex items-center space-x-2">
              <code className="flex-1 text-xs text-orange-400 font-mono bg-black px-3 py-1.5 rounded overflow-x-auto whitespace-nowrap">
                {`${API_URL}/p/${projectSlug || selectedProject}`}
              </code>
              <button
                onClick={() => copyToClipboard(`${API_URL}/p/${projectSlug || selectedProject}`, 'project-url')}
                className="p-1.5 rounded hover:bg-[#2a2a2a] text-[#a1a1a1] hover:text-[#ededed] transition-colors flex-shrink-0"
                title="Copy Project URL"
              >
                {copiedKeys.has('project-url') ? (
                  <svg className="w-4 h-4 text-green-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                  </svg>
                ) : (
                  <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 16H6a2 2 0 01-2-2V6a2 2 0 012-2h8a2 2 0 012 2v2m-6 12h8a2 2 0 002-2v-8a2 2 0 00-2-2h-8a2 2 0 00-2 2v8a2 2 0 002 2z" />
                  </svg>
                )}
              </button>
            </div>
          </div>

          {/* Project ID */}
          <div className="bg-[#181818] border border-[#2a2a2a] rounded-lg p-4">
            <p className="text-xs font-semibold text-[#ededed] mb-1">Project ID</p>
            <p className="text-[10px] text-[#a1a1a1] mb-2">
              Use this ID when calling authentication endpoints
            </p>
            <div className="flex items-center space-x-2">
              <code className="text-xs text-[#a1a1a1] font-mono bg-black px-3 py-1.5 rounded">
                {selectedProject}
              </code>
              <button
                onClick={() => copyToClipboard(selectedProject, 'project-id')}
                className="p-1.5 rounded hover:bg-[#2a2a2a] text-[#a1a1a1] hover:text-[#ededed] transition-colors"
                title="Copy Project ID"
              >
                {copiedKeys.has('project-id') ? (
                  <svg className="w-4 h-4 text-green-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                  </svg>
                ) : (
                  <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 16H6a2 2 0 01-2-2V6a2 2 0 012-2h8a2 2 0 012 2v2m-6 12h8a2 2 0 002-2v-8a2 2 0 00-2-2h-8a2 2 0 00-2 2v8a2 2 0 002 2z" />
                  </svg>
                )}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Info Banner */}
      <div className="bg-blue-500/10 border border-blue-500/20 rounded-lg p-4">
        <div className="flex items-start space-x-3">
          <svg className="w-5 h-5 text-blue-500 flex-shrink-0 mt-0.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
          </svg>
          <div>
            <p className="text-xs font-semibold text-blue-500 mb-1">Keep your API keys secure</p>
            <p className="text-xs text-[#a1a1a1]">
              API keys provide full access to your data. Never share them publicly or commit them to version control.
            </p>
          </div>
        </div>
      </div>

      {/* API Keys List */}
      {loading ? (
        <div className="bg-[#181818] border border-[#2a2a2a] rounded-lg p-12 text-center">
          <p className="text-xs text-[#a1a1a1]">Loading API keys...</p>
        </div>
      ) : !selectedProject ? (
        <div className="bg-[#181818] border border-[#2a2a2a] rounded-lg p-12 text-center">
          <p className="text-xs text-[#a1a1a1]">Please select a project to view API keys</p>
        </div>
      ) : apiKeys.length === 0 ? (
        <div className="bg-[#181818] border border-[#2a2a2a] rounded-lg p-12 text-center">
          <svg className="w-12 h-12 text-[#6b6b6b] mx-auto mb-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 7a2 2 0 012 2m4 0a6 6 0 01-7.743 5.743L11 17H9v2H7v2H4a1 1 0 01-1-1v-2.586a1 1 0 01.293-.707l5.964-5.964A6 6 0 1121 9z" />
          </svg>
          <p className="text-sm text-[#ededed] mb-2">No API keys yet</p>
          <p className="text-xs text-[#a1a1a1]">Create your first API key to start using the API</p>
        </div>
      ) : (
        <div className="bg-[#181818] border border-[#2a2a2a] rounded-lg overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full text-xs">
              <thead className="bg-[#1c1c1c] border-b border-[#2a2a2a]">
                <tr>
                  <th className="px-4 py-3 text-left font-medium text-[#a1a1a1]">Name</th>
                  <th className="px-4 py-3 text-left font-medium text-[#a1a1a1]">Key</th>
                  <th className="px-4 py-3 text-left font-medium text-[#a1a1a1]">Role</th>
                  <th className="px-4 py-3 text-left font-medium text-[#a1a1a1]">Created</th>
                  <th className="px-4 py-3 text-left font-medium text-[#a1a1a1]">Last Used</th>
                  <th className="px-4 py-3 text-left font-medium text-[#a1a1a1]">Status</th>
                  <th className="px-4 py-3 text-right font-medium text-[#a1a1a1]">Actions</th>
                </tr>
              </thead>
              <tbody>
                {apiKeys.map((apiKey) => (
                  <tr
                    key={apiKey.id}
                    className="border-b border-[#2a2a2a] last:border-0 hover:bg-[#2a2a2a] transition-colors group"
                  >
                    <td className="px-4 py-3">
                      <div className="flex items-center space-x-2">
                        <svg className="w-4 h-4 text-[#6b6b6b]" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 7a2 2 0 012 2m4 0a6 6 0 01-7.743 5.743L11 17H9v2H7v2H4a1 1 0 01-1-1v-2.586a1 1 0 01.293-.707l5.964-5.964A6 6 0 1121 9z" />
                        </svg>
                        <span className="text-[#ededed] font-medium">{apiKey.name}</span>
                      </div>
                    </td>
                    <td className="px-4 py-3">
                      <div className="flex items-center space-x-2">
                        <div className="flex-1 min-w-0">
                          <code className="text-[#a1a1a1] font-mono text-[10px] block overflow-x-auto whitespace-nowrap">
                            {visibleKeys.has(apiKey.id)
                              ? (apiKey.key || 'No key available')
                              : maskKey(apiKey.key || apiKey.key_prefix)
                            }
                          </code>
                        </div>
                        <div className="flex items-center space-x-1 flex-shrink-0">
                          <button
                            onClick={() => toggleKeyVisibility(apiKey.id)}
                            className="p-1 rounded hover:bg-[#3a3a3a] text-[#a1a1a1] hover:text-[#ededed] transition-colors"
                            title={visibleKeys.has(apiKey.id) ? "Hide key" : "Show key"}
                          >
                            {visibleKeys.has(apiKey.id) ? (
                              <svg className="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13.875 18.825A10.05 10.05 0 0112 19c-4.478 0-8.268-2.943-9.543-7a9.97 9.97 0 011.563-3.029m5.858.908a3 3 0 114.243 4.243M9.878 9.878l4.242 4.242M9.88 9.88l-3.29-3.29m7.532 7.532l3.29 3.29M3 3l3.59 3.59m0 0A9.953 9.953 0 0112 5c4.478 0 8.268 2.943 9.543 7a10.025 10.025 0 01-4.132 5.411m0 0L21 21" />
                              </svg>
                            ) : (
                              <svg className="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M2.458 12C3.732 7.943 7.523 5 12 5c4.478 0 8.268 2.943 9.542 7-1.274 4.057-5.064 7-9.542 7-4.477 0-8.268-2.943-9.542-7z" />
                              </svg>
                            )}
                          </button>
                          <button
                            onClick={() => copyToClipboard(apiKey.key || '', apiKey.id)}
                            className="p-1 rounded hover:bg-[#3a3a3a] text-[#a1a1a1] hover:text-[#ededed] transition-colors"
                            title="Copy full key"
                          >
                            {copiedKeys.has(apiKey.id) ? (
                              <svg className="w-3 h-3 text-green-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                              </svg>
                            ) : (
                              <svg className="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 16H6a2 2 0 01-2-2V6a2 2 0 012-2h8a2 2 0 012 2v2m-6 12h8a2 2 0 002-2v-8a2 2 0 00-2-2h-8a2 2 0 00-2 2v8a2 2 0 002 2z" />
                              </svg>
                            )}
                          </button>
                        </div>
                      </div>
                    </td>
                    <td className="px-4 py-3">
                      <span className={`px-2 py-0.5 rounded text-[10px] font-medium ${
                        apiKey.role === 'admin'
                          ? 'bg-orange-500/10 text-orange-500'
                          : 'bg-blue-500/10 text-blue-500'
                      }`}>
                        {apiKey.role}
                      </span>
                    </td>
                    <td className="px-4 py-3 text-[#a1a1a1]">{formatDate(apiKey.created_at)}</td>
                    <td className="px-4 py-3 text-[#a1a1a1]">{formatLastUsed(apiKey.last_used_at)}</td>
                    <td className="px-4 py-3">
                      <span className={`px-2 py-0.5 rounded text-[10px] font-medium ${
                        apiKey.is_active
                          ? 'bg-green-500/10 text-green-500'
                          : 'bg-gray-500/10 text-gray-500'
                      }`}>
                        {apiKey.is_active ? 'Active' : 'Inactive'}
                      </span>
                    </td>
                    <td className="px-4 py-3 text-right">
                      <div className="flex items-center justify-end space-x-1 opacity-0 group-hover:opacity-100 transition-opacity">
                        <button 
                          onClick={() => toggleAPIKey(apiKey.id)}
                          className="p-1 rounded hover:bg-[#3a3a3a] text-[#a1a1a1] hover:text-[#ededed] transition-colors" 
                          title={apiKey.is_active ? 'Disable' : 'Enable'}
                        >
                          <svg className="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            {apiKey.is_active ? (
                              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M18.364 18.364A9 9 0 005.636 5.636m12.728 12.728A9 9 0 015.636 5.636m12.728 12.728L5.636 5.636" />
                            ) : (
                              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
                            )}
                          </svg>
                        </button>
                        <button 
                          onClick={() => revokeAPIKey(apiKey.id)}
                          className="p-1 rounded hover:bg-[#3a3a3a] text-[#a1a1a1] hover:text-red-500 transition-colors" 
                          title="Revoke"
                        >
                          <svg className="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
                          </svg>
                        </button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* Create API Key Modal */}
      {showCreateModal && (
        <div className="fixed inset-0 bg-black/60 backdrop-blur-sm z-50 flex items-center justify-center p-4" onClick={() => setShowCreateModal(false)}>
          <div className="bg-[#181818] border border-[#2a2a2a] rounded-lg p-6 max-w-md w-full" onClick={(e) => e.stopPropagation()}>
            <div className="flex items-center justify-between mb-6">
              <h2 className="text-lg font-semibold text-[#ededed]">Create API Key</h2>
              <button
                onClick={() => setShowCreateModal(false)}
                className="p-1 rounded hover:bg-[#2a2a2a] text-[#a1a1a1] hover:text-[#ededed] transition-colors"
              >
                <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                </svg>
              </button>
            </div>

            <div className="space-y-4">
              <div>
                <label className="block text-xs font-medium text-[#ededed] mb-2">
                  Key Name
                </label>
                <input
                  type="text"
                  value={keyName}
                  onChange={(e) => setKeyName(e.target.value)}
                  placeholder="e.g., Production API Key"
                  className="w-full px-3 py-2 bg-[#1c1c1c] border border-[#2a2a2a] rounded text-xs text-[#ededed] placeholder-[#6b6b6b] focus:outline-none focus:border-orange-600"
                />
              </div>

              <div>
                <label className="block text-xs font-medium text-[#ededed] mb-2">
                  Role
                </label>
                <select 
                  value={keyRole}
                  onChange={(e) => setKeyRole(e.target.value)}
                  className="w-full px-3 py-2 bg-[#1c1c1c] border border-[#2a2a2a] rounded text-xs text-[#ededed] focus:outline-none focus:border-orange-600"
                >
                  <option value="read">Read Only</option>
                  <option value="admin">Admin</option>
                </select>
                <p className="text-[10px] text-[#6b6b6b] mt-1">
                  {keyRole === 'read' ? 'Can only query data' : 'Can create, update, and delete data'}
                </p>
              </div>

              {error && (
                <div className="bg-red-500/10 border border-red-500/20 rounded p-3">
                  <p className="text-xs text-red-500">{error}</p>
                </div>
              )}

              <div className="flex items-center justify-end space-x-2 pt-4">
                <button
                  onClick={() => setShowCreateModal(false)}
                  className="px-4 py-2 bg-[#2a2a2a] text-[#ededed] rounded text-xs font-medium hover:bg-[#3a3a3a] transition-colors"
                >
                  Cancel
                </button>
                <button 
                  onClick={createAPIKey}
                  disabled={!keyName.trim()}
                  className="px-4 py-2 bg-orange-600 hover:bg-orange-500 text-white rounded text-xs font-medium transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  Create Key
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
