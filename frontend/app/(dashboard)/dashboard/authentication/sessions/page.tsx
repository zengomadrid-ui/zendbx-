'use client';

import { useState, useEffect } from 'react';
import { format } from 'date-fns';

interface Session {
  id: string;
  device_name: string;
  device_type: string;
  browser: string;
  os: string;
  ip_address: string;
  location: string;
  last_active: string;
  created_at: string;
  is_active: boolean;
}

export default function SessionsPage() {
  const [sessions, setSessions] = useState<Session[]>([]);
  const [loading, setLoading] = useState(true);
  const [deletingId, setDeletingId] = useState<string | null>(null);

  useEffect(() => {
    fetchSessions();
  }, []);

  const fetchSessions = async () => {
    try {
      const token = localStorage.getItem('token');
      const res = await fetch('http://localhost:8000/api/auth/sessions', {
        headers: { 'Authorization': `Bearer ${token}` }
      });

      if (res.ok) {
        const data = await res.json();
        setSessions(data.sessions);
      }
    } catch (error) {
      console.error('Failed to fetch sessions:', error);
    } finally {
      setLoading(false);
    }
  };

  const logoutSession = async (sessionId: string) => {
    if (!confirm('Are you sure you want to logout this session?')) return;

    setDeletingId(sessionId);
    try {
      const token = localStorage.getItem('token');
      const res = await fetch(`http://localhost:8000/api/auth/sessions/${sessionId}`, {
        method: 'DELETE',
        headers: { 'Authorization': `Bearer ${token}` }
      });

      if (res.ok) {
        await fetchSessions();
      }
    } catch (error) {
      console.error('Failed to logout session:', error);
    } finally {
      setDeletingId(null);
    }
  };

  const logoutAllSessions = async () => {
    if (!confirm('Are you sure you want to logout all other devices? You will remain logged in on this device.')) return;

    try {
      const token = localStorage.getItem('token');
      const res = await fetch('http://localhost:8000/api/auth/sessions', {
        method: 'DELETE',
        headers: { 'Authorization': `Bearer ${token}` }
      });

      if (res.ok) {
        await fetchSessions();
      }
    } catch (error) {
      console.error('Failed to logout all sessions:', error);
    }
  };

  const getDeviceIcon = (deviceType: string) => {
    if (deviceType === 'mobile') {
      return (
        <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 18h.01M8 21h8a2 2 0 002-2V5a2 2 0 00-2-2H8a2 2 0 00-2 2v14a2 2 0 002 2z" />
        </svg>
      );
    } else if (deviceType === 'tablet') {
      return (
        <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 18h.01M7 21h10a2 2 0 002-2V5a2 2 0 00-2-2H7a2 2 0 00-2 2v14a2 2 0 002 2z" />
        </svg>
      );
    } else {
      return (
        <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9.75 17L9 20l-1 1h8l-1-1-.75-3M3 13h18M5 17h14a2 2 0 002-2V5a2 2 0 00-2-2H5a2 2 0 00-2 2v10a2 2 0 002 2z" />
        </svg>
      );
    }
  };

  if (loading) {
    return (
      <div className="p-6 flex items-center justify-center">
        <p className="text-sm text-[#a1a1a1]">Loading sessions...</p>
      </div>
    );
  }

  return (
    <div className="p-6 space-y-6 max-w-6xl">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-white">Active Sessions</h1>
          <p className="text-sm text-[#a1a1a1] mt-1">
            Manage your active sessions across all devices
          </p>
        </div>
        {sessions.length > 1 && (
          <button
            onClick={logoutAllSessions}
            className="px-4 py-2 bg-red-600/10 hover:bg-red-600/20 text-red-400 rounded-lg text-sm font-medium transition-colors border border-red-600/20"
          >
            Logout All Other Devices
          </button>
        )}
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
              <p className="text-2xl font-bold text-white">{sessions.length}</p>
              <p className="text-xs text-[#a1a1a1]">Active Sessions</p>
            </div>
          </div>
        </div>

        <div className="bg-[#181818] border border-[#2a2a2a] rounded-2xl p-6">
          <div className="flex items-center space-x-3">
            <div className="w-12 h-12 bg-orange-600/10 rounded-xl flex items-center justify-center">
              <svg className="w-6 h-6 text-orange-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 18h.01M8 21h8a2 2 0 002-2V5a2 2 0 00-2-2H8a2 2 0 00-2 2v14a2 2 0 002 2z" />
              </svg>
            </div>
            <div>
              <p className="text-2xl font-bold text-white">
                {sessions.filter(s => s.device_type === 'mobile').length}
              </p>
              <p className="text-xs text-[#a1a1a1]">Mobile Devices</p>
            </div>
          </div>
        </div>

        <div className="bg-[#181818] border border-[#2a2a2a] rounded-2xl p-6">
          <div className="flex items-center space-x-3">
            <div className="w-12 h-12 bg-green-600/10 rounded-xl flex items-center justify-center">
              <svg className="w-6 h-6 text-green-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9.75 17L9 20l-1 1h8l-1-1-.75-3M3 13h18M5 17h14a2 2 0 002-2V5a2 2 0 00-2-2H5a2 2 0 00-2 2v10a2 2 0 002 2z" />
              </svg>
            </div>
            <div>
              <p className="text-2xl font-bold text-white">
                {sessions.filter(s => s.device_type === 'desktop').length}
              </p>
              <p className="text-xs text-[#a1a1a1]">Desktop Devices</p>
            </div>
          </div>
        </div>
      </div>

      {/* Sessions List */}
      <div className="space-y-4">
        {sessions.map((session) => (
          <div
            key={session.id}
            className="bg-[#181818] border border-[#2a2a2a] rounded-2xl p-6 hover:border-[#3a3a3a] transition-colors"
          >
            <div className="flex items-start justify-between">
              <div className="flex items-start space-x-4">
                <div className="w-12 h-12 bg-[#2a2a2a] rounded-xl flex items-center justify-center text-[#a1a1a1]">
                  {getDeviceIcon(session.device_type)}
                </div>
                
                <div className="flex-1">
                  <div className="flex items-center space-x-2 mb-1">
                    <h3 className="text-sm font-semibold text-white">
                      {session.device_name}
                    </h3>
                    <span className="px-2 py-0.5 bg-green-600/10 text-green-500 text-xs rounded-full">
                      Active
                    </span>
                  </div>
                  
                  <div className="grid grid-cols-2 gap-x-6 gap-y-2 mt-3">
                    <div className="flex items-center space-x-2 text-xs">
                      <svg className="w-4 h-4 text-[#6b6b6b]" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17.657 16.657L13.414 20.9a1.998 1.998 0 01-2.827 0l-4.244-4.243a8 8 0 1111.314 0z" />
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 11a3 3 0 11-6 0 3 3 0 016 0z" />
                      </svg>
                      <span className="text-[#a1a1a1]">
                        {session.location || 'Unknown location'}
                      </span>
                    </div>
                    
                    <div className="flex items-center space-x-2 text-xs">
                      <svg className="w-4 h-4 text-[#6b6b6b]" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 12a9 9 0 01-9 9m9-9a9 9 0 00-9-9m9 9H3m9 9a9 9 0 01-9-9m9 9c1.657 0 3-4.03 3-9s-1.343-9-3-9m0 18c-1.657 0-3-4.03-3-9s1.343-9 3-9m-9 9a9 9 0 019-9" />
                      </svg>
                      <span className="text-[#a1a1a1]">{session.ip_address}</span>
                    </div>
                    
                    <div className="flex items-center space-x-2 text-xs">
                      <svg className="w-4 h-4 text-[#6b6b6b]" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" />
                      </svg>
                      <span className="text-[#a1a1a1]">
                        Last active {format(new Date(session.last_active), 'MMM d, h:mm a')}
                      </span>
                    </div>
                    
                    <div className="flex items-center space-x-2 text-xs">
                      <svg className="w-4 h-4 text-[#6b6b6b]" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z" />
                      </svg>
                      <span className="text-[#a1a1a1]">
                        Created {format(new Date(session.created_at), 'MMM d, yyyy')}
                      </span>
                    </div>
                  </div>
                </div>
              </div>
              
              <button
                onClick={() => logoutSession(session.id)}
                disabled={deletingId === session.id}
                className="px-4 py-2 bg-red-600/10 hover:bg-red-600/20 text-red-400 rounded-lg text-sm font-medium transition-colors disabled:opacity-50"
              >
                {deletingId === session.id ? 'Logging out...' : 'Logout'}
              </button>
            </div>
          </div>
        ))}
      </div>

      {sessions.length === 0 && (
        <div className="bg-[#181818] border border-[#2a2a2a] rounded-2xl p-12 text-center">
          <svg className="w-16 h-16 text-[#3a3a3a] mx-auto mb-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m5.618-4.016A11.955 11.955 0 0112 2.944a11.955 11.955 0 01-8.618 3.04A12.02 12.02 0 003 9c0 5.591 3.824 10.29 9 11.622 5.176-1.332 9-6.03 9-11.622 0-1.042-.133-2.052-.382-3.016z" />
          </svg>
          <h3 className="text-lg font-semibold text-white mb-2">No Active Sessions</h3>
          <p className="text-sm text-[#a1a1a1]">You don't have any active sessions</p>
        </div>
      )}
    </div>
  );
}
