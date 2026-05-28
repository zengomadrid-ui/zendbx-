'use client';

import { useState, useEffect } from 'react';
import Link from 'next/link';
import { usePathname, useRouter } from 'next/navigation';
import { apiFetch } from '@/lib/fetch-utils';

interface User {
  id: string;
  email: string;
  full_name: string;
  avatar_url?: string;
  plan: string;
  role?: string; // Added for RBAC
}

export default function DashboardLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const [isSidebarOpen, setIsSidebarOpen] = useState(true); // Always start open
  const [showCommandPalette, setShowCommandPalette] = useState(false);
  const [activeProject, setActiveProject] = useState<string>('');
  const [activeProjectInitial, setActiveProjectInitial] = useState<string>('');
  const [user, setUser] = useState<User | null>(null);
  const [showUserMenu, setShowUserMenu] = useState(false);
  const [expandedMenus, setExpandedMenus] = useState<string[]>(['Authentication', 'Database']); // Track expanded menus
  const [isLoading, setIsLoading] = useState(true);
  const pathname = usePathname();
  const router = useRouter();

  const projects = [
    { id: 1, name: activeProject || 'No Project', initial: activeProjectInitial || 'NP', color: 'from-orange-600 to-orange-500' },
  ];

  const navigation = [
    { 
      name: 'Project Overview', 
      href: '/dashboard', 
      icon: (
        <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 19v-6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2a2 2 0 002-2zm0 0V9a2 2 0 012-2h2a2 2 0 012 2v10m-6 0a2 2 0 002 2h2a2 2 0 002-2m0 0V5a2 2 0 012-2h2a2 2 0 012 2v14a2 2 0 01-2 2h-2a2 2 0 01-2-2z" />
        </svg>
      )
    },
    { 
      name: 'AI Builder', 
      href: '/dashboard/ai-builder', 
      icon: (
        <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9.663 17h4.673M12 3v1m6.364 1.636l-.707.707M21 12h-1M4 12H3m3.343-5.657l-.707-.707m2.828 9.9a5 5 0 117.072 0l-.548.547A3.374 3.374 0 0014 18.469V19a2 2 0 11-4 0v-.531c0-.895-.356-1.754-.988-2.386l-.548-.547z" />
        </svg>
      ),
      badge: 'NEW'
    },
    { 
      name: 'Real-time Demo', 
      href: '/dashboard/realtime', 
      icon: (
        <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 10V3L4 14h7v7l9-11h-7z" />
        </svg>
      )
    },
    { 
      name: 'Table Editor', 
      href: '/dashboard/tables', 
      icon: (
        <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 10h18M3 14h18m-9-4v8m-7 0h14a2 2 0 002-2V8a2 2 0 00-2-2H5a2 2 0 00-2 2v8a2 2 0 002 2z" />
        </svg>
      )
    },
    { 
      name: 'SQL Editor', 
      href: '/dashboard/sql-editor', 
      icon: (
        <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 9l3 3-3 3m5 0h3M5 20h14a2 2 0 002-2V6a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z" />
        </svg>
      )
    },
    { 
      name: 'My Profile', 
      href: '/dashboard/profile', 
      icon: (
        <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z" />
        </svg>
      )
    },
    { 
      name: 'Backups', 
      href: '/dashboard/backups', 
      icon: (
        <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 7H5a2 2 0 00-2 2v9a2 2 0 002 2h14a2 2 0 002-2V9a2 2 0 00-2-2h-3m-1 4l-3 3m0 0l-3-3m3 3V4" />
        </svg>
      )
    },
    { 
      name: 'Analytics', 
      href: '/dashboard/analytics', 
      icon: (
        <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 19v-6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2a2 2 0 002-2zm0 0V9a2 2 0 012-2h2a2 2 0 012 2v10m-6 0a2 2 0 002 2h2a2 2 0 002-2m0 0V5a2 2 0 012-2h2a2 2 0 012 2v14a2 2 0 01-2 2h-2a2 2 0 01-2-2z" />
        </svg>
      ),
      badge: 'NEW'
    },
  ];

  // Build secondary navigation based on user role
  const secondaryNav = [
    { 
      name: 'Projects', 
      href: '/dashboard/projects', 
      icon: (
        <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 7v10a2 2 0 002 2h14a2 2 0 002-2V9a2 2 0 00-2-2h-6l-2-2H5a2 2 0 00-2 2z" />
        </svg>
      )
    },
    { 
      name: 'Team', 
      href: '/dashboard/team', 
      icon: (
        <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17 20h5v-2a3 3 0 00-5.356-1.857M17 20H7m10 0v-2c0-.656-.126-1.283-.356-1.857M7 20H2v-2a3 3 0 015.356-1.857M7 20v-2c0-.656.126-1.283.356-1.857m0 0a5.002 5.002 0 019.288 0M15 7a3 3 0 11-6 0 3 3 0 016 0zm6 3a2 2 0 11-4 0 2 2 0 014 0zM7 10a2 2 0 11-4 0 2 2 0 014 0z" />
        </svg>
      ),
      badge: 'New'
    },
    { 
      name: 'API Keys', 
      href: '/dashboard/api-keys', 
      icon: (
        <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 7a2 2 0 012 2m4 0a6 6 0 01-7.743 5.743L11 17H9v2H7v2H4a1 1 0 01-1-1v-2.586a1 1 0 01.293-.707l5.964-5.964A6 6 0 1121 9z" />
        </svg>
      )
    },
    { 
      name: 'API Playground', 
      href: '/dashboard/api-playground', 
      icon: (
        <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M14.752 11.168l-3.197-2.132A1 1 0 0010 9.87v4.263a1 1 0 001.555.832l3.197-2.132a1 1 0 000-1.664z" />
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
        </svg>
      )
    },
    // Authentication menu - different items based on role
    {
      name: 'Authentication', 
      href: '/dashboard/authentication', 
      icon: (
        <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 15v2m-6 4h12a2 2 0 002-2v-6a2 2 0 00-2-2H6a2 2 0 00-2 2v6a2 2 0 002 2zm10-10V7a4 4 0 00-8 0v4h8z" />
        </svg>
      ),
      children: user?.role === 'admin' ? [
        // Admin sees all pages
        { name: 'Users', href: '/dashboard/authentication/users' },
        { name: 'Providers', href: '/dashboard/authentication/providers' },
        { name: 'Sessions', href: '/dashboard/authentication/sessions' },
        { name: 'Security', href: '/dashboard/authentication/security' },
        { name: 'Policies', href: '/dashboard/authentication/policies' },
        { name: 'OAuth Apps', href: '/dashboard/authentication/oauth-apps' },
        { name: 'Hooks', href: '/dashboard/authentication/hooks' },
        { name: 'Logs', href: '/dashboard/authentication/logs' },
        { name: 'Settings', href: '/dashboard/authentication/settings' },
      ] : [
        // Regular users see limited pages (but including Users now)
        { name: 'Users', href: '/dashboard/authentication/users' },
        { name: 'Providers', href: '/dashboard/authentication/providers' },
        { name: 'Sessions', href: '/dashboard/authentication/sessions' },
        { name: 'Security', href: '/dashboard/authentication/security' },
        { name: 'Settings', href: '/dashboard/authentication/settings' },
      ]
    },
    // Database menu with sub-items
    {
      name: 'Database', 
      href: '/dashboard/database', 
      icon: (
        <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 7v10c0 2.21 3.582 4 8 4s8-1.79 8-4V7M4 7c0 2.21 3.582 4 8 4s8-1.79 8-4M4 7c0-2.21 3.582-4 8-4s8 1.79 8 4m0 5c0 2.21-3.582 4-8 4s-8-1.79-8-4" />
        </svg>
      ),
      children: [
        { name: 'Tables', href: '/dashboard/database/tables' },
        { name: 'Schema Visualizer', href: '/dashboard/database/schema' },
        { name: 'Functions', href: '/dashboard/database/functions' },
        { name: 'Triggers', href: '/dashboard/database/triggers' },
        { name: 'Import Data', href: '/dashboard/import' },
      ]
    },
    // Row Level Security - separate menu item
    { 
      name: 'Row Level Security', 
      href: '/dashboard/database/rls', 
      icon: (
        <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m5.618-4.016A11.955 11.955 0 0112 2.944a11.955 11.955 0 01-8.618 3.04A12.02 12.02 0 003 9c0 5.591 3.824 10.29 9 11.622 5.176-1.332 9-6.03 9-11.622 0-1.042-.133-2.052-.382-3.016z" />
        </svg>
      )
    },
  ];

  // Fetch current user and check if onboarding is needed
  useEffect(() => {
    const fetchUserAndCheckOnboarding = async () => {
      console.log('🔍 Dashboard: Checking authentication...');
      
      // Add a small delay to ensure localStorage is updated after login
      await new Promise(resolve => setTimeout(resolve, 100));
      
      const token = localStorage.getItem('token');
      console.log('🔑 Dashboard: Token exists?', !!token);
      
      if (!token) {
        console.log('❌ Dashboard: No token found, redirecting to login');
        router.push('/login');
        return;
      }

      try {
        console.log('📡 Dashboard: Fetching user data...');
        // Fetch user
        const userResponse = await apiFetch('api/auth/me');

        console.log('📥 Dashboard: User response status:', userResponse.status);

        if (!userResponse.ok) {
          // If unauthorized, clear storage and redirect
          if (userResponse.status === 401 || userResponse.status === 403) {
            console.log('❌ Dashboard: Unauthorized, clearing storage and redirecting');
            localStorage.removeItem('token');
            localStorage.removeItem('user_id');
            localStorage.removeItem('user_email');
            localStorage.removeItem('user');
            router.push('/login');
            return;
          }
          throw new Error('Failed to fetch user');
        }

        const userData = await userResponse.json();
        console.log('✅ Dashboard: User data received:', userData.email);
        setUser(userData);

        // Check if user has projects (skip if already on onboarding page)
        if (pathname !== '/onboarding') {
          console.log('📡 Dashboard: Fetching projects...');
          const projectsResponse = await apiFetch('api/projects');

          console.log('📥 Dashboard: Projects response status:', projectsResponse.status);

          if (projectsResponse.ok) {
            const projects = await projectsResponse.json();
            console.log('📦 Dashboard: Projects count:', projects.length);
            
            // If no projects, redirect to onboarding
            if (projects.length === 0) {
              console.log('⚠️ Dashboard: No projects, redirecting to onboarding');
              router.push('/onboarding');
              return;
            }
            
            // Use last_selected_project_id from user data, or first project
            let currentProject;
            if (userData.last_selected_project_id) {
              currentProject = projects.find((p: any) => p.id === userData.last_selected_project_id);
            }
            if (!currentProject) {
              currentProject = projects[0];
            }
            
            if (currentProject) {
              console.log('✅ Dashboard: Setting active project:', currentProject.name);
              setActiveProject(currentProject.name);
              // Generate initials from project name
              const initials = currentProject.name
                .split(' ')
                .map((word: string) => word[0])
                .join('')
                .toUpperCase()
                .slice(0, 2);
              setActiveProjectInitial(initials);
              
              // Store current project ID in localStorage for quick access
              localStorage.setItem('current_project_id', currentProject.id);
              
              // Update last_selected_project_id in database if it changed
              if (userData.last_selected_project_id !== currentProject.id) {
                apiFetch(`api/auth/me/last-project/${currentProject.id}`, {
                  method: 'PUT',
                }).catch(err => console.error('Failed to update last project:', err));
              }
            }
          }
        }
        console.log('✅ Dashboard: Authentication complete');
      } catch (error) {
        console.error('❌ Dashboard: Error fetching user/projects:', error);
        // For network errors or other non-auth issues, just stop loading
        setIsLoading(false);
      } finally {
        setIsLoading(false);
      }
    };

    fetchUserAndCheckOnboarding();
  }, [router, pathname]);

  // Command Palette keyboard shortcut
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if ((e.metaKey || e.ctrlKey) && e.key === 'k') {
        e.preventDefault();
        setShowCommandPalette(!showCommandPalette);
      }
      if (e.key === 'Escape') {
        setShowCommandPalette(false);
        setShowUserMenu(false);
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [showCommandPalette]);

  // Show loading state while checking auth
  if (!user) {
    return (
      <div className="min-h-screen bg-[#1c1c1c] flex items-center justify-center">
        <div className="text-center">
          <div className="w-12 h-12 bg-gradient-to-br from-orange-600 to-orange-500 rounded-lg flex items-center justify-center mx-auto mb-4 animate-pulse">
            <span className="text-white font-bold text-2xl">N</span>
          </div>
          <p className="text-sm text-[#a1a1a1]">Loading...</p>
        </div>
      </div>
    );
  }

  const handleLogout = () => {
    localStorage.removeItem('token');
    localStorage.removeItem('user_id');
    localStorage.removeItem('user_email');
    router.push('/login');
  };

  const getInitials = (name: string) => {
    return name
      .split(' ')
      .map(n => n[0])
      .join('')
      .toUpperCase()
      .slice(0, 2);
  };

  return (
    <div className="min-h-screen bg-[#1c1c1c] flex">
      {/* Sidebar - Improved */}
      <aside
        className={`fixed inset-y-0 left-0 z-50 flex flex-col bg-[#0f0f0f] border-r border-[#2a2a2a] transition-all duration-300 ${
          isSidebarOpen ? 'w-72' : 'w-0'
        } overflow-hidden`}
      >
        {/* Logo - More space */}
        <div className="h-16 flex items-center justify-between px-6 border-b border-[#2a2a2a] flex-shrink-0">
          <Link href="/" className="flex items-center">
            <img src="/logo.png" alt="ZENDBX" className="h-10 w-auto" />
          </Link>
        </div>

        {/* Project Selector - Larger, more prominent */}
        <div className="px-4 py-4 border-b border-[#2a2a2a] flex-shrink-0">
          <button className="w-full flex items-center justify-between px-4 py-3 bg-[#1a1a1a] hover:bg-[#242424] rounded-lg text-left transition-all group">
            <div className="flex items-center space-x-3 min-w-0">
              <div className={`w-8 h-8 bg-gradient-to-br ${projects[0].color} rounded-lg flex items-center justify-center flex-shrink-0 shadow-lg shadow-orange-500/20`}>
                <span className="text-sm font-bold text-white">{projects[0].initial}</span>
              </div>
              <div className="flex-1 min-w-0">
                <p className="text-sm font-semibold text-white truncate">{activeProject}</p>
                <p className="text-xs text-gray-500">Production</p>
              </div>
            </div>
            <svg className="w-4 h-4 text-gray-500 group-hover:text-gray-300 transition-colors flex-shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
            </svg>
          </button>
        </div>

        {/* Navigation - Improved spacing and sizing */}
        <nav className="flex-1 px-4 py-4 overflow-y-auto">
          <div className="space-y-1">
            {navigation.map((item) => {
              const isActive = pathname === item.href;
              return (
                <Link
                  key={item.name}
                  href={item.href}
                  className={`flex items-center space-x-3 px-4 py-3 rounded-lg text-sm font-medium transition-all ${
                    isActive
                      ? 'bg-gradient-to-r from-orange-500/10 to-transparent text-white border-l-2 border-orange-500'
                      : 'text-gray-400 hover:bg-[#1a1a1a] hover:text-white'
                  }`}
                >
                  <div className={isActive ? 'text-orange-500' : ''}>
                    {item.icon}
                  </div>
                  <span>{item.name}</span>
                  {(item as any).badge && (
                    <span className="ml-auto px-2 py-0.5 bg-orange-500 text-white text-xs font-bold rounded-md shadow-lg shadow-orange-500/30">
                      {(item as any).badge}
                    </span>
                  )}
                </Link>
              );
            })}
          </div>

          <div className="mt-6 mb-3 px-4">
            <div className="text-xs font-semibold text-gray-600 uppercase tracking-wider">Workspace</div>
          </div>

          <div className="space-y-1">
            {secondaryNav.map((item) => {
              const isActive = pathname === item.href || (item.children && item.children.some(child => pathname === child.href));
              const isExpanded = expandedMenus.includes(item.name);
              
              return (
                <div key={item.name}>
                  <button
                    onClick={() => {
                      if (item.children) {
                        setExpandedMenus(prev => 
                          prev.includes(item.name) 
                            ? prev.filter(name => name !== item.name)
                            : [...prev, item.name]
                        );
                      } else {
                        router.push(item.href);
                      }
                    }}
                    className={`w-full flex items-center justify-between px-4 py-3 rounded-lg text-sm font-medium transition-all ${
                      isActive
                        ? 'bg-gradient-to-r from-orange-500/10 to-transparent text-white border-l-2 border-orange-500'
                        : 'text-gray-400 hover:bg-[#1a1a1a] hover:text-white'
                    }`}
                  >
                    <div className="flex items-center space-x-3">
                      <div className={isActive ? 'text-orange-500' : ''}>
                        {item.icon}
                      </div>
                      <span>{item.name}</span>
                      {(item as any).badge && (
                        <span className="px-2 py-0.5 bg-blue-500 text-white text-xs font-bold rounded-md">
                          {(item as any).badge}
                        </span>
                      )}
                    </div>
                    {item.children && (
                      <svg 
                        className={`w-4 h-4 transition-transform ${isExpanded ? 'rotate-180' : ''}`}
                        fill="none" 
                        stroke="currentColor" 
                        viewBox="0 0 24 24"
                      >
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
                      </svg>
                    )}
                  </button>
                  
                  {/* Submenu - Improved */}
                  {item.children && isExpanded && (
                    <div className="ml-8 mt-1 space-y-1 border-l-2 border-[#2a2a2a] pl-4">
                      {item.children.map((child) => {
                        const isChildActive = pathname === child.href;
                        return (
                          <Link
                            key={child.name}
                            href={child.href}
                            className={`block px-3 py-2 rounded-lg text-sm transition-all ${
                              isChildActive
                                ? 'bg-[#1a1a1a] text-orange-500 font-medium'
                                : 'text-gray-500 hover:bg-[#1a1a1a] hover:text-white'
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
            })}
          </div>
        </nav>

        {/* Bottom Section - Improved */}
        <div className="px-4 py-4 border-t border-[#2a2a2a] space-y-3 flex-shrink-0">
          {/* Upgrade Banner - Only show for free users */}
          {user?.plan === 'free' && (
            <div className="relative overflow-hidden bg-gradient-to-br from-orange-500/20 to-orange-600/10 border border-orange-500/30 rounded-xl p-4">
              <div className="absolute inset-0 bg-gradient-to-br from-orange-500/10 to-transparent" />
              <div className="relative z-10">
                <p className="text-xs font-bold text-orange-500 mb-1">Upgrade to Pro</p>
                <p className="text-xs text-gray-400 mb-3">Unlock unlimited queries & features</p>
                <button className="w-full py-2 bg-gradient-to-r from-orange-500 to-orange-600 text-white text-sm font-semibold rounded-lg hover:from-orange-600 hover:to-orange-700 transition-all shadow-lg shadow-orange-500/20 hover:shadow-orange-500/40 transform hover:scale-105">
                  Upgrade Now
                </button>
              </div>
            </div>
          )}

          {/* User Profile - Improved */}
          <div className="relative">
            <button 
              onClick={() => setShowUserMenu(!showUserMenu)}
              className="w-full flex items-center space-x-3 px-3 py-3 rounded-lg hover:bg-[#1a1a1a] transition-all group"
            >
              <div className="w-9 h-9 bg-gradient-to-br from-orange-500 to-orange-600 rounded-lg flex items-center justify-center text-white font-bold text-sm flex-shrink-0 shadow-lg shadow-orange-500/20">
                {user ? getInitials(user.full_name) : '?'}
              </div>
              <div className="flex-1 min-w-0 text-left">
                <p className="text-sm font-semibold text-white truncate">
                  {user?.full_name || 'Loading...'}
                </p>
                <p className="text-xs text-gray-500 capitalize">
                  {user?.plan || 'Free'} Plan
                </p>
              </div>
              <svg className="w-4 h-4 text-gray-500 opacity-0 group-hover:opacity-100 transition-opacity flex-shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 12h.01M12 12h.01M19 12h.01M6 12a1 1 0 11-2 0 1 1 0 012 0zm7 0a1 1 0 11-2 0 1 1 0 012 0zm7 0a1 1 0 11-2 0 1 1 0 012 0z" />
              </svg>
            </button>

            {/* User Menu Dropdown - Improved */}
            {showUserMenu && (
              <div className="absolute bottom-full left-0 right-0 mb-2 bg-[#1a1a1a] border border-[#2a2a2a] rounded-xl shadow-2xl">
                <div className="p-4 border-b border-[#2a2a2a]">
                  <p className="text-sm font-semibold text-white">{user?.full_name}</p>
                  <p className="text-xs text-gray-500">{user?.email}</p>
                </div>
                <div className="p-2">
                  <button className="w-full text-left px-3 py-2 text-sm text-gray-400 hover:bg-[#242424] hover:text-white rounded-lg transition-all">
                    Profile Settings
                  </button>
                  <button className="w-full text-left px-3 py-2 text-sm text-gray-400 hover:bg-[#242424] hover:text-white rounded-lg transition-all">
                    Billing
                  </button>
                  <div className="h-px bg-[#2a2a2a] my-2"></div>
                  <button 
                    onClick={handleLogout}
                    className="w-full text-left px-3 py-2 text-sm text-red-400 hover:bg-red-500/10 rounded-lg transition-all"
                  >
                    Sign out
                  </button>
                </div>
              </div>
            )}
          </div>
        </div>
      </aside>

      {/* Main content */}
      <div className={`flex-1 flex flex-col transition-all duration-300 ${isSidebarOpen ? 'ml-72' : 'ml-0'}`}>
        {/* Top bar - Improved */}
        <header className="h-14 bg-[#0f0f0f] border-b border-[#2a2a2a] flex items-center justify-between px-6 flex-shrink-0">
          <div className="flex items-center space-x-4">
            <button
              onClick={() => setIsSidebarOpen(!isSidebarOpen)}
              className="p-2 rounded-lg hover:bg-[#1a1a1a] text-gray-400 hover:text-white transition-all"
            >
              <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 6h16M4 12h16M4 18h16" />
              </svg>
            </button>

            {/* Command Palette Trigger - Improved */}
            <button
              onClick={() => setShowCommandPalette(true)}
              className="flex items-center space-x-3 px-4 py-2 bg-[#1a1a1a] border border-[#2a2a2a] rounded-lg hover:border-[#3a3a3a] transition-all text-sm text-gray-400 hover:text-white"
            >
              <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
              </svg>
              <span>Search...</span>
              <kbd className="px-2 py-1 bg-[#242424] border border-[#3a3a3a] rounded text-xs font-mono">⌘K</kbd>
            </button>
          </div>

          <div className="flex items-center space-x-2">
            <button className="p-1.5 rounded hover:bg-[#2a2a2a] text-[#a1a1a1] hover:text-[#ededed] transition-colors relative">
              <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 17h5l-1.405-1.405A2.032 2.032 0 0118 14.158V11a6.002 6.002 0 00-4-5.659V5a2 2 0 10-4 0v.341C7.67 6.165 6 8.388 6 11v3.159c0 .538-.214 1.055-.595 1.436L4 17h5m6 0v1a3 3 0 11-6 0v-1m6 0H9" />
              </svg>
              <span className="absolute top-0.5 right-0.5 w-1.5 h-1.5 bg-orange-500 rounded-full"></span>
            </button>

            <button className="p-1.5 rounded hover:bg-[#2a2a2a] text-[#a1a1a1] hover:text-[#ededed] transition-colors">
              <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8.228 9c.549-1.165 2.03-2 3.772-2 2.21 0 4 1.343 4 3 0 1.4-1.278 2.575-3.006 2.907-.542.104-.994.54-.994 1.093m0 3h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
              </svg>
            </button>

            <div className="h-4 w-px bg-[#2a2a2a]"></div>

            {user && (
              <div className="flex items-center space-x-2">
                <span className="text-xs text-[#a1a1a1]">{user.email}</span>
                <button
                  onClick={handleLogout}
                  className="px-2 py-1 text-xs font-medium text-[#a1a1a1] hover:text-red-400 transition-colors"
                >
                  Sign out
                </button>
              </div>
            )}
          </div>
        </header>

        {/* Page content */}
        <main className="flex-1 overflow-auto bg-[#1c1c1c]">
          {children}
        </main>
      </div>

      {/* Command Palette Modal */}
      {showCommandPalette && (
        <div className="fixed inset-0 bg-black/60 backdrop-blur-sm z-50 flex items-start justify-center pt-20" onClick={() => setShowCommandPalette(false)}>
          <div className="bg-[#181818] border border-[#2a2a2a] rounded-lg shadow-2xl w-full max-w-2xl" onClick={(e) => e.stopPropagation()}>
            <div className="p-3 border-b border-[#2a2a2a]">
              <input
                type="text"
                placeholder="Search or jump to..."
                autoFocus
                className="w-full bg-transparent text-sm text-[#ededed] placeholder-[#6b6b6b] focus:outline-none"
              />
            </div>
            <div className="p-2 max-h-96 overflow-y-auto">
              {[...navigation, ...secondaryNav].map((item) => (
                <Link
                  key={item.name}
                  href={item.href}
                  onClick={() => setShowCommandPalette(false)}
                  className="flex items-center space-x-3 px-3 py-2 rounded hover:bg-[#2a2a2a] text-[#a1a1a1] hover:text-[#ededed] transition-colors"
                >
                  {item.icon}
                  <span className="text-sm">{item.name}</span>
                </Link>
              ))}
            </div>
            <div className="p-2 border-t border-[#2a2a2a] flex items-center justify-between text-[10px] text-[#6b6b6b]">
              <span>Navigate with ↑↓</span>
              <span>Press ESC to close</span>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
