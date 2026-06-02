"use client";

import { useState, useEffect } from "react";
import { config } from "@/lib/config";


const API_BASE_URL = config.api.baseUrl;

interface PerformanceMetrics {
  queries_per_sec: number;
  avg_response_time_ms: number;
  total_queries_today: number;
  slow_queries_count: number;
  cpu_usage_percent: number;
  memory_usage_percent: number;
  active_connections: number;
  timestamp: string;
}

interface SlowQuery {
  id: string;
  query: string;
  execution_time_ms: number;
  rows_examined: number;
  timestamp: string;
}

interface UserQueryStats {
  account: {
    type: string;
    display_name: string;
    status: string;
  };
  limits: {
    api_requests_limit: number;
    api_requests_used: number;
    api_requests_remaining: number;
    usage_percentage: number;
  };
  queries: {
    total_all_time: number;
    today: number;
    this_week: number;
    this_month: number;
    success_count: number;
    failed_count: number;
    avg_execution_time_ms: number;
  };
  top_projects: Array<{
    id: string;
    name: string;
    query_count: number;
  }>;
  daily_trend: Array<{
    date: string;
    count: number;
  }>;
}

export default function AnalyticsPage() {
  const [metrics, setMetrics] = useState<PerformanceMetrics | null>(null);
  const [slowQueries, setSlowQueries] = useState<SlowQuery[]>([]);
  const [userStats, setUserStats] = useState<UserQueryStats | null>(null);
  const [loading, setLoading] = useState(true);
  const [selectedProject, setSelectedProject] = useState<string>("");
  const [projects, setProjects] = useState<any[]>([]);
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [activeTab, setActiveTab] = useState<"project" | "account">("account");

  useEffect(() => {
    fetchProjects();
    fetchUserStats();
  }, []);

  useEffect(() => {
    if (selectedProject && activeTab === "project") {
      fetchMetrics();
      fetchSlowQueries();
      
      // Auto-refresh every 5 seconds
      const interval = setInterval(() => {
        fetchMetrics();
      }, 5000);
      
      return () => clearInterval(interval);
    }
  }, [selectedProject, activeTab]);

  const fetchProjects = async () => {
    try {
      const token = localStorage.getItem("token");
      if (!token) {
        console.log("No token found");
        setLoading(false);
        return;
      }
      
      const response = await fetch(`${API_BASE_URL}/api/projects`, {
        headers: { Authorization: `Bearer ${token}` },
      });
      
      if (response.status === 401) {
        console.log("Unauthorized");
        setLoading(false);
        return;
      }
      
      if (response.ok) {
        const data = await response.json();
        setProjects(data);
        if (data.length > 0) {
          setSelectedProject(data[0].id);
        } else {
          setLoading(false);
        }
      } else {
        setLoading(false);
      }
    } catch (error) {
      console.error("Failed to fetch projects:", error);
      setLoading(false);
    }
  };

  const fetchMetrics = async () => {
    if (!selectedProject) return;
    
    setIsRefreshing(true);
    try {
      const token = localStorage.getItem("token");
      const response = await fetch(
        `${API_BASE_URL}/api/projects/${selectedProject}/analytics/performance`,
        {
          headers: { Authorization: `Bearer ${token}` },
        }
      );
      
      if (response.ok) {
        const data = await response.json();
        setMetrics(data);
      }
    } catch (error) {
      console.error("Failed to fetch metrics:", error);
    } finally {
      setLoading(false);
      setIsRefreshing(false);
    }
  };

  const fetchSlowQueries = async () => {
    if (!selectedProject) return;
    
    try {
      const token = localStorage.getItem("token");
      const response = await fetch(
        `${API_BASE_URL}/api/projects/${selectedProject}/analytics/slow-queries?limit=10`,
        {
          headers: { Authorization: `Bearer ${token}` },
        }
      );
      
      if (response.ok) {
        const data = await response.json();
        setSlowQueries(data.slow_queries);
      }
    } catch (error) {
      console.error("Failed to fetch slow queries:", error);
    }
  };

  const fetchUserStats = async () => {
    try {
      const token = localStorage.getItem("token");
      if (!token) {
        console.log("No token found, redirecting to login");
        window.location.href = "/login";
        return;
      }
      
      const response = await fetch(
        `${API_BASE_URL}/api/analytics/user-stats`,
        {
          headers: { Authorization: `Bearer ${token}` },
        }
      );
      
      if (response.status === 401) {
        console.log("Unauthorized, redirecting to login");
        localStorage.removeItem("token");
        window.location.href = "/login";
        return;
      }
      
      if (response.ok) {
        const data = await response.json();
        setUserStats(data);
      } else {
        console.error("Failed to fetch user stats:", response.status);
      }
    } catch (error) {
      console.error("Failed to fetch user stats:", error);
    } finally {
      setLoading(false);
    }
  };

  if (loading) {
    return (
      <div className="flex flex-col items-center justify-center h-screen">
        <div className="text-gray-400 mb-4">Loading analytics...</div>
        <div className="text-sm text-gray-600">
          If this takes too long, you may need to <a href="/login" className="text-orange-500 hover:underline">login again</a>
        </div>
      </div>
    );
  }

  if (projects.length === 0) {
    return (
      <div className="flex items-center justify-center h-screen">
        <div className="text-center">
          <svg
            className="mx-auto h-12 w-12 text-gray-600 mb-4"
            fill="none"
            viewBox="0 0 24 24"
            stroke="currentColor"
          >
            <path
              strokeLinecap="round"
              strokeLinejoin="round"
              strokeWidth={2}
              d="M9 19v-6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2a2 2 0 002-2zm0 0V9a2 2 0 012-2h2a2 2 0 012 2v10m-6 0a2 2 0 002 2h2a2 2 0 002-2m0 0V5a2 2 0 012-2h2a2 2 0 012 2v14a2 2 0 01-2 2h-2a2 2 0 01-2-2z"
            />
          </svg>
          <h3 className="text-lg font-medium text-white mb-2">No Projects Found</h3>
          <p className="text-gray-400 mb-4">Create a project to view analytics</p>
          <a
            href="/dashboard/projects"
            className="inline-flex items-center px-4 py-2 bg-orange-600 text-white rounded-lg hover:bg-orange-700"
          >
            Create Project
          </a>
        </div>
      </div>
    );
  }

  return (
    <div className="p-6 space-y-6 max-w-7xl">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center space-x-3">
          <div>
            <h1 className="text-xl font-semibold text-[#ededed]">Performance Analytics</h1>
            <p className="text-xs text-[#a1a1a1] mt-1">Monitor your database performance and query usage</p>
          </div>
          {/* Live Indicator */}
          {activeTab === "project" && (
            <div className="flex items-center space-x-2 px-3 py-1 bg-[#1c1c1c] border border-[#2a2a2a] rounded-full">
              <div className={`w-2 h-2 rounded-full ${isRefreshing ? 'bg-orange-500 animate-pulse' : 'bg-green-500'}`}></div>
              <span className="text-xs text-[#a1a1a1]">LIVE</span>
            </div>
          )}
        </div>
        
        {/* Project Selector - only show in project tab */}
        {activeTab === "project" && (
          <select
            value={selectedProject}
            onChange={(e) => setSelectedProject(e.target.value)}
            className="px-3 py-1.5 bg-[#1c1c1c] border border-[#2a2a2a] rounded text-xs text-[#ededed] focus:outline-none focus:border-orange-600"
          >
            {projects.map((project) => (
              <option key={project.id} value={project.id}>
                {project.name}
              </option>
            ))}
          </select>
        )}
      </div>

      {/* Tabs */}
      <div className="flex space-x-2 border-b border-[#2a2a2a]">
        <button
          onClick={() => setActiveTab("account")}
          className={`px-4 py-2 text-sm font-medium transition-colors ${
            activeTab === "account"
              ? "text-orange-500 border-b-2 border-orange-500"
              : "text-[#a1a1a1] hover:text-[#ededed]"
          }`}
        >
          Account Usage
        </button>
        <button
          onClick={() => setActiveTab("project")}
          className={`px-4 py-2 text-sm font-medium transition-colors ${
            activeTab === "project"
              ? "text-orange-500 border-b-2 border-orange-500"
              : "text-[#a1a1a1] hover:text-[#ededed]"
          }`}
        >
          Project Performance
        </button>
      </div>

      {/* Account Usage Tab */}
      {activeTab === "account" && userStats && (
        <div className="space-y-6">
          {/* Account Info Card */}
          <div className="bg-gradient-to-r from-orange-600/10 to-orange-500/5 border border-orange-500/20 rounded-lg p-6">
            <div className="flex items-center justify-between">
              <div>
                <div className="flex items-center space-x-3">
                  <h2 className="text-2xl font-bold text-[#ededed]">{userStats.account.display_name}</h2>
                  <span className={`px-3 py-1 rounded-full text-xs font-medium ${
                    userStats.account.type === 'free' ? 'bg-gray-600 text-white' :
                    userStats.account.type === 'pro' ? 'bg-blue-600 text-white' :
                    'bg-purple-600 text-white'
                  }`}>
                    {userStats.account.type.toUpperCase()}
                  </span>
                </div>
                <p className="text-sm text-[#a1a1a1] mt-1">Status: {userStats.account.status}</p>
              </div>
              <a
                href="/dashboard/billing"
                className="px-4 py-2 bg-orange-600 text-white text-sm rounded-lg hover:bg-orange-700 transition-colors"
              >
                Manage Plan
              </a>
            </div>
          </div>

          {/* Query Stats Grid */}
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
            {/* Total Queries */}
            <div className="bg-[#1c1c1c] border border-[#2a2a2a] rounded-lg p-4">
              <div className="text-[#a1a1a1] text-xs mb-2">Total Queries (All Time)</div>
              <div className="text-3xl font-bold text-[#ededed]">
                {userStats.queries.total_all_time.toLocaleString()}
              </div>
            </div>

            {/* Today */}
            <div className="bg-[#1c1c1c] border border-[#2a2a2a] rounded-lg p-4">
              <div className="text-[#a1a1a1] text-xs mb-2">Queries Today</div>
              <div className="text-3xl font-bold text-[#ededed]">
                {userStats.queries.today.toLocaleString()}
              </div>
            </div>

            {/* This Week */}
            <div className="bg-[#1c1c1c] border border-[#2a2a2a] rounded-lg p-4">
              <div className="text-[#a1a1a1] text-xs mb-2">This Week</div>
              <div className="text-3xl font-bold text-[#ededed]">
                {userStats.queries.this_week.toLocaleString()}
              </div>
            </div>

            {/* This Month */}
            <div className="bg-[#1c1c1c] border border-[#2a2a2a] rounded-lg p-4">
              <div className="text-[#a1a1a1] text-xs mb-2">This Month</div>
              <div className="text-3xl font-bold text-[#ededed]">
                {userStats.queries.this_month.toLocaleString()}
              </div>
            </div>
          </div>

          {/* API Quota Usage */}
          <div className="bg-[#1c1c1c] border border-[#2a2a2a] rounded-lg p-6">
            <div className="flex items-center justify-between mb-4">
              <h3 className="text-lg font-semibold text-[#ededed]">API Request Quota</h3>
              <span className="text-sm text-[#a1a1a1]">
                {userStats.limits.api_requests_used.toLocaleString()} / {userStats.limits.api_requests_limit.toLocaleString()}
              </span>
            </div>
            <div className="bg-[#0a0a0a] rounded-full h-4 mb-2">
              <div
                className={`h-4 rounded-full transition-all ${
                  userStats.limits.usage_percentage >= 90 ? 'bg-red-600' :
                  userStats.limits.usage_percentage >= 75 ? 'bg-orange-600' :
                  'bg-green-600'
                }`}
                style={{ width: `${Math.min(userStats.limits.usage_percentage, 100)}%` }}
              />
            </div>
            <div className="flex items-center justify-between text-xs">
              <span className="text-[#a1a1a1]">
                {userStats.limits.api_requests_remaining.toLocaleString()} requests remaining
              </span>
              <span className={`font-medium ${
                userStats.limits.usage_percentage >= 90 ? 'text-red-500' :
                userStats.limits.usage_percentage >= 75 ? 'text-orange-500' :
                'text-green-500'
              }`}>
                {userStats.limits.usage_percentage.toFixed(1)}% used
              </span>
            </div>
          </div>

          {/* Query Performance */}
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <div className="bg-[#1c1c1c] border border-[#2a2a2a] rounded-lg p-4">
              <div className="text-[#a1a1a1] text-xs mb-2">Success Rate</div>
              <div className="text-2xl font-bold text-green-500">
                {userStats.queries.success_count + userStats.queries.failed_count > 0
                  ? ((userStats.queries.success_count / (userStats.queries.success_count + userStats.queries.failed_count)) * 100).toFixed(1)
                  : 0}%
              </div>
              <div className="text-xs text-[#666] mt-1">
                {userStats.queries.success_count.toLocaleString()} successful
              </div>
            </div>

            <div className="bg-[#1c1c1c] border border-[#2a2a2a] rounded-lg p-4">
              <div className="text-[#a1a1a1] text-xs mb-2">Failed Queries</div>
              <div className="text-2xl font-bold text-red-500">
                {userStats.queries.failed_count.toLocaleString()}
              </div>
              <div className="text-xs text-[#666] mt-1">Last 30 days</div>
            </div>

            <div className="bg-[#1c1c1c] border border-[#2a2a2a] rounded-lg p-4">
              <div className="text-[#a1a1a1] text-xs mb-2">Avg Execution Time</div>
              <div className="text-2xl font-bold text-[#ededed]">
                {userStats.queries.avg_execution_time_ms}
                <span className="text-sm text-[#a1a1a1]">ms</span>
              </div>
              <div className="text-xs text-[#666] mt-1">Last 30 days</div>
            </div>
          </div>

          {/* Top Projects */}
          <div className="bg-[#1c1c1c] border border-[#2a2a2a] rounded-lg p-6">
            <h3 className="text-lg font-semibold text-[#ededed] mb-4">Most Active Projects</h3>
            <div className="space-y-3">
              {userStats.top_projects.map((project, index) => (
                <div key={project.id} className="flex items-center justify-between p-3 bg-[#0a0a0a] rounded-lg">
                  <div className="flex items-center space-x-3">
                    <span className="text-[#666] font-mono text-sm">#{index + 1}</span>
                    <span className="text-[#ededed] font-medium">{project.name}</span>
                  </div>
                  <span className="text-orange-500 font-medium">
                    {project.query_count.toLocaleString()} queries
                  </span>
                </div>
              ))}
              {userStats.top_projects.length === 0 && (
                <div className="text-center py-8 text-[#a1a1a1]">
                  No project activity yet
                </div>
              )}
            </div>
          </div>
        </div>
      )}

      {/* Project Performance Tab */}
      {activeTab === "project" && projects.length > 0 && (
        <div className="space-y-6">
          {/* Metrics Grid */}
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
        {/* Queries/sec */}
        <div className="bg-[#1c1c1c] border border-[#2a2a2a] rounded-lg p-4">
          <div className="flex items-center justify-between mb-2">
            <div className="text-[#a1a1a1] text-xs">Queries/sec</div>
            <svg className="w-5 h-5 text-orange-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 10V3L4 14h7v7l9-11h-7z" />
            </svg>
          </div>
          <div className="text-3xl font-bold text-[#ededed]">
            {metrics?.queries_per_sec || 0}
          </div>
          <div className="text-[10px] text-[#666] mt-2">Last minute average</div>
        </div>

        {/* Avg Response Time */}
        <div className="bg-[#1c1c1c] border border-[#2a2a2a] rounded-lg p-4">
          <div className="flex items-center justify-between mb-2">
            <div className="text-[#a1a1a1] text-xs">Avg Response Time</div>
            <svg className="w-5 h-5 text-blue-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" />
            </svg>
          </div>
          <div className="text-3xl font-bold text-[#ededed]">
            {metrics?.avg_response_time_ms || 0}
            <span className="text-lg text-[#a1a1a1]">ms</span>
          </div>
          <div className="text-[10px] text-[#666] mt-2">Last hour average</div>
        </div>

        {/* Total Queries Today */}
        <div className="bg-[#1c1c1c] border border-[#2a2a2a] rounded-lg p-4">
          <div className="flex items-center justify-between mb-2">
            <div className="text-[#a1a1a1] text-xs">Total Queries Today</div>
            <svg className="w-5 h-5 text-green-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 19v-6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2a2 2 0 002-2zm0 0V9a2 2 0 012-2h2a2 2 0 012 2v10m-6 0a2 2 0 002 2h2a2 2 0 002-2m0 0V5a2 2 0 012-2h2a2 2 0 012 2v14a2 2 0 01-2 2h-2a2 2 0 01-2-2z" />
            </svg>
          </div>
          <div className="text-3xl font-bold text-[#ededed]">
            {metrics?.total_queries_today || 0}
          </div>
          <div className="text-[10px] text-[#666] mt-2">Since midnight</div>
        </div>

        {/* Slow Queries */}
        <div className="bg-[#1c1c1c] border border-[#2a2a2a] rounded-lg p-4">
          <div className="flex items-center justify-between mb-2">
            <div className="text-[#a1a1a1] text-xs">Slow Queries</div>
            <svg className="w-5 h-5 text-orange-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
            </svg>
          </div>
          <div className="text-3xl font-bold text-orange-500">
            {metrics?.slow_queries_count || 0}
          </div>
          <div className="text-[10px] text-[#666] mt-2">&gt;500ms today</div>
        </div>
      </div>

      {/* Resource Usage */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        {/* CPU Usage */}
        <div className="bg-[#1c1c1c] border border-[#2a2a2a] rounded-lg p-4">
          <div className="flex items-center justify-between mb-3">
            <div className="text-[#a1a1a1] text-xs">CPU Usage</div>
            <svg className="w-5 h-5 text-orange-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 3v2m6-2v2M9 19v2m6-2v2M5 9H3m2 6H3m18-6h-2m2 6h-2M7 19h10a2 2 0 002-2V7a2 2 0 00-2-2H7a2 2 0 00-2 2v10a2 2 0 002 2zM9 9h6v6H9V9z" />
            </svg>
          </div>
          <div className="flex items-end space-x-2">
            <div className="text-2xl font-bold text-[#ededed]">
              {metrics?.cpu_usage_percent || 0}%
            </div>
          </div>
          <div className="mt-3 bg-[#0a0a0a] rounded-full h-2">
            <div
              className="bg-orange-600 h-2 rounded-full transition-all"
              style={{ width: `${metrics?.cpu_usage_percent || 0}%` }}
            />
          </div>
        </div>

        {/* Memory Usage */}
        <div className="bg-[#1c1c1c] border border-[#2a2a2a] rounded-lg p-4">
          <div className="flex items-center justify-between mb-3">
            <div className="text-[#a1a1a1] text-xs">Memory Usage</div>
            <svg className="w-5 h-5 text-purple-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 11H5m14 0a2 2 0 012 2v6a2 2 0 01-2 2H5a2 2 0 01-2-2v-6a2 2 0 012-2m14 0V9a2 2 0 00-2-2M5 11V9a2 2 0 012-2m0 0V5a2 2 0 012-2h6a2 2 0 012 2v2M7 7h10" />
            </svg>
          </div>
          <div className="flex items-end space-x-2">
            <div className="text-2xl font-bold text-[#ededed]">
              {metrics?.memory_usage_percent || 0}%
            </div>
          </div>
          <div className="mt-3 bg-[#0a0a0a] rounded-full h-2">
            <div
              className="bg-orange-600 h-2 rounded-full transition-all"
              style={{ width: `${metrics?.memory_usage_percent || 0}%` }}
            />
          </div>
        </div>

        {/* Active Connections */}
        <div className="bg-[#1c1c1c] border border-[#2a2a2a] rounded-lg p-4">
          <div className="flex items-center justify-between mb-3">
            <div className="text-[#a1a1a1] text-xs">Active Connections</div>
            <svg className="w-5 h-5 text-cyan-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13.828 10.172a4 4 0 00-5.656 0l-4 4a4 4 0 105.656 5.656l1.102-1.101m-.758-4.899a4 4 0 005.656 0l4-4a4 4 0 00-5.656-5.656l-1.1 1.1" />
            </svg>
          </div>
          <div className="flex items-end space-x-2">
            <div className="text-2xl font-bold text-[#ededed]">
              {metrics?.active_connections || 0}
            </div>
            <div className="text-[#a1a1a1] text-xs mb-1">connections</div>
          </div>
        </div>
      </div>

      {/* Slow Query Log */}
      <div className="bg-[#1c1c1c] border border-[#2a2a2a] rounded-lg p-4">
        <h2 className="text-lg font-semibold text-[#ededed] mb-4">Slow Query Log</h2>
        
        {slowQueries.length === 0 ? (
          <div className="text-center py-12 text-[#a1a1a1]">
            <svg
              className="mx-auto h-12 w-12 text-[#2a2a2a] mb-4"
              fill="none"
              viewBox="0 0 24 24"
              stroke="currentColor"
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth={2}
                d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z"
              />
            </svg>
            <p className="text-sm font-medium">No slow queries detected</p>
            <p className="text-xs mt-1">All queries are performing well!</p>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full">
              <thead>
                <tr className="border-b border-[#2a2a2a]">
                  <th className="text-left py-3 px-4 text-[#a1a1a1] font-medium text-xs">Query</th>
                  <th className="text-left py-3 px-4 text-[#a1a1a1] font-medium text-xs">Execution Time</th>
                  <th className="text-left py-3 px-4 text-[#a1a1a1] font-medium text-xs">Rows Examined</th>
                  <th className="text-left py-3 px-4 text-[#a1a1a1] font-medium text-xs">Timestamp</th>
                </tr>
              </thead>
              <tbody>
                {slowQueries.map((query) => (
                  <tr key={query.id} className="border-b border-[#2a2a2a] hover:bg-[#0a0a0a]">
                    <td className="py-3 px-4">
                      <code className="text-xs text-[#ededed] bg-black px-2 py-1 rounded">
                        {query.query}
                      </code>
                    </td>
                    <td className="py-3 px-4">
                      <span className="text-orange-500 font-medium text-xs">
                        {query.execution_time_ms}ms
                      </span>
                    </td>
                    <td className="py-3 px-4 text-[#ededed] text-xs">
                      {query.rows_examined.toLocaleString()}
                    </td>
                    <td className="py-3 px-4 text-[#a1a1a1] text-xs">
                      {new Date(query.timestamp).toLocaleString()}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
        </div>
      )}

      {/* Auto-refresh indicator */}
      {activeTab === "project" && (
        <div className="text-center text-[#666] text-xs">
          Auto-refreshing every 5 seconds • Last updated: {metrics?.timestamp ? new Date(metrics.timestamp).toLocaleTimeString() : 'Never'}
        </div>
      )}
    </div>
  );
}
