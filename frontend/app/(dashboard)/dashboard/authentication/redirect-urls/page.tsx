'use client';

import { useState, useEffect } from 'react';
import { apiFetch } from '@/lib/fetch-utils';

interface RedirectURL {
  id: string;
  redirect_url: string;
  active: boolean;
  created_at: string;
}

export default function RedirectURLsPage() {
  const [redirectUrls, setRedirectUrls] = useState<RedirectURL[]>([]);
  const [selectedProject, setSelectedProject] = useState<any>(null);
  const [allProjects, setAllProjects] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [showAddModal, setShowAddModal] = useState(false);
  const [newUrl, setNewUrl] = useState('');
  const [showProjectDropdown, setShowProjectDropdown] = useState(false);
  const [successMessage, setSuccessMessage] = useState('');
  const [showSuccessPopup, setShowSuccessPopup] = useState(false);

  // Load projects
  useEffect(() => {
    const loadProjects = async () => {
      try {
        const projectsResponse = await apiFetch('api/projects');
        
        if (projectsResponse.ok) {
          const projects = await projectsResponse.json();
          setAllProjects(projects);
          
          const projectId = localStorage.getItem('current_project_id');
          if (projectId) {
            const selected = projects.find((p: any) => p.id === projectId);
            if (selected) {
              setSelectedProject(selected);
            } else if (projects.length > 0) {
              setSelectedProject(projects[0]);
              localStorage.setItem('current_project_id', projects[0].id);
            }
          } else if (projects.length > 0) {
            setSelectedProject(projects[0]);
            localStorage.setItem('current_project_id', projects[0].id);
          }
        }
      } catch (error) {
        console.error('Failed to load projects:', error);
      }
      setLoading(false);
    };
    loadProjects();
  }, []);

  // Load redirect URLs when project changes
  useEffect(() => {
    const loadRedirectUrls = async () => {
      if (!selectedProject) return;

      try {
        const response = await apiFetch(
          `api/oauth/redirect-urls?project_id=${selectedProject.id}`
        );

        if (response.ok) {
          const urls = await response.json();
          setRedirectUrls(urls);
        }
      } catch (error) {
        console.error('Error loading redirect URLs:', error);
      }
    };

    loadRedirectUrls();
  }, [selectedProject]);

  const handleProjectChange = (project: any) => {
    setSelectedProject(project);
    localStorage.setItem('current_project_id', project.id);
    if (project.slug) localStorage.setItem('current_project_slug', project.slug);
    setShowProjectDropdown(false);
  };

  const handleAddUrl = async () => {
    if (!newUrl || !selectedProject) return;

    try {
      const response = await apiFetch(
        `api/oauth/redirect-urls?project_id=${selectedProject.id}`,
        {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ redirect_url: newUrl })
        }
      );

      if (response.ok) {
        const added = await response.json();
        setRedirectUrls([...redirectUrls, added]);
        setNewUrl('');
        setShowAddModal(false);
        setSuccessMessage('Redirect URL added successfully!');
        setShowSuccessPopup(true);
        setTimeout(() => setShowSuccessPopup(false), 3000);
      } else {
        const error = await response.json();
        setSuccessMessage(`Error: ${error.detail || 'Failed to add URL'}`);
        setShowSuccessPopup(true);
        setTimeout(() => setShowSuccessPopup(false), 5000);
      }
    } catch (error) {
      console.error('Error adding redirect URL:', error);
      setSuccessMessage('Failed to add redirect URL');
      setShowSuccessPopup(true);
      setTimeout(() => setShowSuccessPopup(false), 3000);
    }
  };

  const handleToggleActive = async (urlId: string, currentActive: boolean) => {
    try {
      const response = await apiFetch(
        `api/oauth/redirect-urls/${urlId}`,
        {
          method: 'PATCH',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ active: !currentActive })
        }
      );

      if (response.ok) {
        const updated = await response.json();
        setRedirectUrls(redirectUrls.map(url => 
          url.id === urlId ? updated : url
        ));
        setSuccessMessage(`URL ${updated.active ? 'activated' : 'deactivated'}`);
        setShowSuccessPopup(true);
        setTimeout(() => setShowSuccessPopup(false), 2000);
      }
    } catch (error) {
      console.error('Error toggling URL:', error);
    }
  };

  const handleDeleteUrl = async (urlId: string) => {
    if (!confirm('Are you sure you want to delete this redirect URL?')) return;

    try {
      const response = await apiFetch(
        `api/oauth/redirect-urls/${urlId}`,
        { method: 'DELETE' }
      );

      if (response.ok) {
        setRedirectUrls(redirectUrls.filter(url => url.id !== urlId));
        setSuccessMessage('Redirect URL deleted');
        setShowSuccessPopup(true);
        setTimeout(() => setShowSuccessPopup(false), 2000);
      }
    } catch (error) {
      console.error('Error deleting URL:', error);
    }
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-black text-white p-6 flex items-center justify-center">
        <div className="text-gray-400">Loading...</div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-black text-white p-6">
      <div className="max-w-6xl mx-auto">
        {/* Success Popup */}
        {showSuccessPopup && (
          <div className="fixed top-4 right-4 bg-orange-500 text-white px-6 py-3 rounded-lg shadow-lg z-50 animate-fade-in">
            {successMessage}
          </div>
        )}

        {/* Header */}
        <div className="mb-8">
          <div className="flex items-center justify-between mb-2">
            <h1 className="text-2xl font-bold">OAuth Redirect URLs</h1>
            
            {/* Project Selector */}
            {allProjects.length > 0 && (
              <div className="relative project-dropdown">
                <button
                  onClick={() => setShowProjectDropdown(!showProjectDropdown)}
                  className="flex items-center gap-2 px-4 py-2 bg-[#1a1a1a] border border-gray-800 rounded-lg hover:border-orange-500/50 transition-colors"
                >
                  <svg className="w-4 h-4 text-orange-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 7v10a2 2 0 002 2h14a2 2 0 002-2V9a2 2 0 00-2-2h-6l-2-2H5a2 2 0 00-2 2z" />
                  </svg>
                  <span className="text-sm font-medium">
                    {selectedProject ? selectedProject.name : 'Select Project'}
                  </span>
                  <svg className={`w-4 h-4 text-gray-400 transition-transform ${showProjectDropdown ? 'rotate-180' : ''}`} fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
                  </svg>
                </button>

                {showProjectDropdown && (
                  <div className="absolute right-0 mt-2 w-64 bg-[#1a1a1a] border border-gray-800 rounded-lg shadow-xl z-50 max-h-64 overflow-y-auto">
                    {allProjects.map((project) => (
                      <button
                        key={project.id}
                        onClick={() => handleProjectChange(project)}
                        className={`w-full text-left px-4 py-3 hover:bg-gray-800 transition-colors border-b border-gray-800 last:border-b-0 ${
                          selectedProject?.id === project.id ? 'bg-orange-500/10' : ''
                        }`}
                      >
                        <div className="flex items-center justify-between">
                          <div>
                            <p className="text-sm font-medium text-white">{project.name}</p>
                            {project.slug && (
                              <p className="text-xs text-gray-500 mt-0.5">{project.slug}</p>
                            )}
                          </div>
                          {selectedProject?.id === project.id && (
                            <svg className="w-4 h-4 text-orange-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                            </svg>
                          )}
                        </div>
                      </button>
                    ))}
                  </div>
                )}
              </div>
            )}
          </div>
          
          <p className="text-gray-400 text-sm">
            Whitelist URLs where users can be redirected after OAuth authentication
          </p>
          {selectedProject && (
            <p className="text-xs text-gray-500 mt-1">
              Project: <span className="text-orange-400">{selectedProject.name}</span>
            </p>
          )}
        </div>

        {/* Add URL Button */}
        <div className="mb-6">
          <button
            onClick={() => setShowAddModal(true)}
            className="px-4 py-2 bg-orange-500 hover:bg-orange-600 text-white rounded-lg font-medium transition-colors flex items-center gap-2"
          >
            <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
            </svg>
            Add Redirect URL
          </button>
        </div>

        {/* Redirect URLs List */}
        {redirectUrls.length === 0 ? (
          <div className="bg-[#1a1a1a] rounded-lg p-12 border border-gray-800 text-center">
            <svg className="w-16 h-16 text-gray-600 mx-auto mb-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13.828 10.172a4 4 0 00-5.656 0l-4 4a4 4 0 105.656 5.656l1.102-1.101m-.758-4.899a4 4 0 005.656 0l4-4a4 4 0 00-5.656-5.656l-1.1 1.1" />
            </svg>
            <h3 className="text-lg font-semibold text-gray-400 mb-2">No Redirect URLs</h3>
            <p className="text-sm text-gray-500 mb-4">
              Add URLs where users can be redirected after OAuth authentication
            </p>
            <button
              onClick={() => setShowAddModal(true)}
              className="px-4 py-2 bg-orange-500 hover:bg-orange-600 text-white rounded-lg text-sm font-medium transition-colors"
            >
              Add Your First URL
            </button>
          </div>
        ) : (
          <div className="space-y-3">
            {redirectUrls.map((url) => (
              <div
                key={url.id}
                className="bg-[#1a1a1a] rounded-lg p-5 border border-gray-800 hover:border-orange-500/50 transition-colors"
              >
                <div className="flex items-center justify-between">
                  <div className="flex-1">
                    <div className="flex items-center gap-3 mb-1">
                      <code className="text-orange-300 font-mono text-sm">
                        {url.redirect_url}
                      </code>
                      {url.active && (
                        <span className="px-2 py-0.5 bg-green-500/20 text-green-400 text-xs rounded-full">
                          Active
                        </span>
                      )}
                      {!url.active && (
                        <span className="px-2 py-0.5 bg-gray-700 text-gray-400 text-xs rounded-full">
                          Inactive
                        </span>
                      )}
                    </div>
                    <p className="text-xs text-gray-500">
                      Added {new Date(url.created_at).toLocaleDateString()}
                    </p>
                  </div>

                  <div className="flex items-center gap-3">
                    <label className="relative inline-flex items-center cursor-pointer">
                      <input
                        type="checkbox"
                        checked={url.active}
                        onChange={() => handleToggleActive(url.id, url.active)}
                        className="sr-only peer"
                      />
                      <div className="w-11 h-6 bg-gray-700 peer-checked:bg-orange-500 rounded-full peer peer-focus:outline-none peer-focus:ring-4 peer-focus:ring-orange-800 after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:after:translate-x-full peer-checked:after:border-white"></div>
                    </label>

                    <button
                      onClick={() => handleDeleteUrl(url.id)}
                      className="p-2 text-gray-400 hover:text-red-400 hover:bg-red-500/10 rounded-lg transition-colors"
                      title="Delete URL"
                    >
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

        {/* Help Section */}
        {selectedProject && (
          <div className="mt-8 bg-orange-500/10 border border-orange-500/30 rounded-lg p-6">
            <h3 className="text-sm font-semibold text-orange-400 mb-3">How to use</h3>
            <p className="text-xs text-gray-300 mb-4">
              When users authenticate via OAuth, they will be redirected to one of these URLs with authentication tokens in the query parameters.
            </p>
            <div className="bg-black rounded p-3">
              <p className="text-xs text-gray-400 mb-2">Example OAuth URL:</p>
              <code className="text-xs text-orange-300">
                https://api.zendbx.in/p/{selectedProject.slug}/auth/google?redirect_to=YOUR_URL
              </code>
            </div>
          </div>
        )}
      </div>

      {/* Add URL Modal */}
      {showAddModal && (
        <div className="fixed inset-0 bg-black/80 flex items-center justify-center p-4 z-50">
          <div className="bg-[#1a1a1a] rounded-lg shadow-xl max-w-md w-full p-6 border border-gray-800">
            <h2 className="text-xl font-bold mb-4">Add Redirect URL</h2>

            <div className="space-y-4 mb-6">
              <div>
                <label className="block text-sm font-medium text-gray-300 mb-2">
                  Redirect URL
                </label>
                <input
                  type="url"
                  value={newUrl}
                  onChange={(e) => setNewUrl(e.target.value)}
                  placeholder="https://yourapp.com/auth/callback"
                  className="w-full px-3 py-2 bg-black border border-gray-700 rounded-lg focus:ring-2 focus:ring-orange-500 focus:border-transparent text-white placeholder-gray-500"
                />
                <p className="text-xs text-gray-500 mt-2">
                  Users will be redirected here after successful OAuth authentication
                </p>
              </div>
            </div>

            <div className="flex gap-3">
              <button
                onClick={() => {
                  setShowAddModal(false);
                  setNewUrl('');
                }}
                className="flex-1 px-4 py-2 bg-gray-800 hover:bg-gray-700 text-white rounded-lg font-medium transition-colors"
              >
                Cancel
              </button>
              <button
                onClick={handleAddUrl}
                disabled={!newUrl}
                className="flex-1 px-4 py-2 bg-orange-500 hover:bg-orange-600 disabled:bg-gray-700 disabled:text-gray-500 text-white rounded-lg font-medium transition-colors"
              >
                Add URL
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
