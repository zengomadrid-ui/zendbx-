'use client';

import { useState, useEffect, useCallback } from 'react';
import Link from 'next/link';
import { usePathname, useRouter } from 'next/navigation';
import { apiFetch } from '@/lib/fetch-utils';
import LoadingSpinner from '@/components/ui/LoadingSpinner';
import SpatialBackground from '@/components/ui/spatial/SpatialBackground';

interface User {
  id: string; email: string; full_name: string; avatar_url?: string; plan: string; role?: string;
}

interface Notification {
  id: string;
  event_type: string;
  success: boolean;
  created_at: string;
  event_data?: Record<string, unknown>;
  user_email?: string;
}

/** SVG icon component for notifications — no emojis */
function NotifIcon({ type, success }: { type: string; success: boolean }) {
  const cls = `w-4 h-4 flex-shrink-0 mt-0.5 ${success ? 'text-[#A1A1AA]' : 'text-red-400'}`;
  switch (type) {
    case 'login':
    case 'logout':
      return (
        <svg className={cls} fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.75} d="M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z" />
        </svg>
      );
    case 'signup':
      return (
        <svg className={cls} fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.75} d="M18 9v3m0 0v3m0-3h3m-3 0h-3m-2-5a4 4 0 11-8 0 4 4 0 018 0zM3 20a6 6 0 0112 0v1H3v-1z" />
        </svg>
      );
    case 'password_reset':
    case 'api_key_created':
      return (
        <svg className={cls} fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.75} d="M15 7a2 2 0 012 2m4 0a6 6 0 01-7.743 5.743L11 17H9v2H7v2H4a1 1 0 01-1-1v-2.586a1 1 0 01.293-.707l5.964-5.964A6 6 0 1121 9z" />
        </svg>
      );
    case 'project_created':
      return (
        <svg className={cls} fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.75} d="M3 7v10a2 2 0 002 2h14a2 2 0 002-2V9a2 2 0 00-2-2h-6l-2-2H5a2 2 0 00-2 2z" />
        </svg>
      );
    case 'project_deleted':
    case 'user_deleted':
      return (
        <svg className={cls} fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.75} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
        </svg>
      );
    case 'backup_created':
      return (
        <svg className={cls} fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.75} d="M8 7H5a2 2 0 00-2 2v9a2 2 0 002 2h14a2 2 0 002-2V9a2 2 0 00-2-2h-3m-1 4l-3 3m0 0l-3-3m3 3V4" />
        </svg>
      );
    case 'storage_upload':
      return (
        <svg className={cls} fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.75} d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-8l-4-4m0 0L8 8m4-4v12" />
        </svg>
      );
    case 'user_suspended':
    case 'role_changed':
      return (
        <svg className={cls} fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.75} d="M9 12l2 2 4-4m5.618-4.016A11.955 11.955 0 0112 2.944a11.955 11.955 0 01-8.618 3.04A12.02 12.02 0 003 9c0 5.591 3.824 10.29 9 11.622 5.176-1.332 9-6.03 9-11.622 0-1.042-.133-2.052-.382-3.016z" />
        </svg>
      );
    default:
      return success ? (
        <svg className={cls} fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.75} d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
        </svg>
      ) : (
        <svg className={cls} fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.75} d="M12 8v4m0 4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
        </svg>
      );
  }
}

/** Map an audit event_type to a readable title and description */
function notifMeta(n: Notification): { title: string; desc: string } {
  const data = n.event_data ?? {};
  switch (n.event_type) {
    case 'login':
      return { title: n.success ? 'Login successful' : 'Failed login attempt', desc: n.user_email ?? '' };
    case 'logout':
      return { title: 'Signed out', desc: n.user_email ?? '' };
    case 'signup':
      return { title: 'Account created', desc: n.user_email ?? '' };
    case 'password_reset':
      return { title: 'Password reset', desc: 'Password was changed successfully' };
    case 'project_created':
      return { title: 'New project created', desc: String((data as Record<string,unknown>).project_name ?? '') };
    case 'project_deleted':
      return { title: 'Project deleted', desc: String((data as Record<string,unknown>).project_name ?? '') };
    case 'api_key_created':
      return { title: 'API key generated', desc: String((data as Record<string,unknown>).key_name ?? 'New key created') };
    case 'user_suspended':
      return { title: 'User suspended', desc: String((data as Record<string,unknown>).suspended_user_email ?? '') };
    case 'user_deleted':
      return { title: 'User deleted', desc: String((data as Record<string,unknown>).deleted_user_email ?? '') };
    case 'role_changed':
      return { title: 'Role changed', desc: `New role: ${String((data as Record<string,unknown>).new_role ?? '')}` };
    case 'backup_created':
      return { title: 'Backup completed', desc: 'Database backup created successfully' };
    case 'storage_upload':
      return { title: 'File uploaded', desc: String((data as Record<string,unknown>).file_name ?? '') };
    default:
      return { title: n.event_type.replace(/_/g, ' '), desc: n.user_email ?? '' };
  }
}

