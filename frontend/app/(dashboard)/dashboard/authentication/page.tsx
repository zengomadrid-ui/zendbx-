'use client';

import { useState, useEffect } from 'react';

interface OAuthConnection {
  provider: string;
  connected: boolean;
  email?: string;
  connected_at?: string;
}

export default function AuthenticationPage() {
  const [user, setUser] = useState<any>(null);
  const [oauthConnections, setOauthConnections] = useState<OAuthConnection[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetchUserData();
  }, []);

  const fetchUserData = async () => {
    try {
      const token = localStorage.getItem('token');
      const response = await fetch('http://localhost:8000/api/auth/me', {
        headers: {
          'Authorization': `Bearer ${token}`
        }
      });

      if (response.ok) {
        const userData = await response.json();
        setUser(userData);
        
        // Mock OAuth connections for now
        setOauthConnections([
          {
            provider: 'google',
            connected: userData.oauth_provider === 'google',
            email: userData.oauth_provider === 'google' ? userData.email : undefined,
            connected_at: userData.oauth_provider === 'google' ? userData.created_at : undefined
          },
          {
            provider: 'github',
            connected: userData.oauth_provider === 'github',
            email: userData.oauth_provider === 'github' ? userData.email : undefined,
            connected_at: userData.oauth_provider === 'github' ? userData.created_at : undefined
          }
        ]);
      }
    } catch (error) {
      console.error('Failed to fetch user data:', error);
    } finally {
      setLoading(false);
    }
  };

  const connectOAuth = (provider: string) => {
    window.location.href = `http://localhost:8000/api/auth/oauth/${provider}/login`;
  };

  const getProviderIcon = (provider: string) => {
    if (provider === 'google') {
      return (
        <svg className="w-6 h-6" viewBox="0 0 24 24">
          <path fill="#4285F4" d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z"/>
          <path fill="#34A853" d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"/>
          <path fill="#FBBC05" d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z"/>
          <path fill="#EA4335" d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z"/>
        </svg>
      );
    } else if (provider === 'github') {
      return (
        <svg className="w-6 h-6" fill="currentColor" viewBox="0 0 24 24">
          <path fillRule="evenodd" d="M12 2C6.477 2 2 6.484 2 12.017c0 4.425 2.865 8.18 6.839 9.504.5.092.682-.217.682-.483 0-.237-.008-.868-.013-1.703-2.782.605-3.369-1.343-3.369-1.343-.454-1.158-1.11-1.466-1.11-1.466-.908-.62.069-.608.069-.608 1.003.07 1.531 1.032 1.531 1.032.892 1.53 2.341 1.088 2.91.832.092-.647.35-1.088.636-1.338-2.22-.253-4.555-1.113-4.555-4.951 0-1.093.39-1.988 1.029-2.688-.103-.253-.446-1.272.098-2.65 0 0 .84-.27 2.75 1.026A9.564 9.564 0 0112 6.844c.85.004 1.705.115 2.504.337 1.909-1.296 2.747-1.027 2.747-1.027.546 1.379.202 2.398.1 2.651.64.7 1.028 1.595 1.028 2.688 0 3.848-2.339 4.695-4.566 4.943.359.309.678.92.678 1.855 0 1.338-.012 2.419-.012 2.747 0 .268.18.58.688.482A10.019 10.019 0 0022 12.017C22 6.484 17.522 2 12 2z" clipRule="evenodd"/>
        </svg>
      );
    }
  };

  if (loading) {
    return (
      <div className="p-6 flex items-center justify-center">
        <p className="text-sm text-gray-400">Loading...</p>
      </div>
    );
  }

  return (
    <div className="p-6 space-y-6 max-w-4xl">
      <div>
        <h1 className="text-xl font-semibold text-white">Authentication</h1>
        <p className="text-xs text-gray-400 mt-1">Manage your login methods and security settings</p>
      </div>

      {/* Current Login Method */}
      <div className="bg-[#181818] border border-[#2a2a2a] rounded-lg p-6">
        <h2 className="text-sm font-semibold text-white mb-4">Current Login Method</h2>
        <div className="flex items-center space-x-3">
          {user?.oauth_provider ? (
            <>
              {getProviderIcon(user.oauth_provider)}
              <div>
                <p className="text-sm text-white capitalize">{user.oauth_provider}</p>
                <p className="text-xs text-gray-400">{user.email}</p>
              </div>
            </>
          ) : (
            <>
              <div className="w-6 h-6 bg-orange-600 rounded flex items-center justify-center">
                <svg className="w-4 h-4 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M16 12a4 4 0 10-8 0 4 4 0 008 0zm0 0v1.5a2.5 2.5 0 005 0V12a9 9 0 10-9 9m4.5-1.206a8.959 8.959 0 01-4.5 1.207" />
                </svg>
              </div>
              <div>
                <p className="text-sm text-white">Email & Password</p>
                <p className="text-xs text-gray-400">{user?.email}</p>
              </div>
            </>
          )}
        </div>
      </div>

      {/* OAuth Connections */}
      <div className="bg-[#181818] border border-[#2a2a2a] rounded-lg p-6">
        <h2 className="text-sm font-semibold text-white mb-4">Connected Accounts</h2>
        <p className="text-xs text-gray-400 mb-4">Link your social accounts for quick sign-in</p>
        
        <div className="space-y-3">
          {oauthConnections.map((connection) => (
            <div
              key={connection.provider}
              className="flex items-center justify-between p-4 bg-[#1c1c1c] border border-[#2a2a2a] rounded-lg"
            >
              <div className="flex items-center space-x-3">
                {getProviderIcon(connection.provider)}
                <div>
                  <p className="text-sm text-white capitalize">{connection.provider}</p>
                  {connection.connected ? (
                    <p className="text-xs text-green-500">Connected</p>
                  ) : (
                    <p className="text-xs text-gray-400">Not connected</p>
                  )}
                </div>
              </div>
              
              {connection.connected ? (
                <button
                  className="px-3 py-1.5 text-xs font-medium text-red-400 hover:text-red-300 transition-colors"
                  onClick={() => alert('Disconnect feature coming soon')}
                >
                  Disconnect
                </button>
              ) : (
                <button
                  className="px-3 py-1.5 text-xs font-medium bg-orange-600 hover:bg-orange-500 text-white rounded transition-colors"
                  onClick={() => connectOAuth(connection.provider)}
                >
                  Connect
                </button>
              )}
            </div>
          ))}
        </div>
      </div>

      {/* Password Section */}
      {!user?.oauth_provider && (
        <div className="bg-[#181818] border border-[#2a2a2a] rounded-lg p-6">
          <h2 className="text-sm font-semibold text-white mb-4">Password</h2>
          <p className="text-xs text-gray-400 mb-4">Change your password to keep your account secure</p>
          
          <button className="px-4 py-2 text-xs font-medium bg-[#2a2a2a] hover:bg-[#3a3a3a] text-white rounded transition-colors">
            Change Password
          </button>
        </div>
      )}

      {/* Security Info */}
      <div className="bg-blue-500/10 border border-blue-500/20 rounded-lg p-4">
        <div className="flex items-start space-x-3">
          <svg className="w-5 h-5 text-blue-500 flex-shrink-0 mt-0.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
          </svg>
          <div>
            <p className="text-xs font-semibold text-blue-500 mb-1">Security Tip</p>
            <p className="text-xs text-gray-400">
              Connecting multiple login methods ensures you can always access your account, even if you lose access to one method.
            </p>
          </div>
        </div>
      </div>
    </div>
  );
}
