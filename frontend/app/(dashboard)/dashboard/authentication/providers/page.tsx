'use client';

import React, { useState } from 'react';

interface Provider {
  id: string;
  name: string;
  description: string;
  icon: React.ReactNode;
  enabled: boolean;
  configurable: boolean;
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
      configurable: false
    },
    {
      id: 'google',
      name: 'Google OAuth',
      description: 'Sign in with Google accounts',
      icon: (
        <svg className="w-6 h-6" viewBox="0 0 24 24">
          <path fill="currentColor" d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z"/>
          <path fill="currentColor" d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"/>
          <path fill="currentColor" d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z"/>
          <path fill="currentColor" d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z"/>
        </svg>
      ),
      enabled: false,
      configurable: true
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
      configurable: true
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
      configurable: true
    }
  ]);

  const [showConfigDialog, setShowConfigDialog] = useState(false);
  const [selectedProvider, setSelectedProvider] = useState<Provider | null>(null);

  const toggleProvider = (providerId: string) => {
    setProviders(providers.map(p => 
      p.id === providerId ? { ...p, enabled: !p.enabled } : p
    ));
  };

  const configureProvider = (provider: Provider) => {
    setSelectedProvider(provider);
    setShowConfigDialog(true);
  };

  const getStatusColor = (enabled: boolean) => {
    return enabled 
      ? 'bg-green-600/10 text-green-400 border-green-600/20'
      : 'bg-gray-600/10 text-gray-400 border-gray-600/20';
  };

  return (
    <div className="p-6 space-y-6 max-w-5xl">
      {/* Header */}
      <div>
        <h1 className="text-2xl font-bold text-white">Sign-in Providers</h1>
        <p className="text-sm text-[#a1a1a1] mt-1">
          Configure authentication methods for your application
        </p>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <div className="bg-[#181818] border border-[#2a2a2a] rounded-2xl p-6">
          <div className="flex items-center space-x-3">
            <div className="w-12 h-12 bg-purple-600/10 rounded-xl flex items-center justify-center">
              <svg className="w-6 h-6 text-purple-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m5.618-4.016A11.955 11.955 0 0112 2.944a11.955 11.955 0 01-8.618 3.04A12.02 12.02 0 003 9c0 5.591 3.824 10.29 9 11.622 5.176-1.332 9-6.03 9-11.622 0-1.042-.133-2.052-.382-3.016z" />
              </svg>
            </div>
            <div>
              <p className="text-2xl font-bold text-white">{providers.length}</p>
              <p className="text-xs text-[#a1a1a1]">Total Providers</p>
            </div>
          </div>
        </div>

        <div className="bg-[#181818] border border-[#2a2a2a] rounded-2xl p-6">
          <div className="flex items-center space-x-3">
            <div className="w-12 h-12 bg-green-600/10 rounded-xl flex items-center justify-center">
              <svg className="w-6 h-6 text-green-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
              </svg>
            </div>
            <div>
              <p className="text-2xl font-bold text-white">
                {providers.filter(p => p.enabled).length}
              </p>
              <p className="text-xs text-[#a1a1a1]">Enabled</p>
            </div>
          </div>
        </div>

        <div className="bg-[#181818] border border-[#2a2a2a] rounded-2xl p-6">
          <div className="flex items-center space-x-3">
            <div className="w-12 h-12 bg-orange-600/10 rounded-xl flex items-center justify-center">
              <svg className="w-6 h-6 text-orange-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10.325 4.317c.426-1.756 2.924-1.756 3.35 0a1.724 1.724 0 002.573 1.066c1.543-.94 3.31.826 2.37 2.37a1.724 1.724 0 001.065 2.572c1.756.426 1.756 2.924 0 3.35a1.724 1.724 0 00-1.066 2.573c.94 1.543-.826 3.31-2.37 2.37a1.724 1.724 0 00-2.572 1.065c-.426 1.756-2.924 1.756-3.35 0a1.724 1.724 0 00-2.573-1.066c-1.543.94-3.31-.826-2.37-2.37a1.724 1.724 0 00-1.065-2.572c-1.756-.426-1.756-2.924 0-3.35a1.724 1.724 0 001.066-2.573c-.94-1.543.826-3.31 2.37-2.37.996.608 2.296.07 2.572-1.065z" />
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
              </svg>
            </div>
            <div>
              <p className="text-2xl font-bold text-white">
                {providers.filter(p => p.configurable).length}
              </p>
              <p className="text-xs text-[#a1a1a1]">Configurable</p>
            </div>
          </div>
        </div>
      </div>

      {/* Providers List */}
      <div className="space-y-4">
        {providers.map((provider) => (
          <div
            key={provider.id}
            className="bg-[#181818] border border-[#2a2a2a] rounded-2xl p-6 hover:border-[#3a3a3a] transition-colors"
          >
            <div className="flex items-center justify-between">
              <div className="flex items-center space-x-4">
                <div className={`w-14 h-14 rounded-xl flex items-center justify-center ${
                  provider.enabled ? 'bg-purple-600/10 text-purple-500' : 'bg-[#2a2a2a] text-[#6b6b6b]'
                }`}>
                  {provider.icon}
                </div>
                
                <div>
                  <div className="flex items-center space-x-3 mb-1">
                    <h3 className="text-base font-semibold text-white">
                      {provider.name}
                    </h3>
                    <span className={`px-2 py-0.5 text-xs rounded-full border ${getStatusColor(provider.enabled)}`}>
                      {provider.enabled ? 'Enabled' : 'Disabled'}
                    </span>
                  </div>
                  <p className="text-sm text-[#a1a1a1]">{provider.description}</p>
                </div>
              </div>

              <div className="flex items-center space-x-3">
                {provider.configurable && (
                  <button
                    onClick={() => configureProvider(provider)}
                    className="px-4 py-2 bg-[#2a2a2a] hover:bg-[#3a3a3a] text-white rounded-lg text-sm font-medium transition-colors"
                  >
                    Configure
                  </button>
                )}
                
                <button
                  onClick={() => toggleProvider(provider.id)}
                  disabled={provider.id === 'email'}
                  className={`relative inline-flex h-6 w-11 items-center rounded-full transition-colors ${
                    provider.enabled ? 'bg-purple-600' : 'bg-[#2a2a2a]'
                  } ${provider.id === 'email' ? 'opacity-50 cursor-not-allowed' : ''}`}
                >
                  <span
                    className={`inline-block h-4 w-4 transform rounded-full bg-white transition-transform ${
                      provider.enabled ? 'translate-x-6' : 'translate-x-1'
                    }`}
                  />
                </button>
              </div>
            </div>

            {provider.id === 'email' && (
              <div className="mt-4 p-3 bg-blue-600/10 border border-blue-600/20 rounded-lg">
                <p className="text-xs text-blue-400">
                  Email & Password authentication is always enabled and cannot be disabled.
                </p>
              </div>
            )}
          </div>
        ))}
      </div>

      {/* Configuration Dialog */}
      {showConfigDialog && selectedProvider && (
        <div className="fixed inset-0 bg-black/60 backdrop-blur-sm z-50 flex items-center justify-center p-4">
          <div className="bg-[#181818] border border-[#2a2a2a] rounded-2xl p-6 max-w-lg w-full">
            <h3 className="text-lg font-bold text-white mb-2">
              Configure {selectedProvider.name}
            </h3>
            <p className="text-sm text-[#a1a1a1] mb-6">
              Set up OAuth credentials for {selectedProvider.name}
            </p>

            <div className="space-y-4 mb-6">
              <div>
                <label className="block text-xs text-[#a1a1a1] mb-2">Client ID</label>
                <input
                  type="text"
                  placeholder="Enter client ID..."
                  className="w-full px-3 py-2 bg-[#1c1c1c] border border-[#2a2a2a] rounded-lg text-sm text-white placeholder-[#6b6b6b] focus:outline-none focus:border-purple-600/50"
                />
              </div>

              <div>
                <label className="block text-xs text-[#a1a1a1] mb-2">Client Secret</label>
                <input
                  type="password"
                  placeholder="Enter client secret..."
                  className="w-full px-3 py-2 bg-[#1c1c1c] border border-[#2a2a2a] rounded-lg text-sm text-white placeholder-[#6b6b6b] focus:outline-none focus:border-purple-600/50"
                />
              </div>

              <div>
                <label className="block text-xs text-[#a1a1a1] mb-2">Redirect URI</label>
                <input
                  type="text"
                  value={`${process.env.NEXT_PUBLIC_APP_URL!}/callback`}
                  readOnly
                  className="w-full px-3 py-2 bg-[#1c1c1c] border border-[#2a2a2a] rounded-lg text-sm text-[#6b6b6b] focus:outline-none"
                />
                <p className="text-xs text-[#6b6b6b] mt-1">
                  Use this URL in your OAuth app configuration
                </p>
              </div>
            </div>

            <div className="flex space-x-3">
              <button
                onClick={() => {
                  setShowConfigDialog(false);
                  setSelectedProvider(null);
                }}
                className="flex-1 px-4 py-2 bg-[#2a2a2a] hover:bg-[#3a3a3a] text-white rounded-lg text-sm font-medium transition-colors"
              >
                Cancel
              </button>
              <button
                onClick={() => {
                  // Save configuration
                  setShowConfigDialog(false);
                  setSelectedProvider(null);
                }}
                className="flex-1 px-4 py-2 bg-purple-600 hover:bg-purple-700 text-white rounded-lg text-sm font-medium transition-colors"
              >
                Save Configuration
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
