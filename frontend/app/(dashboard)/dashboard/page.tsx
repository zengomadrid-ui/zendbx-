'use client';

import Link from 'next/link';
import { useState, useEffect, useCallback, useRef } from 'react';
import { apiFetch } from '@/lib/fetch-utils';
import { MCPCard } from '@/components/dashboard/MCPCard';

interface ProjectStats {
  project: { id: string; name: string; slug?: string; created_at: string };
  database: { table_count: number; total_rows: number; function_count: number; trigger_count: number; size_bytes: number; size_mb: number; recent_activity: number };
  api: { total_requests: number; requests_24h: number; requests_1h: number };
  auth: { total_users: number; new_users_7d: number; active_users_24h: number };
  resources: { storage: { used_mb: number; limit_mb: number; percentage: number }; memory: { used_mb: number; limit_mb: number; percentage: number } };
}

interface QueryHistory {
  id: string; question: string | null; sql_query: string;
  status: 'success' | 'failed' | 'auto_fixed' | 'auto_fix_failed';
  execution_time_ms: number | null; rows_returned: number | null;
  error_message: string | null; created_at: string;
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

/* ── Spatial Progress Bar ── */
function SpatialProgress({ pct, color = 'orange' }: { pct: number; color?: 'orange' | 'blue' | 'green' | 'red' }) {
  const clr = pct > 80 ? 'red' : pct > 60 ? 'orange' : color;
  const gMap: Record<string, string> = {
    orange: 'from-[#FF6B00] to-[#ff9d5c]',
    blue:   'from-blue-500 to-blue-400',
    green:  'from-emerald-500 to-emerald-400',
    red:    'from-red-500 to-red-400',
  };
  const glow: Record<string, string> = {
    orange: '0 0 8px rgba(255,107,0,0.5)',
    blue:   '0 0 8px rgba(59,130,246,0.5)',
    green:  '0 0 8px rgba(34,197,94,0.5)',
    red:    '0 0 8px rgba(239,68,68,0.5)',
  };
  return (
    <div className="h-[3px] w-full rounded-full overflow-hidden" style={{ background: 'rgba(255,255,255,0.06)' }}>
      <div
        className={`h-full rounded-full bg-gradient-to-r ${gMap[clr]} transition-all duration-700 ease-out`}
        style={{ width: `${Math.min(pct, 100)}%`, boxShadow: glow[clr] }}
      />
    </div>
  );
}

/* ── Stat Metric Card ── */
function MetricCard({ value, label, sub, accent, href, icon, delay = 0 }:
  { value: string; label: string; sub?: string; accent?: boolean; href: string; icon: string; delay?: number }) {
  return (
    <Link href={href} className="group block" style={{ animationDelay: `${delay}ms` }}>
      <div className="relative rounded-2xl overflow-hidden transition-all duration-250 ease-spring"
        style={{
          background: 'rgba(17,17,17,0.85)', border: '1px solid rgba(255,255,255,0.06)',
          boxShadow: '0 4px 16px rgba(0,0,0,0.5), 0 1px 0 rgba(255,255,255,0.04) inset',
        }}
        onMouseEnter={e => {
          const el = e.currentTarget;
          el.style.transform = 'translateY(-2px) scale(1.01)';
          el.style.borderColor = 'rgba(255,107,0,0.15)';
          el.style.boxShadow = '0 8px 32px rgba(0,0,0,0.6), 0 0 0 1px rgba(255,107,0,0.1), 0 0 20px rgba(255,107,0,0.05), 0 1px 0 rgba(255,255,255,0.06) inset';
        }}
        onMouseLeave={e => {
          const el = e.currentTarget;
          el.style.transform = '';
          el.style.borderColor = 'rgba(255,255,255,0.06)';
          el.style.boxShadow = '0 4px 16px rgba(0,0,0,0.5), 0 1px 0 rgba(255,255,255,0.04) inset';
        }}
      >
        {/* Top edge highlight */}
        <div className="absolute inset-x-0 top-0 h-px bg-gradient-to-r from-transparent via-white/[0.06] to-transparent" />
        <div className="p-5">
          <div className="flex items-start justify-between mb-3">
            <div className="w-8 h-8 rounded-xl flex items-center justify-center flex-shrink-0"
              style={{ background: accent ? 'rgba(255,107,0,0.12)' : 'rgba(255,255,255,0.05)', border: '1px solid rgba(255,255,255,0.06)' }}>
              <svg className={`w-3.5 h-3.5 ${accent ? 'text-[#FF6B00]' : 'text-[#71717A]'}`} fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.75} d={icon} />
              </svg>
            </div>
            <svg className="w-3 h-3 text-[#3F3F46] group-hover:text-[#FF6B00]/50 transition-colors" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M7 17L17 7M17 7H7M17 7v10" />
            </svg>
          </div>
          <p className={`text-2xl font-bold tracking-tight ${accent ? 'text-[#FF6B00]' : 'text-white'}`} style={{ fontVariantNumeric: 'tabular-nums' }}>
            {value}
          </p>
          <p className="text-xs text-[#71717A] mt-1 font-medium">{label}</p>
          {sub && <p className="text-[10px] text-[#3F3F46] mt-0.5">{sub}</p>}
        </div>
      </div>
    </Link>
  );
}

