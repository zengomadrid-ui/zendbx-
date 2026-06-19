'use client';

import Link from 'next/link';
import { useState, useEffect, useCallback } from 'react';
import { apiFetch } from '@/lib/fetch-utils';

interface Project {
  id: string;
  name: string;
  slug?: string;
  database_name: string;
  region: string;
  status: string;
  created_at: string;
}

interface ProjectStats {
  project: { id: string; name: string; slug?: string; created_at: string };
  database: {
    table_count: number; total_rows: number; function_count: number;
    trigger_count: number; size_bytes: number; size_mb: number; recent_activity: number;
  };
  api: { total_requests: number; requests_24h: number; requests_1h: number };
  auth: { total_users: number; new_users_7d: number; active_users_24h: number };
  resources: {
    storage: { used_mb: number; limit_mb: number; percentage: number };
    memory:  { used_mb: number; limit_mb: number; percentage: number };
  };
}

interface QueryHistory {
  id: string;
  question: string | null;
  sql_query: string;
  status: 'success' | 'failed' | 'auto_fixed' | 'auto_fix_failed';
  execution_time_ms: number | null;
  rows_returned: number | null;
  error_message: string | null;
  created_at: string;
}

function timeAgo(iso: string) {
  const diff = Math.floor((Date.now() - new Date(iso).getTime()) / 1000);
  if (diff < 60) return `${diff}s ago`;
  if (diff < 3600) return `${Math.floor(diff / 60)}m ago`;
  if (diff < 86400) return `${Math.floor(diff / 3600)}h ago`;
  return `${Math.floor(diff / 86400)}d ago`;
}

function fmtSize(mb: number) {
  return mb >= 1024 ? `${(mb / 1024).toFixed(1)} GB` : `${mb.toFixed(1)} MB`;
}

function ProgressBar({ pct, color = 'bg-orange-500' }: { pct: number; color?: string }) {
  const bar = pct > 80 ? 'bg-red-500' : pct > 60 ? 'bg-yellow-500' : color;
  return (
    <div className="h-1.5 w-full bg-[#2a2a2a] rounded-full overflow-hidden">
      <div className={`h-full rounded-full transition-all duration-500 ${bar}`} style={{ width: `${Math.min(pct, 100)}%` }} />
    </div>
  );
}