function timeAgo(dateStr: string): string {
  const diff = Math.floor((Date.now() - new Date(dateStr).getTime()) / 1000);
  if (diff < 60) return `${diff}s ago`;
  if (diff < 3600) return `${Math.floor(diff / 60)}m ago`;
  if (diff < 86400) return `${Math.floor(diff / 3600)}h ago`;
  return `${Math.floor(diff / 86400)}d ago`;
}

const NAV_PRIMARY = [
  { name: 'Overview',      href: '/dashboard',             icon: 'M9 19v-6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2a2 2 0 002-2zm0 0V9a2 2 0 012-2h2a2 2 0 012 2v10m-6 0a2 2 0 002 2h2a2 2 0 002-2m0 0V5a2 2 0 012-2h2a2 2 0 012 2v14a2 2 0 01-2 2h-2a2 2 0 01-2-2z' },
  { name: 'AI Builder',    href: '/dashboard/ai-builder',  icon: 'M9.663 17h4.673M12 3v1m6.364 1.636l-.707.707M21 12h-1M4 12H3m3.343-5.657l-.707-.707m2.828 9.9a5 5 0 117.072 0l-.548.547A3.374 3.374 0 0014 18.469V19a2 2 0 11-4 0v-.531c0-.895-.356-1.754-.988-2.386l-.548-.547z', badge: 'AI' },
  { name: 'MCP',           href: '/dashboard/mcp',         icon: 'M13 10V3L4 14h7v7l9-11h-7z', badge: 'NEW' },
  { name: 'Table Editor',  href: '/dashboard/tables',      icon: 'M3 10h18M3 14h18m-9-4v8m-7 0h14a2 2 0 002-2V8a2 2 0 00-2-2H5a2 2 0 00-2 2v8a2 2 0 002 2z' },
  { name: 'SQL Editor',    href: '/dashboard/sql-editor',  icon: 'M8 9l3 3-3 3m5 0h3M5 20h14a2 2 0 002-2V6a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z' },
  { name: 'Realtime',      href: '/dashboard/realtime',    icon: 'M13 10V3L4 14h7v7l9-11h-7z' },
];

const NAV_WORKSPACE = [
  { name: 'Projects',      href: '/dashboard/projects',       icon: 'M3 7v10a2 2 0 002 2h14a2 2 0 002-2V9a2 2 0 00-2-2h-6l-2-2H5a2 2 0 00-2 2z',
    children: [{ name: 'All Projects', href: '/dashboard/projects' }] },
  { name: 'Authentication', href: '/dashboard/authentication', icon: 'M12 15v2m-6 4h12a2 2 0 002-2v-6a2 2 0 00-2-2H6a2 2 0 00-2 2v6a2 2 0 002 2zm10-10V7a4 4 0 00-8 0v4h8z',
    children: [
      { name: 'Users',     href: '/dashboard/authentication/users' },
      { name: 'Providers', href: '/dashboard/authentication/providers' },
      { name: 'Sessions',  href: '/dashboard/authentication/sessions' },
      { name: 'Security',  href: '/dashboard/authentication/security' },
      { name: 'Settings',  href: '/dashboard/authentication/settings' },
    ]},
  { name: 'Database',      href: '/dashboard/database',       icon: 'M4 7v10c0 2.21 3.582 4 8 4s8-1.79 8-4V7M4 7c0 2.21 3.582 4 8 4s8-1.79 8-4M4 7c0-2.21 3.582-4 8-4s8 1.79 8 4',
    children: [
      { name: 'Tables',          href: '/dashboard/database/tables' },
      { name: 'Schema',          href: '/dashboard/database/schema' },
      { name: 'Functions',       href: '/dashboard/database/functions' },
      { name: 'Triggers',        href: '/dashboard/database/triggers' },
      { name: 'Row Level Security', href: '/dashboard/database/rls' },
      { name: 'Import Data',     href: '/dashboard/import' },
    ]},
  { name: 'Storage',       href: '/dashboard/storage',        icon: 'M5 8h14M5 8a2 2 0 110-4h14a2 2 0 110 4M5 8v10a2 2 0 002 2h10a2 2 0 002-2V8m-9 4h4' },
  { name: 'API Playground',href: '/dashboard/api-playground', icon: 'M14.752 11.168l-3.197-2.132A1 1 0 0010 9.87v4.263a1 1 0 001.555.832l3.197-2.132a1 1 0 000-1.664zM21 12a9 9 0 11-18 0 9 9 0 0118 0z' },
  { name: 'API Keys',      href: '/dashboard/api-keys',       icon: 'M15 7a2 2 0 012 2m4 0a6 6 0 01-7.743 5.743L11 17H9v2H7v2H4a1 1 0 01-1-1v-2.586a1 1 0 01.293-.707l5.964-5.964A6 6 0 1121 9z' },
  { name: 'Analytics',     href: '/dashboard/analytics',      icon: 'M9 19v-6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2a2 2 0 002-2zm0 0V9a2 2 0 012-2h2a2 2 0 012 2v10m-6 0a2 2 0 002 2h2a2 2 0 002-2m0 0V5a2 2 0 012-2h2a2 2 0 012 2v14a2 2 0 01-2 2h-2a2 2 0 01-2-2z' },
  { name: 'Backups',       href: '/dashboard/backups',        icon: 'M8 7H5a2 2 0 00-2 2v9a2 2 0 002 2h14a2 2 0 002-2V9a2 2 0 00-2-2h-3m-1 4l-3 3m0 0l-3-3m3 3V4' },
  { name: 'Team',          href: '/dashboard/team',           icon: 'M17 20h5v-2a3 3 0 00-5.356-1.857M17 20H7m10 0v-2c0-.656-.126-1.283-.356-1.857M7 20H2v-2a3 3 0 015.356-1.857M7 20v-2c0-.656.126-1.283.356-1.857m0 0a5.002 5.002 0 019.288 0M15 7a3 3 0 11-6 0 3 3 0 016 0z', badge: 'New' },
  { name: 'Billing',       href: '/dashboard/billing',        icon: 'M3 10h18M7 15h1m4 0h1m-7 4h12a3 3 0 003-3V8a3 3 0 00-3-3H6a3 3 0 00-3 3v8a3 3 0 003 3z' },
];

