'use client';

import Link from 'next/link';
import { useState, useEffect } from 'react';

// Force dynamic rendering - prevent static generation
export const dynamic = 'force-dynamic';
export const revalidate = 0;

interface ProjectStats {
  project: {
    id: string;
    name: string;
    created_at: string;
  };
  database: {
    table_count: number;
    total_rows: number;
    function_count: number;
    trigger_count: number;
    size_bytes: number;
    size_mb: number;
    recent_activity: number;
  };
  api: {
    total_requests: number;
    requests_24h: number;
    requests_1h: number;
  };
  auth: {
    total_users: number;
    new_users_7d: number;
    active_users_24h: number;
  };
  resources: {
    storage: {
      used_mb: number;
      limit_mb: number;
      percentage: number;
    };
    memory: {
      used_mb: number;
      limit_mb: number;
      percentage: number;
    };
  };
}

export default function DashboardPage() {
  const [stats, setStats] = useState<ProjectStats | null>(null);
  const [loading, setLoading] = useState(true);
  const [selectedProjectId, setSelectedProjectId] = useState<string | null>(null);

  useEffect(() => {
    fetchProjectAndStats();
    
    // Auto-refresh every 10 seconds
    const interval = setInterval(() => {
      if (selectedProjectId) {
        fetchStats(selectedProjectId);
      }
    }, 10000);
    
    return () => clearInterval(interval);
  }, [selectedProjectId]);

  const fetchProjectAndStats = async () => {
    const token = localStorage.getItem('token');
    if (!token) return;

    try {
      // First, get the list of projects
      const projectsResponse = await fetch(`${process.env.NEXT_PUBLIC_API_URL!}/api/projects`, {
        headers: {
          'Authorization': `Bearer ${token}`,
        },
      });

      if (projectsResponse.ok) {
        const projects = await projectsResponse.json();
        
        if (projects.length > 0) {
          const firstProject = projects[0];
          setSelectedProjectId(firstProject.id);
          await fetchStats(firstProject.id);
        } else {
          setLoading(false);
        }
      }
    } catch (error) {
      console.error('Failed to fetch projects:', error);
      setLoading(false);
    }
  };

  const fetchStats = async (projectId: string) => {
    const token = localStorage.getItem('token');
    if (!token) return;

    try {
      const response = await fetch(`${process.env.NEXT_PUBLIC_API_URL!}/api/projects/${projectId}/overview`, {
        headers: {
          'Authorization': `Bearer ${token}`,
        },
      });

      if (response.ok) {
        const data = await response.json();
        setStats(data);
      } else {
        const errorText = await response.text();
        console.error('Failed to fetch stats:', response.status, errorText);
        alert(`Error ${response.status}: ${errorText}`);
      }
    } catch (error) {
      console.error('Failed to fetch stats:', error);
      alert(`Network error: ${error}`);
    } finally {
      setLoading(false);
    }
  };

  const quickActions = [
    {
      title: 'New Query',
      description: 'Write and execute SQL queries',
      href: '/dashboard/sql-editor',
      icon: (
        <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 9l3 3-3 3m5 0h3M5 20h14a2 2 0 002-2V6a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z" />
        </svg>
      ),
      primary: true,
    },
    {
      title: 'Upload Data',
      description: 'Import CSV files with data cleaning',
      href: '/dashboard/import',
      icon: (
        <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M7 16a4 4 0 01-.88-7.903A5 5 0 1115.9 6L16 6a5 5 0 011 9.9M15 13l-3-3m0 0l-3 3m3-3v12" />
        </svg>
      ),
      primary: false,
    },
    {
      title: 'Browse Tables',
      description: 'View and edit your data',
      href: '/dashboard/database/tables',
      icon: (
        <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 10h18M3 14h18m-9-4v8m-7 0h14a2 2 0 002-2V8a2 2 0 00-2-2H5a2 2 0 00-2 2v8a2 2 0 002 2z" />
        </svg>
      ),
      primary: false,
    },
  ];

  if (loading) {
    return (
      <div className="min-h-full bg-[#1c1c1c] p-6">
        <div className="max-w-[1600px] mx-auto">
          <div className="flex items-center justify-center h-64">
            <div className="text-center">
              <div className="w-12 h-12 border-4 border-orange-500 border-t-transparent rounded-full animate-spin mx-auto mb-4"></div>
              <p className="text-sm text-[#a1a1a1]">Loading project statistics...</p>
            </div>
          </div>
        </div>
      </div>
    );
  }

  if (!stats) {
    return (
      <div className="min-h-full bg-[#1c1c1c] p-6">
        <div className="max-w-[1600px] mx-auto">
          <div className="text-center py-12">
          <svg className="w-16 h-16 mx-auto text-[#3a3a3a] mb-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 7v10a2 2 0 002 2h14a2 2 0 002-2V9a2 2 0 00-2-2h-6l-2-2H5a2 2 0 00-2 2z" />
          </svg>
          <h2 className="text-lg font-semibold text-[#ededed] mb-2">No Projects Yet</h2>
          <p className="text-sm text-[#a1a1a1] mb-4">Create your first project to get started</p>
          <Link
            href="/dashboard/projects"
            className="inline-flex items-center px-4 py-2 bg-orange-600 hover:bg-orange-500 text-white text-sm rounded transition-colors"
          >
            Create Project
          </Link>
        </div>
      </div>
    </div>
  );
  }

  const statCards = [
    {
      name: 'Database Tables',
      value: stats.database.table_count.toString(),
      change: `${stats.database.total_rows.toLocaleString()} total rows`,
      trend: 'neutral',
      icon: (
        <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 10h18M3 14h18m-9-4v8m-7 0h14a2 2 0 002-2V8a2 2 0 00-2-2H5a2 2 0 00-2 2v8a2 2 0 002 2z" />
        </svg>
      ),
      link: '/dashboard/database/tables'
    },
    {
      name: 'API Requests',
      value: stats.api.requests_24h.toLocaleString(),
      change: `${stats.api.requests_1h} in last hour`,
      trend: stats.api.requests_1h > 0 ? 'up' : 'neutral',
      icon: (
        <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 10V3L4 14h7v7l9-11h-7z" />
        </svg>
      ),
      link: '/dashboard/api-playground'
    },
    {
      name: 'Total Users',
      value: stats.auth.total_users.toString(),
      change: `${stats.auth.active_users_24h} active today`,
      trend: stats.auth.active_users_24h > 0 ? 'up' : 'neutral',
      icon: (
        <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4.354a4 4 0 110 5.292M15 21H3v-1a6 6 0 0112 0v1zm0 0h6v-1a6 6 0 00-9-5.197M13 7a4 4 0 11-8 0 4 4 0 018 0z" />
        </svg>
      ),
      link: '/dashboard/authentication/users'
    },
    {
      name: 'Functions & Triggers',
      value: `${stats.database.function_count + stats.database.trigger_count}`,
      change: `${stats.database.function_count} functions, ${stats.database.trigger_count} triggers`,
      trend: 'neutral',
      icon: (
        <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10 20l4-16m4 4l4 4-4 4M6 16l-4-4 4-4" />
        </svg>
      ),
      link: '/dashboard/database/functions'
    },
  ];

  return (
    <div className="min-h-full bg-[#1c1c1c] p-6">
      <div className="max-w-[1600px] mx-auto space-y-6">
        {/* Header */}
        <div className="flex items-center justify-between">
        <div>
          <h1 className="text-xl font-semibold text-[#ededed]">{stats.project.name}</h1>
          <p className="text-xs text-[#a1a1a1] mt-1">Real-time project overview and statistics</p>
        </div>
        <div className="flex items-center space-x-2 text-xs text-[#6b6b6b]">
          <div className="w-2 h-2 bg-green-500 rounded-full animate-pulse"></div>
          <span>Live</span>
        </div>
      </div>

      {/* Stats Grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
        {statCards.map((stat) => (
          <Link
            key={stat.name}
            href={stat.link}
            className="bg-[#181818] border border-[#2a2a2a] rounded-lg p-4 hover:border-[#3a3a3a] transition-colors group"
          >
            <div className="flex items-center justify-between mb-3">
              <div className="w-8 h-8 bg-[#2a2a2a] rounded flex items-center justify-center text-orange-500 group-hover:bg-[#3a3a3a] transition-colors">
                {stat.icon}
              </div>
              {stat.trend !== 'neutral' && (
                <span className={`text-[10px] font-medium flex items-center space-x-1 ${
                  stat.trend === 'up' ? 'text-green-500' : 'text-red-500'
                }`}>
                  <svg className="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d={stat.trend === 'up' ? 'M5 10l7-7m0 0l7 7m-7-7v18' : 'M19 14l-7 7m0 0l-7-7m7 7V3'} />
                  </svg>
                </span>
              )}
            </div>
            <p className="text-[10px] text-[#a1a1a1] font-medium uppercase tracking-wider">{stat.name}</p>
            <p className="text-2xl font-semibold text-[#ededed] mt-1">{stat.value}</p>
            <p className="text-[10px] text-[#6b6b6b] mt-1">{stat.change}</p>
          </Link>
        ))}
      </div>

      {/* Resource Usage */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        {/* Storage Usage */}
        <div className="bg-[#181818] border border-[#2a2a2a] rounded-lg p-4">
          <div className="flex items-center justify-between mb-3">
            <h3 className="text-sm font-semibold text-[#ededed]">Storage Usage</h3>
            <span className="text-xs text-[#a1a1a1]">
              {stats.resources.storage.used_mb} MB / {stats.resources.storage.limit_mb} MB
            </span>
          </div>
          <div className="w-full bg-[#2a2a2a] rounded-full h-2 mb-2">
            <div
              className={`h-2 rounded-full transition-all ${
                stats.resources.storage.percentage > 80 ? 'bg-red-500' :
                stats.resources.storage.percentage > 60 ? 'bg-yellow-500' :
                'bg-green-500'
              }`}
              style={{ width: `${Math.min(stats.resources.storage.percentage, 100)}%` }}
            ></div>
          </div>
          <p className="text-[10px] text-[#6b6b6b]">
            {stats.resources.storage.percentage.toFixed(1)}% used
          </p>
        </div>

        {/* Memory Usage */}
        <div className="bg-[#181818] border border-[#2a2a2a] rounded-lg p-4">
          <div className="flex items-center justify-between mb-3">
            <h3 className="text-sm font-semibold text-[#ededed]">Memory Usage</h3>
            <span className="text-xs text-[#a1a1a1]">
              {stats.resources.memory.used_mb} MB / {stats.resources.memory.limit_mb} MB
            </span>
          </div>
          <div className="w-full bg-[#2a2a2a] rounded-full h-2 mb-2">
            <div
              className={`h-2 rounded-full transition-all ${
                stats.resources.memory.percentage > 80 ? 'bg-red-500' :
                stats.resources.memory.percentage > 60 ? 'bg-yellow-500' :
                'bg-green-500'
              }`}
              style={{ width: `${Math.min(stats.resources.memory.percentage, 100)}%` }}
            ></div>
          </div>
          <p className="text-[10px] text-[#6b6b6b]">
            {stats.resources.memory.percentage.toFixed(1)}% used
          </p>
        </div>
      </div>

      {/* Quick Actions */}
      <div>
        <h2 className="text-sm font-semibold text-[#ededed] mb-3">Quick actions</h2>
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          {quickActions.map((action) => (
            <Link
              key={action.title}
              href={action.href}
              className={`block p-4 rounded-lg border transition-all group ${
                action.primary
                  ? 'bg-gradient-to-br from-orange-600 to-orange-500 border-orange-600 hover:from-orange-500 hover:to-orange-600'
                  : 'bg-[#181818] border-[#2a2a2a] hover:border-[#3a3a3a]'
              }`}
            >
              <div className={`w-10 h-10 rounded flex items-center justify-center mb-3 ${
                action.primary
                  ? 'bg-white/10'
                  : 'bg-[#2a2a2a] text-orange-500 group-hover:bg-[#3a3a3a]'
              } transition-colors`}>
                {action.icon}
              </div>
              <h3 className={`text-sm font-semibold mb-1 ${
                action.primary ? 'text-white' : 'text-[#ededed] group-hover:text-orange-500'
              } transition-colors`}>
                {action.title}
              </h3>
              <p className={`text-xs ${
                action.primary ? 'text-orange-100' : 'text-[#a1a1a1]'
              }`}>
                {action.description}
              </p>
            </Link>
          ))}
        </div>
      </div>

      {/* Database Activity */}
      <div className="bg-[#181818] border border-[#2a2a2a] rounded-lg p-4">
        <h2 className="text-sm font-semibold text-[#ededed] mb-4">Database Activity</h2>
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
          <div className="text-center">
            <p className="text-2xl font-semibold text-[#ededed]">{stats.database.table_count}</p>
            <p className="text-xs text-[#6b6b6b] mt-1">Tables</p>
          </div>
          <div className="text-center">
            <p className="text-2xl font-semibold text-[#ededed]">{stats.database.total_rows.toLocaleString()}</p>
            <p className="text-xs text-[#6b6b6b] mt-1">Total Rows</p>
          </div>
          <div className="text-center">
            <p className="text-2xl font-semibold text-[#ededed]">{stats.database.function_count}</p>
            <p className="text-xs text-[#6b6b6b] mt-1">Functions</p>
          </div>
          <div className="text-center">
            <p className="text-2xl font-semibold text-[#ededed]">{stats.database.trigger_count}</p>
            <p className="text-xs text-[#6b6b6b] mt-1">Triggers</p>
          </div>
        </div>
      </div>
    </div>
    </div>
  );
}
