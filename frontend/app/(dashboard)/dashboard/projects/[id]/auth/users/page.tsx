'use client';

export const dynamic = 'force-dynamic';
export const revalidate = 0;

import { apiFetch } from '@/lib/fetch-utils';
import { useState, useEffect } from 'react';
import { useParams } from 'next/navigation';

interface ProjectUser {
  id: string;
  email: string;
  full_name: string;
  provider: string;
  avatar_url: string | null;
  is_active: boolean;
  last_login_at: string | null;
  last_login_ip: string | null;
  created_at: string;
  active_sessions: number;
}

export default function ProjectUsersPage() {
  const params = useParams();
  const projectId = params.id as string;
  
  const [users, setUsers] = useState<ProjectUser[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [providerFilter, setProviderFilter] = useState('');
  const [statusFilter, setStatusFilter] = useState('');
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    fetchUsers();
  }, [search, providerFilter, statusFilter, projectId]);

  const fetchUsers = async () => {
    try {
      // Query the project database directly for users table
      const sql = `
        SELECT 
          id, 
          email, 
          name as full_name, 
          provider, 
          avatar_url,
          COALESCE(is_active, true) as is_active,
          last_login_at,
          created_at,
          0 as active_sessions,
          NULL as last_login_ip
        FROM users
        ${search ? `WHERE email ILIKE '%${search}%' OR name ILIKE '%${search}%'` : ''}
        ${providerFilter ? `${search ? 'AND' : 'WHERE'} provider = '${providerFilter}'` : ''}
        ORDER BY created_at DESC
      `;

      const res = await apiFetch(`/api/projects/${projectId}/query`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ sql })
      });

      if (res.status === 404) {
        setError('Project not found or you do not have access to this project');
        setLoading(false);
        return;
      }

      if (res.status === 403) {
        setError('Access denied. You do not own this project.');
        setLoading(false);
        return;
      }

      if (res.ok) {
        const data = await res.json();
        let filteredUsers = data.rows || [];
        
        // Apply status filter
        if (statusFilter === 'active') {
          filteredUsers = filteredUsers.filter((u: ProjectUser) => u.is_active);
        } else if (statusFilter === 'suspended') {
          filteredUsers = filteredUsers.filter((u: ProjectUser) => !u.is_active);
        }
        
        setUsers(filteredUsers);
        setError(null);
      } else {
        const errorData = await res.json().catch(() => ({}));
        setError(`Failed to load users: ${errorData.detail || res.statusText}`);
      }
    } catch (error) {
      console.error('Failed to fetch project users:', error);
      setError('Network error. Please check if the backend is running.');
    } finally {
      setLoading(false);
    }
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-[#0f0f0f] p-6 flex items-center justify-center">
        <p className="text-sm text-[#6b6b6b]">Loading users...</p>
      </div>
    );
  }

  if (error) {
    return (
      <div className="min-h-screen bg-[#0f0f0f] p-6">
        <div className="max-w-2xl mx-auto">
          <div className="bg-[#1a1a1a] border border-red-900/20 rounded-lg p-8 text-center">
            <div className="w-16 h-16 bg-red-900/20 rounded-full flex items-center justify-center mx-auto mb-4">
              <svg className="w-8 h-8 text-red-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
              </svg>
            </div>
            <h2 className="text-xl font-bold text-white mb-2">Error Loading Users</h2>
            <p className="text-sm text-[#a1a1a1] mb-4">{error}</p>
            <button
              onClick={() => {
                setError(null);
                setLoading(true);
                fetchUsers();
              }}
              className="px-4 py-2 bg-purple-600 hover:bg-purple-700 text-white rounded-lg text-sm font-medium transition-colors"
            >
              Try Again
            </button>
          </div>
        </div>
      </div>
    );
  }

  const totalUsers = users.length;
  const activeUsers = users.filter(u => u.is_active).length;
  const suspendedUsers = users.filter(u => !u.is_active).length;
  const activeToday = users.filter(u => u.last_login_at && new Date(u.last_login_at) > new Date(Date.now() - 24*60*60*1000)).length;

  return (
    <div className="min-h-screen bg-[#0f0f0f] p-6">
      <div className="max-w-7xl mx-auto space-y-6">
        {/* Header */}
        <div>
          <h1 className="text-2xl font-bold text-white">Users</h1>
          <p className="text-sm text-[#6b6b6b] mt-1">
            Manage all users in your application
          </p>
        </div>

        {/* Stats Cards */}
        <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
          {/* Total Users */}
          <div className="bg-[#1a1a1a] border border-[#2a2a2a] rounded-lg p-4">
            <div className="flex items-center space-x-3">
              <div className="w-10 h-10 bg-purple-500/10 rounded-lg flex items-center justify-center">
                <svg className="w-5 h-5 text-purple-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4.354a4 4 0 110 5.292M15 21H3v-1a6 6 0 0112 0v1zm0 0h6v-1a6 6 0 00-9-5.197M13 7a4 4 0 11-8 0 4 4 0 018 0z" />
                </svg>
              </div>
              <div>
                <p className="text-2xl font-bold text-white">{totalUsers}</p>
                <p className="text-xs text-[#6b6b6b]">Total Users</p>
              </div>
            </div>
          </div>

          {/* Active Users */}
          <div className="bg-[#1a1a1a] border border-[#2a2a2a] rounded-lg p-4">
            <div className="flex items-center space-x-3">
              <div className="w-10 h-10 bg-green-500/10 rounded-lg flex items-center justify-center">
                <svg className="w-5 h-5 text-green-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
                </svg>
              </div>
              <div>
                <p className="text-2xl font-bold text-white">{activeUsers}</p>
                <p className="text-xs text-[#6b6b6b]">Active Users</p>
              </div>
            </div>
          </div>

          {/* Suspended */}
          <div className="bg-[#1a1a1a] border border-[#2a2a2a] rounded-lg p-4">
            <div className="flex items-center space-x-3">
              <div className="w-10 h-10 bg-red-500/10 rounded-lg flex items-center justify-center">
                <svg className="w-5 h-5 text-red-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M18.364 18.364A9 9 0 005.636 5.636m12.728 12.728A9 9 0 015.636 5.636m12.728 12.728L5.636 5.636" />
                </svg>
              </div>
              <div>
                <p className="text-2xl font-bold text-white">{suspendedUsers}</p>
                <p className="text-xs text-[#6b6b6b]">Suspended</p>
              </div>
            </div>
          </div>

          {/* Active Today */}
          <div className="bg-[#1a1a1a] border border-[#2a2a2a] rounded-lg p-4">
            <div className="flex items-center space-x-3">
              <div className="w-10 h-10 bg-orange-500/10 rounded-lg flex items-center justify-center">
                <svg className="w-5 h-5 text-orange-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" />
                </svg>
              </div>
              <div>
                <p className="text-2xl font-bold text-white">{activeToday}</p>
                <p className="text-xs text-[#6b6b6b]">Active Today</p>
              </div>
            </div>
          </div>
        </div>

        {/* Filters */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          <div>
            <label className="block text-xs text-[#6b6b6b] mb-2">Search</label>
            <input
              type="text"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Search by email or name..."
              className="w-full px-3 py-2 bg-[#1a1a1a] border border-[#2a2a2a] rounded-lg text-sm text-white placeholder-[#4a4a4a] focus:outline-none focus:border-[#3a3a3a]"
            />
          </div>

          <div>
            <label className="block text-xs text-[#6b6b6b] mb-2">Provider</label>
            <select
              value={providerFilter}
              onChange={(e) => setProviderFilter(e.target.value)}
              className="w-full px-3 py-2 bg-[#1a1a1a] border border-[#2a2a2a] rounded-lg text-sm text-white focus:outline-none focus:border-[#3a3a3a]"
            >
              <option value="">All Providers</option>
              <option value="email">Email</option>
              <option value="google">Google</option>
              <option value="github">GitHub</option>
            </select>
          </div>

          <div>
            <label className="block text-xs text-[#6b6b6b] mb-2">Status</label>
            <select
              value={statusFilter}
              onChange={(e) => setStatusFilter(e.target.value)}
              className="w-full px-3 py-2 bg-[#1a1a1a] border border-[#2a2a2a] rounded-lg text-sm text-white focus:outline-none focus:border-[#3a3a3a]"
            >
              <option value="">All Status</option>
              <option value="active">Active</option>
              <option value="suspended">Suspended</option>
            </select>
          </div>
        </div>

        {/* Users Table */}
        <div className="bg-[#1a1a1a] border border-[#2a2a2a] rounded-lg overflow-hidden">
          <table className="w-full">
            <thead className="bg-[#151515] border-b border-[#2a2a2a]">
              <tr>
                <th className="px-6 py-3 text-left text-xs font-medium text-[#6b6b6b] uppercase tracking-wider">User</th>
                <th className="px-6 py-3 text-left text-xs font-medium text-[#6b6b6b] uppercase tracking-wider">Provider</th>
                <th className="px-6 py-3 text-left text-xs font-medium text-[#6b6b6b] uppercase tracking-wider">Last Login</th>
                <th className="px-6 py-3 text-left text-xs font-medium text-[#6b6b6b] uppercase tracking-wider">Sessions</th>
                <th className="px-6 py-3 text-left text-xs font-medium text-[#6b6b6b] uppercase tracking-wider">Projects</th>
                <th className="px-6 py-3 text-left text-xs font-medium text-[#6b6b6b] uppercase tracking-wider">Status</th>
                <th className="px-6 py-3 text-right text-xs font-medium text-[#6b6b6b] uppercase tracking-wider">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-[#2a2a2a]">
              {users.map((user) => (
                <tr key={user.id} className="hover:bg-[#1f1f1f] transition-colors">
                  <td className="px-6 py-4">
                    <div className="flex items-center space-x-3">
                      {user.avatar_url ? (
                        <img 
                          src={user.avatar_url} 
                          alt={user.full_name}
                          className="w-8 h-8 rounded-full"
                        />
                      ) : (
                        <div className="w-8 h-8 bg-[#2a2a2a] rounded-full flex items-center justify-center">
                          <span className="text-xs text-[#6b6b6b] font-medium">
                            {user.email.charAt(0).toUpperCase()}
                          </span>
                        </div>
                      )}
                      <div>
                        <p className="text-sm font-medium text-white">{user.full_name || user.email.split('@')[0]}</p>
                        <p className="text-xs text-[#6b6b6b]">{user.email}</p>
                      </div>
                    </div>
                  </td>
                  <td className="px-6 py-4">
                    <span className="text-sm text-[#a1a1a1] capitalize">{user.provider}</span>
                  </td>
                  <td className="px-6 py-4">
                    <span className="text-sm text-[#6b6b6b]">
                      {user.last_login_at ? new Date(user.last_login_at).toLocaleDateString() : 'Never'}
                    </span>
                  </td>
                  <td className="px-6 py-4">
                    <span className="text-sm text-white">{user.active_sessions}</span>
                  </td>
                  <td className="px-6 py-4">
                    <span className="text-sm text-white">1</span>
                  </td>
                  <td className="px-6 py-4">
                    {user.is_active ? (
                      <span className="text-sm text-green-500">Active</span>
                    ) : (
                      <span className="text-sm text-red-500">Suspended</span>
                    )}
                  </td>
                  <td className="px-6 py-4 text-right space-x-2">
                    <button className="px-3 py-1 text-xs text-yellow-500 hover:text-yellow-400 transition-colors">
                      Suspend
                    </button>
                    <button className="px-3 py-1 text-xs text-red-500 hover:text-red-400 transition-colors">
                      Delete
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>

          {users.length === 0 && (
            <div className="p-12 text-center">
              <svg className="w-16 h-16 text-[#2a2a2a] mx-auto mb-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4.354a4 4 0 110 5.292M15 21H3v-1a6 6 0 0112 0v1zm0 0h6v-1a6 6 0 00-9-5.197M13 7a4 4 0 11-8 0 4 4 0 018 0z" />
              </svg>
              <h3 className="text-lg font-semibold text-white mb-2">No Users Found</h3>
              <p className="text-sm text-[#6b6b6b]">No users have authenticated via your app yet</p>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
