'use client';

import React, { useState, useEffect } from 'react';
import { format } from 'date-fns';

interface AuditLog {
  id: string;
  event_type: string;
  user_id: string;
  user_email: string;
  ip_address: string;
  user_agent: string;
  event_data: any;
  success: boolean;
  created_at: string;
}

interface LogStats {
  total_events: number;
  successful_events: number;
  failed_events: number;
  last_24h: number;
}

export default function LogsPage() {
  const [logs, setLogs] = useState<AuditLog[]>([]);
  const [stats, setStats] = useState<LogStats>({
    total_events: 0,
    successful_events: 0,
    failed_events: 0,
    last_24h: 0
  });
  const [loading, setLoading] = useState(true);
  const [eventFilter, setEventFilter] = useState('');
  const [successFilter, setSuccessFilter] = useState('');
  const [searchQuery, setSearchQuery] = useState('');
  const [dateFrom, setDateFrom] = useState('');
  const [dateTo, setDateTo] = useState('');
  const [exportFormat, setExportFormat] = useState<'csv' | 'json'>('csv');

  useEffect(() => {
    fetchLogs();
    fetchStats();
  }, [eventFilter, successFilter]);

  const fetchStats = async () => {
    try {
      const token = localStorage.getItem('token');
      const response = await fetch(`${process.env.NEXT_PUBLIC_API_URL || "http://localhost:8000"}/api/audit/logs/stats`, {
        headers: {
          'Authorization': `Bearer ${token}`
        }
      });
      
      if (response.ok) {
        const data = await response.json();
        setStats(data);
      }
    } catch (error) {
      console.error('Failed to fetch stats:', error);
    }
  };

  const fetchLogs = async () => {
    try {
      const token = localStorage.getItem('token');
      const params = new URLSearchParams();
      
      if (eventFilter) params.append('event_type', eventFilter);
      if (successFilter) params.append('success', successFilter);
      params.append('limit', '100');
      
      const response = await fetch(`${process.env.NEXT_PUBLIC_API_URL || "http://localhost:8000"}/api/audit/logs?${params}`, {
        headers: {
          'Authorization': `Bearer ${token}`
        }
      });
      
      if (response.ok) {
        const data = await response.json();
        setLogs(data.logs || []);
      } else {
        // Fallback to mock data if API fails
        const mockLogs: AuditLog[] = [
          {
            id: '1',
            event_type: 'login',
            user_id: '123',
            user_email: 'user@example.com',
            ip_address: '192.168.1.1',
            user_agent: 'Mozilla/5.0',
            event_data: { method: 'email' },
            success: true,
            created_at: new Date().toISOString()
          },
          {
            id: '2',
            event_type: 'password_change',
            user_id: '123',
            user_email: 'user@example.com',
            ip_address: '192.168.1.1',
            user_agent: 'Mozilla/5.0',
            event_data: {},
            success: true,
            created_at: new Date(Date.now() - 3600000).toISOString()
          },
          {
            id: '3',
            event_type: 'login',
            user_id: '456',
            user_email: 'admin@example.com',
            ip_address: '192.168.1.2',
            user_agent: 'Chrome/91.0',
            event_data: { method: 'google' },
            success: false,
            created_at: new Date(Date.now() - 7200000).toISOString()
          }
        ];
        setLogs(mockLogs);
      }
    } catch (error) {
      console.error('Failed to fetch logs:', error);
    } finally {
      setLoading(false);
    }
  };

  const getEventIcon = (eventType: string) => {
    const icons: Record<string, React.ReactNode> = {
      login: (
        <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M11 16l-4-4m0 0l4-4m-4 4h14m-5 4v1a3 3 0 01-3 3H6a3 3 0 01-3-3V7a3 3 0 013-3h7a3 3 0 013 3v1" />
        </svg>
      ),
      logout: (
        <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17 16l4-4m0 0l-4-4m4 4H7m6 4v1a3 3 0 01-3 3H6a3 3 0 01-3-3V7a3 3 0 013-3h4a3 3 0 013 3v1" />
        </svg>
      ),
      password_change: (
        <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 7a2 2 0 012 2m4 0a6 6 0 01-7.743 5.743L11 17H9v2H7v2H4a1 1 0 01-1-1v-2.586a1 1 0 01.293-.707l5.964-5.964A6 6 0 1121 9z" />
        </svg>
      ),
      user_suspended: (
        <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M18.364 18.364A9 9 0 005.636 5.636m12.728 12.728A9 9 0 015.636 5.636m12.728 12.728L5.636 5.636" />
        </svg>
      ),
      default: (
        <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
        </svg>
      )
    };
    return icons[eventType] || icons.default;
  };

  const getEventColor = (eventType: string) => {
    const colors: Record<string, string> = {
      login: 'text-green-500',
      logout: 'text-blue-500',
      password_change: 'text-orange-500',
      user_suspended: 'text-red-500',
      default: 'text-gray-500'
    };
    return colors[eventType] || colors.default;
  };

  const exportLogs = () => {
    if (exportFormat === 'csv') {
      const csv = [
        ['Timestamp', 'Event', 'User', 'IP Address', 'User Agent', 'Status'].join(','),
        ...filteredLogs.map(log => [
          log.created_at,
          log.event_type,
          log.user_email,
          log.ip_address,
          `"${log.user_agent}"`,
          log.success ? 'Success' : 'Failed'
        ].join(','))
      ].join('\n');

      const blob = new Blob([csv], { type: 'text/csv' });
      const url = window.URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `audit-logs-${Date.now()}.csv`;
      a.click();
    } else {
      const json = JSON.stringify(filteredLogs, null, 2);
      const blob = new Blob([json], { type: 'application/json' });
      const url = window.URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `audit-logs-${Date.now()}.json`;
      a.click();
    }
  };

  const filteredLogs = logs.filter(log => {
    if (eventFilter && log.event_type !== eventFilter) return false;
    if (successFilter && log.success.toString() !== successFilter) return false;
    if (searchQuery && !log.user_email.toLowerCase().includes(searchQuery.toLowerCase())) return false;
    
    // Date range filtering
    if (dateFrom) {
      const logDate = new Date(log.created_at);
      const fromDate = new Date(dateFrom);
      if (logDate < fromDate) return false;
    }
    if (dateTo) {
      const logDate = new Date(log.created_at);
      const toDate = new Date(dateTo);
      toDate.setHours(23, 59, 59, 999); // End of day
      if (logDate > toDate) return false;
    }
    
    return true;
  });

  if (loading) {
    return (
      <div className="p-6 flex items-center justify-center">
        <p className="text-sm text-[#a1a1a1]">Loading logs...</p>
      </div>
    );
  }

  return (
    <div className="p-6 space-y-6 max-w-7xl">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-white">Audit Logs</h1>
          <p className="text-sm text-[#a1a1a1] mt-1">
            Track all authentication events and security activities
          </p>
        </div>
        <div className="flex items-center space-x-3">
          <select
            value={exportFormat}
            onChange={(e) => setExportFormat(e.target.value as 'csv' | 'json')}
            className="px-3 py-2 bg-[#1c1c1c] border border-[#2a2a2a] rounded-lg text-sm text-white focus:outline-none focus:border-purple-600/50"
          >
            <option value="csv">CSV</option>
            <option value="json">JSON</option>
          </select>
          <button
            onClick={exportLogs}
            className="px-4 py-2 bg-purple-600 hover:bg-purple-700 text-white rounded-lg text-sm font-medium transition-colors flex items-center space-x-2"
          >
            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-4l-4 4m0 0l-4-4m4 4V4" />
            </svg>
            <span>Export {exportFormat.toUpperCase()}</span>
          </button>
        </div>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
        <div className="bg-[#181818] border border-[#2a2a2a] rounded-2xl p-6">
          <div className="flex items-center space-x-3">
            <div className="w-12 h-12 bg-purple-600/10 rounded-xl flex items-center justify-center">
              <svg className="w-6 h-6 text-purple-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
              </svg>
            </div>
            <div>
              <p className="text-2xl font-bold text-white">{stats.total_events}</p>
              <p className="text-xs text-[#a1a1a1]">Total Events</p>
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
              <p className="text-2xl font-bold text-white">{stats.successful_events}</p>
              <p className="text-xs text-[#a1a1a1]">Successful</p>
            </div>
          </div>
        </div>

        <div className="bg-[#181818] border border-[#2a2a2a] rounded-2xl p-6">
          <div className="flex items-center space-x-3">
            <div className="w-12 h-12 bg-red-600/10 rounded-xl flex items-center justify-center">
              <svg className="w-6 h-6 text-red-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10 14l2-2m0 0l2-2m-2 2l-2-2m2 2l2 2m7-2a9 9 0 11-18 0 9 9 0 0118 0z" />
              </svg>
            </div>
            <div>
              <p className="text-2xl font-bold text-white">{stats.failed_events}</p>
              <p className="text-xs text-[#a1a1a1]">Failed</p>
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
              <p className="text-2xl font-bold text-white">{stats.last_24h}</p>
              <p className="text-xs text-[#a1a1a1]">Last 24h</p>
            </div>
          </div>
        </div>
      </div>

      {/* Filters */}
      <div className="bg-[#181818] border border-[#2a2a2a] rounded-2xl p-4">
        <div className="grid grid-cols-1 md:grid-cols-5 gap-4">
          <div>
            <label className="block text-xs text-[#a1a1a1] mb-2">Search User</label>
            <input
              type="text"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder="Search by email..."
              className="w-full px-3 py-2 bg-[#1c1c1c] border border-[#2a2a2a] rounded-lg text-sm text-white placeholder-[#6b6b6b] focus:outline-none focus:border-purple-600/50"
            />
          </div>

          <div>
            <label className="block text-xs text-[#a1a1a1] mb-2">Event Type</label>
            <select
              value={eventFilter}
              onChange={(e) => setEventFilter(e.target.value)}
              className="w-full px-3 py-2 bg-[#1c1c1c] border border-[#2a2a2a] rounded-lg text-sm text-white focus:outline-none focus:border-purple-600/50"
            >
              <option value="">All Events</option>
              <option value="login">Login</option>
              <option value="logout">Logout</option>
              <option value="password_change">Password Change</option>
              <option value="user_suspended">User Suspended</option>
              <option value="api_key_created">API Key Created</option>
              <option value="project_created">Project Created</option>
            </select>
          </div>

          <div>
            <label className="block text-xs text-[#a1a1a1] mb-2">Status</label>
            <select
              value={successFilter}
              onChange={(e) => setSuccessFilter(e.target.value)}
              className="w-full px-3 py-2 bg-[#1c1c1c] border border-[#2a2a2a] rounded-lg text-sm text-white focus:outline-none focus:border-purple-600/50"
            >
              <option value="">All Status</option>
              <option value="true">Success</option>
              <option value="false">Failed</option>
            </select>
          </div>

          <div>
            <label className="block text-xs text-[#a1a1a1] mb-2">Date From</label>
            <input
              type="date"
              value={dateFrom}
              onChange={(e) => setDateFrom(e.target.value)}
              className="w-full px-3 py-2 bg-[#1c1c1c] border border-[#2a2a2a] rounded-lg text-sm text-white focus:outline-none focus:border-purple-600/50"
            />
          </div>

          <div>
            <label className="block text-xs text-[#a1a1a1] mb-2">Date To</label>
            <input
              type="date"
              value={dateTo}
              onChange={(e) => setDateTo(e.target.value)}
              className="w-full px-3 py-2 bg-[#1c1c1c] border border-[#2a2a2a] rounded-lg text-sm text-white focus:outline-none focus:border-purple-600/50"
            />
          </div>
        </div>

        {(searchQuery || eventFilter || successFilter || dateFrom || dateTo) && (
          <div className="mt-4 flex items-center justify-between">
            <p className="text-xs text-[#a1a1a1]">
              Showing {filteredLogs.length} of {logs.length} logs
            </p>
            <button
              onClick={() => {
                setSearchQuery('');
                setEventFilter('');
                setSuccessFilter('');
                setDateFrom('');
                setDateTo('');
              }}
              className="text-xs text-purple-400 hover:text-purple-300 transition-colors"
            >
              Clear all filters
            </button>
          </div>
        )}
      </div>

      {/* Logs Table */}
      <div className="bg-[#181818] border border-[#2a2a2a] rounded-2xl overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full">
            <thead className="bg-[#1c1c1c] border-b border-[#2a2a2a]">
              <tr>
                <th className="px-6 py-3 text-left text-xs font-semibold text-[#a1a1a1] uppercase tracking-wider">Timestamp</th>
                <th className="px-6 py-3 text-left text-xs font-semibold text-[#a1a1a1] uppercase tracking-wider">Event</th>
                <th className="px-6 py-3 text-left text-xs font-semibold text-[#a1a1a1] uppercase tracking-wider">User</th>
                <th className="px-6 py-3 text-left text-xs font-semibold text-[#a1a1a1] uppercase tracking-wider">IP Address</th>
                <th className="px-6 py-3 text-left text-xs font-semibold text-[#a1a1a1] uppercase tracking-wider">Status</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-[#2a2a2a]">
              {filteredLogs.map((log) => (
                <tr key={log.id} className="hover:bg-[#1c1c1c] transition-colors">
                  <td className="px-6 py-4 whitespace-nowrap">
                    <p className="text-sm text-white">{format(new Date(log.created_at), 'MMM d, h:mm a')}</p>
                  </td>
                  <td className="px-6 py-4">
                    <div className="flex items-center space-x-2">
                      <div className={getEventColor(log.event_type)}>
                        {getEventIcon(log.event_type)}
                      </div>
                      <span className="text-sm text-white capitalize">
                        {log.event_type.replace('_', ' ')}
                      </span>
                    </div>
                  </td>
                  <td className="px-6 py-4">
                    <p className="text-sm text-white">{log.user_email}</p>
                  </td>
                  <td className="px-6 py-4">
                    <p className="text-sm text-[#a1a1a1]">{log.ip_address}</p>
                  </td>
                  <td className="px-6 py-4">
                    {log.success ? (
                      <span className="px-2 py-1 bg-green-600/10 text-green-400 text-xs rounded-full border border-green-600/20">
                        Success
                      </span>
                    ) : (
                      <span className="px-2 py-1 bg-red-600/10 text-red-400 text-xs rounded-full border border-red-600/20">
                        Failed
                      </span>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>

        {filteredLogs.length === 0 && (
          <div className="p-12 text-center">
            <svg className="w-16 h-16 text-[#3a3a3a] mx-auto mb-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
            </svg>
            <h3 className="text-lg font-semibold text-white mb-2">No Logs Found</h3>
            <p className="text-sm text-[#a1a1a1]">Try adjusting your filters</p>
          </div>
        )}
      </div>
    </div>
  );
}
