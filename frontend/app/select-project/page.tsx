'use client';

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { apiFetch } from '@/lib/fetch-utils';

interface Project {
  id: string;
  name: string;
  slug?: string;
  database_name: string;
  region: string;
  status: string;
  created_at: string;
  description?: string;
}

export default function SelectProjectPage() {
  const [projects, setProjects] = useState<Project[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [user, setUser] = useState<any>(null);
  const router = useRouter();

  useEffect(() => {
    fetchUserAndProjects();
  }, []);

  const fetchUserAndProjects = async () => {
    try {
      const token = localStorage.getItem('token');
      if (!token) {
        router.push('/login');
        return;
      }

      // Fetch user info
      const userResponse = await apiFetch('api/auth/me');
      if (!userResponse.ok) {
        localStorage.removeItem('token');
        router.push('/login');
        return;
      }
      const userData = await userResponse.json();
      setUser(userData);

      // Fetch projects
      const projectsResponse = await apiFetch('api/projects');
      if (projectsResponse.ok) {
        const projectsData = await projectsResponse.json();
        setProjects(projectsData);
        
        // If no projects, redirect to onboarding
        if (projectsData.length === 0) {
          router.push('/onboarding');
          return;
        }
      }
    } catch (error) {
      console.error('Error fetching data:', error);
      router.push('/login');
    } finally {
      setIsLoading(false);
    }
  };

  const handleProjectSelect = (project: Project) => {
    // Set the selected project in localStorage
    localStorage.setItem('current_project_id', project.id);
    if (project.slug) {
      localStorage.setItem('current_project_slug', project.slug);
    }
    
    // Redirect to dashboard
    window.location.href = '/dashboard';
  };

  const handleLogout = () => {
    localStorage.removeItem('token');
    localStorage.removeItem('user_id');
    localStorage.removeItem('user_email');
    localStorage.removeItem('user');
    localStorage.removeItem('current_project_id');
    localStorage.removeItem('current_project_slug');
    router.push('/login');
  };

  const formatDate = (dateString: string) => {
    return new Date(dateString).toLocaleDateString('en-US', {
      month: 'short',
      day: 'numeric',
      year: 'numeric'
    });
  };

  if (isLoading) {
    return (
      <div className="min-h-screen bg-black flex items-center justify-center">
        <div className="text-center">
          <div className="w-8 h-8 border-2 border-orange-500 border-t-transparent rounded-full animate-spin mx-auto mb-4"></div>
          <p className="text-[#a1a1a1]">Loading your projects...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-black">
      {/* Header */}
      <header className="border-b border-[#1a1a1a] bg-[#0a0a0a]">
        <div className="max-w-7xl mx-auto px-6 py-4 flex items-center justify-between">
          {/* Logo */}
          <div className="flex items-center space-x-3">
            <img src="/logo.png" alt="ZENDBX" className="h-8 w-auto" />
          </div>

          {/* User menu */}
          <div className="flex items-center space-x-4">
            <div className="flex items-center space-x-3">
              <div className="w-8 h-8 bg-gradient-to-br from-orange-500 to-orange-600 rounded-full flex items-center justify-center">
                <span className="text-white text-sm font-semibold">
                  {user?.full_name?.split(' ').map((n: string) => n[0]).join('').toUpperCase() || 'U'}
                </span>
              </div>
              <span className="text-[#a1a1a1] text-sm">{user?.email}</span>
            </div>
            <button 
              onClick={handleLogout}
              className="text-[#a1a1a1] hover:text-white text-sm transition-colors"
            >
              Logout
            </button>
          </div>
        </div>
      </header>

      {/* Main content */}
      <main className="max-w-7xl mx-auto px-6 py-12">
        <div className="text-center mb-12">
          <h1 className="text-3xl font-bold text-white mb-3">Your Projects</h1>
          <p className="text-[#a1a1a1] text-lg">Manage your PostgreSQL databases</p>
        </div>

        {/* Projects grid */}
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6 max-w-6xl mx-auto">
          {projects.map((project) => (
            <div
              key={project.id}
              onClick={() => handleProjectSelect(project)}
              className="bg-[#111111] border border-[#1a1a1a] rounded-xl p-6 hover:border-[#2a2a2a] transition-all cursor-pointer group hover:bg-[#161616]"
            >
              {/* Project icon and status */}
              <div className="flex items-start justify-between mb-4">
                <div className="w-12 h-12 bg-gradient-to-br from-orange-500 to-orange-600 rounded-lg flex items-center justify-center">
                  <svg className="w-6 h-6 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 7v10c0 2.21 3.582 4 8 4s8-1.79 8-4V7M4 7c0 2.21 3.582 4 8 4s8-1.79 8-4M4 7c0-2.21 3.582-4 8-4s8 1.79 8 4" />
                  </svg>
                </div>
                
                <div className="flex items-center space-x-2">
                  <div className={`w-2 h-2 rounded-full ${
                    project.status === 'active' ? 'bg-green-500' : 'bg-yellow-500'
                  }`}></div>
                  <span className={`text-xs font-medium ${
                    project.status === 'active' ? 'text-green-500' : 'text-yellow-500'
                  }`}>
                    {project.status === 'active' ? 'Active' : 'Starting'}
                  </span>
                </div>
              </div>

              {/* Project name */}
              <h3 className="text-xl font-semibold text-white mb-2 group-hover:text-orange-500 transition-colors">
                {project.name}
              </h3>

              {/* Project description */}
              {project.description && (
                <p className="text-[#6b6b6b] text-sm mb-4 line-clamp-2">
                  {project.description}
                </p>
              )}

              {/* Project metadata */}
              <div className="space-y-2 mb-4">
                <div className="flex items-center justify-between text-xs">
                  <span className="text-[#6b6b6b]">Database</span>
                  <span className="text-[#a1a1a1] font-mono">{project.database_name}</span>
                </div>
                <div className="flex items-center justify-between text-xs">
                  <span className="text-[#6b6b6b]">Region</span>
                  <span className="text-[#a1a1a1]">{project.region}</span>
                </div>
                <div className="flex items-center justify-between text-xs">
                  <span className="text-[#6b6b6b]">Created</span>
                  <span className="text-[#a1a1a1]">{formatDate(project.created_at)}</span>
                </div>
              </div>

              {/* Plan badge */}
              <div className="flex items-center justify-between">
                <span className="px-2 py-1 bg-orange-500/10 text-orange-500 text-xs font-medium rounded-md border border-orange-500/20">
                  FREE
                </span>
                
                {/* Click indicator */}
                <div className="opacity-0 group-hover:opacity-100 transition-opacity">
                  <svg className="w-4 h-4 text-orange-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
                  </svg>
                </div>
              </div>
            </div>
          ))}

          {/* New Project Card */}
          <div
            onClick={() => router.push('/onboarding')}
            className="bg-[#111111] border-2 border-dashed border-[#1a1a1a] rounded-xl p-6 hover:border-[#2a2a2a] transition-all cursor-pointer group hover:bg-[#161616] flex flex-col items-center justify-center text-center min-h-[280px]"
          >
            <div className="w-12 h-12 bg-[#1a1a1a] rounded-lg flex items-center justify-center mb-4 group-hover:bg-[#2a2a2a] transition-colors">
              <svg className="w-6 h-6 text-[#6b6b6b] group-hover:text-orange-500 transition-colors" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
              </svg>
            </div>
            <h3 className="text-lg font-semibold text-[#a1a1a1] group-hover:text-white transition-colors mb-2">
              New Project
            </h3>
            <p className="text-[#6b6b6b] text-sm">
              Create a new PostgreSQL database
            </p>
          </div>
        </div>
      </main>
    </div>
  );
}