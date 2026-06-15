'use client';

import { useState, useEffect } from 'react';
import { apiFetch } from '@/lib/fetch-utils';

interface Project {
  id: string;
  name: string;
  slug?: string;
  database_name: string;
  region: string;
  status: string;
  created_at: string;
}

interface ProjectKey {
  id: string;
  name: string;
  key_prefix: string;
  full_key: string;       // complete working JWT — always populated
  encrypted_key: string;  // same as full_key from backend
  role: string;
  is_active: boolean;
  created_at: string;
}

interface ProjectKeys {
  anon?: ProjectKey;
  service_role?: ProjectKey;
}

// Eye icon — open
function EyeOpen() {
  return (
    <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M2.458 12C3.732 7.943 7.523 5 12 5c4.478 0 8.268 2.943 9.542 7-1.274 4.057-5.064 7-9.542 7-4.477 0-8.268-2.943-9.542-7z" />
    </svg>
  );
}

// Eye icon — closed
function EyeOff() {
  return (
    <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13.875 18.825A10.05 10.05 0 0112 19c-4.478 0-8.268-2.943-9.543-7a9.97 9.97 0 011.563-3.029m5.858.908a3 3 0 114.243 4.243M9.878 9.878l4.242 4.242M9.88 9.88l-3.29-3.29m7.532 7.532l3.29 3.29M3 3l3.59 3.59m0 0A9.953 9.953 0 0112 5c4.478 0 8.268 2.943 9.543 7a10.025 10.025 0 01-4.132 5.411m0 0L21 21" />
    </svg>
  );
}

// Copy icon
function CopyIcon() {
  return (
    <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 16H6a2 2 0 01-2-2V6a2 2 0 012-2h8a2 2 0 012 2v2m-6 12h8a2 2 0 002-2v-8a2 2 0 00-2-2h-8a2 2 0 00-2 2v8a2 2 0 002 2z" />
    </svg>
  );
}

// Check icon
function CheckIcon() {
  return (
    <svg className="w-3.5 h-3.5 text-green-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
    </svg>
  );
}

/** Produce a Supabase-style preview: first 20 chars … last 8 chars */
function previewKey(key: string): string {
  if (!key || key.length <= 30) return key;
  return key.substring(0, 20) + '…' + key.substring(key.length - 8);
}

