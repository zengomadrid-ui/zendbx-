'use client';

import { useState, useEffect } from 'react';

interface Provider {
  id: string;
  name: string;
  description: string;
  icon: React.ReactNode;
  enabled: boolean;
  configured: boolean;
  canDisable: boolean;
}

export default function ProvidersPage() {
  const [providers, setProviders] = useState<Provider[]>([
    {
      id: 'email',
      name: 'Email & Password',
      description: 'Traditional email and password authentication',
      icon: (
        <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 8l7.89 5.26a2 2 0 002.22 0L21 8M5 19h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v10a2 2 0 002 2z" />
        </svg>
      ),
      enabled: true,
      configured: true,
      canDisable: false
    },
    {
      id: 'google',
      name: 'Google OAuth',
      description: 'Sign in with Google accounts',
      icon: (
        <svg className="w-6 h-6" viewBox="0 0 24 24">
          <path fill="#4285F4" d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z"/>
          <path fill="#34A853" d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"/>
          <path fill="#FBBC05" d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z"/>
          <path fill="#EA4335" d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z"/>
        </svg>
      ),
      enabled: false,
      configured: false,
      canDisable: true
    },
    {
      id: 'github',
      name: 'GitHub OAuth',
      description: 'Sign in with GitHub accounts',
      icon: (
        <svg className="w-6 h-6" fill="currentColor" viewBox="0 0 24 24">
          <path d="M12 0c-6.626 0-12 5.373-12 12 0 5.302 3.438 9.8 8.207 11.387.599.111.793-.261.793-.577v-2.234c-3.338.726-4.033-1.416-4.033-1.416-.546-1.387-1.333-1.756-1.333-1.756-1.089-.745.083-.729.083-.729 1.205.084 1.839 1.237 1.839 1.237 1.07 1.834 2.807 1.304 3.492.997.107-.775.418-1.305.762-1.604-2.665-.305-5.467-1.334-5.467-5.931 0-1.311.469-2.381 1.236-3.221-.124-.303-.535-1.524.117-3.176 0 0 1.008-.322 3.301 1.23.957-.266 1.983-.399 3.003-.404 1.02.005 2.047.138 3.006.404 2.291-1.552 3.297-1.23 3.297-1.23.653 1.653.242 2.874.118 3.176.77.84 1.235 1.911 1.235 3.221 0 4.609-2.807 5.624-5.479 5.921.43.372.823 1.102.823 2.222v3.293c0 .319.192.694.801.576 4.765-1.589 8.199-6.086 8.199-11.386 0-6.627-5.373-12-12-12z"/>
        </svg>
      ),
      enabled: false,
      configured: false,
      canDisable: true
    },
    {
      id: 'magic-link',
      name: 'Magic Link',
      description: 'Passwordless authentication via email',
      icon: (
        <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13.828 10.172a4 4 0 00-5.656 0l-4 4a4 4 0 105.656 5.656l1.102-1.101m-.758-4.899a4 4 0 005.656 0l4-4a4 4 0 00-5.656-5.656l-1.1 1.1" />
        </svg>
      ),
      enabled: false,
      configured: false,
      canDisable: true
    }
  ]);

  const [showConfigModal, setShowConfigModal] = useState(false);
  const [selectedProvider, setSelectedProvider] = useState<string | null>(null);
  const [clientId, setClientId] = useState('');
  const [clientSecret, setClientSecret] = useState('');
  const [callbackUrl, setCallbackUrl] = useState('');
  const [showSuccessPopup, setShowSuccessPopup] = useState(false);
  const [successMessage, setSuccessMessage] = useState('');
  const [selectedProject, setSelectedProject] = useState<any>(null);
  const [loadingProject, setLoadingProject] = useState(true);
  const [allProjects, setAllProjects] = useState<any[]>([]);
  const [showProjectDropdown, setShowProjectDropdown] = useState(false);

  const totalProviders = providers.length;
  const enabledProviders = providers.filter(p => p.enabled).length;
  const configurableProviders = providers.filter(p => p.canDisable).length;

  const baseUrl = process.env.NEXT_PUBLIC_BACKEND_URL || 'http://localhost:8000';

  useEffect(() => {
    // Load all projects and selected project
    const loadProjects = async () => {
      try {
        const token = localStorage.getItem('token');
        
        // Load all projects
        const projectsResponse = await fetch(
          `${process.env.NEXT_PUBLIC_API_URL}/api/projects`,
          {
            headers: { 'Authorization': `Bearer ${token}` },
          }
        );
        
        if (projectsResponse.ok) {
          const projects = await projectsResponse.json();
          setAllProjects(projects);
          
          // Load selected project
          const projectId = localStorage.getItem('selectedProject');
          if (projectId) {
            const selected = projects.find((p: any) => p.id === projectId);
            if (selected) {
              console.log('Loaded project:', selected);
              setSelectedProject(selected);
            }
          } else if (projects.length > 0) {
            // Auto-select first project if none selected
            console.log('Auto-selecting first project:', projects[0]);
            setSelectedProject(projects[0]);
            localStorage.setItem('selectedProject', projects[0].id);
          }
        }
      } catch (error) {
        console.error('Failed to load projects:', error);
      }
      setLoadingProject(false);
    };
    loadProjects();
  }, []);

  // Load provider configurations when project changes
  useEffect(() => {
    const loadProviderConfigs = async () => {
      if (!selectedProject) {
        console.log('⚠️ No project selected, skipping provider config load');
        return;
      }
      
      try {
        const token = localStorage.getItem('token');
        
        // Check if backend is accessible
        if (!process.env.NEXT_PUBLIC_API_URL) {
          console.warn('NEXT_PUBLIC_API_URL not configured');
          return;
        }
        
        console.log('📡 Loading provider configs for project:', selectedProject.id);
        
        const response = await fetch(
          `${process.env.NEXT_PUBLIC_API_URL}/api/oauth/providers?project_id=${selectedProject.id}`,
          {
            headers: { 'Authorization': `Bearer ${token}` },
          }
        );
        
        console.log('📡 Provider configs response status:', response.status);
        
        if (response.ok) {
          const configs = await response.json();
          console.log('✅ Loaded provider configs:', configs);
          
          // Update providers state with configured status
          setProviders(prevProviders => 
            prevProviders.map(p => {
              const config = configs.find((c: any) => c.provider === p.id);
              if (config) {
                console.log(`✅ Provider ${p.id} is configured and ${config.enabled ? 'enabled' : 'disabled'}`);
                return { ...p, configured: true, enabled: config.enabled };
              }
              console.log(`⚠️ Provider ${p.id} is NOT configured`);
              return p;
            })
          );
        } else {
          console.error('❌ Failed to load provider configs:', response.status, response.statusText);
        }
      } catch (error) {
        console.error('❌ Error loading provider configurations:', error);
        // Don't show error to user - just log it
        // The page will still work, just won't show configured status
      }
    };
    
    loadProviderConfigs();
  }, [selectedProject]);

  const handleProjectChange = (project: any) => {
    setSelectedProject(project);
    localStorage.setItem('selectedProject', project.id);
    setShowProjectDropdown(false);
    // Reload providers for new project
    window.location.reload();
  };

  useEffect(() => {
    if (selectedProvider) {
      setCallbackUrl(`${baseUrl}/api/auth/oauth/${selectedProvider}/callback`);
    }
  }, [selectedProvider, baseUrl]);

  // Close dropdown when clicking outside
  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      const target = event.target as HTMLElement;
      if (showProjectDropdown && !target.closest('.project-dropdown')) {
        setShowProjectDropdown(false);
      }
    };

    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, [showProjectDropdown]);

  const handleConfigure = (providerId: string) => {
    setSelectedProvider(providerId);
    // Always reset to empty fields
    setClientId('');
    setClientSecret('');
    setCallbackUrl(`${baseUrl}/api/auth/oauth/${providerId}/callback`);
    setShowConfigModal(true);
  };

  const handleToggle = async (providerId: string) => {
    if (!selectedProject) return;
    
    // Don't allow toggling if provider is not configured
    const provider = providers.find(p => p.id === providerId);
    console.log('🔄 Toggle attempt for provider:', providerId);
    console.log('🔄 Provider state:', provider);
    console.log('🔄 All providers:', providers);
    
    if (!provider?.configured) {
      console.warn('❌ Cannot toggle unconfigured provider');
      setSuccessMessage('⚠️ Please configure this provider first before enabling it');
      setShowSuccessPopup(true);
      setTimeout(() => setShowSuccessPopup(false), 3000);
      return;
    }
    
    console.log('✅ Provider is configured, proceeding with toggle');
    
    try {
      const token = localStorage.getItem('token');
      const response = await fetch(
        `${process.env.NEXT_PUBLIC_API_URL}/api/oauth/providers/${providerId}/toggle?project_id=${selectedProject.id}`,
        {
          method: 'PATCH',
          headers: {
            'Authorization': `Bearer ${token}`,
          },
        }
      );

      console.log('🔄 Toggle response status:', response.status);

      if (response.ok) {
        const updated = await response.json();
        console.log('✅ Toggle successful:', updated);
        setProviders(prevProviders => prevProviders.map(p => 
          p.id === providerId ? { ...p, enabled: updated.enabled, configured: true } : p
        ));
        
        // Show success message
        const providerName = providers.find(p => p.id === providerId)?.name || 'Provider';
        setSuccessMessage(`${providerName} ${updated.enabled ? 'enabled' : 'disabled'} successfully!`);
        setShowSuccessPopup(true);
        setTimeout(() => setShowSuccessPopup(false), 2000);
      } else {
        console.error('❌ Failed to toggle provider:', response.status);
        setSuccessMessage('❌ Failed to toggle provider');
        setShowSuccessPopup(true);
        setTimeout(() => setShowSuccessPopup(false), 3000);
      }
    } catch (error) {
      console.error('❌ Error toggling provider:', error);
      setSuccessMessage('❌ Cannot connect to backend server');
      setShowSuccessPopup(true);
      setTimeout(() => setShowSuccessPopup(false), 3000);
    }
  };

  const handleSave = async () => {
    if (selectedProvider && clientId && clientSecret && selectedProject) {
      try {
        const token = localStorage.getItem('token');
        
        console.log('=== SAVING OAUTH CONFIGURATION ===');
        console.log('Provider:', selectedProvider);
        console.log('Project ID:', selectedProject.id);
        console.log('Project Slug:', selectedProject.slug);
        console.log('Client ID:', clientId);
        console.log('API URL:', `${process.env.NEXT_PUBLIC_API_URL}/api/oauth/providers?project_id=${selectedProject.id}`);
        
        // Check if backend URL is configured
        if (!process.env.NEXT_PUBLIC_API_URL) {
          throw new Error('Backend API URL not configured. Check NEXT_PUBLIC_API_URL environment variable.');
        }
        
        // Call backend API to save OAuth provider configuration
        const response = await fetch(
          `${process.env.NEXT_PUBLIC_API_URL}/api/oauth/providers?project_id=${selectedProject.id}`,
          {
            method: 'POST',
            headers: {
              'Authorization': `Bearer ${token}`,
              'Content-Type': 'application/json',
            },
            body: JSON.stringify({
              provider: selectedProvider,
              client_id: clientId,
              client_secret: clientSecret,
              enabled: true
            })
          }
        );

        console.log('Response status:', response.status);
        
        if (!response.ok) {
          const error = await response.json();
          console.error('API Error:', error);
          throw new Error(error.detail || 'Failed to save provider configuration');
        }

        const result = await response.json();
        console.log('API Success:', result);

        // Update local state on success - use functional update to avoid stale closure
        console.log('📝 Updating provider state: setting', selectedProvider, 'to configured=true, enabled=true');
        setProviders(prevProviders => {
          const updated = prevProviders.map(p => 
            p.id === selectedProvider 
              ? { ...p, configured: true, enabled: true } 
              : p
          );
          console.log('📝 Updated providers state:', updated);
          return updated;
        });
        setShowConfigModal(false);
        
        // Show success popup
        const providerName = providers.find(p => p.id === selectedProvider)?.name || 'Provider';
        setSuccessMessage(`${providerName} configured successfully! ✓`);
        setShowSuccessPopup(true);
        
        // Reset fields
        setClientId('');
        setClientSecret('');
        
        // Hide success popup after 3 seconds
        setTimeout(() => {
          setShowSuccessPopup(false);
        }, 3000);
      } catch (error) {
        console.error('Failed to save provider configuration:', error);
        
        let errorMessage = 'Failed to save configuration';
        if (error instanceof TypeError && error.message === 'Failed to fetch') {
          errorMessage = 'Cannot connect to backend server. Make sure the backend is running on http://localhost:8000';
        } else if (error instanceof Error) {
          errorMessage = error.message;
        }
        
        setSuccessMessage(`❌ ${errorMessage}`);
        setShowSuccessPopup(true);
        setTimeout(() => {
          setShowSuccessPopup(false);
        }, 5000);
      }
    } else {
      console.error('Missing required fields:', {
        selectedProvider,
        clientId: clientId ? 'present' : 'missing',
        clientSecret: clientSecret ? 'present' : 'missing',
        selectedProject: selectedProject ? 'present' : 'missing'
      });
    }
  };

  return (
    <div className="min-h-screen bg-black text-white p-6">
      <div className="max-w-6xl mx-auto">
        {/* Header */}
        <div className="mb-8">
          <div className="flex items-center justify-between mb-2">
            <h1 className="text-2xl font-bold">Sign-in Providers</h1>
            
            {/* Project Selector Dropdown */}
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

                {/* Dropdown Menu */}
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
          
          <p className="text-gray-400 text-sm">Configure authentication methods for your application</p>
          {selectedProject && (
            <p className="text-xs text-gray-500 mt-1">
              Project: <span className="text-orange-400">{selectedProject.name}</span> 
              {selectedProject.slug && <span className="text-gray-600"> ({selectedProject.slug})</span>}
            </p>
          )}
          {!selectedProject && !loadingProject && (
            <p className="text-xs text-red-400 mt-1">⚠️ No project selected. Please select a project first.</p>
          )}
        </div>

        {/* Stats Cards */}
        <div className="grid grid-cols-3 gap-4 mb-8">
          <div className="bg-[#1a1a1a] rounded-lg p-6 border border-gray-800">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 bg-orange-500/20 rounded-lg flex items-center justify-center">
                <svg className="w-5 h-5 text-orange-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m5.618-4.016A11.955 11.955 0 0112 2.944a11.955 11.955 0 01-8.618 3.04A12.02 12.02 0 003 9c0 5.591 3.824 10.29 9 11.622 5.176-1.332 9-6.03 9-11.622 0-1.042-.133-2.052-.382-3.016z" />
                </svg>
              </div>
              <div>
                <div className="text-3xl font-bold">{totalProviders}</div>
                <div className="text-sm text-gray-400">Total Providers</div>
              </div>
            </div>
          </div>

          <div className="bg-[#1a1a1a] rounded-lg p-6 border border-gray-800">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 bg-orange-500/20 rounded-lg flex items-center justify-center">
                <svg className="w-5 h-5 text-orange-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
                </svg>
              </div>
              <div>
                <div className="text-3xl font-bold">{enabledProviders}</div>
                <div className="text-sm text-gray-400">Enabled</div>
              </div>
            </div>
          </div>

          <div className="bg-[#1a1a1a] rounded-lg p-6 border border-gray-800">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 bg-orange-500/20 rounded-lg flex items-center justify-center">
                <svg className="w-5 h-5 text-orange-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10.325 4.317c.426-1.756 2.924-1.756 3.35 0a1.724 1.724 0 002.573 1.066c1.543-.94 3.31.826 2.37 2.37a1.724 1.724 0 001.065 2.572c1.756.426 1.756 2.924 0 3.35a1.724 1.724 0 00-1.066 2.573c.94 1.543-.826 3.31-2.37 2.37a1.724 1.724 0 00-2.572 1.065c-.426 1.756-2.924 1.756-3.35 0a1.724 1.724 0 00-2.573-1.066c-1.543.94-3.31-.826-2.37-2.37a1.724 1.724 0 00-1.065-2.572c-1.756-.426-1.756-2.924 0-3.35a1.724 1.724 0 001.066-2.573c-.94-1.543.826-3.31 2.37-2.37.996.608 2.296.07 2.572-1.065z" />
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
                </svg>
              </div>
              <div>
                <div className="text-3xl font-bold">{configurableProviders}</div>
                <div className="text-sm text-gray-400">Configurable</div>
              </div>
            </div>
          </div>
        </div>

        {/* Providers List */}
        <div className="space-y-3">
          {providers.map((provider) => (
            <div
              key={provider.id}
              className="bg-[#1a1a1a] rounded-lg p-5 border border-gray-800 hover:border-orange-500/50 transition-colors"
            >
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-4">
                  <div className={`w-12 h-12 rounded-lg flex items-center justify-center ${
                    provider.id === 'email' ? 'bg-orange-500/20' :
                    provider.id === 'google' ? 'bg-white' :
                    provider.id === 'github' ? 'bg-gray-800' :
                    'bg-orange-500/20'
                  }`}>
                    {provider.icon}
                  </div>
                  <div>
                    <div className="flex items-center gap-2">
                      <h3 className="font-semibold">{provider.name}</h3>
                      {provider.enabled && (
                        <span className="px-2 py-0.5 bg-orange-500/20 text-orange-400 text-xs rounded-full">
                          Enabled
                        </span>
                      )}
                      {!provider.enabled && provider.canDisable && (
                        <span className="px-2 py-0.5 bg-gray-700 text-gray-400 text-xs rounded-full">
                          Disabled
                        </span>
                      )}
                    </div>
                    <p className="text-sm text-gray-400">{provider.description}</p>
                  </div>
                </div>

                <div className="flex items-center gap-3">
                  {provider.canDisable && (
                    <button
                      onClick={() => handleConfigure(provider.id)}
                      className="px-4 py-2 bg-gray-800 hover:bg-gray-700 text-white rounded-lg text-sm font-medium transition-colors border border-gray-700"
                    >
                      Configure
                    </button>
                  )}
                  
                  <label className="relative inline-flex items-center cursor-pointer">
                    <input
                      type="checkbox"
                      checked={provider.enabled}
                      onChange={() => provider.canDisable && handleToggle(provider.id)}
                      disabled={!provider.canDisable}
                      className="sr-only peer"
                    />
                    <div className={`w-11 h-6 rounded-full peer ${
                      provider.canDisable 
                        ? 'bg-gray-700 peer-checked:bg-orange-500 cursor-pointer' 
                        : 'bg-orange-500 cursor-not-allowed opacity-50'
                    } peer-focus:outline-none peer-focus:ring-4 peer-focus:ring-orange-800 after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:after:translate-x-full peer-checked:after:border-white`}></div>
                  </label>
                </div>
              </div>

              {provider.id === 'email' && (
                <div className="mt-3 pt-3 border-t border-gray-800">
                  <p className="text-xs text-orange-400">
                    Email & Password authentication is always enabled and cannot be disabled.
                  </p>
                </div>
              )}

              {/* Generated OAuth URL - Show when configured */}
              {provider.configured && provider.canDisable && selectedProject && (
                <div className="mt-4 pt-4 border-t border-gray-800">
                  <div className="bg-orange-500/10 border border-orange-500/30 rounded-lg p-4">
                    <div className="flex items-center gap-2 mb-2">
                      <svg className="w-4 h-4 text-orange-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13.828 10.172a4 4 0 00-5.656 0l-4 4a4 4 0 105.656 5.656l1.102-1.101m-.758-4.899a4 4 0 005.656 0l4-4a4 4 0 00-5.656-5.656l-1.1 1.1" />
                      </svg>
                      <h4 className="text-sm font-semibold text-orange-400">Your OAuth Login URL</h4>
                    </div>
                    <p className="text-xs text-gray-400 mb-3">
                      Use this URL in your application to enable {provider.name} instantly
                    </p>
                    <div className="flex gap-2">
                      <input
                        type="text"
                        value={`${baseUrl}/oauth/${provider.id}/${selectedProject.slug}`}
                        readOnly
                        className="flex-1 px-3 py-2 bg-black border border-orange-500/50 rounded-lg text-orange-300 text-sm font-mono"
                      />
                      <button
                        onClick={() => {
                          const url = `${baseUrl}/oauth/${provider.id}/${selectedProject.slug}`;
                          navigator.clipboard.writeText(url);
                          setSuccessMessage('OAuth URL copied to clipboard!');
                          setShowSuccessPopup(true);
                          setTimeout(() => setShowSuccessPopup(false), 2000);
                        }}
                        className="px-4 py-2 bg-orange-500 hover:bg-orange-600 text-white rounded-lg text-sm font-medium transition-colors"
                      >
                        Copy URL
                      </button>
                    </div>
                    <div className="mt-3 pt-3 border-t border-orange-500/20">
                      <p className="text-xs text-gray-400 mb-2">Example usage:</p>
                      <div className="bg-black rounded p-2">
                        <code className="text-xs text-orange-300">
                          &lt;a href="{`${baseUrl}/oauth/${provider.id}/${selectedProject.slug}`}"&gt;
                          <br />
                          &nbsp;&nbsp;Login with {provider.name.split(' ')[0]}
                          <br />
                          &lt;/a&gt;
                        </code>
                      </div>
                    </div>
                  </div>
                </div>
              )}
            </div>
          ))}
        </div>
      </div>

      {/* Configuration Modal */}
      {showConfigModal && (
        <div className="fixed inset-0 bg-black/80 flex items-center justify-center p-4 z-50">
          <div className="bg-[#1a1a1a] rounded-lg shadow-xl max-w-md w-full p-6 border border-gray-800">
            <h2 className="text-xl font-bold mb-4">
              Configure {providers.find(p => p.id === selectedProvider)?.name}
            </h2>

            <div className="space-y-4 mb-6">
              <div>
                <label className="block text-sm font-medium text-gray-300 mb-2">
                  Callback URL (Read-only)
                </label>
                <div className="flex gap-2">
                  <input
                    type="text"
                    value={callbackUrl}
                    readOnly
                    className="flex-1 px-3 py-2 bg-black border border-gray-700 rounded-lg text-white text-sm font-mono"
                  />
                  <button
                    onClick={() => {
                      navigator.clipboard.writeText(callbackUrl);
                      alert('Callback URL copied to clipboard!');
                    }}
                    className="px-3 py-2 bg-gray-800 hover:bg-gray-700 text-white rounded-lg text-sm border border-gray-700"
                  >
                    Copy
                  </button>
                </div>
                <p className="text-xs text-gray-500 mt-1">
                  Add this URL to your {selectedProvider === 'google' ? 'Google Cloud Console' : 'GitHub OAuth App'} settings
                </p>
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-300 mb-2">
                  Client ID
                </label>
                <input
                  type="text"
                  value={clientId}
                  onChange={(e) => setClientId(e.target.value)}
                  placeholder=""
                  className="w-full px-3 py-2 bg-black border border-gray-700 rounded-lg focus:ring-2 focus:ring-orange-500 focus:border-transparent text-white placeholder-gray-500"
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-300 mb-2">
                  Client Secret
                </label>
                <input
                  type="password"
                  value={clientSecret}
                  onChange={(e) => setClientSecret(e.target.value)}
                  placeholder=""
                  className="w-full px-3 py-2 bg-black border border-gray-700 rounded-lg focus:ring-2 focus:ring-orange-500 focus:border-transparent text-white placeholder-gray-500"
                />
              </div>

              <div className="bg-orange-500/10 border border-orange-500/20 rounded-lg p-3">
                <p className="text-xs text-orange-400">
                  💡 Get credentials from {selectedProvider === 'google' ? 'Google Cloud Console' : 'GitHub Developer Settings'}
                </p>
              </div>
            </div>

            <div className="flex gap-3">
              <button
                onClick={() => {
                  setShowConfigModal(false);
                  setClientId('');
                  setClientSecret('');
                }}
                className="flex-1 px-4 py-2 bg-gray-800 hover:bg-gray-700 text-white rounded-lg transition-colors border border-gray-700"
              >
                Cancel
              </button>
              <button
                onClick={handleSave}
                disabled={!clientId || !clientSecret}
                className="flex-1 px-4 py-2 bg-orange-500 hover:bg-orange-600 text-white rounded-lg transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
              >
                Save
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Success Popup */}
      {showSuccessPopup && (
        <div className="fixed top-4 right-4 z-50 animate-slide-in-right">
          <div className="bg-[#1a1a1a] border-l-4 border-orange-500 rounded-lg shadow-xl p-4 flex items-center gap-3 min-w-[300px]">
            <div className="w-10 h-10 bg-orange-500/20 rounded-full flex items-center justify-center flex-shrink-0">
              <svg className="w-6 h-6 text-orange-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
              </svg>
            </div>
            <div className="flex-1">
              <p className="text-white font-medium">{successMessage}</p>
              <p className="text-gray-400 text-sm">Provider is now active</p>
            </div>
            <button
              onClick={() => setShowSuccessPopup(false)}
              className="text-gray-400 hover:text-white"
            >
              <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
              </svg>
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
