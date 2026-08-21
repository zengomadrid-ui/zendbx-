"use client";

import { useState, useEffect } from "react";
import { apiFetch } from "@/lib/fetch-utils";
import { useRouter } from "next/navigation";

interface Dashboard {
  id: string;
  name: string;
  description: string | null;
  created_at: string;
  updated_at: string;
}

export default function VisualizerPage() {
  const router = useRouter();
  const [dashboards, setDashboards] = useState<Dashboard[]>([]);
  const [loading, setLoading] = useState(true);
  const [showNewDashboard, setShowNewDashboard] = useState(false);
  const [newDashboardName, setNewDashboardName] = useState("");
  const [newDashboardDesc, setNewDashboardDesc] = useState("");
  const [creating, setCreating] = useState(false);

  useEffect(() => {
    loadDashboards();
  }, []);

  const loadDashboards = async () => {
    try {
      const projectId = localStorage.getItem("current_project_id");
      const response = await apiFetch(
        `/api/visualizer/projects/${projectId}/dashboards`
      );

      if (response.ok) {
        const data = await response.json();
        setDashboards(data.dashboards || []);
      }
    } catch (error) {
      console.error("Failed to load dashboards:", error);
    } finally {
      setLoading(false);
    }
  };

  const createDashboard = async () => {
    if (!newDashboardName.trim()) return;

    setCreating(true);
    try {
      const projectId = localStorage.getItem("current_project_id");
      const response = await apiFetch(
        `/api/visualizer/projects/${projectId}/dashboards`,
        {
          method: "POST",
          body: JSON.stringify({
            name: newDashboardName,
            description: newDashboardDesc || null,
          }),
        }
      );

      if (response.ok) {
        const dashboard = await response.json();
        router.push(`/dashboard/visualizer/${dashboard.id}`);
      }
    } catch (error) {
      console.error("Failed to create dashboard:", error);
    } finally {
      setCreating(false);
    }
  };

  const deleteDashboard = async (dashboardId: string) => {
    if (!confirm("Are you sure you want to delete this dashboard?")) return;

    try {
      const projectId = localStorage.getItem("current_project_id");
      const response = await apiFetch(
        `/api/visualizer/projects/${projectId}/dashboards/${dashboardId}`,
        { method: "DELETE" }
      );

      if (response.ok) {
        setDashboards(dashboards.filter((d) => d.id !== dashboardId));
      }
    } catch (error) {
      console.error("Failed to delete dashboard:", error);
    }
  };

  if (loading) {
    return (
      <div className="h-full flex items-center justify-center bg-[#0a0a0a]">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-orange-500 mx-auto mb-4"></div>
          <div className="text-gray-400">Loading dashboards...</div>
        </div>
      </div>
    );
  }

  return (
    <div className="h-full bg-[#0a0a0a] text-white overflow-auto">
      {/* Header */}
      <div className="border-b border-[#2a2a2a] bg-[#0a0a0a] sticky top-0 z-10">
        <div className="px-6 py-4">
          <div className="flex items-center justify-between">
            <div>
              <h1 className="text-2xl font-bold text-white">Data Visualizer</h1>
              <p className="text-sm text-gray-500 mt-1">
                Turn your data into interactive charts and dashboards
              </p>
            </div>
            <button
              onClick={() => setShowNewDashboard(true)}
              className="px-4 py-2 bg-orange-500 hover:bg-orange-600 text-white rounded-lg transition-colors flex items-center gap-2"
            >
              <svg
                className="w-5 h-5"
                fill="none"
                stroke="currentColor"
                viewBox="0 0 24 24"
              >
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth={2}
                  d="M12 4v16m8-8H4"
                />
              </svg>
              New Dashboard
            </button>
          </div>
        </div>
      </div>

      {/* New Dashboard Modal */}
      {showNewDashboard && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50">
          <div className="bg-[#141414] border border-[#2a2a2a] rounded-lg p-6 w-full max-w-md">
            <h2 className="text-lg font-semibold mb-4">Create New Dashboard</h2>
            <div className="space-y-4">
              <div>
                <label className="block text-sm text-gray-400 mb-2">
                  Name *
                </label>
                <input
                  type="text"
                  value={newDashboardName}
                  onChange={(e) => setNewDashboardName(e.target.value)}
                  placeholder="Sales Dashboard"
                  className="w-full px-3 py-2 bg-[#0a0a0a] border border-[#2a2a2a] rounded text-white placeholder-gray-600 focus:outline-none focus:border-orange-500"
                  autoFocus
                />
              </div>
              <div>
                <label className="block text-sm text-gray-400 mb-2">
                  Description
                </label>
                <textarea
                  value={newDashboardDesc}
                  onChange={(e) => setNewDashboardDesc(e.target.value)}
                  placeholder="Track sales metrics and revenue..."
                  className="w-full px-3 py-2 bg-[#0a0a0a] border border-[#2a2a2a] rounded text-white placeholder-gray-600 focus:outline-none focus:border-orange-500 h-20 resize-none"
                />
              </div>
            </div>
            <div className="flex gap-3 mt-6">
              <button
                onClick={() => {
                  setShowNewDashboard(false);
                  setNewDashboardName("");
                  setNewDashboardDesc("");
                }}
                className="flex-1 px-4 py-2 bg-[#1a1a1a] hover:bg-[#2a2a2a] border border-[#2a2a2a] rounded transition-colors"
              >
                Cancel
              </button>
              <button
                onClick={createDashboard}
                disabled={!newDashboardName.trim() || creating}
                className="flex-1 px-4 py-2 bg-orange-500 hover:bg-orange-600 disabled:bg-gray-700 disabled:cursor-not-allowed rounded transition-colors"
              >
                {creating ? "Creating..." : "Create"}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Content */}
      <div className="p-6">
        {dashboards.length === 0 ? (
          /* Empty State */
          <div className="flex flex-col items-center justify-center py-20">
            <svg
              className="w-20 h-20 text-gray-700 mb-4"
              fill="none"
              stroke="currentColor"
              viewBox="0 0 24 24"
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth={1}
                d="M9 19v-6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2a2 2 0 002-2zm0 0V9a2 2 0 012-2h2a2 2 0 012 2v10m-6 0a2 2 0 002 2h2a2 2 0 002-2m0 0V5a2 2 0 012-2h2a2 2 0 012 2v14a2 2 0 01-2 2h-2a2 2 0 01-2-2z"
              />
            </svg>
            <h3 className="text-xl font-semibold text-white mb-2">
              No Dashboards Yet
            </h3>
            <p className="text-gray-500 mb-6 text-center max-w-md">
              Create your first dashboard to start visualizing your data with
              interactive charts
            </p>
            <button
              onClick={() => setShowNewDashboard(true)}
              className="px-6 py-3 bg-orange-500 hover:bg-orange-600 rounded-lg transition-colors flex items-center gap-2"
            >
              <svg
                className="w-5 h-5"
                fill="none"
                stroke="currentColor"
                viewBox="0 0 24 24"
              >
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth={2}
                  d="M12 4v16m8-8H4"
                />
              </svg>
              Create Dashboard
            </button>
          </div>
        ) : (
          /* Dashboard Grid */
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
            {dashboards.map((dashboard) => (
              <div
                key={dashboard.id}
                className="bg-[#141414] border border-[#2a2a2a] rounded-lg p-6 hover:border-orange-500/50 transition-colors group cursor-pointer"
                onClick={() => router.push(`/dashboard/visualizer/${dashboard.id}`)}
              >
                <div className="flex items-start justify-between mb-4">
                  <div className="flex-1">
                    <h3 className="text-lg font-semibold text-white group-hover:text-orange-500 transition-colors">
                      {dashboard.name}
                    </h3>
                    {dashboard.description && (
                      <p className="text-sm text-gray-500 mt-1 line-clamp-2">
                        {dashboard.description}
                      </p>
                    )}
                  </div>
                  <button
                    onClick={(e) => {
                      e.stopPropagation();
                      deleteDashboard(dashboard.id);
                    }}
                    className="p-2 hover:bg-[#2a2a2a] rounded transition-colors opacity-0 group-hover:opacity-100"
                  >
                    <svg
                      className="w-4 h-4 text-gray-400 hover:text-red-500"
                      fill="none"
                      stroke="currentColor"
                      viewBox="0 0 24 24"
                    >
                      <path
                        strokeLinecap="round"
                        strokeLinejoin="round"
                        strokeWidth={2}
                        d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16"
                      />
                    </svg>
                  </button>
                </div>

                <div className="flex items-center gap-4 text-xs text-gray-600">
                  <span className="flex items-center gap-1">
                    <svg
                      className="w-3 h-3"
                      fill="none"
                      stroke="currentColor"
                      viewBox="0 0 24 24"
                    >
                      <path
                        strokeLinecap="round"
                        strokeLinejoin="round"
                        strokeWidth={2}
                        d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z"
                      />
                    </svg>
                    {new Date(dashboard.updated_at).toLocaleDateString()}
                  </span>
                </div>

                <div className="mt-4 flex items-center text-sm text-orange-500 opacity-0 group-hover:opacity-100 transition-opacity">
                  <span>Open Dashboard</span>
                  <svg
                    className="w-4 h-4 ml-1"
                    fill="none"
                    stroke="currentColor"
                    viewBox="0 0 24 24"
                  >
                    <path
                      strokeLinecap="round"
                      strokeLinejoin="round"
                      strokeWidth={2}
                      d="M9 5l7 7-7 7"
                    />
                  </svg>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