/* ── Main Dashboard ── */
export default function DashboardPage() {
  const [stats, setStats] = useState<ProjectStats | null>(null);
  const [queries, setQueries] = useState<QueryHistory[]>([]);
  const [projectId, setProjectId] = useState<string | null>(null);
  const [projectName, setProjectName] = useState('');
  const [loading, setLoading] = useState(true);
  const [mounted, setMounted] = useState(false);

  const fetchStats = useCallback(async (pid: string) => {
    try { const r = await apiFetch(`api/projects/${pid}/overview`); if (r.ok) setStats(await r.json()); } catch {}
  }, []);

  const fetchQueries = useCallback(async (pid: string) => {
    try { const r = await apiFetch(`api/projects/${pid}/query/history?limit=8`); if (r.ok) setQueries(await r.json()); } catch {}
  }, []);

  useEffect(() => {
    setMounted(true);
    (async () => {
      try {
        const r = await apiFetch('api/projects');
        if (!r.ok) return;
        const list = await r.json();
        if (!list.length) return;
        const cid = localStorage.getItem('current_project_id');
        const proj = (cid ? list.find((p: { id: string }) => p.id === cid) : null) ?? list[0];
        setProjectId(proj.id);
        setProjectName(proj.name);
        localStorage.setItem('current_project_id', proj.id);
        await Promise.all([fetchStats(proj.id), fetchQueries(proj.id)]);
      } finally { setLoading(false); }
    })();
  }, [fetchStats, fetchQueries]);

  useEffect(() => {
    if (!projectId) return;
    const s = setInterval(() => fetchStats(projectId), 10_000);
    const q = setInterval(() => fetchQueries(projectId), 8_000);
    return () => { clearInterval(s); clearInterval(q); };
  }, [projectId, fetchStats, fetchQueries]);

  if (loading) return (
    <div className="min-h-full flex items-center justify-center">
      <div className="text-center space-y-4">
        <div className="relative w-12 h-12 mx-auto">
          <div className="absolute inset-0 rounded-full animate-ping" style={{ background: 'rgba(255,107,0,0.15)' }} />
          <div className="relative w-12 h-12 rounded-full border-2 border-[#FF6B00]/30 border-t-[#FF6B00] animate-spin" />
        </div>
        <p className="text-sm text-[#52525B] font-medium">Loading project...</p>
      </div>
    </div>
  );

  if (!stats) return (
    <div className="min-h-full flex items-center justify-center">
      <div className="text-center space-y-4">
        <div className="w-14 h-14 mx-auto rounded-2xl flex items-center justify-center"
          style={{ background: 'rgba(255,255,255,0.04)', border: '1px solid rgba(255,255,255,0.08)' }}>
          <svg className="w-6 h-6 text-[#3F3F46]" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M3 7v10a2 2 0 002 2h14a2 2 0 002-2V9a2 2 0 00-2-2h-6l-2-2H5a2 2 0 00-2 2z" />
          </svg>
        </div>
        <div>
          <p className="text-base font-semibold text-white">No projects yet</p>
          <p className="text-sm text-[#71717A] mt-1">Create your first project to get started</p>
        </div>
        <Link href="/dashboard/projects"
          className="inline-flex items-center gap-2 px-5 py-2.5 rounded-xl text-sm font-semibold text-white transition-all"
          style={{ background: 'linear-gradient(135deg, #FF6B00, #e85e00)', boxShadow: '0 4px 16px rgba(255,107,0,0.3)' }}>
          Create Project
        </Link>
      </div>
    </div>
  );

  const { database: db, resources: res, api, auth } = stats;
  const diskPct = Math.round(res.storage.percentage);
  const ramPct  = Math.round(res.memory.percentage);

  return (
    <div className={`min-h-full p-6 space-y-5 transition-opacity duration-500 ${mounted ? 'opacity-100' : 'opacity-0'}`}>
      <div className="max-w-[1400px] mx-auto space-y-5">

        {/* ── PAGE HEADER ── */}
        <div className="flex items-start justify-between pt-1 animate-slide-up" style={{ animationDelay: '0ms' }}>
          <div>
            <div className="flex items-center gap-3 mb-1">
              <h1 className="text-lg font-bold text-white tracking-tight">{projectName}</h1>
              <div className="flex items-center gap-1.5 px-2 py-0.5 rounded-full text-[10px] font-semibold text-emerald-400"
                style={{ background: 'rgba(34,197,94,0.1)', border: '1px solid rgba(34,197,94,0.2)' }}>
                <span className="live-dot" style={{ width: 5, height: 5 }} /> Live
              </div>
            </div>
            <p className="text-xs text-[#71717A]">Project overview · Updates every 10s</p>
          </div>
          <div className="flex items-center gap-2">
            <Link href="/dashboard/sql-editor"
              className="flex items-center gap-2 px-3.5 py-2 rounded-xl text-xs font-semibold text-white transition-all"
              style={{ background: 'linear-gradient(135deg, #FF6B00, #e85e00)', boxShadow: '0 2px 12px rgba(255,107,0,0.3)', border: '1px solid rgba(255,107,0,0.3)' }}>
              <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 9l3 3-3 3m5 0h3M5 20h14a2 2 0 002-2V6a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z" />
              </svg>
              SQL Editor
            </Link>
          </div>
        </div>

        {/* ── TOP STATUS ROW ── */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4 animate-slide-up" style={{ animationDelay: '60ms' }}>

          {/* Status Card */}
          <div className="relative rounded-2xl overflow-hidden"
            style={{ background: 'rgba(17,17,17,0.85)', border: '1px solid rgba(255,255,255,0.06)', boxShadow: '0 8px 32px rgba(0,0,0,0.5), 0 1px 0 rgba(255,255,255,0.04) inset' }}>
            <div className="absolute inset-x-0 top-0 h-px bg-gradient-to-r from-transparent via-emerald-500/20 to-transparent" />
            <div className="p-5 space-y-4">
              <p className="text-[10px] font-semibold text-[#52525B] uppercase tracking-widest">Status & Compute</p>
              <div className="flex items-center gap-3">
                <div className="w-9 h-9 rounded-xl flex items-center justify-center"
                  style={{ background: 'rgba(34,197,94,0.1)', border: '1px solid rgba(34,197,94,0.15)' }}>
                  <svg className="w-4 h-4 text-emerald-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
                  </svg>
                </div>
                <div>
                  <p className="text-sm font-semibold text-emerald-400">Healthy</p>
                  <p className="text-[11px] text-[#52525B] mt-0.5">Free plan · Nano · 0.25 vCPU</p>
                </div>
              </div>
              <div className="space-y-3">
                <div>
                  <div className="flex justify-between text-[11px] text-[#71717A] mb-1.5">
                    <span>Storage</span>
                    <span className="font-mono">{fmtSize(res.storage.used_mb)} / {fmtSize(res.storage.limit_mb)}</span>
                  </div>
                  <SpatialProgress pct={diskPct} color="orange" />
                </div>
                <div>
                  <div className="flex justify-between text-[11px] text-[#71717A] mb-1.5">
                    <span>Memory</span>
                    <span className="font-mono">{res.memory.used_mb.toFixed(0)} / {res.memory.limit_mb} MB</span>
                  </div>
                  <SpatialProgress pct={ramPct} color="blue" />
                </div>
              </div>
            </div>
          </div>

          {/* Database Card */}
          <div className="relative rounded-2xl overflow-hidden"
            style={{ background: 'rgba(17,17,17,0.85)', border: '1px solid rgba(255,255,255,0.06)', boxShadow: '0 8px 32px rgba(0,0,0,0.5), 0 1px 0 rgba(255,255,255,0.04) inset' }}>
            <div className="absolute inset-x-0 top-0 h-px bg-gradient-to-r from-transparent via-blue-500/20 to-transparent" />
            <div className="p-5 space-y-4">
              <p className="text-[10px] font-semibold text-[#52525B] uppercase tracking-widest">Primary Database</p>
              <div className="flex items-center gap-3">
                <div className="w-9 h-9 rounded-xl flex items-center justify-center"
                  style={{ background: 'rgba(59,130,246,0.1)', border: '1px solid rgba(59,130,246,0.15)' }}>
                  <svg className="w-4 h-4 text-blue-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 7v10c0 2.21 3.582 4 8 4s8-1.79 8-4V7M4 7c0 2.21 3.582 4 8 4s8-1.79 8-4M4 7c0-2.21 3.582-4 8-4s8 1.79 8 4" />
                  </svg>
                </div>
                <div>
                  <p className="text-sm font-semibold text-white">Mumbai · South Asia</p>
                  <p className="text-[11px] text-[#52525B] mt-0.5">PostgreSQL 18.4 · public</p>
                </div>
              </div>
              <div className="grid grid-cols-3 gap-2">
                {[
                  { label: 'Tables', value: db.table_count },
                  { label: 'Functions', value: db.function_count },
                  { label: 'Triggers', value: db.trigger_count },
                ].map(({ label, value }) => (
                  <div key={label} className="rounded-xl p-3 text-center"
                    style={{ background: 'rgba(255,255,255,0.03)', border: '1px solid rgba(255,255,255,0.05)' }}>
                    <p className="text-base font-bold text-white" style={{ fontVariantNumeric: 'tabular-nums' }}>{value}</p>
                    <p className="text-[10px] text-[#52525B] mt-0.5">{label}</p>
                  </div>
                ))}
              </div>
            </div>
          </div>

          {/* Resources Card */}
          <div className="relative rounded-2xl overflow-hidden"
            style={{ background: 'rgba(17,17,17,0.85)', border: '1px solid rgba(255,255,255,0.06)', boxShadow: '0 8px 32px rgba(0,0,0,0.5), 0 1px 0 rgba(255,255,255,0.04) inset' }}>
            <div className="absolute inset-x-0 top-0 h-px bg-gradient-to-r from-transparent via-[#FF6B00]/20 to-transparent" />
            <div className="p-5 space-y-4">
              <p className="text-[10px] font-semibold text-[#52525B] uppercase tracking-widest">Resources</p>
              <div className="grid grid-cols-2 gap-2.5">
                {[
                  { label: 'Disk',  value: `${diskPct}%`,                  sub: fmtSize(res.storage.used_mb), color: 'text-[#FF6B00]', glow: 'rgba(255,107,0,0.1)' },
                  { label: 'RAM',   value: `${ramPct}%`,                   sub: `${res.memory.used_mb.toFixed(0)} MB`, color: 'text-blue-400', glow: 'rgba(59,130,246,0.1)' },
                  { label: 'Conns', value: '0%',                           sub: '0 / 1000',   color: 'text-purple-400', glow: 'rgba(168,85,247,0.1)' },
                  { label: 'Cache', value: '99.9%',                        sub: 'buffer hit', color: 'text-emerald-400', glow: 'rgba(34,197,94,0.1)' },
                ].map(({ label, value, sub, color, glow }) => (
                  <div key={label} className="rounded-xl p-3" style={{ background: `${glow}`, border: '1px solid rgba(255,255,255,0.05)' }}>
                    <p className={`text-base font-bold ${color}`} style={{ fontVariantNumeric: 'tabular-nums' }}>{value}</p>
                    <p className="text-[10px] text-[#71717A] mt-0.5">{label}</p>
                    <p className="text-[10px] text-[#3F3F46]">{sub}</p>
                  </div>
                ))}
              </div>
            </div>
          </div>
        </div>

        {/* ── METRICS STRIP ── */}
        <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-3 animate-slide-up" style={{ animationDelay: '120ms' }}>
          {[
            { label: 'Tables',    value: db.table_count.toString(),        sub: `${db.total_rows.toLocaleString()} rows`, href: '/dashboard/database/tables', accent: false, icon: 'M3 10h18M3 14h18m-9-4v8m-7 0h14a2 2 0 002-2V8a2 2 0 00-2-2H5a2 2 0 00-2 2v8a2 2 0 002 2z' },
            { label: 'DB Size',   value: fmtSize(db.size_mb),              sub: `${diskPct}% used`,       href: '/dashboard/database',  accent: false, icon: 'M4 7v10c0 2.21 3.582 4 8 4s8-1.79 8-4V7M4 7c0 2.21 3.582 4 8 4s8-1.79 8-4M4 7c0-2.21 3.582-4 8-4s8 1.79 8 4' },
            { label: 'Cache Hit', value: '99.9%',                          sub: 'query efficiency',       href: '/dashboard/analytics', accent: true,  icon: 'M9 19v-6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2a2 2 0 002-2zm0 0V9a2 2 0 012-2h2a2 2 0 012 2v10m-6 0a2 2 0 002 2h2a2 2 0 002-2m0 0V5a2 2 0 012-2h2a2 2 0 012 2v14a2 2 0 01-2 2h-2a2 2 0 01-2-2z' },
            { label: 'Requests',  value: api.total_requests.toLocaleString(), sub: `${api.requests_24h} today`, href: '/dashboard/analytics', accent: false, icon: 'M13 10V3L4 14h7v7l9-11h-7z' },
            { label: 'Last Backup', value: 'None',                         sub: 'not configured',         href: '/dashboard/backups',   accent: false, icon: 'M8 7H5a2 2 0 00-2 2v9a2 2 0 002 2h14a2 2 0 002-2V9a2 2 0 00-2-2h-3m-1 4l-3 3m0 0l-3-3m3 3V4' },
            { label: 'Users',     value: auth.total_users.toString(),      sub: `${auth.active_users_24h} active`, href: '/dashboard/authentication/users', accent: false, icon: 'M17 20h5v-2a3 3 0 00-5.356-1.857M17 20H7m10 0v-2c0-.656-.126-1.283-.356-1.857M7 20H2v-2a3 3 0 015.356-1.857M7 20v-2c0-.656.126-1.283.356-1.857m0 0a5.002 5.002 0 019.288 0M15 7a3 3 0 11-6 0 3 3 0 016 0z' },
          ].map((card, i) => (
            <MetricCard key={card.label} {...card} delay={i * 30} />
          ))}
        </div>

        {/* ── MCP CARD ── */}
        {projectId && (
          <div className="animate-slide-up" style={{ animationDelay: '160ms' }}>
            <MCPCard projectId={projectId} />
          </div>
        )}

        {/* ── BOTTOM ROW: Queries + Quick Actions ── */}
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-4 animate-slide-up" style={{ animationDelay: '200ms' }}>

          {/* Recent Queries */}
          <div className="lg:col-span-2 rounded-2xl overflow-hidden"
            style={{ background: 'rgba(17,17,17,0.85)', border: '1px solid rgba(255,255,255,0.06)', boxShadow: '0 8px 32px rgba(0,0,0,0.5), 0 1px 0 rgba(255,255,255,0.04) inset' }}>
            <div className="absolute inset-x-0 top-0 h-px bg-gradient-to-r from-transparent via-white/[0.06] to-transparent" />
            <div className="flex items-center justify-between px-5 py-4" style={{ borderBottom: '1px solid rgba(255,255,255,0.05)' }}>
              <div className="flex items-center gap-2.5">
                <div className="w-6 h-6 rounded-lg flex items-center justify-center" style={{ background: 'rgba(255,255,255,0.05)' }}>
                  <svg className="w-3 h-3 text-[#71717A]" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 9l3 3-3 3m5 0h3M5 20h14a2 2 0 002-2V6a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z" />
                  </svg>
                </div>
                <p className="text-sm font-semibold text-white">Recent Queries</p>
                <span className="live-dot" style={{ width: 5, height: 5 }} />
              </div>
              <Link href="/dashboard/history"
                className="text-[11px] font-medium text-[#FF6B00] hover:text-[#ff9d5c] transition-colors flex items-center gap-1">
                View all
                <svg className="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M7 17L17 7M17 7H7M17 7v10" />
                </svg>
              </Link>
            </div>

            {queries.length === 0 ? (
              <div className="flex flex-col items-center justify-center py-16 text-center px-6">
                <div className="w-12 h-12 rounded-2xl flex items-center justify-center mb-4"
                  style={{ background: 'rgba(255,255,255,0.03)', border: '1px solid rgba(255,255,255,0.06)' }}>
                  <svg className="w-5 h-5 text-[#3F3F46]" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M8 9l3 3-3 3m5 0h3M5 20h14a2 2 0 002-2V6a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z" />
                  </svg>
                </div>
                <p className="text-sm font-medium text-[#71717A]">No queries yet</p>
                <p className="text-xs text-[#3F3F46] mt-1">Run your first query in the SQL editor</p>
                <Link href="/dashboard/sql-editor"
                  className="mt-4 text-xs font-medium text-[#FF6B00] hover:text-[#ff9d5c] transition-colors flex items-center gap-1">
                  Open SQL Editor →
                </Link>
              </div>
            ) : (
              <div>
                {queries.map((q, i) => {
                  const ok = q.status === 'success' || q.status === 'auto_fixed';
                  return (
                    <div key={q.id}
                      className="flex items-start gap-3.5 px-5 py-3.5 transition-all duration-150 hover:bg-white/[0.025] cursor-default"
                      style={{ borderBottom: i < queries.length - 1 ? '1px solid rgba(255,255,255,0.04)' : 'none' }}>
                      <span className="mt-1.5 flex-shrink-0 w-1.5 h-1.5 rounded-full"
                        style={{ background: ok ? '#22c55e' : '#ef4444', boxShadow: `0 0 6px ${ok ? 'rgba(34,197,94,0.5)' : 'rgba(239,68,68,0.5)'}` }} />
                      <div className="flex-1 min-w-0">
                        <p className="text-xs text-white truncate font-medium">
                          {q.question || q.sql_query.slice(0, 60)}
                        </p>
                        <p className="text-[11px] text-[#52525B] font-mono truncate mt-0.5">
                          {q.sql_query.slice(0, 70)}{q.sql_query.length > 70 ? '…' : ''}
                        </p>
                      </div>
                      <div className="text-right flex-shrink-0">
                        <p className="text-[11px] text-[#52525B]">{timeAgo(q.created_at)}</p>
                        <p className="text-[10px] text-[#3F3F46] mt-0.5 font-mono">
                          {q.execution_time_ms != null ? `${q.execution_time_ms}ms` : '—'}
                          {q.rows_returned != null ? ` · ${q.rows_returned}r` : ''}
                        </p>
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </div>

          {/* Quick Actions */}
          <div className="space-y-3">
            <p className="text-xs font-semibold text-[#52525B] uppercase tracking-widest px-1">Quick Actions</p>
            <div className="space-y-2">
              {[
                { title: 'SQL Editor',    desc: 'Write & run queries',   href: '/dashboard/sql-editor',   primary: true,  icon: 'M8 9l3 3-3 3m5 0h3M5 20h14a2 2 0 002-2V6a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z' },
                { title: 'AI Builder',    desc: 'Generate with AI',      href: '/dashboard/ai-builder',   primary: false, icon: 'M9.663 17h4.673M12 3v1m6.364 1.636l-.707.707M21 12h-1M4 12H3m3.343-5.657l-.707-.707m2.828 9.9a5 5 0 117.072 0l-.548.547A3.374 3.374 0 0014 18.469V19a2 2 0 11-4 0v-.531c0-.895-.356-1.754-.988-2.386l-.548-.547z' },
                { title: 'Browse Tables', desc: 'View & edit data',      href: '/dashboard/database/tables', primary: false, icon: 'M3 10h18M3 14h18m-9-4v8m-7 0h14a2 2 0 002-2V8a2 2 0 00-2-2H5a2 2 0 00-2 2v8a2 2 0 002 2z' },
                { title: 'Import Data',   desc: 'Upload CSV files',      href: '/dashboard/import',       primary: false, icon: 'M7 16a4 4 0 01-.88-7.903A5 5 0 1115.9 6L16 6a5 5 0 011 9.9M15 13l-3-3m0 0l-3 3m3-3v12' },
                { title: 'API Keys',      desc: 'Manage project keys',   href: '/dashboard/api-keys',     primary: false, icon: 'M15 7a2 2 0 012 2m4 0a6 6 0 01-7.743 5.743L11 17H9v2H7v2H4a1 1 0 01-1-1v-2.586a1 1 0 01.293-.707l5.964-5.964A6 6 0 1121 9z' },
              ].map((a) => (
                <Link key={a.title} href={a.href}
                  className="flex items-center gap-3 p-3.5 rounded-xl transition-all duration-200 group"
                  style={a.primary ? {
                    background: 'linear-gradient(135deg, rgba(255,107,0,0.15), rgba(255,107,0,0.08))',
                    border: '1px solid rgba(255,107,0,0.2)',
                    boxShadow: '0 4px 16px rgba(255,107,0,0.1)',
                  } : {
                    background: 'rgba(255,255,255,0.03)',
                    border: '1px solid rgba(255,255,255,0.06)',
                  }}
                  onMouseEnter={e => {
                    if (!a.primary) {
                      e.currentTarget.style.background = 'rgba(255,255,255,0.055)';
                      e.currentTarget.style.borderColor = 'rgba(255,255,255,0.1)';
                      e.currentTarget.style.transform = 'translateY(-1px)';
                    } else {
                      e.currentTarget.style.transform = 'translateY(-1px)';
                      e.currentTarget.style.boxShadow = '0 8px 24px rgba(255,107,0,0.2)';
                    }
                  }}
                  onMouseLeave={e => {
                    e.currentTarget.style.transform = '';
                    if (a.primary) {
                      e.currentTarget.style.boxShadow = '0 4px 16px rgba(255,107,0,0.1)';
                      e.currentTarget.style.background = 'linear-gradient(135deg, rgba(255,107,0,0.15), rgba(255,107,0,0.08))';
                    } else {
                      e.currentTarget.style.background = 'rgba(255,255,255,0.03)';
                      e.currentTarget.style.borderColor = 'rgba(255,255,255,0.06)';
                    }
                  }}>
                  <div className="w-8 h-8 rounded-xl flex items-center justify-center flex-shrink-0 transition-all duration-200"
                    style={a.primary ? { background: 'rgba(255,107,0,0.2)', border: '1px solid rgba(255,107,0,0.2)' } : { background: 'rgba(255,255,255,0.05)', border: '1px solid rgba(255,255,255,0.06)' }}>
                    <svg className={`w-3.5 h-3.5 ${a.primary ? 'text-[#FF6B00]' : 'text-[#71717A] group-hover:text-[#A1A1AA]'} transition-colors`}
                      fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.75} d={a.icon} />
                    </svg>
                  </div>
                  <div>
                    <p className={`text-xs font-semibold ${a.primary ? 'text-[#FF6B00]' : 'text-white'}`}>{a.title}</p>
                    <p className="text-[10px] text-[#71717A] mt-0.5">{a.desc}</p>
                  </div>
                  <svg className="w-3 h-3 text-[#3F3F46] group-hover:text-[#71717A] ml-auto transition-colors" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
                  </svg>
                </Link>
              ))}
            </div>
          </div>
        </div>

        {/* ── MODULE GRID (Futuristic Ops Center) ── */}
        <div className="grid grid-cols-2 md:grid-cols-4 gap-3 animate-slide-up" style={{ animationDelay: '260ms' }}>
          {[
            { label: 'Database',       href: '/dashboard/database',        icon: 'M4 7v10c0 2.21 3.582 4 8 4s8-1.79 8-4V7M4 7c0 2.21 3.582 4 8 4s8-1.79 8-4M4 7c0-2.21 3.582-4 8-4s8 1.79 8 4', color: 'text-blue-400',    glow: 'rgba(59,130,246,0.08)' },
            { label: 'Storage',        href: '/dashboard/storage',          icon: 'M5 8h14M5 8a2 2 0 110-4h14a2 2 0 110 4M5 8v10a2 2 0 002 2h10a2 2 0 002-2V8m-9 4h4', color: 'text-purple-400', glow: 'rgba(168,85,247,0.08)' },
            { label: 'Authentication', href: '/dashboard/authentication',   icon: 'M12 15v2m-6 4h12a2 2 0 002-2v-6a2 2 0 00-2-2H6a2 2 0 00-2 2v6a2 2 0 002 2zm10-10V7a4 4 0 00-8 0v4h8z', color: 'text-emerald-400', glow: 'rgba(34,197,94,0.08)' },
            { label: 'Realtime',       href: '/dashboard/realtime',         icon: 'M13 10V3L4 14h7v7l9-11h-7z', color: 'text-yellow-400', glow: 'rgba(234,179,8,0.08)' },
            { label: 'Analytics',      href: '/dashboard/analytics',        icon: 'M9 19v-6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2a2 2 0 002-2zm0 0V9a2 2 0 012-2h2a2 2 0 012 2v10m-6 0a2 2 0 002 2h2a2 2 0 002-2m0 0V5a2 2 0 012-2h2a2 2 0 012 2v14a2 2 0 01-2 2h-2a2 2 0 01-2-2z', color: 'text-[#FF6B00]', glow: 'rgba(255,107,0,0.08)' },
            { label: 'Edge Functions', href: '/dashboard/api-playground',   icon: 'M14.752 11.168l-3.197-2.132A1 1 0 0010 9.87v4.263a1 1 0 001.555.832l3.197-2.132a1 1 0 000-1.664zM21 12a9 9 0 11-18 0 9 9 0 0118 0z', color: 'text-cyan-400', glow: 'rgba(34,211,238,0.08)' },
            { label: 'Backups',        href: '/dashboard/backups',          icon: 'M8 7H5a2 2 0 00-2 2v9a2 2 0 002 2h14a2 2 0 002-2V9a2 2 0 00-2-2h-3m-1 4l-3 3m0 0l-3-3m3 3V4', color: 'text-green-400', glow: 'rgba(34,197,94,0.08)' },
            { label: 'Team',           href: '/dashboard/team',             icon: 'M17 20h5v-2a3 3 0 00-5.356-1.857M17 20H7m10 0v-2c0-.656-.126-1.283-.356-1.857M7 20H2v-2a3 3 0 015.356-1.857M7 20v-2c0-.656.126-1.283.356-1.857m0 0a5.002 5.002 0 019.288 0M15 7a3 3 0 11-6 0 3 3 0 016 0z', color: 'text-pink-400', glow: 'rgba(236,72,153,0.08)' },
          ].map((mod, i) => (
            <Link key={mod.label} href={mod.href}
              className="group relative rounded-2xl p-4 overflow-hidden transition-all duration-250"
              style={{ background: `${mod.glow}`, border: '1px solid rgba(255,255,255,0.05)', boxShadow: '0 4px 16px rgba(0,0,0,0.3)', animationDelay: `${i * 25}ms` }}
              onMouseEnter={e => {
                e.currentTarget.style.transform = 'translateY(-2px) scale(1.02)';
                e.currentTarget.style.borderColor = 'rgba(255,255,255,0.09)';
                e.currentTarget.style.boxShadow = '0 8px 32px rgba(0,0,0,0.5)';
              }}
              onMouseLeave={e => {
                e.currentTarget.style.transform = '';
                e.currentTarget.style.borderColor = 'rgba(255,255,255,0.05)';
                e.currentTarget.style.boxShadow = '0 4px 16px rgba(0,0,0,0.3)';
              }}>
              <div className="absolute inset-x-0 top-0 h-px bg-gradient-to-r from-transparent via-white/[0.06] to-transparent" />
              <svg className={`w-4 h-4 ${mod.color} mb-3`} fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.75} d={mod.icon} />
              </svg>
              <p className="text-xs font-semibold text-white">{mod.label}</p>
              <div className="flex items-center gap-1 mt-1">
                <div className="w-1 h-1 rounded-full bg-emerald-500/60" />
                <p className="text-[10px] text-[#52525B]">Active</p>
              </div>
              <svg className="absolute top-3 right-3 w-3 h-3 text-[#2a2a2a] group-hover:text-[#52525B] transition-colors" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M7 17L17 7M17 7H7M17 7v10" />
              </svg>
            </Link>
          ))}
        </div>
      </div>
    </div>
  );
}
