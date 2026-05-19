'use client';

import { useState, useEffect } from 'react';
import { useParams, useRouter } from 'next/navigation';
import Link from 'next/link';

interface AuthStats {
  total_users: number;
  active_sessions: number;
  recent_signups: number;
  recent_logins: number;
  provider_breakdown: Record<string, number>;
}

export default function ProjectAuthPage() {
  const params = useParams();
  const router = useRouter();
  const projectId = params.id as string;
  
  const [stats, setStats] = useState<AuthStats | null>(null);
  const [loading, setLoading] = useState(true);
  const [projectName, setProjectName] = useState('');

  useEffect(() => {
    fetchProjectInfo();
    fetchStats();
  }, []);

  const fetchProjectInfo = async () => {
    try {
      const token = localStorage.getItem('token');
      const res = await fetch(`${process.env.NEXT_PUBLIC_API_URL || "http://localhost:8000"}/api/projects/${projectId}`, {
        headers: { 'Authorization': `Bearer ${token}` }
      });

      if (res.ok) {
        const data = await res.json();
        setProjectName(data.name);
      }
    } catch (error) {
      console.error('Failed to fetch project:', error);
    }
  };

  const fetchStats = async () => {
    try {
      const token = localStorage.getItem('token');
      const res = await fetch(`${process.env.NEXT_PUBLIC_API_URL || "http://localhost:8000"}/api/projects/${projectId}/auth/stats`,
        {
          headers: { 'Authorization': `Bearer ${token}` }
        }
      );

      if (res.ok) {
        const data = await res.json();
        setStats(data);
      }
    } catch (error) {
      console.error('Failed to fetch stats:', error);
    } finally {
      setLoading(false);
    }
  };

  const tabs = [
    { name: 'Overview', href: `/dashboard/projects/${projectId}/auth`, current: true },
    { name: 'Users', href: `/dashboard/projects/${projectId}/auth/users`, current: false },
    { name: 'Sessions', href: `/dashboard/projects/${projectId}/auth/sessions`, current: false },
    { name: 'Logs', href: `/dashboard/projects/${projectId}/auth/logs`, current: false },
    { name: 'Providers', href: `/dashboard/projects/${projectId}/auth/providers`, current: false },
  ];

  if (loading) {
    return (
      <div className="p-6 flex items-center justify-center">
        <p className="text-sm text-[#a1a1a1]">Loading...</p>
      </div>
    );
  }

  return (
    <div className="p-6 space-y-6 max-w-7xl">
      {/* Header */}
      <div>
        <div className="flex items-center space-x-2 text-sm text-[#6b6b6b] mb-2">
          <Link href="/dashboard/projects" className="hover:text-orange-500 transition-colors">
            Projects
          </Link>
          <span>/</span>
          <Link href={`/dashboard/projects/${projectId}`} className="hover:text-orange-500 transition-colors">
            {projectName}
          </Link>
          <span>/</span>
          <span className="text-white">Authentication</span>
        </div>
        <h1 className="text-2xl font-bold text-white">Authentication</h1>
        <p className="text-sm text-[#a1a1a1] mt-1">
          Manage users, sessions, and authentication for your app
        </p>
      </div>

      {/* Tabs */}
      <div className="border-b border-[#2a2a2a]">
        <nav className="flex space-x-8">
          {tabs.map((tab) => (
            <Link
              key={tab.name}
              href={tab.href}
              className={`py-4 px-1 border-b-2 font-medium text-sm transition-colors ${
                tab.current
                  ? 'border-orange-500 text-orange-500'
                  : 'border-transparent text-[#6b6b6b] hover:text-white hover:border-[#3a3a3a]'
              }`}
            >
              {tab.name}
            </Link>
          ))}
        </nav>
      </div>

      {/* Stats Grid */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-6">
        <div className="bg-[#181818] border border-[#2a2a2a] rounded-2xl p-6">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-xs font-medium text-[#6b6b6b] uppercase tracking-wider">Total Users</p>
              <p className="text-3xl font-bold text-white mt-2">{stats?.total_users || 0}</p>
              <p className="text-xs text-[#6b6b6b] mt-1">All time</p>
            </div>
            <div className="w-12 h-12 bg-orange-600/10 rounded-full flex items-center justify-center">
              <svg className="w-6 h-6 text-orange-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4.354a4 4 0 110 5.292M15 21H3v-1a6 6 0 0112 0v1zm0 0h6v-1a6 6 0 00-9-5.197M13 7a4 4 0 11-8 0 4 4 0 018 0z" />
              </svg>
            </div>
          </div>
        </div>

        <div className="bg-[#181818] border border-[#2a2a2a] rounded-2xl p-6">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-xs font-medium text-[#6b6b6b] uppercase tracking-wider">Active Sessions</p>
              <p className="text-3xl font-bold text-white mt-2">{stats?.active_sessions || 0}</p>
              <p className="text-xs text-[#6b6b6b] mt-1">Currently active</p>
            </div>
            <div className="w-12 h-12 bg-green-600/10 rounded-full flex items-center justify-center">
              <svg className="w-6 h-6 text-green-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m5.618-4.016A11.955 11.955 0 0112 2.944a11.955 11.955 0 01-8.618 3.04A12.02 12.02 0 003 9c0 5.591 3.824 10.29 9 11.622 5.176-1.332 9-6.03 9-11.622 0-1.042-.133-2.052-.382-3.016z" />
              </svg>
            </div>
          </div>
        </div>

        <div className="bg-[#181818] border border-[#2a2a2a] rounded-2xl p-6">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-xs font-medium text-[#6b6b6b] uppercase tracking-wider">New Signups</p>
              <p className="text-3xl font-bold text-white mt-2">{stats?.recent_signups || 0}</p>
              <p className="text-xs text-[#6b6b6b] mt-1">Last 7 days</p>
            </div>
            <div className="w-12 h-12 bg-blue-600/10 rounded-full flex items-center justify-center">
              <svg className="w-6 h-6 text-blue-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M18 9v3m0 0v3m0-3h3m-3 0h-3m-2-5a4 4 0 11-8 0 4 4 0 018 0zM3 20a6 6 0 0112 0v1H3v-1z" />
              </svg>
            </div>
          </div>
        </div>

        <div className="bg-[#181818] border border-[#2a2a2a] rounded-2xl p-6">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-xs font-medium text-[#6b6b6b] uppercase tracking-wider">Recent Logins</p>
              <p className="text-3xl font-bold text-white mt-2">{stats?.recent_logins || 0}</p>
              <p className="text-xs text-[#6b6b6b] mt-1">Last 24 hours</p>
            </div>
            <div className="w-12 h-12 bg-purple-600/10 rounded-full flex items-center justify-center">
              <svg className="w-6 h-6 text-purple-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M11 16l-4-4m0 0l4-4m-4 4h14m-5 4v1a3 3 0 01-3 3H6a3 3 0 01-3-3V7a3 3 0 013-3h7a3 3 0 013 3v1" />
              </svg>
            </div>
          </div>
        </div>
      </div>

      {/* Provider Breakdown */}
      {stats && Object.keys(stats.provider_breakdown).length > 0 && (
        <div className="bg-[#181818] border border-[#2a2a2a] rounded-2xl p-6">
          <h2 className="text-lg font-semibold text-white mb-4">Authentication Providers</h2>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            {Object.entries(stats.provider_breakdown).map(([provider, count]) => {
              const percentage = stats.total_users > 0 
                ? ((count / stats.total_users) * 100).toFixed(1)
                : 0;
              
              const providerColors: Record<string, string> = {
                'email': 'from-blue-600 to-blue-500',
                'google': 'from-red-600 to-red-500',
                'github': 'from-purple-600 to-purple-500',
              };

              return (
                <div key={provider} className="bg-[#1c1c1c] border border-[#2a2a2a] rounded-lg p-4">
                  <div className="flex items-center justify-between mb-3">
                    <span className="text-sm font-medium text-white capitalize">{provider}</span>
                    <span className="text-xs text-[#6b6b6b]">{percentage}%</span>
                  </div>
                  <div className="flex items-center space-x-3">
                    <div className={`w-10 h-10 bg-gradient-to-br ${providerColors[provider] || 'from-gray-600 to-gray-500'} rounded-lg flex items-center justify-center`}>
                      <svg className="w-5 h-5 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z" />
                      </svg>
                    </div>
                    <div>
                      <p className="text-2xl font-bold text-white">{count}</p>
                      <p className="text-xs text-[#6b6b6b]">users</p>
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      )}

      {/* Quick Actions */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        <Link
          href={`/dashboard/projects/${projectId}/auth/users`}
          className="bg-[#181818] border border-[#2a2a2a] rounded-2xl p-6 hover:border-orange-600/30 transition-colors group"
        >
          <div className="flex items-center justify-between">
            <div>
              <h3 className="text-lg font-semibold text-white group-hover:text-orange-500 transition-colors">
                Manage Users
              </h3>
              <p className="text-sm text-[#6b6b6b] mt-1">
                View and manage all users who signed up for your app
              </p>
            </div>
            <svg className="w-6 h-6 text-[#6b6b6b] group-hover:text-orange-500 transition-colors" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
            </svg>
          </div>
        </Link>

        <Link
          href={`/dashboard/projects/${projectId}/auth/sessions`}
          className="bg-[#181818] border border-[#2a2a2a] rounded-2xl p-6 hover:border-orange-600/30 transition-colors group"
        >
          <div className="flex items-center justify-between">
            <div>
              <h3 className="text-lg font-semibold text-white group-hover:text-orange-500 transition-colors">
                Active Sessions
              </h3>
              <p className="text-sm text-[#6b6b6b] mt-1">
                Monitor and manage active user sessions
              </p>
            </div>
            <svg className="w-6 h-6 text-[#6b6b6b] group-hover:text-orange-500 transition-colors" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
            </svg>
          </div>
        </Link>

        <Link
          href={`/dashboard/projects/${projectId}/auth/logs`}
          className="bg-[#181818] border border-[#2a2a2a] rounded-2xl p-6 hover:border-orange-600/30 transition-colors group"
        >
          <div className="flex items-center justify-between">
            <div>
              <h3 className="text-lg font-semibold text-white group-hover:text-orange-500 transition-colors">
                Authentication Logs
              </h3>
              <p className="text-sm text-[#6b6b6b] mt-1">
                Track login attempts, failures, and security events
              </p>
            </div>
            <svg className="w-6 h-6 text-[#6b6b6b] group-hover:text-orange-500 transition-colors" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
            </svg>
          </div>
        </Link>

        <Link
          href={`/dashboard/projects/${projectId}/auth/providers`}
          className="bg-[#181818] border border-[#2a2a2a] rounded-2xl p-6 hover:border-orange-600/30 transition-colors group"
        >
          <div className="flex items-center justify-between">
            <div>
              <h3 className="text-lg font-semibold text-white group-hover:text-orange-500 transition-colors">
                OAuth Providers
              </h3>
              <p className="text-sm text-[#6b6b6b] mt-1">
                Configure authentication providers for your app
              </p>
            </div>
            <svg className="w-6 h-6 text-[#6b6b6b] group-hover:text-orange-500 transition-colors" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
            </svg>
          </div>
        </Link>
      </div>

      {/* Info Banner */}
      <div className="bg-blue-500/10 border border-blue-500/20 rounded-lg p-4">
        <div className="flex items-start space-x-3">
          <svg className="w-5 h-5 text-blue-500 flex-shrink-0 mt-0.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
          </svg>
          <div>
            <p className="text-xs font-semibold text-blue-500 mb-1">Project-Level Authentication</p>
            <p className="text-xs text-[#a1a1a1]">
              This dashboard shows users who authenticated via YOUR app using this project's OAuth. 
              These are not AURIX platform users.
            </p>
          </div>
        </div>
      </div>
    </div>
  );
}
