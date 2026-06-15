'use client';

// Force dynamic rendering - prevent static generation
export const dynamic = 'force-dynamic';
export const revalidate = 0;

import { useState, useEffect } from 'react';
import { useParams, useRouter } from 'next/navigation';
import Link from 'next/link';
import { apiFetch } from '@/lib/fetch-utils';

interface Project {
  id: string;
  name: string;
  slug: string;
  description?: string;
  storage_used: number;
  max_storage: number;
  created_at: string;
}

export default function ProjectSettingsPage() {
  const params = useParams();
  const router = useRouter();
  const projectId = params.id as string;
  const [activeTab, setActiveTab] = useState('general');
  const [project, setProject] = useState<Project | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetchProject();
  }, [projectId]);

  async function fetchProject() {
    try {
      const res = await apiFetch(`api/projects/${projectId}`);
      if (res.ok) {
        setProject(await res.json());
      }
    } finally {
      setLoading(false);
    }
  }

  const tabs = [
    { 
      id: 'general', 
      name: 'General',
      icon: (
        <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10.325 4.317c.426-1.756 2.924-1.756 3.35 0a1.724 1.724 0 002.573 1.066c1.543-.94 3.31.826 2.37 2.37a1.724 1.724 0 001.065 2.572c1.756.426 1.756 2.924 0 3.35a1.724 1.724 0 00-1.066 2.573c.94 1.543-.826 3.31-2.37 2.37a1.724 1.724 0 00-2.572 1.065c-.426 1.756-2.924 1.756-3.35 0a1.724 1.724 0 00-2.573-1.066c-1.543.94-3.31-.826-2.37-2.37a1.724 1.724 0 00-1.065-2.572c-1.756-.426-1.756-2.924 0-3.35a1.724 1.724 0 001.066-2.573c-.94-1.543.826-3.31 2.37-2.37.996.608 2.296.07 2.572-1.065z" />
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
        </svg>
      )
    },
    { 
      id: 'usage', 
      name: 'Usage & Limits',
      icon: (
        <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 19v-6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2a2 2 0 002-2zm0 0V9a2 2 0 012-2h2a2 2 0 012 2v10m-6 0a2 2 0 002 2h2a2 2 0 002-2m0 0V5a2 2 0 012-2h2a2 2 0 012 2v14a2 2 0 01-2 2h-2a2 2 0 01-2-2z" />
        </svg>
      )
    },
    { 
      id: 'api-keys', 
      name: 'API Keys',
      icon: (
        <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 7a2 2 0 012 2m4 0a6 6 0 01-7.743 5.743L11 17H9v2H7v2H4a1 1 0 01-1-1v-2.586a1 1 0 01.293-.707l5.964-5.964A6 6 0 1121 9z" />
        </svg>
      ),
      badge: 'NEW'
    },
    { 
      id: 'backups', 
      name: 'Backups',
      icon: (
        <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 7H5a2 2 0 00-2 2v9a2 2 0 002 2h14a2 2 0 002-2V9a2 2 0 00-2-2h-3m-1 4l-3 3m0 0l-3-3m3 3V4" />
        </svg>
      )
    },
    { 
      id: 'configuration', 
      name: 'Configuration',
      icon: (
        <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 6V4m0 2a2 2 0 100 4m0-4a2 2 0 110 4m-6 8a2 2 0 100-4m0 4a2 2 0 110-4m0 4v2m0-6V4m6 6v10m6-2a2 2 0 100-4m0 4a2 2 0 110-4m0 4v2m0-6V4" />
        </svg>
      )
    },
    { 
      id: 'database', 
      name: 'Database',
      icon: (
        <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 7v10c0 2.21 3.582 4 8 4s8-1.79 8-4V7M4 7c0 2.21 3.582 4 8 4s8-1.79 8-4M4 7c0-2.21 3.582-4 8-4s8 1.79 8 4m0 5c0 2.21-3.582 4-8 4s-8-1.79-8-4" />
        </svg>
      )
    },
    { 
      id: 'authentication', 
      name: 'Authentication',
      icon: (
        <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 15v2m-6 4h12a2 2 0 002-2v-6a2 2 0 00-2-2H6a2 2 0 00-2 2v6a2 2 0 002 2zm10-10V7a4 4 0 00-8 0v4h8z" />
        </svg>
      )
    },
    { 
      id: 'storage', 
      name: 'Storage',
      icon: (
        <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 8h14M5 8a2 2 0 110-4h14a2 2 0 110 4M5 8v10a2 2 0 002 2h10a2 2 0 002-2V8m-9 4h4" />
        </svg>
      )
    },
    { 
      id: 'migration', 
      name: 'Database Migration',
      icon: (
        <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
        </svg>
      )
    },
  ];

  return (
    <div className="min-h-screen bg-[#1c1c1c]">
      {/* Header */}
      <div className="bg-[#0f0f0f] border-b border-[#2a2a2a] px-6 py-4">
        <div className="flex items-center space-x-3">
          <Link
            href={`/dashboard/projects`}
            className="text-gray-400 hover:text-white transition-colors"
          >
            <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
            </svg>
          </Link>
          <div>
            <h1 className="text-xl font-bold text-white">Project Settings</h1>
            <p className="text-sm text-gray-500">{project?.name || 'Loading...'}</p>
          </div>
        </div>
      </div>

      <div className="flex">
        {/* Sidebar */}
        <aside className="w-64 bg-[#0f0f0f] border-r border-[#2a2a2a] min-h-[calc(100vh-73px)]">
          <nav className="p-4 space-y-1">
            {tabs.map((tab) => (
              <button
                key={tab.id}
                onClick={() => setActiveTab(tab.id)}
                className={`w-full flex items-center justify-between px-3 py-2.5 rounded-lg text-sm font-medium transition-all ${
                  activeTab === tab.id
                    ? 'bg-gradient-to-r from-orange-500/10 to-transparent text-white border-l-2 border-orange-500'
                    : 'text-gray-400 hover:bg-[#1a1a1a] hover:text-white'
                }`}
              >
                <div className="flex items-center space-x-3">
                  <div className={activeTab === tab.id ? 'text-orange-500' : ''}>{tab.icon}</div>
                  <span>{tab.name}</span>
                </div>
                {tab.badge && (
                  <span className="px-2 py-0.5 bg-orange-500 text-white text-xs font-bold rounded-md">
                    {tab.badge}
                  </span>
                )}
              </button>
            ))}
          </nav>
        </aside>

        {/* Content */}
        <main className="flex-1 p-6">
          {loading ? (
            <div className="flex items-center justify-center h-64">
              <div className="w-8 h-8 border-2 border-orange-500 border-t-transparent rounded-full animate-spin" />
            </div>
          ) : (
            <>
              {activeTab === 'general' && <GeneralSettings project={project} onUpdate={fetchProject} />}
              {activeTab === 'usage' && <UsageSettings projectId={projectId} project={project} />}
              {activeTab === 'api-keys' && <ApiKeysSettings projectId={projectId} project={project} />}
              {activeTab === 'backups' && <BackupsSettings projectId={projectId} />}
              {activeTab === 'configuration' && <ConfigurationSettings projectId={projectId} />}
              {activeTab === 'database' && <DatabaseSettings projectId={projectId} />}
              {activeTab === 'authentication' && <AuthenticationSettings projectId={projectId} />}
              {activeTab === 'storage' && <StorageSettings projectId={projectId} project={project} />}
              {activeTab === 'migration' && <MigrationSettings projectId={projectId} />}
            </>
          )}
        </main>
      </div>
    </div>
  );
}

