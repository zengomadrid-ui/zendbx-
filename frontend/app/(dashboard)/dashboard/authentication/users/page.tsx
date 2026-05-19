'use client';

import { useState, useEffect } from 'react';
import { format } from 'date-fns';

interface User {
  id: string;
  email: string;
  full_name: string;
  oauth_provider: string;
  is_suspended: boolean;
  suspended_at: string | null;
  suspended_reason: string | null;
  last_login_at: string | null;
  last_login_ip: string | null;
  created_at: string;
  active_sessions: number;
  project_count: number;
}

export default function UsersPage() {
  const [users, setUsers] = useState<User[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [providerFilter, setProviderFilter] = useState('');
  const [statusFilter, setStatusFilter] = useState('');
  const [selectedUser, setSelectedUser] = useState<User | null>(null);
  const [showSuspendDialog, setShowSuspendDialog] = useState(false);
  const [suspendReason, setSuspendReason] = useState('');
  const [actionLoading, setActionLoading] = useState(false);
  const [currentUserRole, setCurrentUserRole] = useState<string | null>(null);

  useEffect(() => {
    checkUserRole();
  }, []);

  useEffect(() => {
    if (currentUserRole) {
      fetchUsers();
    }
  }, [search, providerFilter, statusFilter, currentUserRole]);

  const checkUserRole = async () => {
    try {
      const token = localStorage.getItem('token');
      const res = await fetch(`${process.env.NEXT_PUBLIC_API_URL || "http://localhost:8000"}/api/auth/me`, {
        headers: { 'Authorization': `Bearer ${token}` }
      });

      if (res.ok) {
        const data = await res.json();
        setCurrentUserRole(data.role || 'user');
      }
    } catch (error) {
      console.error('Failed to check user role:', error);
      setLoading(false);
    }
  };

  const fetchUsers = async () => {
    try {
      const token = localStorage.getItem('token');
      
      if (currentUserRole === 'admin') {
        // Admin: Fetch all users
        const params = new URLSearchParams();
        if (search) params.append('search', search);
        if (providerFilter) params.append('provider', providerFilter);
        if (statusFilter) params.append('is_suspended', statusFilter);

        const res = await fetch(`${process.env.NEXT_PUBLIC_API_URL || "http://localhost:8000"}/api/admin/users?${params}`, {
          headers: { 'Authorization': `Bearer ${token}` }
        });

        if (res.ok) {
          const data = await res.json();
          setUsers(data.users);
        }
      } else {
        // Non-admin: Fetch only their own user info
        const res = await fetch(`${process.env.NEXT_PUBLIC_API_URL || "http://localhost:8000"}/api/auth/me`, {
          headers: { 'Authorization': `Bearer ${token}` }
        });

        if (res.ok) {
          const userData = await res.json();
          // Format to match User interface
          setUsers([{
            id: userData.id,
            email: userData.email,
            full_name: userData.full_name,
            oauth_provider: userData.oauth_provider || 'email',
            is_suspended: false,
            suspended_at: null,
            suspended_reason: null,
            last_login_at: userData.last_login_at || null,
            last_login_ip: null,
            created_at: userData.created_at,
            active_sessions: 0, // Will be fetched separately if needed
            project_count: 0 // Will be fetched separately if needed
          }]);
        }
      }
    } catch (error) {
      console.error('Failed to fetch users:', error);
    } finally {
      setLoading(false);
    }
  };

  const handleSuspend = async (user: User) => {
    setSelectedUser(user);
    setShowSuspendDialog(true);
  };

  const confirmSuspend = async () => {
    if (!selectedUser || !suspendReason.trim()) return;

    setActionLoading(true);
    try {
      const token = localStorage.getItem('token');
      const res = await fetch(`${process.env.NEXT_PUBLIC_API_URL || "http://localhost:8000"}/api/admin/users/${selectedUser.id}/suspend`, {
        method: 'PATCH',
        headers: {
          'Authorization': `Bearer ${token}`,
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({ reason: suspendReason })
      });

      if (res.ok) {
        await fetchUsers();
        setShowSuspendDialog(false);
        setSuspendReason('');
        setSelectedUser(null);
      }
    } catch (error) {
      console.error('Failed to suspend user:', error);
    } finally {
      setActionLoading(false);
    }
  };

  const handleUnsuspend = async (userId: string) => {
    if (!confirm('Are you sure you want to unsuspend this user?')) return;

    setActionLoading(true);
    try {
      const token = localStorage.getItem('token');
      const res = await fetch(`${process.env.NEXT_PUBLIC_API_URL || "http://localhost:8000"}/api/admin/users/${userId}/unsuspend`, {
        method: 'PATCH',
        headers: { 'Authorization': `Bearer ${token}` }
      });

      if (res.ok) {
        await fetchUsers();
      }
    } catch (error) {
      console.error('Failed to unsuspend user:', error);
    } finally {
      setActionLoading(false);
    }
  };

  const handleDelete = async (user: User) => {
    if (!confirm(`Are you sure you want to delete ${user.email}? This action cannot be undone.`)) return;

    setActionLoading(true);
    try {
      const token = localStorage.getItem('token');
      const res = await fetch(`${process.env.NEXT_PUBLIC_API_URL || "http://localhost:8000"}/api/admin/users/${user.id}`, {
        method: 'DELETE',
        headers: { 'Authorization': `Bearer ${token}` }
      });

      if (res.ok) {
        await fetchUsers();
      }
    } catch (error) {
      console.error('Failed to delete user:', error);
    } finally {
      setActionLoading(false);
    }
  };

  const getProviderBadge = (provider: string) => {
    const colors: Record<string, string> = {
      'email': 'bg-blue-600/10 text-blue-400 border-blue-600/20',
      'google': 'bg-red-600/10 text-red-400 border-red-600/20',
      'github': 'bg-purple-600/10 text-purple-400 border-purple-600/20',
    };
    return colors[provider] || 'bg-gray-600/10 text-gray-400 border-gray-600/20';
  };

  if (loading) {
    return (
      <div className="p-6 flex items-center justify-center">
        <p className="text-sm text-[#a1a1a1]">Loading users...</p>
      </div>
    );
  }

  return (
    <div className="p-6 space-y-6 max-w-7xl">
      {/* Header */}
      <div>
        <h1 className="text-2xl font-bold text-white">
          {currentUserRole === 'admin' ? 'Users' : 'My Account'}
        </h1>
        <p className="text-sm text-[#a1a1a1] mt-1">
          {currentUserRole === 'admin' 
            ? 'Manage all users in your application'
            : 'View your account information'}
        </p>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
        <div className="bg-[#181818] border border-[#2a2a2a] rounded-2xl p-6">
          <div className="flex items-center space-x-3">
            <div className="w-12 h-12 bg-purple-600/10 rounded-xl flex items-center justify-center">
              <svg className="w-6 h-6 text-purple-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4.354a4 4 0 110 5.292M15 21H3v-1a6 6 0 0112 0v1zm0 0h6v-1a6 6 0 00-9-5.197M13 7a4 4 0 11-8 0 4 4 0 018 0z" />
              </svg>
            </div>
            <div>
              <p className="text-2xl font-bold text-white">{users.length}</p>
              <p className="text-xs text-[#a1a1a1]">Total Users</p>
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
                {users.filter(u => !u.is_suspended).length}
              </p>
              <p className="text-xs text-[#a1a1a1]">Active Users</p>
            </div>
          </div>
        </div>

        <div className="bg-[#181818] border border-[#2a2a2a] rounded-2xl p-6">
          <div className="flex items-center space-x-3">
            <div className="w-12 h-12 bg-red-600/10 rounded-xl flex items-center justify-center">
              <svg className="w-6 h-6 text-red-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M18.364 18.364A9 9 0 005.636 5.636m12.728 12.728A9 9 0 015.636 5.636m12.728 12.728L5.636 5.636" />
              </svg>
            </div>
            <div>
              <p className="text-2xl font-bold text-white">
                {users.filter(u => u.is_suspended).length}
              </p>
              <p className="text-xs text-[#a1a1a1]">Suspended</p>
            </div>
          </div>
        </div>

        <div className="bg-[#181818] border border-[#2a2a2a] rounded-2xl p-6">
          <div className="flex items-center space-x-3">
            <div className="w-12 h-12 bg-orange-600/10 rounded-xl flex items-center justify-center">
              <svg className="w-6 h-6 text-orange-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" />
              </svg>
            </div>
            <div>
              <p className="text-2xl font-bold text-white">
                {users.filter(u => u.last_login_at && new Date(u.last_login_at) > new Date(Date.now() - 24*60*60*1000)).length}
              </p>
              <p className="text-xs text-[#a1a1a1]">Active Today</p>
            </div>
          </div>
        </div>
      </div>

      {/* Filters - Only show for admin */}
      {currentUserRole === 'admin' && (
        <div className="bg-[#181818] border border-[#2a2a2a] rounded-2xl p-4">
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <div>
              <label className="block text-xs text-[#a1a1a1] mb-2">Search</label>
              <input
                type="text"
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                placeholder="Search by email or name..."
                className="w-full px-3 py-2 bg-[#1c1c1c] border border-[#2a2a2a] rounded-lg text-sm text-white placeholder-[#6b6b6b] focus:outline-none focus:border-purple-600/50"
              />
            </div>

            <div>
              <label className="block text-xs text-[#a1a1a1] mb-2">Provider</label>
              <select
                value={providerFilter}
                onChange={(e) => setProviderFilter(e.target.value)}
                className="w-full px-3 py-2 bg-[#1c1c1c] border border-[#2a2a2a] rounded-lg text-sm text-white focus:outline-none focus:border-purple-600/50"
              >
                <option value="">All Providers</option>
                <option value="email">Email</option>
                <option value="google">Google</option>
                <option value="github">GitHub</option>
              </select>
            </div>

            <div>
              <label className="block text-xs text-[#a1a1a1] mb-2">Status</label>
              <select
                value={statusFilter}
                onChange={(e) => setStatusFilter(e.target.value)}
                className="w-full px-3 py-2 bg-[#1c1c1c] border border-[#2a2a2a] rounded-lg text-sm text-white focus:outline-none focus:border-purple-600/50"
              >
                <option value="">All Status</option>
                <option value="false">Active</option>
                <option value="true">Suspended</option>
              </select>
            </div>
          </div>
        </div>
      )}

      {/* Users Table */}
      <div className="bg-[#181818] border border-[#2a2a2a] rounded-2xl overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full">
            <thead className="bg-[#1c1c1c] border-b border-[#2a2a2a]">
              <tr>
                <th className="px-6 py-3 text-left text-xs font-semibold text-[#a1a1a1] uppercase tracking-wider">User</th>
                <th className="px-6 py-3 text-left text-xs font-semibold text-[#a1a1a1] uppercase tracking-wider">Provider</th>
                <th className="px-6 py-3 text-left text-xs font-semibold text-[#a1a1a1] uppercase tracking-wider">Last Login</th>
                <th className="px-6 py-3 text-left text-xs font-semibold text-[#a1a1a1] uppercase tracking-wider">Sessions</th>
                <th className="px-6 py-3 text-left text-xs font-semibold text-[#a1a1a1] uppercase tracking-wider">Projects</th>
                <th className="px-6 py-3 text-left text-xs font-semibold text-[#a1a1a1] uppercase tracking-wider">Status</th>
                <th className="px-6 py-3 text-right text-xs font-semibold text-[#a1a1a1] uppercase tracking-wider">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-[#2a2a2a]">
              {users.map((user) => (
                <tr key={user.id} className="hover:bg-[#1c1c1c] transition-colors">
                  <td className="px-6 py-4">
                    <div>
                      <p className="text-sm font-medium text-white">{user.full_name}</p>
                      <p className="text-xs text-[#a1a1a1]">{user.email}</p>
                    </div>
                  </td>
                  <td className="px-6 py-4">
                    <span className={`px-2 py-1 text-xs rounded-full border ${getProviderBadge(user.oauth_provider)}`}>
                      {user.oauth_provider}
                    </span>
                  </td>
                  <td className="px-6 py-4">
                    {user.last_login_at ? (
                      <div>
                        <p className="text-sm text-white">{format(new Date(user.last_login_at), 'MMM d, h:mm a')}</p>
                        <p className="text-xs text-[#a1a1a1]">{user.last_login_ip}</p>
                      </div>
                    ) : (
                      <span className="text-sm text-[#6b6b6b]">Never</span>
                    )}
                  </td>
                  <td className="px-6 py-4">
                    <span className="text-sm text-white">{user.active_sessions}</span>
                  </td>
                  <td className="px-6 py-4">
                    <span className="text-sm text-white">{user.project_count}</span>
                  </td>
                  <td className="px-6 py-4">
                    {user.is_suspended ? (
                      <span className="px-2 py-1 bg-red-600/10 text-red-400 text-xs rounded-full border border-red-600/20">
                        Suspended
                      </span>
                    ) : (
                      <span className="px-2 py-1 bg-green-600/10 text-green-400 text-xs rounded-full border border-green-600/20">
                        Active
                      </span>
                    )}
                  </td>
                  <td className="px-6 py-4 text-right space-x-2">
                    {currentUserRole === 'admin' ? (
                      <>
                        {user.is_suspended ? (
                          <button
                            onClick={() => handleUnsuspend(user.id)}
                            disabled={actionLoading}
                            className="px-3 py-1 bg-green-600/10 hover:bg-green-600/20 text-green-400 rounded text-xs font-medium transition-colors disabled:opacity-50"
                          >
                            Unsuspend
                          </button>
                        ) : (
                          <button
                            onClick={() => handleSuspend(user)}
                            disabled={actionLoading}
                            className="px-3 py-1 bg-yellow-600/10 hover:bg-yellow-600/20 text-yellow-400 rounded text-xs font-medium transition-colors disabled:opacity-50"
                          >
                            Suspend
                          </button>
                        )}
                        <button
                          onClick={() => handleDelete(user)}
                          disabled={actionLoading}
                          className="px-3 py-1 bg-red-600/10 hover:bg-red-600/20 text-red-400 rounded text-xs font-medium transition-colors disabled:opacity-50"
                        >
                          Delete
                        </button>
                      </>
                    ) : (
                      <span className="text-xs text-[#6b6b6b]">-</span>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>

        {users.length === 0 && (
          <div className="p-12 text-center">
            <svg className="w-16 h-16 text-[#3a3a3a] mx-auto mb-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4.354a4 4 0 110 5.292M15 21H3v-1a6 6 0 0112 0v1zm0 0h6v-1a6 6 0 00-9-5.197M13 7a4 4 0 11-8 0 4 4 0 018 0z" />
            </svg>
            <h3 className="text-lg font-semibold text-white mb-2">No Users Found</h3>
            <p className="text-sm text-[#a1a1a1]">Try adjusting your filters</p>
          </div>
        )}
      </div>

      {/* Suspend Dialog */}
      {showSuspendDialog && selectedUser && (
        <div className="fixed inset-0 bg-black/60 backdrop-blur-sm z-50 flex items-center justify-center p-4">
          <div className="bg-[#181818] border border-[#2a2a2a] rounded-2xl p-6 max-w-md w-full">
            <h3 className="text-lg font-bold text-white mb-2">Suspend User</h3>
            <p className="text-sm text-[#a1a1a1] mb-4">
              Suspending {selectedUser.email}. They will be logged out of all sessions.
            </p>

            <div className="mb-4">
              <label className="block text-xs text-[#a1a1a1] mb-2">Reason for suspension</label>
              <textarea
                value={suspendReason}
                onChange={(e) => setSuspendReason(e.target.value)}
                placeholder="Enter reason..."
                rows={3}
                className="w-full px-3 py-2 bg-[#1c1c1c] border border-[#2a2a2a] rounded-lg text-sm text-white placeholder-[#6b6b6b] focus:outline-none focus:border-purple-600/50"
              />
            </div>

            <div className="flex space-x-3">
              <button
                onClick={() => {
                  setShowSuspendDialog(false);
                  setSuspendReason('');
                  setSelectedUser(null);
                }}
                disabled={actionLoading}
                className="flex-1 px-4 py-2 bg-[#2a2a2a] hover:bg-[#3a3a3a] text-white rounded-lg text-sm font-medium transition-colors disabled:opacity-50"
              >
                Cancel
              </button>
              <button
                onClick={confirmSuspend}
                disabled={actionLoading || !suspendReason.trim()}
                className="flex-1 px-4 py-2 bg-red-600 hover:bg-red-700 text-white rounded-lg text-sm font-medium transition-colors disabled:opacity-50"
              >
                {actionLoading ? 'Suspending...' : 'Suspend User'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