export default function DashboardPage() {
  const [stats, setStats]             = useState<ProjectStats | null>(null);
  const [queries, setQueries]         = useState<QueryHistory[]>([]);
  const [projects, setProjects]       = useState<Project[]>([]);
  const [projectId, setProjectId]     = useState<string | null>(null);
  const [projectName, setProjectName] = useState('');
  const [loading, setLoading]         = useState(true);
  const [showProjectSelector, setShowProjectSelector] = useState(false);

  const fetchProjects = useCallback(async () => {
    try {
      const r = await apiFetch('api/projects');
      if (r.ok) {
        const data = await r.json();
        setProjects(data);
        return data;
      }
      return [];
    } catch {
      return [];
    }
  }, []);

  const switchProject = useCallback(async (pid: string) => {
    setLoading(true);
    const project = projects.find((p: { id: string; name: string }) => p.id === pid);
    if (project) {
      setProjectId(pid);
      setProjectName(project.name);
      localStorage.setItem('current_project_id', pid);
      await Promise.all([fetchStats(pid), fetchQueries(pid)]);
    }
    setLoading(false);
    setShowProjectSelector(false);
  }, [projects]);

  const fetchStats = useCallback(async (pid: string) => {
    try {
      const r = await apiFetch(`api/projects/${pid}/overview`);
      if (r.ok) setStats(await r.json());
    } catch { /* silent */ }
  }, []);

  const fetchQueries = useCallback(async (pid: string) => {
    try {
      const r = await apiFetch(`api/projects/${pid}/query/history?limit=8`);
      if (r.ok) setQueries(await r.json());
    } catch { /* silent */ }
  }, []);

  useEffect(() => {
    (async () => {
      try {
        const projectsList = await fetchProjects();
        if (!projectsList.length) return;
        
        // Try to use previously selected project or fall back to first project
        const currentProjectId = localStorage.getItem('current_project_id');
        const selectedProject = currentProjectId 
          ? projectsList.find((p: { id: string }) => p.id === currentProjectId) || projectsList[0]
          : projectsList[0];
          
        setProjectId(selectedProject.id);
        setProjectName(selectedProject.name);
        localStorage.setItem('current_project_id', selectedProject.id);
        await Promise.all([fetchStats(selectedProject.id), fetchQueries(selectedProject.id)]);
      } finally {
        setLoading(false);
      }
    })();
  }, [fetchProjects, fetchStats, fetchQueries]);

  useEffect(() => {
    if (!projectId) return;
    const s = setInterval(() => fetchStats(projectId), 10_000);
    const q = setInterval(() => fetchQueries(projectId), 8_000);
    return () => { clearInterval(s); clearInterval(q); };
  }, [projectId, fetchStats, fetchQueries]);

  if (loading) return (
    <div className="min-h-full bg-[#1c1c1c] flex items-center justify-center">
      <div className="text-center">
        <div className="w-8 h-8 border-2 border-orange-500 border-t-transparent rounded-full animate-spin mx-auto mb-3" />
        <p className="text-sm text-gray-400">Loading project...</p>
      </div>
    </div>
  );

  if (!stats) return (
    <div className="min-h-full bg-[#1c1c1c] flex items-center justify-center">
      <div className="text-center space-y-3">
        <svg className="w-12 h-12 mx-auto text-[#3a3a3a]" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M3 7v10a2 2 0 002 2h14a2 2 0 002-2V9a2 2 0 00-2-2h-6l-2-2H5a2 2 0 00-2 2z" />
        </svg>
        <p className="text-base font-medium text-white">No projects yet</p>
        <p className="text-sm text-gray-400">Create your first project to get started</p>
        <Link href="/dashboard/projects" className="inline-block px-4 py-2 bg-orange-600 hover:bg-orange-500 text-white text-sm font-medium rounded-lg transition-colors">
          Create Project
        </Link>
      </div>
    </div>
  );

  const { database: db, resources: res, api, auth } = stats;
  const diskPct = Math.round(res.storage.percentage);
  const ramPct  = Math.round(res.memory.percentage);

  return (
    <div className="min-h-full bg-[#1c1c1c] p-6 space-y-6">
      <div className="max-w-[1400px] mx-auto space-y-6">

        {/* Header */}
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-xl font-semibold text-white">{projectName}</h1>
            <p className="text-sm text-gray-400 mt-0.5">Project overview</p>
          </div>
          <div className="flex items-center gap-2 text-sm text-emerald-400 font-medium">
            <span className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse" />
            Live
          </div>
        </div>

        {/* Top 3 info cards */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">

          {/* Status */}
          <div className="bg-[#181818] border border-[#2a2a2a] rounded-lg p-5 space-y-4">
            <p className="text-xs font-medium text-gray-500 uppercase tracking-wide">Status & Compute</p>
            <div className="flex items-center gap-3">
              <div className="w-9 h-9 rounded-lg bg-emerald-500/10 flex items-center justify-center flex-shrink-0">
                <svg className="w-5 h-5 text-emerald-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
                </svg>
              </div>
              <div>
                <p className="text-sm font-semibold text-emerald-400">Healthy</p>
                <p className="text-xs text-gray-500 mt-0.5">Free plan · Nano · 0.25 vCPU</p>
              </div>
            </div>
            <div className="space-y-3">
              <div>
                <div className="flex justify-between text-xs text-gray-400 mb-1.5">
                  <span>Storage</span>
                  <span>{fmtSize(res.storage.used_mb)} / {fmtSize(res.storage.limit_mb)}</span>
                </div>
                <ProgressBar pct={diskPct} />
              </div>
              <div>
                <div className="flex justify-between text-xs text-gray-400 mb-1.5">
                  <span>Memory</span>
                  <span>{res.memory.used_mb.toFixed(0)} / {res.memory.limit_mb} MB</span>
                </div>
                <ProgressBar pct={ramPct} color="bg-blue-500" />
              </div>
            </div>
          </div>

          {/* Primary Database */}
          <div className="bg-[#181818] border border-[#2a2a2a] rounded-lg p-5 space-y-4">
            <p className="text-xs font-medium text-gray-500 uppercase tracking-wide">Primary Database</p>
            <div className="flex items-center gap-3">
              <div className="w-9 h-9 rounded-lg bg-blue-500/10 flex items-center justify-center flex-shrink-0">
                <svg className="w-5 h-5 text-blue-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 7v10c0 2.21 3.582 4 8 4s8-1.79 8-4V7M4 7c0 2.21 3.582 4 8 4s8-1.79 8-4M4 7c0-2.21 3.582-4 8-4s8 1.79 8 4" />
                </svg>
              </div>
              <div>
                <p className="text-sm font-semibold text-white">South Asia · Mumbai</p>
                <p className="text-xs text-gray-500 mt-0.5">PostgreSQL 18.4 · public</p>
              </div>
            </div>
            <div className="grid grid-cols-3 gap-2">
              {[
                { label: 'Tables',    value: db.table_count },
                { label: 'Functions', value: db.function_count },
                { label: 'Triggers',  value: db.trigger_count },
              ].map(({ label, value }) => (
                <div key={label} className="bg-[#111] rounded-md p-3 text-center">
                  <p className="text-base font-bold text-white">{value}</p>
                  <p className="text-xs text-gray-500 mt-0.5">{label}</p>
                </div>
              ))}
            </div>
          </div>

          {/* Resources */}
          <div className="bg-[#181818] border border-[#2a2a2a] rounded-lg p-5 space-y-4">
            <p className="text-xs font-medium text-gray-500 uppercase tracking-wide">Resources</p>
            <div className="grid grid-cols-2 gap-3">
              {[
                { label: 'Disk',   value: `${diskPct}%`,  sub: `${fmtSize(res.storage.used_mb)}`, color: 'text-orange-400' },
                { label: 'RAM',    value: `${ramPct}%`,   sub: `${res.memory.used_mb.toFixed(0)} MB`, color: 'text-blue-400' },
                { label: 'Conns',  value: '0%',           sub: '0 / 1000',   color: 'text-purple-400' },
                { label: 'Cache',  value: '99.9%',        sub: 'buffer hit', color: 'text-emerald-400' },
              ].map(({ label, value, sub, color }) => (
                <div key={label} className="bg-[#111] rounded-md p-3">
                  <p className={`text-base font-bold ${color}`}>{value}</p>
                  <p className="text-xs text-gray-400 mt-0.5">{label}</p>
                  <p className="text-xs text-gray-600">{sub}</p>
                </div>
              ))}
            </div>
          </div>
        </div>

        {/* Stat strip */}
        <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-3">
          {[
            { label: 'Tables',        value: db.table_count.toString(),          sub: `${db.total_rows.toLocaleString()} rows`,  href: '/dashboard/database/tables',       accent: false },
            { label: 'DB Size',       value: fmtSize(db.size_mb),               sub: `${diskPct}% used`,                        href: '/dashboard/database',              accent: false },
            { label: 'Cache Hit',     value: '99.9%',                           sub: 'query efficiency',                        href: '/dashboard/analytics',             accent: true  },
            { label: 'Requests / mo', value: api.total_requests.toLocaleString(), sub: `${api.requests_24h} today`,             href: '/dashboard/analytics',             accent: false },
            { label: 'Last Backup',   value: 'None',                            sub: 'not configured',                          href: '/dashboard/backups',               accent: false },
            { label: 'Users',         value: auth.total_users.toString(),        sub: `${auth.active_users_24h} active today`,  href: '/dashboard/authentication/users',  accent: false },
          ].map((card) => (
            <Link
              key={card.label}
              href={card.href}
              className="bg-[#181818] border border-[#2a2a2a] rounded-lg p-4 hover:border-[#3a3a3a] transition-colors group"
            >
              <p className={`text-xl font-bold ${card.accent ? 'text-emerald-400' : 'text-white'}`}>{card.value}</p>
              <p className="text-sm text-gray-400 mt-1">{card.label}</p>
              <p className="text-xs text-gray-600 mt-0.5">{card.sub}</p>
            </Link>
          ))}
        </div>

        {/* Bottom: recent queries + quick actions */}
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">

          {/* Recent queries — 2/3 width */}
          <div className="lg:col-span-2 bg-[#181818] border border-[#2a2a2a] rounded-lg overflow-hidden">
            <div className="flex items-center justify-between px-5 py-4 border-b border-[#2a2a2a]">
              <div className="flex items-center gap-2">
                <p className="text-sm font-semibold text-white">Recent queries</p>
                <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 animate-pulse" />
              </div>
              <Link href="/dashboard/history" className="text-xs text-orange-500 hover:text-orange-400 transition-colors font-medium">
                View all →
              </Link>
            </div>

            {queries.length === 0 ? (
              <div className="flex flex-col items-center justify-center py-14 text-center px-6">
                <svg className="w-10 h-10 text-[#333] mb-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M8 9l3 3-3 3m5 0h3M5 20h14a2 2 0 002-2V6a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z" />
                </svg>
                <p className="text-sm text-gray-400">No queries yet</p>
                <p className="text-xs text-gray-600 mt-1">Run your first query in the SQL editor</p>
                <Link href="/dashboard/sql-editor" className="mt-4 text-sm text-orange-500 hover:text-orange-400 transition-colors font-medium">
                  Open SQL editor →
                </Link>
              </div>
            ) : (
              <div className="divide-y divide-[#222]">
                {queries.map((q) => {
                  const ok = q.status === 'success' || q.status === 'auto_fixed';
                  return (
                    <div key={q.id} className="flex items-start gap-3 px-5 py-3.5 hover:bg-[#1e1e1e] transition-colors">
                      <span className={`w-2 h-2 rounded-full mt-1.5 flex-shrink-0 ${ok ? 'bg-emerald-500' : 'bg-red-500'}`} />
                      <div className="flex-1 min-w-0">
                        <p className="text-sm text-white truncate">
                          {q.question || q.sql_query.slice(0, 60)}
                        </p>
                        <p className="text-xs text-gray-500 truncate mt-0.5">
                          {q.sql_query.slice(0, 80)}{q.sql_query.length > 80 ? '…' : ''}
                        </p>
                      </div>
                      <div className="text-right flex-shrink-0">
                        <p className="text-xs text-gray-500">{timeAgo(q.created_at)}</p>
                        <p className="text-xs text-gray-600 mt-0.5">
                          {q.execution_time_ms != null ? `${q.execution_time_ms}ms` : '—'}
                          {q.rows_returned != null ? ` · ${q.rows_returned} rows` : ''}
                        </p>
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </div>

          {/* Quick actions — 1/3 width */}
          <div className="space-y-3">
            <p className="text-sm font-semibold text-white">Quick actions</p>
            {[
              {
                title: 'SQL Editor', desc: 'Write and run queries', href: '/dashboard/sql-editor', primary: true,
                icon: <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 9l3 3-3 3m5 0h3M5 20h14a2 2 0 002-2V6a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z" /></svg>,
              },
              {
                title: 'Import Data', desc: 'Upload CSV files', href: '/dashboard/import',
                icon: <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M7 16a4 4 0 01-.88-7.903A5 5 0 1115.9 6L16 6a5 5 0 011 9.9M15 13l-3-3m0 0l-3 3m3-3v12" /></svg>,
              },
              {
                title: 'Browse Tables', desc: 'View and edit data', href: '/dashboard/database/tables',
                icon: <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 10h18M3 14h18m-9-4v8m-7 0h14a2 2 0 002-2V8a2 2 0 00-2-2H5a2 2 0 00-2 2v8a2 2 0 002 2z" /></svg>,
              },
              {
                title: 'API Keys', desc: 'Manage project keys', href: '/dashboard/api-keys',
                icon: <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 7a2 2 0 012 2m4 0a6 6 0 01-7.743 5.743L11 17H9v2H7v2H4a1 1 0 01-1-1v-2.586a1 1 0 01.293-.707l5.964-5.964A6 6 0 1121 9z" /></svg>,
              },
            ].map((a) => (
              <Link
                key={a.title}
                href={a.href}
                className={`flex items-center gap-3 p-3.5 rounded-lg border transition-colors group ${
                  a.primary
                    ? 'bg-orange-600 border-orange-600 hover:bg-orange-500 hover:border-orange-500'
                    : 'bg-[#181818] border-[#2a2a2a] hover:border-[#3a3a3a]'
                }`}
              >
                <div className={`w-8 h-8 rounded-lg flex items-center justify-center flex-shrink-0 ${
                  a.primary ? 'bg-white/15 text-white' : 'bg-[#222] text-orange-500 group-hover:bg-[#2a2a2a]'
                } transition-colors`}>
                  {a.icon}
                </div>
                <div>
                  <p className={`text-sm font-medium ${a.primary ? 'text-white' : 'text-white'}`}>{a.title}</p>
                  <p className={`text-xs mt-0.5 ${a.primary ? 'text-orange-100' : 'text-gray-500'}`}>{a.desc}</p>
                </div>
              </Link>
            ))}
          </div>

        </div>
      </div>
    </div>
  );
}