function NavIcon({ d }: { d: string }) {
  return (
    <svg className="w-[15px] h-[15px] flex-shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24" aria-hidden>
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.75} d={d} />
    </svg>
  );
}

function NavItem({ item, pathname, router }: { item: typeof NAV_PRIMARY[0] & { badge?: string; children?: { name: string; href: string }[] }, pathname: string, router: ReturnType<typeof useRouter> }) {
  const isActive = pathname === item.href || (item.children?.some(c => pathname.startsWith(c.href)) ?? false);
  const [open, setOpen] = useState(isActive);

  if (item.children) {
    return (
      <div>
        <button
          onClick={() => setOpen(o => !o)}
          className={`w-full flex items-center justify-between px-3 py-2 rounded-xl text-xs font-medium transition-all duration-200 group ${
            isActive
              ? 'bg-[rgba(255,107,0,0.1)] text-white border-l-2 border-[#FF6B00] pl-[10px]'
              : 'text-[#71717A] hover:text-white hover:bg-white/[0.04] border-l-2 border-transparent'
          }`}
        >
          <span className="flex items-center gap-2.5">
            <span className={isActive ? 'text-[#FF6B00]' : 'text-[#52525B] group-hover:text-[#A1A1AA]'}>
              <NavIcon d={item.icon} />
            </span>
            {item.name}
            {item.badge && (
              <span className={`px-1.5 py-0.5 rounded-md text-[10px] font-bold ${item.badge === 'AI' ? 'bg-[rgba(255,107,0,0.15)] text-[#FF6B00]' : 'bg-blue-500/20 text-blue-400'}`}>
                {item.badge}
              </span>
            )}
          </span>
          <svg className={`w-3 h-3 transition-transform duration-200 ${open ? 'rotate-180' : ''} ${isActive ? 'text-[#FF6B00]/60' : 'text-[#52525B]'}`} fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
          </svg>
        </button>
        {open && (
          <div className="ml-5 mt-0.5 pl-3 border-l border-white/[0.05] space-y-0.5">
            {item.children.map(child => {
              const ca = pathname === child.href;
              return (
                <Link
                  key={child.href}
                  href={child.href}
                  className={`block px-2.5 py-1.5 rounded-lg text-xs transition-all duration-150 ${
                    ca ? 'text-[#FF6B00] bg-[rgba(255,107,0,0.08)] font-medium' : 'text-[#71717A] hover:text-white hover:bg-white/[0.04]'
                  }`}
                >
                  {child.name}
                </Link>
              );
            })}
          </div>
        )}
      </div>
    );
  }

  return (
    <Link
      href={item.href}
      className={`flex items-center gap-2.5 px-3 py-2 rounded-xl text-xs font-medium transition-all duration-200 group ${
        isActive
          ? 'bg-[rgba(255,107,0,0.1)] text-white border-l-2 border-[#FF6B00] pl-[10px]'
          : 'text-[#71717A] hover:text-white hover:bg-white/[0.04] border-l-2 border-transparent'
      }`}
    >
      <span className={isActive ? 'text-[#FF6B00]' : 'text-[#52525B] group-hover:text-[#A1A1AA]'}>
        <NavIcon d={item.icon} />
      </span>
      <span className="flex-1 truncate">{item.name}</span>
      {item.badge && (
        <span className={`px-1.5 py-0.5 rounded-md text-[10px] font-bold ${item.badge === 'AI' ? 'bg-[rgba(255,107,0,0.15)] text-[#FF6B00]' : 'bg-blue-500/20 text-blue-400'}`}>
          {item.badge}
        </span>
      )}
    </Link>
  );
}