/** Single credential row — handles its own show/copy state */
function CredentialRow({
  label,
  badge,
  badgeColor,
  hint,
  fullKey,
  accentColor,
}: {
  label: string;
  badge: string;
  badgeColor: string;
  hint: string;
  fullKey: string;
  accentColor: string; // tailwind text-* class
}) {
  const [visible, setVisible] = useState(false);
  const [copied, setCopied] = useState(false);

  const copy = (e: React.MouseEvent) => {
    e.stopPropagation();
    navigator.clipboard.writeText(fullKey);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  const displayValue = visible ? fullKey : previewKey(fullKey);

  return (
    <div>
      <div className="flex items-center space-x-2 mb-1.5">
        <span className="text-xs font-medium text-[#ededed]">{label}</span>
        <span className={`px-2 py-0.5 rounded text-[10px] font-medium ${badgeColor}`}>{badge}</span>
        <span className="text-xs text-[#6b6b6b]">{hint}</span>
      </div>
      <div className="flex items-center space-x-2">
        <div className="flex-1 min-w-0 relative">
          <code
            className={`block text-xs ${accentColor} bg-[#111] px-3 py-2 rounded font-mono border border-[#2a2a2a] overflow-x-auto whitespace-nowrap scrollbar-thin`}
          >
            {displayValue}
          </code>
        </div>
        <button
          onClick={(e) => { e.stopPropagation(); setVisible(v => !v); }}
          title={visible ? 'Hide key' : 'Reveal full key'}
          className="p-1.5 hover:bg-[#2a2a2a] rounded text-[#6b6b6b] hover:text-[#ededed] transition-colors flex-shrink-0"
        >
          {visible ? <EyeOff /> : <EyeOpen />}
        </button>
        <button
          onClick={copy}
          title="Copy full key to clipboard"
          className="p-1.5 hover:bg-[#2a2a2a] rounded text-[#6b6b6b] hover:text-green-500 transition-colors flex-shrink-0"
        >
          {copied ? <CheckIcon /> : <CopyIcon />}
        </button>
      </div>
    </div>
  );
}

export default function ProjectsPage() {
  const [showCreateModal, setShowCreateModal] = useState(false);
  const [projects, setProjects] = useState<Project[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [copiedUrl, setCopiedUrl] = useState<string | null>(null);
  const [expandedProject, setExpandedProject] = useState<string | null>(null);
  const [projectKeys, setProjectKeys] = useState<Record<string, ProjectKeys>>({});
  const [keysLoading, setKeysLoading] = useState<Record<string, boolean>>({});
  const [newProjectKeys, setNewProjectKeys] = useState<{ anon_key: string; service_role_key: string } | null>(null);

  const [projectName, setProjectName] = useState('');
  const [description, setDescription] = useState('');
  const [error, setError] = useState('');

  useEffect(() => { fetchProjects(); }, []);

  const fetchProjects = async () => {
    try {
      const response = await apiFetch('api/projects');
      if (response.ok) setProjects(await response.json());
    } catch (err) {
      console.error('Failed to fetch projects:', err);
    }
  };

  const fetchProjectKeys = async (projectId: string) => {
    setKeysLoading(prev => ({ ...prev, [projectId]: true }));
    try {
      const response = await apiFetch(`api/projects/${projectId}/keys?reveal=true`);
      if (!response.ok) {
        console.error('Keys API error:', response.status);
        return;
      }
      const data = await response.json();

      // Normalise: backend returns full JWT in encrypted_key
      const normalise = (k: any): ProjectKey | undefined => {
        if (!k) return undefined;
        const fullKey = k.encrypted_key || k.full_key || k.key_prefix || '';
        return { ...k, full_key: fullKey, encrypted_key: fullKey };
      };

      setProjectKeys(prev => ({
        ...prev,
        [projectId]: {
          anon: normalise(data.keys?.anon),
          service_role: normalise(data.keys?.service_role),
        },
      }));
    } catch (err) {
      console.error('Failed to fetch project keys:', err);
    } finally {
      setKeysLoading(prev => ({ ...prev, [projectId]: false }));
    }
  };

  const toggleProjectExpansion = (projectId: string) => {
    if (expandedProject === projectId) {
      setExpandedProject(null);
    } else {
      setExpandedProject(projectId);
      // Only fetch once per session
      if (!projectKeys[projectId]) fetchProjectKeys(projectId);
    }
  };

  const handleDeleteProject = async (projectId: string) => {
    if (!confirm('Delete this project? This will permanently destroy the database and all data.')) return;
    try {
      const response = await apiFetch(`api/projects/${projectId}`, { method: 'DELETE' });
      if (response.ok) {
        if (localStorage.getItem('current_project_id') === projectId) {
          localStorage.removeItem('current_project_id');
        }
        fetchProjects();
      } else {
        const data = await response.json();
        alert('Failed to delete: ' + (data.detail || 'Unknown error'));
      }
    } catch {
      alert('Failed to delete project');
    }
  };

  const copyToClipboard = (text: string, label: string) => {
    navigator.clipboard.writeText(text);
    setCopiedUrl(label);
    setTimeout(() => setCopiedUrl(null), 2000);
  };

  const getApiUrl = (slug?: string) =>
    slug ? `${process.env.NEXT_PUBLIC_API_URL!}/p/${slug}` : null;

  const handleCreateProject = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsLoading(true);
    setError('');
    try {
      const response = await apiFetch('api/projects', {
        method: 'POST',
        body: JSON.stringify({ name: projectName, description: description || null }),
      });
      const data = await response.json();
      if (!response.ok) throw new Error(data.detail || 'Failed to create project');

      if (data.anon_key && data.service_role_key) {
        setNewProjectKeys({ anon_key: data.anon_key, service_role_key: data.service_role_key });
      }
      if (projects.length === 0) localStorage.setItem('current_project_id', data.id);

      setShowCreateModal(false);
      setProjectName('');
      setDescription('');
      fetchProjects();
    } catch (err: any) {
      setError(err.message);
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="p-6 space-y-6 max-w-7xl">

      {/* ── New-project keys banner ── */}
      {newProjectKeys && (
        <div className="bg-green-500/10 border border-green-500/20 rounded-lg p-6">
          <div className="flex items-start space-x-3">
            <svg className="w-6 h-6 text-green-500 flex-shrink-0 mt-0.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
            </svg>
            <div className="flex-1">
              <h3 className="text-sm font-semibold text-green-500 mb-1">Project created!</h3>
              <p className="text-xs text-[#a1a1a1] mb-4">
                Copy your keys now. You can also retrieve them any time from the API Keys section below.
              </p>
              <div className="space-y-3">
                <CredentialRow
                  label="anon (public)"
                  badge="public"
                  badgeColor="bg-green-500/10 text-green-500"
                  hint="— safe for client-side use"
                  fullKey={newProjectKeys.anon_key}
                  accentColor="text-green-400"
                />
                <CredentialRow
                  label="service_role (secret)"
                  badge="secret"
                  badgeColor="bg-orange-500/10 text-orange-400"
                  hint="— full access, keep private"
                  fullKey={newProjectKeys.service_role_key}
                  accentColor="text-orange-400"
                />
              </div>
              <button
                onClick={() => setNewProjectKeys(null)}
                className="mt-4 text-xs text-green-500 hover:text-green-400 font-medium"
              >
                Dismiss
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ── Header ── */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-xl font-semibold text-[#ededed]">All Projects</h1>
          <p className="text-xs text-[#a1a1a1] mt-1">Manage your database projects</p>
        </div>
        <button
          onClick={() => setShowCreateModal(true)}
          className="flex items-center space-x-1.5 px-3 py-1.5 bg-orange-600 hover:bg-orange-500 text-white rounded text-xs font-medium transition-colors"
        >
          <svg className="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
          </svg>
          <span>New Project</span>
        </button>
      </div>

      {/* ── Project list ── */}
      {projects.length === 0 ? (
        <div className="bg-[#181818] border-2 border-dashed border-[#2a2a2a] rounded-lg p-12 text-center">
          <div className="w-16 h-16 bg-[#2a2a2a] rounded-full flex items-center justify-center mx-auto mb-4">
            <svg className="w-8 h-8 text-[#6b6b6b]" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 7v10c0 2.21 3.582 4 8 4s8-1.79 8-4V7M4 7c0 2.21 3.582 4 8 4s8-1.79 8-4M4 7c0-2.21 3.582-4 8-4s8 1.79 8 4" />
            </svg>
          </div>
          <h3 className="text-sm font-semibold text-[#ededed] mb-2">No projects yet</h3>
          <p className="text-xs text-[#6b6b6b] mb-4 max-w-md mx-auto">
            Create your first project to get started with your own PostgreSQL database.
          </p>
          <button
            onClick={() => setShowCreateModal(true)}
            className="inline-flex items-center space-x-2 px-4 py-2 bg-orange-600 hover:bg-orange-500 text-white rounded text-xs font-medium transition-colors"
          >
            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
            </svg>
            <span>Create Your First Project</span>
          </button>
        </div>
      ) : (
        <div className="space-y-3">
          {projects.map((project) => {
            const apiUrl = getApiUrl(project.slug);
            const keys = projectKeys[project.id];
            const isExpanded = expandedProject === project.id;
            const isKeysLoading = keysLoading[project.id];

            return (
              <div
                key={project.id}
                className="bg-[#181818] border border-[#2a2a2a] rounded-lg p-4 hover:border-[#3a3a3a] transition-all"
              >
                {/* Project header row */}
                <div className="flex items-center justify-between">
                  <div
                    className="flex items-center space-x-4 flex-1 cursor-pointer group"
                    onClick={() => {
                      localStorage.setItem('current_project_id', project.id);
                      if (project.slug) localStorage.setItem('current_project_slug', project.slug);
                      window.location.href = '/dashboard';
                    }}
                  >
                    <div className="w-10 h-10 bg-gradient-to-br from-orange-600 to-orange-500 rounded flex items-center justify-center flex-shrink-0">
                      <svg className="w-5 h-5 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 7v10c0 2.21 3.582 4 8 4s8-1.79 8-4V7M4 7c0 2.21 3.582 4 8 4s8-1.79 8-4M4 7c0-2.21 3.582-4 8-4s8 1.79 8 4" />
                      </svg>
                    </div>
                    <div>
                      <h3 className="text-sm font-semibold text-[#ededed] group-hover:text-orange-500 transition-colors">
                        {project.name}
                        <span className="ml-2 text-xs text-orange-500 opacity-0 group-hover:opacity-100 transition-opacity">Click to open →</span>
                      </h3>
                      <div className="flex flex-wrap items-center gap-x-3 gap-y-1 mt-1">
                        <span className="text-xs text-[#6b6b6b]">
                          ID: <span className="text-[#a1a1a1] font-mono">{project.id}</span>
                          <button
                            onClick={(e) => { e.stopPropagation(); copyToClipboard(project.id, `id-${project.id}`); }}
                            className="ml-1 p-0.5 hover:bg-[#2a2a2a] rounded text-[#6b6b6b] hover:text-orange-500 transition-colors inline-flex"
                          >
                            {copiedUrl === `id-${project.id}` ? <CheckIcon /> : <CopyIcon />}
                          </button>
                        </span>
                        <span className="text-xs text-[#6b6b6b]">DB: <span className="text-[#a1a1a1] font-mono">{project.database_name}</span></span>
                        <span className={`text-xs px-2 py-0.5 rounded ${project.status === 'active' ? 'bg-green-900/20 text-green-400' : 'bg-yellow-900/20 text-yellow-400'}`}>
                          {project.status}
                        </span>
                      </div>
                    </div>
                  </div>

                  {/* Action buttons */}
                  <div className="flex items-center space-x-2 ml-4">
                    <button
                      onClick={() => {
                        localStorage.setItem('current_project_id', project.id);
                        if (project.slug) localStorage.setItem('current_project_slug', project.slug);
                        window.location.href = '/dashboard';
                      }}
                      className="px-3 py-1.5 bg-orange-600 hover:bg-orange-500 text-white rounded text-xs font-medium transition-colors"
                    >
                      Open
                    </button>
                    <button
                      onClick={() => {
                        localStorage.setItem('current_project_id', project.id);
                        window.location.href = '/dashboard/sql-editor';
                      }}
                      className="px-3 py-1.5 bg-blue-600 hover:bg-blue-500 text-white rounded text-xs font-medium transition-colors"
                    >
                      SQL Editor
                    </button>
                    <button
                      onClick={() => { window.location.href = `/dashboard/projects/${project.id}/team`; }}
                      className="px-3 py-1.5 bg-[#2a2a2a] hover:bg-[#3a3a3a] text-[#ededed] rounded text-xs font-medium transition-colors"
                    >
                      Team
                    </button>
                    <button
                      onClick={() => handleDeleteProject(project.id)}
                      className="px-3 py-1.5 bg-red-900/20 hover:bg-red-900/40 text-red-400 border border-red-800 rounded text-xs font-medium transition-colors"
                    >
                      Delete
                    </button>
                  </div>
                </div>

                {/* API URL + keys section */}
                {apiUrl && (
                  <div className="mt-3 pt-3 border-t border-[#2a2a2a]">
                    {/* Project URL */}
                    <div className="mb-2">
                      <div className="flex items-center space-x-2 mb-1">
                        <svg className="w-3.5 h-3.5 text-orange-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13.828 10.172a4 4 0 00-5.656 0l-4 4a4 4 0 105.656 5.656l1.102-1.101m-.758-4.899a4 4 0 005.656 0l4-4a4 4 0 00-5.656-5.656l-1.1 1.1" />
                        </svg>
                        <span className="text-xs font-medium text-[#ededed]">Project URL</span>
                      </div>
                      <div className="flex items-center space-x-2">
                        <code className="text-xs text-[#a1a1a1] bg-[#111] px-2.5 py-1.5 rounded font-mono border border-[#2a2a2a] flex-1 overflow-x-auto whitespace-nowrap">
                          {apiUrl}
                        </code>
                        <button
                          onClick={() => copyToClipboard(apiUrl, `url-${project.id}`)}
                          className="p-1.5 hover:bg-[#2a2a2a] rounded text-[#6b6b6b] hover:text-orange-500 transition-colors flex-shrink-0"
                          title="Copy Project URL"
                        >
                          {copiedUrl === `url-${project.id}` ? <CheckIcon /> : <CopyIcon />}
                        </button>
                      </div>
                    </div>

                    {/* Toggle API keys */}
                    <button
                      onClick={() => toggleProjectExpansion(project.id)}
                      className="mt-2 flex items-center space-x-2 text-xs text-orange-500 hover:text-orange-400 font-medium transition-colors"
                    >
                      <svg className={`w-4 h-4 transition-transform ${isExpanded ? 'rotate-180' : ''}`} fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
                      </svg>
                      <span>{isExpanded ? 'Hide' : 'Show'} API Keys</span>
                    </button>

                    {/* Keys panel */}
                    {isExpanded && (
                      <div className="mt-3 pt-3 border-t border-[#2a2a2a] space-y-3">
                        {isKeysLoading ? (
                          <p className="text-xs text-[#6b6b6b]">Loading keys…</p>
                        ) : !keys ? (
                          <p className="text-xs text-red-400">Could not load keys. <button onClick={() => fetchProjectKeys(project.id)} className="underline hover:text-red-300">Retry</button></p>
                        ) : (
                          <>
                            {keys.anon && (
                              <CredentialRow
                                label="anon"
                                badge="public"
                                badgeColor="bg-green-500/10 text-green-500"
                                hint="— safe for client-side"
                                fullKey={keys.anon.full_key}
                                accentColor="text-green-400"
                              />
                            )}
                            {keys.service_role && (
                              <CredentialRow
                                label="service_role"
                                badge="secret"
                                badgeColor="bg-orange-500/10 text-orange-400"
                                hint="— full access, keep private"
                                fullKey={keys.service_role.full_key}
                                accentColor="text-orange-400"
                              />
                            )}
                            <div className="bg-orange-500/5 border border-orange-500/20 rounded p-3">
                              <p className="text-xs text-orange-400">
                                <span className="font-semibold">Security note:</span> Keep the service_role key private — it bypasses row-level security.
                              </p>
                            </div>
                          </>
                        )}
                      </div>
                    )}
                  </div>
                )}
              </div>
            );
          })}
        </div>
      )}

      {/* ── Create Project Modal ── */}
      {showCreateModal && (
        <div
          className="fixed inset-0 bg-black/60 backdrop-blur-sm z-50 flex items-center justify-center p-4"
          onClick={() => setShowCreateModal(false)}
        >
          <div
            className="bg-[#181818] border border-[#2a2a2a] rounded-lg p-6 max-w-md w-full"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex items-center justify-between mb-6">
              <h2 className="text-lg font-semibold text-[#ededed]">Create a new project</h2>
              <button
                onClick={() => setShowCreateModal(false)}
                className="p-1 rounded hover:bg-[#2a2a2a] text-[#a1a1a1] hover:text-[#ededed] transition-colors"
              >
                <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                </svg>
              </button>
            </div>

            <form onSubmit={handleCreateProject} className="space-y-4">
              {error && (
                <div className="bg-red-900/20 border border-red-800 rounded p-3">
                  <p className="text-red-400 text-sm">{error}</p>
                </div>
              )}
              <div>
                <label className="block text-sm font-medium text-[#ededed] mb-2">Project Name</label>
                <input
                  type="text"
                  value={projectName}
                  onChange={(e) => setProjectName(e.target.value)}
                  placeholder="My Awesome Project"
                  required
                  className="w-full px-3 py-2 bg-[#1c1c1c] border border-[#2a2a2a] rounded text-sm text-[#ededed] placeholder-[#6b6b6b] focus:outline-none focus:ring-2 focus:ring-orange-500"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-[#ededed] mb-2">Description (optional)</label>
                <textarea
                  value={description}
                  onChange={(e) => setDescription(e.target.value)}
                  placeholder="What's this project for?"
                  rows={3}
                  className="w-full px-3 py-2 bg-[#1c1c1c] border border-[#2a2a2a] rounded text-sm text-[#ededed] placeholder-[#6b6b6b] focus:outline-none focus:ring-2 focus:ring-orange-500 resize-none"
                />
              </div>
              <div className="flex items-center justify-end space-x-3 pt-4">
                <button
                  type="button"
                  onClick={() => setShowCreateModal(false)}
                  className="px-4 py-2 text-[#a1a1a1] hover:text-[#ededed] text-sm font-medium transition-colors"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={isLoading}
                  className="px-4 py-2 bg-orange-600 hover:bg-orange-500 text-white rounded text-sm font-medium transition-colors disabled:opacity-50"
                >
                  {isLoading ? 'Creating…' : 'Create Project'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