// General Settings Component
function GeneralSettings({ project, onUpdate }: { project: Project | null; onUpdate: () => void }) {
  const [name, setName] = useState(project?.name || '');
  const [description, setDescription] = useState(project?.description || '');
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (project) {
      setName(project.name);
      setDescription(project.description || '');
    }
  }, [project]);

  async function handleSave() {
    if (!project) return;
    setSaving(true);
    try {
      const res = await apiFetch(`api/projects/${project.id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ name, description }),
      });
      if (res.ok) {
        onUpdate();
        alert('Settings saved successfully');
      }
    } finally {
      setSaving(false);
    }
  }

  async function handleDelete() {
    if (!project) return;
    if (!confirm(`Are you sure you want to delete "${project.name}"? This action cannot be undone.`)) return;
    
    const res = await apiFetch(`api/projects/${project.id}`, { method: 'DELETE' });
    if (res.ok) {
      window.location.href = '/dashboard/projects';
    }
  }

  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-lg font-semibold text-white mb-1">General Settings</h2>
        <p className="text-sm text-gray-400">Manage your project's basic information</p>
      </div>

      <div className="bg-[#0f0f0f] border border-[#2a2a2a] rounded-xl p-6 space-y-4">
        <div>
          <label className="block text-sm font-medium text-gray-300 mb-2">Project Name</label>
          <input
            type="text"
            value={name}
            onChange={(e) => setName(e.target.value)}
            className="w-full bg-[#1a1a1a] border border-[#2a2a2a] rounded-lg px-3 py-2 text-white focus:outline-none focus:border-orange-500"
            placeholder="My Project"
          />
        </div>

        <div>
          <label className="block text-sm font-medium text-gray-300 mb-2">Project Description</label>
          <textarea
            rows={3}
            value={description}
            onChange={(e) => setDescription(e.target.value)}
            className="w-full bg-[#1a1a1a] border border-[#2a2a2a] rounded-lg px-3 py-2 text-white focus:outline-none focus:border-orange-500"
            placeholder="Describe your project..."
          />
        </div>

        <div>
          <label className="block text-sm font-medium text-gray-300 mb-2">Project ID</label>
          <input
            type="text"
            value={project?.id || ''}
            readOnly
            className="w-full bg-[#1a1a1a] border border-[#2a2a2a] rounded-lg px-3 py-2 text-gray-500 cursor-not-allowed"
          />
        </div>

        <div>
          <label className="block text-sm font-medium text-gray-300 mb-2">Created At</label>
          <input
            type="text"
            value={project?.created_at ? new Date(project.created_at).toLocaleString() : ''}
            readOnly
            className="w-full bg-[#1a1a1a] border border-[#2a2a2a] rounded-lg px-3 py-2 text-gray-500 cursor-not-allowed"
          />
        </div>

        <div className="pt-4 border-t border-[#2a2a2a]">
          <button 
            onClick={handleSave}
            disabled={saving}
            className="px-4 py-2 bg-orange-500 hover:bg-orange-600 disabled:opacity-50 text-white text-sm font-semibold rounded-lg transition-colors"
          >
            {saving ? 'Saving...' : 'Save Changes'}
          </button>
        </div>
      </div>

      {/* Danger Zone */}
      <div className="bg-red-500/5 border border-red-500/20 rounded-xl p-6">
        <h3 className="text-sm font-semibold text-red-400 mb-2">Danger Zone</h3>
        <p className="text-sm text-gray-400 mb-4">Irreversible and destructive actions</p>
        <button 
          onClick={handleDelete}
          className="px-4 py-2 bg-red-500/10 hover:bg-red-500/20 text-red-400 text-sm font-semibold rounded-lg transition-colors"
        >
          Delete Project
        </button>
      </div>
    </div>
  );
}

// Usage Settings Component
function UsageSettings({ projectId, project }: { projectId: string; project: Project | null }) {
  const formatBytes = (bytes: number) => {
    if (!bytes) return '0 B';
    const k = 1024;
    const sizes = ['B', 'KB', 'MB', 'GB'];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return `${parseFloat((bytes / Math.pow(k, i)).toFixed(1))} ${sizes[i]}`;
  };

  const storagePercent = project ? (project.storage_used / project.max_storage * 100).toFixed(2) : 0;

  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-lg font-semibold text-white mb-1">Usage & Limits</h2>
        <p className="text-sm text-gray-400">Monitor your project's resource usage</p>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        <div className="bg-[#0f0f0f] border border-[#2a2a2a] rounded-xl p-4">
          <div className="flex items-center justify-between mb-2">
            <span className="text-sm text-gray-400">Storage Used</span>
            <span className="text-xs text-gray-600">Total</span>
          </div>
          <div className="text-2xl font-bold text-white mb-1">
            {project ? formatBytes(project.storage_used) : '0 B'}
          </div>
          <div className="text-xs text-gray-500">
            of {project ? formatBytes(project.max_storage) : '0 B'} limit
          </div>
          <div className="mt-3 h-2 bg-[#1a1a1a] rounded-full overflow-hidden">
            <div 
              className="h-full bg-blue-500" 
              style={{ width: `${Math.min(Number(storagePercent), 100)}%` }} 
            />
          </div>
        </div>

        <div className="bg-[#0f0f0f] border border-[#2a2a2a] rounded-xl p-4">
          <div className="flex items-center justify-between mb-2">
            <span className="text-sm text-gray-400">Project Status</span>
            <span className="text-xs text-gray-600">Current</span>
          </div>
          <div className="text-2xl font-bold text-green-500 mb-1">Active</div>
          <div className="text-xs text-gray-500">
            Created {project ? new Date(project.created_at).toLocaleDateString() : 'N/A'}
          </div>
        </div>
      </div>
    </div>
  );
}

// API Keys Settings Component
function ApiKeysSettings({ projectId, project }: { projectId: string; project: Project | null }) {
  const [keys, setKeys] = useState<{ anon?: any; service_role?: any } | null>(null);
  const [loading, setLoading] = useState(true);
  const [regenerating, setRegenerating] = useState(false);
  const [visibleKeys, setVisibleKeys] = useState<Record<string, boolean>>({});
  const [copiedKeys, setCopiedKeys] = useState<Record<string, boolean>>({});

  useEffect(() => {
    fetchKeys();
  }, [projectId]);

  async function fetchKeys() {
    setLoading(true);
    try {
      const res = await apiFetch(`api/projects/${projectId}/keys?reveal=true`);
      if (res.ok) {
        const data = await res.json();
        const norm = (k: any) => k ? { ...k, full_key: k.encrypted_key || k.full_key || k.key_prefix } : undefined;
        setKeys({ anon: norm(data.keys?.anon), service_role: norm(data.keys?.service_role) });
      }
    } finally {
      setLoading(false);
    }
  }

  async function regenerateKeys() {
    if (!confirm('Regenerate API keys? Your existing keys will stop working immediately. Make sure to update any apps using the old keys.')) return;
    setRegenerating(true);
    try {
      const res = await apiFetch(`api/projects/${projectId}/regenerate-keys`, { method: 'POST' });
      if (res.ok) {
        const data = await res.json();
        // Show the fresh keys directly from the response (no need to re-fetch)
        const norm = (key: string, name: string, role: string, keyType: string) => ({
          full_key: key, encrypted_key: key, key_prefix: key.substring(0, 20) + '...',
          name, role, key_type: keyType, is_active: true,
        });
        setKeys({
          anon: norm(data.anon_key, 'anon (public)', 'read', 'anon'),
          service_role: norm(data.service_role_key, 'service_role (secret)', 'admin', 'service_role'),
        });
        // Auto-reveal so user can see & copy the new keys
        setVisibleKeys({ anon: true, service_role: true });
      } else {
        const err = await res.json();
        alert('Failed to regenerate keys: ' + (err.detail || 'Unknown error'));
      }
    } finally {
      setRegenerating(false);
    }
  }

  const copyKey = (key: string, id: string) => {
    navigator.clipboard.writeText(key);
    setCopiedKeys(prev => ({ ...prev, [id]: true }));
    setTimeout(() => setCopiedKeys(prev => ({ ...prev, [id]: false })), 2000);
  };

  const previewKey = (key: string) => {
    if (!key || key.length <= 30) return key;
    return key.substring(0, 24) + '…' + key.substring(key.length - 10);
  };

  const apiUrl = `${process.env.NEXT_PUBLIC_API_URL || ''}/p/${project?.slug || projectId}`;

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-lg font-semibold text-white mb-1">API Keys</h2>
          <p className="text-sm text-gray-400">Your project credentials — use these with the ZendBX SDK or REST API</p>
        </div>
        <div className="flex items-center space-x-2">
          <button
            onClick={fetchKeys}
            className="px-3 py-1.5 bg-[#1a1a1a] hover:bg-[#242424] border border-[#2a2a2a] text-gray-300 text-xs font-medium rounded-lg transition-colors"
          >
            Refresh
          </button>
          <button
            onClick={regenerateKeys}
            disabled={regenerating}
            className="px-3 py-1.5 bg-red-500/10 hover:bg-red-500/20 border border-red-500/30 text-red-400 hover:text-red-300 text-xs font-medium rounded-lg transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
          >
            {regenerating ? 'Regenerating…' : '⟳ Regenerate Keys'}
          </button>
        </div>
      </div>

      <div className="bg-yellow-500/5 border border-yellow-500/20 rounded-xl p-4">
        <p className="text-xs text-yellow-400">
          <span className="font-semibold">Warning:</span> Regenerating keys invalidates all existing keys immediately. Update every app and service that uses these credentials before regenerating.
        </p>
      </div>

      {/* Project URL */}
      <div className="bg-[#0f0f0f] border border-[#2a2a2a] rounded-xl p-5">
        <p className="text-xs font-semibold text-gray-400 uppercase tracking-wider mb-3">Project URL</p>
        <div className="flex items-center space-x-2">
          <code className="flex-1 text-sm text-orange-400 font-mono bg-[#1a1a1a] px-3 py-2 rounded-lg border border-[#2a2a2a] overflow-x-auto whitespace-nowrap">
            {apiUrl}
          </code>
          <button
            onClick={() => copyKey(apiUrl, 'url')}
            className="p-2 rounded-lg hover:bg-[#2a2a2a] text-gray-400 hover:text-white transition-colors flex-shrink-0"
            title="Copy URL"
          >
            {copiedKeys['url'] ? (
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
        <p className="text-xs text-gray-600 mt-2">The base URL for all API requests to this project</p>
      </div>

      {loading ? (
        <div className="bg-[#0f0f0f] border border-[#2a2a2a] rounded-xl p-8 text-center">
          <p className="text-sm text-gray-400">Loading credentials…</p>
        </div>
      ) : !keys ? (
        <div className="bg-red-500/5 border border-red-500/20 rounded-xl p-6">
          <p className="text-sm text-red-400">Could not load keys.{' '}
            <button onClick={fetchKeys} className="underline hover:text-red-300">Try again</button>
          </p>
        </div>
      ) : (
        <div className="space-y-4">
          {/* Anon key */}
          {keys.anon && (
            <div className="bg-[#0f0f0f] border border-[#2a2a2a] rounded-xl p-5">
              <div className="flex items-center justify-between mb-3">
                <div>
                  <div className="flex items-center space-x-2">
                    <p className="text-sm font-semibold text-white">anon</p>
                    <span className="px-2 py-0.5 bg-green-500/10 text-green-500 text-xs rounded-full font-medium">public</span>
                  </div>
                  <p className="text-xs text-gray-500 mt-0.5">Safe for use in browser / mobile apps</p>
                </div>
              </div>
              <div className="flex items-center space-x-2">
                <code className="flex-1 text-sm text-green-400 font-mono bg-[#1a1a1a] px-3 py-2 rounded-lg border border-[#2a2a2a] overflow-x-auto whitespace-nowrap">
                  {visibleKeys['anon'] ? keys.anon.full_key : previewKey(keys.anon.full_key)}
                </code>
                <button
                  onClick={() => setVisibleKeys(prev => ({ ...prev, anon: !prev['anon'] }))}
                  className="p-2 rounded-lg hover:bg-[#2a2a2a] text-gray-400 hover:text-white transition-colors flex-shrink-0"
                  title={visibleKeys['anon'] ? 'Hide' : 'Reveal full key'}
                >
                  {visibleKeys['anon'] ? (
                    <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13.875 18.825A10.05 10.05 0 0112 19c-4.478 0-8.268-2.943-9.543-7a9.97 9.97 0 011.563-3.029m5.858.908a3 3 0 114.243 4.243M9.878 9.878l4.242 4.242M9.88 9.88l-3.29-3.29m7.532 7.532l3.29 3.29M3 3l3.59 3.59m0 0A9.953 9.953 0 0112 5c4.478 0 8.268 2.943 9.543 7a10.025 10.025 0 01-4.132 5.411m0 0L21 21" />
                    </svg>
                  ) : (
                    <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M2.458 12C3.732 7.943 7.523 5 12 5c4.478 0 8.268 2.943 9.542 7-1.274 4.057-5.064 7-9.542 7-4.477 0-8.268-2.943-9.542-7z" />
                    </svg>
                  )}
                </button>
                <button
                  onClick={() => copyKey(keys.anon!.full_key, 'anon')}
                  className="p-2 rounded-lg hover:bg-[#2a2a2a] text-gray-400 hover:text-green-400 transition-colors flex-shrink-0"
                  title="Copy full anon key"
                >
                  {copiedKeys['anon'] ? (
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
          )}

          {/* Service role key */}
          {keys.service_role && (
            <div className="bg-[#0f0f0f] border border-orange-500/20 rounded-xl p-5">
              <div className="flex items-center justify-between mb-3">
                <div>
                  <div className="flex items-center space-x-2">
                    <p className="text-sm font-semibold text-white">service_role</p>
                    <span className="px-2 py-0.5 bg-orange-500/10 text-orange-400 text-xs rounded-full font-medium">secret</span>
                  </div>
                  <p className="text-xs text-gray-500 mt-0.5">Bypasses RLS — never expose in client-side code</p>
                </div>
              </div>
              <div className="flex items-center space-x-2">
                <code className="flex-1 text-sm text-orange-400 font-mono bg-[#1a1a1a] px-3 py-2 rounded-lg border border-orange-500/20 overflow-x-auto whitespace-nowrap">
                  {visibleKeys['service_role'] ? keys.service_role.full_key : previewKey(keys.service_role.full_key)}
                </code>
                <button
                  onClick={() => setVisibleKeys(prev => ({ ...prev, service_role: !prev['service_role'] }))}
                  className="p-2 rounded-lg hover:bg-[#2a2a2a] text-gray-400 hover:text-white transition-colors flex-shrink-0"
                  title={visibleKeys['service_role'] ? 'Hide' : 'Reveal full key'}
                >
                  {visibleKeys['service_role'] ? (
                    <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13.875 18.825A10.05 10.05 0 0112 19c-4.478 0-8.268-2.943-9.543-7a9.97 9.97 0 011.563-3.029m5.858.908a3 3 0 114.243 4.243M9.878 9.878l4.242 4.242M9.88 9.88l-3.29-3.29m7.532 7.532l3.29 3.29M3 3l3.59 3.59m0 0A9.953 9.953 0 0112 5c4.478 0 8.268 2.943 9.543 7a10.025 10.025 0 01-4.132 5.411m0 0L21 21" />
                    </svg>
                  ) : (
                    <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M2.458 12C3.732 7.943 7.523 5 12 5c4.478 0 8.268 2.943 9.542 7-1.274 4.057-5.064 7-9.542 7-4.477 0-8.268-2.943-9.542-7z" />
                    </svg>
                  )}
                </button>
                <button
                  onClick={() => copyKey(keys.service_role!.full_key, 'service_role')}
                  className="p-2 rounded-lg hover:bg-[#2a2a2a] text-gray-400 hover:text-orange-400 transition-colors flex-shrink-0"
                  title="Copy full service_role key"
                >
                  {copiedKeys['service_role'] ? (
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
          )}

          {/* .env snippet */}
          <div className="bg-[#0f0f0f] border border-[#2a2a2a] rounded-xl p-5">
            <p className="text-xs font-semibold text-gray-400 uppercase tracking-wider mb-3">.env snippet</p>
            <code className="block text-xs font-mono text-gray-300 bg-[#1a1a1a] p-4 rounded-lg overflow-x-auto whitespace-pre">
{`NEXT_PUBLIC_ZENDBX_URL=${apiUrl}
NEXT_PUBLIC_ZENDBX_ANON_KEY=${keys.anon?.full_key || ''}
ZENDBX_SERVICE_ROLE_KEY=${keys.service_role?.full_key || ''}`}
            </code>
            <button
              onClick={() =>
                copyKey(
                  `NEXT_PUBLIC_ZENDBX_URL=${apiUrl}\nNEXT_PUBLIC_ZENDBX_ANON_KEY=${keys.anon?.full_key || ''}\nZENDBX_SERVICE_ROLE_KEY=${keys.service_role?.full_key || ''}`,
                  'env'
                )
              }
              className="mt-3 flex items-center space-x-1.5 text-xs text-gray-400 hover:text-white transition-colors"
            >
              {copiedKeys['env'] ? (
                <svg className="w-3.5 h-3.5 text-green-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                </svg>
              ) : (
                <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 16H6a2 2 0 01-2-2V6a2 2 0 012-2h8a2 2 0 012 2v2m-6 12h8a2 2 0 002-2v-8a2 2 0 00-2-2h-8a2 2 0 00-2 2v8a2 2 0 002 2z" />
                </svg>
              )}
              <span>{copiedKeys['env'] ? 'Copied!' : 'Copy .env snippet'}</span>
            </button>
          </div>
        </div>
      )}
    </div>
  );
}

// Backups Settings Component
function BackupsSettings({ projectId }: { projectId: string }) {
  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-lg font-semibold text-white mb-1">Backup Settings</h2>
        <p className="text-sm text-gray-400">Configure automatic backups for your project</p>
      </div>

      <div className="bg-[#0f0f0f] border border-[#2a2a2a] rounded-xl p-6 space-y-4">
        <div className="flex items-center justify-between">
          <div>
            <h3 className="text-sm font-medium text-white">Automatic Backups</h3>
            <p className="text-xs text-gray-500 mt-1">Enable daily automatic backups</p>
          </div>
          <label className="relative inline-flex items-center cursor-pointer">
            <input type="checkbox" className="sr-only peer" />
            <div className="w-11 h-6 bg-[#2a2a2a] peer-focus:outline-none rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-orange-500"></div>
          </label>
        </div>

        <div>
          <label className="block text-sm font-medium text-gray-300 mb-2">Backup Frequency</label>
          <select className="w-full bg-[#1a1a1a] border border-[#2a2a2a] rounded-lg px-3 py-2 text-white focus:outline-none focus:border-orange-500">
            <option>Daily at 2:00 AM</option>
            <option>Every 12 hours</option>
            <option>Every 6 hours</option>
            <option>Weekly</option>
          </select>
        </div>

        <div>
          <label className="block text-sm font-medium text-gray-300 mb-2">Retention Period</label>
          <select className="w-full bg-[#1a1a1a] border border-[#2a2a2a] rounded-lg px-3 py-2 text-white focus:outline-none focus:border-orange-500">
            <option>7 days</option>
            <option>14 days</option>
            <option>30 days</option>
            <option>90 days</option>
          </select>
        </div>

        <div className="pt-4 border-t border-[#2a2a2a]">
          <button className="px-4 py-2 bg-orange-500 hover:bg-orange-600 text-white text-sm font-semibold rounded-lg transition-colors">
            Save Backup Settings
          </button>
        </div>
      </div>
    </div>
  );
}

// Configuration Settings Component
function ConfigurationSettings({ projectId }: { projectId: string }) {
  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-lg font-semibold text-white mb-1">Configuration</h2>
        <p className="text-sm text-gray-400">Advanced project configuration options</p>
      </div>

      <div className="bg-[#0f0f0f] border border-[#2a2a2a] rounded-xl p-6 space-y-4">
        <div>
          <label className="block text-sm font-medium text-gray-300 mb-2">Environment</label>
          <select className="w-full bg-[#1a1a1a] border border-[#2a2a2a] rounded-lg px-3 py-2 text-white focus:outline-none focus:border-orange-500">
            <option>Production</option>
            <option>Development</option>
            <option>Staging</option>
          </select>
        </div>

        <div>
          <label className="block text-sm font-medium text-gray-300 mb-2">Time Zone</label>
          <select className="w-full bg-[#1a1a1a] border border-[#2a2a2a] rounded-lg px-3 py-2 text-white focus:outline-none focus:border-orange-500">
            <option>UTC</option>
            <option>America/New_York</option>
            <option>Europe/London</option>
            <option>Asia/Tokyo</option>
          </select>
        </div>

        <div className="flex items-center justify-between">
          <div>
            <h3 className="text-sm font-medium text-white">Enable CORS</h3>
            <p className="text-xs text-gray-500 mt-1">Allow cross-origin requests</p>
          </div>
          <label className="relative inline-flex items-center cursor-pointer">
            <input type="checkbox" className="sr-only peer" defaultChecked />
            <div className="w-11 h-6 bg-[#2a2a2a] peer-focus:outline-none rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-orange-500"></div>
          </label>
        </div>

        <div className="pt-4 border-t border-[#2a2a2a]">
          <button className="px-4 py-2 bg-orange-500 hover:bg-orange-600 text-white text-sm font-semibold rounded-lg transition-colors">
            Save Configuration
          </button>
        </div>
      </div>
    </div>
  );
}

// Database Settings Component
function DatabaseSettings({ projectId }: { projectId: string }) {
  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-lg font-semibold text-white mb-1">Database Settings</h2>
        <p className="text-sm text-gray-400">Configure database connection and settings</p>
      </div>

      <div className="bg-[#0f0f0f] border border-[#2a2a2a] rounded-xl p-6 space-y-4">
        <div>
          <label className="block text-sm font-medium text-gray-300 mb-2">Connection String</label>
          <input
            type="password"
            className="w-full bg-[#1a1a1a] border border-[#2a2a2a] rounded-lg px-3 py-2 text-white focus:outline-none focus:border-orange-500"
            value="postgresql://***:***@localhost:5432/***"
            readOnly
          />
        </div>

        <div>
          <label className="block text-sm font-medium text-gray-300 mb-2">Max Connections</label>
          <input
            type="number"
            className="w-full bg-[#1a1a1a] border border-[#2a2a2a] rounded-lg px-3 py-2 text-white focus:outline-none focus:border-orange-500"
            defaultValue={20}
          />
        </div>

        <div className="flex items-center justify-between">
          <div>
            <h3 className="text-sm font-medium text-white">Connection Pooling</h3>
            <p className="text-xs text-gray-500 mt-1">Enable connection pooling for better performance</p>
          </div>
          <label className="relative inline-flex items-center cursor-pointer">
            <input type="checkbox" className="sr-only peer" defaultChecked />
            <div className="w-11 h-6 bg-[#2a2a2a] peer-focus:outline-none rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-orange-500"></div>
          </label>
        </div>

        <div className="pt-4 border-t border-[#2a2a2a]">
          <button className="px-4 py-2 bg-orange-500 hover:bg-orange-600 text-white text-sm font-semibold rounded-lg transition-colors">
            Save Database Settings
          </button>
        </div>
      </div>
    </div>
  );
}

// Authentication Settings Component
function AuthenticationSettings({ projectId }: { projectId: string }) {
  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-lg font-semibold text-white mb-1">Authentication Settings</h2>
        <p className="text-sm text-gray-400">Configure authentication and security options</p>
      </div>

      <div className="bg-[#0f0f0f] border border-[#2a2a2a] rounded-xl p-6 space-y-4">
        <div className="flex items-center justify-between">
          <div>
            <h3 className="text-sm font-medium text-white">Email Verification</h3>
            <p className="text-xs text-gray-500 mt-1">Require email verification for new users</p>
          </div>
          <label className="relative inline-flex items-center cursor-pointer">
            <input type="checkbox" className="sr-only peer" defaultChecked />
            <div className="w-11 h-6 bg-[#2a2a2a] peer-focus:outline-none rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-orange-500"></div>
          </label>
        </div>

        <div className="flex items-center justify-between">
          <div>
            <h3 className="text-sm font-medium text-white">Two-Factor Authentication</h3>
            <p className="text-xs text-gray-500 mt-1">Enable 2FA for enhanced security</p>
          </div>
          <label className="relative inline-flex items-center cursor-pointer">
            <input type="checkbox" className="sr-only peer" />
            <div className="w-11 h-6 bg-[#2a2a2a] peer-focus:outline-none rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-orange-500"></div>
          </label>
        </div>

        <div>
          <label className="block text-sm font-medium text-gray-300 mb-2">Session Timeout (minutes)</label>
          <input
            type="number"
            className="w-full bg-[#1a1a1a] border border-[#2a2a2a] rounded-lg px-3 py-2 text-white focus:outline-none focus:border-orange-500"
            defaultValue={1440}
          />
        </div>

        <div className="pt-4 border-t border-[#2a2a2a]">
          <button className="px-4 py-2 bg-orange-500 hover:bg-orange-600 text-white text-sm font-semibold rounded-lg transition-colors">
            Save Auth Settings
          </button>
        </div>
      </div>
    </div>
  );
}

// Storage Settings Component
function StorageSettings({ projectId, project }: { projectId: string; project: Project | null }) {
  const formatBytes = (bytes: number) => {
    if (!bytes) return '0 B';
    const k = 1024;
    const sizes = ['B', 'KB', 'MB', 'GB'];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return `${parseFloat((bytes / Math.pow(k, i)).toFixed(1))} ${sizes[i]}`;
  };

  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-lg font-semibold text-white mb-1">Storage Settings</h2>
        <p className="text-sm text-gray-400">Configure storage options and limits</p>
      </div>

      <div className="bg-[#0f0f0f] border border-[#2a2a2a] rounded-xl p-6 space-y-4">
        <div>
          <label className="block text-sm font-medium text-gray-300 mb-2">Current Storage Usage</label>
          <div className="text-2xl font-bold text-white">
            {project ? formatBytes(project.storage_used) : '0 B'}
          </div>
          <div className="text-sm text-gray-500 mt-1">
            of {project ? formatBytes(project.max_storage) : '0 B'} available
          </div>
        </div>

        <div>
          <label className="block text-sm font-medium text-gray-300 mb-2">Storage Provider</label>
          <select className="w-full bg-[#1a1a1a] border border-[#2a2a2a] rounded-lg px-3 py-2 text-white focus:outline-none focus:border-orange-500">
            <option>MinIO (Local)</option>
            <option>AWS S3</option>
            <option>Cloudflare R2</option>
            <option>Backblaze B2</option>
          </select>
        </div>

        <div>
          <label className="block text-sm font-medium text-gray-300 mb-2">Max File Size (MB)</label>
          <input
            type="number"
            className="w-full bg-[#1a1a1a] border border-[#2a2a2a] rounded-lg px-3 py-2 text-white focus:outline-none focus:border-orange-500"
            defaultValue={50}
          />
        </div>

        <div>
          <label className="block text-sm font-medium text-gray-300 mb-2">Allowed File Types</label>
          <input
            type="text"
            className="w-full bg-[#1a1a1a] border border-[#2a2a2a] rounded-lg px-3 py-2 text-white focus:outline-none focus:border-orange-500"
            placeholder="image/*, video/*, application/pdf"
          />
        </div>

        <div className="pt-4 border-t border-[#2a2a2a]">
          <button className="px-4 py-2 bg-orange-500 hover:bg-orange-600 text-white text-sm font-semibold rounded-lg transition-colors">
            Save Storage Settings
          </button>
        </div>
      </div>
    </div>
  );
}

// Migration Settings Component
function MigrationSettings({ projectId }: { projectId: string }) {
  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-lg font-semibold text-white mb-1">Database Migration</h2>
        <p className="text-sm text-gray-400">Manage database schema migrations</p>
      </div>

      <div className="bg-[#0f0f0f] border border-[#2a2a2a] rounded-xl p-6 space-y-4">
        <div className="flex items-center justify-between">
          <div>
            <h3 className="text-sm font-medium text-white">Auto-run Migrations</h3>
            <p className="text-xs text-gray-500 mt-1">Automatically apply pending migrations on deployment</p>
          </div>
          <label className="relative inline-flex items-center cursor-pointer">
            <input type="checkbox" className="sr-only peer" defaultChecked />
            <div className="w-11 h-6 bg-[#2a2a2a] peer-focus:outline-none rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-orange-500"></div>
          </label>
        </div>

        <div className="pt-4 border-t border-[#2a2a2a]">
          <div className="flex space-x-3">
            <button className="px-4 py-2 bg-orange-500 hover:bg-orange-600 text-white text-sm font-semibold rounded-lg transition-colors">
              Run Pending Migrations
            </button>
            <button className="px-4 py-2 bg-[#1a1a1a] hover:bg-[#242424] text-gray-300 text-sm font-semibold rounded-lg transition-colors">
              View Migration History
            </button>
          </div>
        </div>
      </div>

      <div className="bg-blue-500/5 border border-blue-500/20 rounded-xl p-6">
        <h3 className="text-sm font-semibold text-blue-400 mb-2">Migration Status</h3>
        <p className="text-sm text-gray-400">All migrations are up to date</p>
      </div>
    </div>
  );
}