export default function DashboardLayout({ children }: { children: React.ReactNode }) {
  const [sidebarOpen, setSidebarOpen] = useState(true);
  const [showCmdPalette, setShowCmdPalette] = useState(false);
  const [showUserMenu, setShowUserMenu] = useState(false);
  const [showNotifications, setShowNotifications] = useState(false);
  const [showProfileMenu, setShowProfileMenu] = useState(false);
  const [notifications, setNotifications] = useState<Notification[]>([]);
  const [notifLoading, setNotifLoading] = useState(false);
  const [unreadCount, setUnreadCount] = useState(0);
  const [readIds, setReadIds] = useState<Set<string>>(new Set());
  const [user, setUser] = useState<User | null>(null);
  const [activeProject, setActiveProject] = useState('');
  const [activeProjectInitial, setActiveProjectInitial] = useState('');
  const [currentProjectId, setCurrentProjectId] = useState('');
  const [freePlanUsage, setFreePlanUsage] = useState<{ used: number; limit: number; percentage: number } | null>(null);
  const [cmdSearch, setCmdSearch] = useState('');
  const pathname = usePathname();
  const router = useRouter();

  const getInitials = (name: string) =>
    name.split(' ').map(n => n[0]).join('').toUpperCase().slice(0, 2);

  const handleLogout = useCallback(() => {
    ['token', 'user_id', 'user_email', 'user'].forEach(k => localStorage.removeItem(k));
    router.push('/login');
  }, [router]);

  const fetchNotifications = useCallback(async () => {
    setNotifLoading(true);
    try {
      const r = await apiFetch('api/audit/logs?limit=20');
      if (r.ok) {
        const data = await r.json();
        const logs: Notification[] = (data.logs ?? []).map((l: Record<string, unknown>) => ({
          id: String(l.id),
          event_type: String(l.event_type),
          success: Boolean(l.success),
          created_at: String(l.created_at),
          event_data: l.event_data as Record<string, unknown> | undefined,
          user_email: l.user_email ? String(l.user_email) : undefined,
        }));
        setNotifications(logs);
        // Count notifications not yet in readIds
        setUnreadCount(prev => {
          const stored = localStorage.getItem('notif_read_ids');
          const ids: string[] = stored ? JSON.parse(stored) : [];
          const idSet = new Set(ids);
          setReadIds(idSet);
          return logs.filter(l => !idSet.has(l.id)).length;
        });
      }
    } catch {
      // silent — no toast spam on polling
    } finally {
      setNotifLoading(false);
    }
  }, []);

  const markAllRead = useCallback(() => {
    const ids = notifications.map(n => n.id);
    const idSet = new Set(ids);
    setReadIds(idSet);
    setUnreadCount(0);
    localStorage.setItem('notif_read_ids', JSON.stringify(ids));
  }, [notifications]);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if ((e.metaKey || e.ctrlKey) && e.key === 'k') { e.preventDefault(); setShowCmdPalette(v => !v); }
      if (e.key === 'Escape') { setShowCmdPalette(false); setShowUserMenu(false); setShowNotifications(false); setShowProfileMenu(false); }
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, []);

  useEffect(() => {
    if (!user) return;
    fetchNotifications();
    const interval = setInterval(fetchNotifications, 30_000);
    return () => clearInterval(interval);
  }, [user, fetchNotifications]);

  // Also fetch when the panel is opened so it's always fresh
  useEffect(() => {
    if (showNotifications && user) fetchNotifications();
  }, [showNotifications, user, fetchNotifications]);

  // Close header dropdowns when clicking outside them
  useEffect(() => {
    if (!showNotifications && !showProfileMenu) return;
    const handler = (e: MouseEvent) => {
      const target = e.target as Element;
      if (!target.closest('[data-header-dropdown]')) {
        setShowNotifications(false);
        setShowProfileMenu(false);
      }
    };
    document.addEventListener('mousedown', handler);
    return () => document.removeEventListener('mousedown', handler);
  }, [showNotifications, showProfileMenu]);

  useEffect(() => {
    (async () => {
      const token = localStorage.getItem('token');
      if (!token) { router.push('/login'); return; }
      try {
        const ur = await apiFetch('api/auth/me');
        if (!ur.ok) { if (ur.status === 401 || ur.status === 403) { localStorage.removeItem('token'); router.push('/login'); } return; }
        const userData = await ur.json();
        setUser(userData);
        if (pathname !== '/onboarding') {
          const pr = await apiFetch('api/projects');
          if (pr.ok) {
            const projects = await pr.json();
            if (!projects.length) { router.push('/onboarding'); return; }
            let proj = userData.last_selected_project_id ? projects.find((p: { id: string }) => p.id === userData.last_selected_project_id) : null;
            if (!proj) proj = projects[0];
            setActiveProject(proj.name);
            setActiveProjectInitial(proj.name.split(' ').map((w: string) => w[0]).join('').toUpperCase().slice(0, 2));
            localStorage.setItem('current_project_id', proj.id);
            if (proj.slug) localStorage.setItem('current_project_slug', proj.slug);
            setCurrentProjectId(proj.id);
          }
        }
      } catch {}
    })();
  }, [router, pathname]);

  useEffect(() => {
    if (!user || user.plan !== 'free') return;
    apiFetch('api/billing/subscription').then(r => r.ok ? r.json() : null).then(d => {
      if (!d) return;
      const used = d.usage?.api_requests ?? 0;
      const limit = d.subscription?.api_requests_limit ?? 10000;
      setFreePlanUsage({ used, limit, percentage: Math.min(Math.round((used / limit) * 100), 100) });
    }).catch(() => {});
  }, [user]);

  if (!user) return (
    <div className="min-h-screen bg-[#050505] flex items-center justify-center">
      <LoadingSpinner size="xl" text="Loading..." />
    </div>
  );

  const allNavItems = [...NAV_PRIMARY, ...NAV_WORKSPACE];
  const filteredNav = cmdSearch
    ? allNavItems.filter(i => i.name.toLowerCase().includes(cmdSearch.toLowerCase()))
    : allNavItems;

  return (
    <div className="min-h-screen bg-[#050505] flex relative">
      <SpatialBackground />

      {/* ── SIDEBAR (Layer 1) ── */}
      <aside
        className={`fixed inset-y-0 left-0 z-40 flex flex-col transition-all duration-300 ease-spring ${
          sidebarOpen ? 'w-[240px]' : 'w-0'
        } overflow-hidden`}
        style={{
          background: 'rgba(7,7,7,0.95)',
          backdropFilter: 'blur(60px) saturate(2)',
          WebkitBackdropFilter: 'blur(60px) saturate(2)',
          borderRight: '1px solid rgba(255,255,255,0.05)',
          boxShadow: '4px 0 32px rgba(0,0,0,0.5), 1px 0 0 rgba(255,255,255,0.025)',
        }}
      >
        {/* Logo */}
        <div className="h-14 flex items-center px-5 border-b border-white/[0.04] flex-shrink-0">
          <Link href="/" className="flex items-center gap-2.5 min-w-0">
            <img src="/logo.png" alt="ZendBX" className="h-8 w-auto flex-shrink-0" />
            <span className="text-sm font-bold text-white tracking-tight truncate" style={{ fontVariantNumeric: 'tabular-nums' }}>
              ZendBX
            </span>
          </Link>
        </div>

        {/* Project switcher */}
        <div className="px-3 py-3 border-b border-white/[0.04] flex-shrink-0">
          <button className="w-full flex items-center gap-2.5 px-3 py-2.5 rounded-xl text-left transition-all duration-200 hover:bg-white/[0.05] group"
            style={{ background: 'rgba(255,255,255,0.03)', border: '1px solid rgba(255,255,255,0.06)' }}>
            <div className="w-7 h-7 rounded-lg flex items-center justify-center flex-shrink-0 text-xs font-bold text-white"
              style={{ background: 'linear-gradient(135deg, #FF6B00, #e85e00)', boxShadow: '0 2px 8px rgba(255,107,0,0.3)' }}>
              {activeProjectInitial || 'P'}
            </div>
            <div className="flex-1 min-w-0">
              <p className="text-xs font-semibold text-white truncate leading-tight">{activeProject || 'Select project'}</p>
              <p className="text-[10px] text-[#52525B] mt-0.5">Production</p>
            </div>
            <svg className="w-3 h-3 text-[#52525B] flex-shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
            </svg>
          </button>
        </div>

        {/* Navigation */}
        <nav className="flex-1 overflow-y-auto px-3 py-3 space-y-0.5">
          <div className="space-y-0.5">
            {NAV_PRIMARY.map(item => (
              <NavItem key={item.href} item={item} pathname={pathname} router={router} />
            ))}
          </div>
          <div className="pt-4 pb-1.5 px-1">
            <span className="text-[10px] font-semibold text-[#3F3F46] uppercase tracking-widest">Workspace</span>
          </div>
          <div className="space-y-0.5">
            {NAV_WORKSPACE.map(item => (
              <NavItem key={item.href} item={item} pathname={pathname} router={router} />
            ))}
          </div>
        </nav>

        {/* Bottom */}
        <div className="px-3 pb-3 pt-2 border-t border-white/[0.04] space-y-2 flex-shrink-0">
          {user.plan === 'free' && (
            <Link href="/dashboard/billing" className="block group">
              <div className="rounded-xl p-3 transition-all duration-200 hover:border-[rgba(255,107,0,0.2)]"
                style={{ background: 'rgba(255,255,255,0.025)', border: '1px solid rgba(255,255,255,0.05)' }}>
                <div className="flex items-center gap-2 mb-2">
                  <div className="w-4 h-4 text-[#FF6B00]">
                    <svg viewBox="0 0 24 24" fill="currentColor"><path d="M12 2l2.09 6.26L20 10l-5.91 1.74L12 18l-2.09-6.26L4 10l5.91-1.74z"/></svg>
                  </div>
                  <span className="text-xs font-semibold text-white">Free Plan</span>
                </div>
                <div className="spatial-progress-track mb-2">
                  <div className="spatial-progress-bar" style={{ width: `${freePlanUsage?.percentage ?? 0}%` }} />
                </div>
                <p className="text-[10px] text-[#52525B] mb-2">
                  {freePlanUsage ? `${freePlanUsage.used.toLocaleString()} / ${freePlanUsage.limit.toLocaleString()} requests` : 'Loading...'}
                </p>
                <div className="w-full py-1.5 rounded-lg text-center text-[11px] font-semibold text-white transition-all"
                  style={{ background: 'linear-gradient(135deg, #FF6B00, #e85e00)', boxShadow: '0 2px 8px rgba(255,107,0,0.25)' }}>
                  Upgrade to Pro →
                </div>
              </div>
            </Link>
          )}

          <div className="relative">
            <button onClick={() => setShowUserMenu(v => !v)}
              className="w-full flex items-center gap-2.5 px-2.5 py-2 rounded-xl transition-all duration-200 hover:bg-white/[0.05] group">
              <div className="w-7 h-7 rounded-lg flex items-center justify-center text-white text-xs font-bold flex-shrink-0"
                style={{ background: 'linear-gradient(135deg, #FF6B00, #e85e00)', boxShadow: '0 2px 8px rgba(255,107,0,0.25)' }}>
                {getInitials(user.full_name)}
              </div>
              <div className="flex-1 min-w-0 text-left">
                <p className="text-xs font-semibold text-white truncate leading-tight">{user.full_name}</p>
                <p className="text-[10px] text-[#52525B] capitalize">{user.plan} plan</p>
              </div>
              <svg className="w-3 h-3 text-[#3F3F46] flex-shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 5v.01M12 12v.01M12 19v.01" />
              </svg>
            </button>

            {showUserMenu && (
              <div className="absolute bottom-full left-0 right-0 mb-2 rounded-xl overflow-hidden animate-slide-up"
                style={{ background: 'rgba(17,17,17,0.98)', border: '1px solid rgba(255,255,255,0.08)', boxShadow: '0 16px 48px rgba(0,0,0,0.7)' }}>
                <div className="px-4 py-3 border-b border-white/[0.05]">
                  <p className="text-xs font-semibold text-white">{user.full_name}</p>
                  <p className="text-[11px] text-[#71717A] mt-0.5">{user.email}</p>
                </div>
                <div className="p-1.5 space-y-0.5">
                  {[{ label: 'Profile', href: '/dashboard/profile' }, { label: 'Billing', href: '/dashboard/billing' }].map(({ label, href }) => (
                    <Link key={href} href={href} onClick={() => setShowUserMenu(false)}
                      className="block px-3 py-2 text-xs text-[#A1A1AA] hover:text-white hover:bg-white/[0.05] rounded-lg transition-all">
                      {label}
                    </Link>
                  ))}
                  <div className="h-px bg-white/[0.05] my-1" />
                  <button onClick={handleLogout}
                    className="w-full text-left px-3 py-2 text-xs text-red-400 hover:bg-red-500/[0.08] rounded-lg transition-all">
                    Sign out
                  </button>
                </div>
              </div>
            )}
          </div>
        </div>
      </aside>

      {/* ── MAIN AREA ── */}
      <div className={`relative z-10 flex-1 flex flex-col transition-all duration-300 ease-spring ${sidebarOpen ? 'ml-[240px]' : 'ml-0'}`}>

        {/* Floating top bar (Layer 2) */}
        <header className="sticky top-0 z-30 h-14 flex items-center justify-between px-5 flex-shrink-0"
          style={{
            background: 'rgba(9,9,9,0.88)',
            backdropFilter: 'blur(48px) saturate(1.8)',
            WebkitBackdropFilter: 'blur(48px) saturate(1.8)',
            borderBottom: '1px solid rgba(255,255,255,0.05)',
            boxShadow: '0 1px 0 rgba(255,255,255,0.03) inset, 0 8px 32px rgba(0,0,0,0.35)',
          }}>
          <div className="flex items-center gap-3">
            <button onClick={() => setSidebarOpen(v => !v)}
              className="w-8 h-8 flex items-center justify-center rounded-lg text-[#71717A] hover:text-white hover:bg-white/[0.06] transition-all duration-200"
              aria-label="Toggle sidebar">
              <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.75} d="M4 6h16M4 12h16M4 18h16" />
              </svg>
            </button>

            <button onClick={() => setShowCmdPalette(true)}
              className="flex items-center gap-2.5 px-3 py-1.5 rounded-xl text-xs text-[#71717A] hover:text-[#A1A1AA] transition-all duration-200"
              style={{ background: 'rgba(255,255,255,0.04)', border: '1px solid rgba(255,255,255,0.06)' }}>
              <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
              </svg>
              <span>Search or jump to...</span>
              <kbd className="px-1.5 py-0.5 rounded-md text-[10px] font-mono" style={{ background: 'rgba(255,255,255,0.06)', border: '1px solid rgba(255,255,255,0.08)' }}>⌘K</kbd>
            </button>
          </div>

          <div className="flex items-center gap-2" data-header-dropdown>
            <div className="flex items-center gap-1.5 px-2.5 py-1 rounded-lg text-[10px] font-medium text-emerald-400"
              style={{ background: 'rgba(34,197,94,0.08)', border: '1px solid rgba(34,197,94,0.15)' }}>
              <span className="live-dot" style={{ width: 5, height: 5 }} />
              Live
            </div>

            {/* ── Bell / Notifications ── */}
            <div className="relative">
              <button
                onClick={() => { setShowNotifications(v => !v); setShowProfileMenu(false); }}
                className="w-8 h-8 flex items-center justify-center rounded-lg text-[#71717A] hover:text-white hover:bg-white/[0.06] transition-all relative"
                aria-label="Notifications"
              >
                <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.75} d="M15 17h5l-1.405-1.405A2.032 2.032 0 0118 14.158V11a6.002 6.002 0 00-4-5.659V5a2 2 0 10-4 0v.341C7.67 6.165 6 8.388 6 11v3.159c0 .538-.214 1.055-.595 1.436L4 17h5m6 0v1a3 3 0 11-6 0v-1m6 0H9" />
                </svg>
                <span className="absolute top-1.5 right-1.5 w-1.5 h-1.5 rounded-full bg-[#FF6B00]" />
              </button>

              {showNotifications && (
                <div
                  className="absolute right-0 top-full mt-2 rounded-xl overflow-hidden z-50"
                  style={{
                    width: '320px',
                    maxWidth: 'calc(100vw - 1rem)',
                    background: 'rgba(13,13,13,0.98)',
                    border: '1px solid rgba(255,255,255,0.08)',
                    boxShadow: '0 16px 48px rgba(0,0,0,0.7)',
                  }}
                >
                  <div className="flex items-center justify-between px-4 py-3 border-b border-white/[0.05]">
                    <span className="text-xs font-semibold text-white">Notifications</span>
                    {unreadCount > 0 && (
                      <span className="text-[10px] text-[#FF6B00] font-medium">{unreadCount} new</span>
                    )}
                  </div>

                  <div className="py-1 max-h-72 overflow-y-auto">
                    {notifLoading && notifications.length === 0 ? (
                      <div className="flex items-center justify-center py-8">
                        <div className="w-4 h-4 border-2 border-[#FF6B00] border-t-transparent rounded-full animate-spin" />
                      </div>
                    ) : notifications.length === 0 ? (
                      <div className="flex flex-col items-center justify-center py-8 gap-2">
                        <svg className="w-8 h-8 text-[#3F3F46]" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M15 17h5l-1.405-1.405A2.032 2.032 0 0118 14.158V11a6.002 6.002 0 00-4-5.659V5a2 2 0 10-4 0v.341C7.67 6.165 6 8.388 6 11v3.159c0 .538-.214 1.055-.595 1.436L4 17h5m6 0v1a3 3 0 11-6 0v-1m6 0H9" />
                        </svg>
                        <p className="text-xs text-[#52525B]">No activity yet</p>
                      </div>
                    ) : (
                      notifications.map((n) => {
                        const { title, desc } = notifMeta(n);
                        const isUnread = !readIds.has(n.id);
                        return (
                          <div
                            key={n.id}
                            className={`flex items-start gap-3 px-4 py-3 transition-all cursor-pointer border-b border-white/[0.03] last:border-0 ${
                              isUnread ? 'bg-[rgba(255,107,0,0.04)] hover:bg-[rgba(255,107,0,0.07)]' : 'hover:bg-white/[0.04]'
                            }`}
                          >
                            <div className="flex-shrink-0 mt-0.5">
                              <NotifIcon type={n.event_type} success={n.success} />
                            </div>
                            <div className="flex-1 min-w-0">
                              <div className="flex items-center gap-1.5">
                                <p className="text-xs font-semibold text-white truncate capitalize">{title}</p>
                                {isUnread && (
                                  <span className="w-1.5 h-1.5 rounded-full bg-[#FF6B00] flex-shrink-0" />
                                )}
                              </div>
                              {desc && <p className="text-[11px] text-[#71717A] mt-0.5 truncate">{desc}</p>}
                              {!n.success && (
                                <span className="inline-block mt-1 text-[10px] text-red-400 font-medium">Failed</span>
                              )}
                            </div>
                            <span className="text-[10px] text-[#52525B] flex-shrink-0 whitespace-nowrap mt-0.5">
                              {timeAgo(n.created_at)}
                            </span>
                          </div>
                        );
                      })
                    )}
                  </div>

                  <div className="px-4 py-2.5 border-t border-white/[0.05]">
                    <button
                      onClick={markAllRead}
                      className="w-full text-center text-[11px] text-[#71717A] hover:text-white transition-all"
                    >
                      Mark all as read
                    </button>
                  </div>
                </div>
              )}
            </div>

            {/* ── Profile avatar / menu ── */}
            <div className="relative">
              <button
                onClick={() => { setShowProfileMenu(v => !v); setShowNotifications(false); }}
                className="w-7 h-7 rounded-lg flex items-center justify-center text-white text-[11px] font-bold flex-shrink-0 transition-all hover:scale-105"
                style={{ background: 'linear-gradient(135deg, #FF6B00, #e85e00)', boxShadow: '0 2px 8px rgba(255,107,0,0.3)' }}
                aria-label="Profile menu"
              >
                {getInitials(user.full_name)}
              </button>

              {showProfileMenu && (
                <div
                  className="absolute right-0 top-full mt-2 w-56 rounded-xl overflow-hidden z-50"
                  style={{
                    background: 'rgba(13,13,13,0.98)',
                    border: '1px solid rgba(255,255,255,0.08)',
                    boxShadow: '0 16px 48px rgba(0,0,0,0.7)',
                  }}
                >
                  <div className="px-4 py-3 border-b border-white/[0.05]">
                    <p className="text-xs font-semibold text-white truncate">{user.full_name}</p>
                    <p className="text-[11px] text-[#71717A] mt-0.5 truncate">{user.email}</p>
                    <span className="inline-block mt-1.5 px-2 py-0.5 rounded-md text-[10px] font-semibold capitalize"
                      style={{ background: 'rgba(255,107,0,0.12)', color: '#FF6B00', border: '1px solid rgba(255,107,0,0.2)' }}>
                      {user.plan} plan
                    </span>
                  </div>
                  <div className="p-1.5 space-y-0.5">
                    {[
                      { label: 'Profile',  href: '/dashboard/profile' },
                      { label: 'Billing',  href: '/dashboard/billing' },
                      { label: 'API Keys', href: '/dashboard/api-keys' },
                      { label: 'Settings', href: '/dashboard/authentication/settings' },
                    ].map(({ label, href }) => (
                      <Link key={href} href={href} onClick={() => setShowProfileMenu(false)}
                        className="block px-3 py-2 text-xs text-[#A1A1AA] hover:text-white hover:bg-white/[0.05] rounded-lg transition-all">
                        {label}
                      </Link>
                    ))}
                    <div className="h-px bg-white/[0.05] my-1" />
                    <button
                      onClick={() => { setShowProfileMenu(false); handleLogout(); }}
                      className="w-full text-left px-3 py-2 text-xs text-red-400 hover:bg-red-500/[0.08] rounded-lg transition-all">
                      Sign out
                    </button>
                  </div>
                </div>
              )}
            </div>
          </div>
        </header>

        {/* Page content (Layer 3) */}
        <main className="flex-1 overflow-auto relative">{children}</main>
      </div>

      {/* ── COMMAND PALETTE (Layer 5) ── */}
      {showCmdPalette && (
        <div className="fixed inset-0 z-50 flex items-start justify-center pt-[18vh]"
          onClick={() => { setShowCmdPalette(false); setCmdSearch(''); }}>
          <div className="absolute inset-0 bg-black/60 backdrop-blur-sm" />
          <div className="relative w-full max-w-xl mx-4 rounded-2xl overflow-hidden animate-scale-in"
            style={{
              background: 'rgba(11,11,11,0.98)',
              border: '1px solid rgba(255,255,255,0.1)',
              boxShadow: '0 32px 128px rgba(0,0,0,0.9), 0 8px 32px rgba(0,0,0,0.7)',
            }}
            onClick={e => e.stopPropagation()}>
            <div className="flex items-center gap-3 px-4 py-3.5 border-b border-white/[0.06]">
              <svg className="w-4 h-4 text-[#52525B] flex-shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
              </svg>
              <input autoFocus value={cmdSearch} onChange={e => setCmdSearch(e.target.value)}
                type="text" placeholder="Search pages, features..."
                className="flex-1 bg-transparent text-sm text-white placeholder-[#52525B] outline-none font-medium" />
              <span className="w-[2px] h-4 bg-[#FF6B00] animate-cursor-blink rounded-full" aria-hidden />
              <kbd className="px-2 py-1 rounded-lg text-[10px] text-[#52525B] font-mono" style={{ background: 'rgba(255,255,255,0.04)', border: '1px solid rgba(255,255,255,0.06)' }}>ESC</kbd>
            </div>
            <div className="py-2 max-h-80 overflow-y-auto">
              {filteredNav.map(item => (
                <Link key={item.href} href={item.href}
                  onClick={() => { setShowCmdPalette(false); setCmdSearch(''); }}
                  className="flex items-center gap-3 px-4 py-2.5 text-sm text-[#A1A1AA] hover:text-white hover:bg-white/[0.04] transition-all group">
                  <span className="w-7 h-7 rounded-lg flex items-center justify-center flex-shrink-0 text-[#52525B] group-hover:text-[#FF6B00] group-hover:bg-[rgba(255,107,0,0.08)] transition-all"
                    style={{ background: 'rgba(255,255,255,0.04)' }}>
                    <NavIcon d={item.icon} />
                  </span>
                  {item.name}
                </Link>
              ))}
              {filteredNav.length === 0 && (
                <p className="px-4 py-6 text-center text-sm text-[#52525B]">No results for "{cmdSearch}"</p>
              )}
            </div>
            <div className="flex items-center justify-between px-4 py-2.5 border-t border-white/[0.04] text-[10px] text-[#3F3F46]">
              <span>↑↓ navigate</span>
              <span>↵ select · ESC close</span>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
