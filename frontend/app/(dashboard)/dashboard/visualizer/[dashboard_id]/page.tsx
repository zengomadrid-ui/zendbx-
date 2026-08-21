"use client";

import { useState, useEffect } from "react";
import { apiFetch } from "@/lib/fetch-utils";
import { useParams, useRouter } from "next/navigation";
import VisualizerBuilder from "../components/VisualizerBuilder";
import ChartRenderer from "../components/ChartRenderer";

interface Chart {
  id: string;
  name: string;
  chart_type: string;
  configuration: any;
  position: any;
}

interface Dashboard {
  id: string;
  name: string;
  description: string | null;
  charts: Chart[];
}

export default function DashboardPage() {
  const params = useParams();
  const router = useRouter();
  const dashboardId = params.dashboard_id as string;

  const [dashboard, setDashboard] = useState<Dashboard | null>(null);
  const [loading, setLoading] = useState(true);
  const [showBuilder, setShowBuilder] = useState(false);
  const [editingChart, setEditingChart] = useState<Chart | null>(null);

  useEffect(() => {
    loadDashboard();
  }, [dashboardId]);

  const loadDashboard = async () => {
    try {
      const projectId = localStorage.getItem("current_project_id");
      const response = await apiFetch(
        `/api/visualizer/projects/${projectId}/dashboards/${dashboardId}`
      );

      if (response.ok) {
        const data = await response.json();
        setDashboard(data);
      }
    } catch (error) {
      console.error("Failed to load dashboard:", error);
    } finally {
      setLoading(false);
    }
  };

  const deleteChart = async (chartId: string) => {
    if (!confirm("Delete this chart?")) return;

    try {
      const projectId = localStorage.getItem("current_project_id");
      const response = await apiFetch(
        `/api/visualizer/projects/${projectId}/charts/${chartId}`,
        { method: "DELETE" }
      );

      if (response.ok) {
        loadDashboard();
      }
    } catch (error) {
      console.error("Failed to delete chart:", error);
    }
  };

  if (loading) {
    return (
      <div className="h-full flex items-center justify-center bg-[#0a0a0a]">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-orange-500 mx-auto mb-4"></div>
          <div className="text-gray-400">Loading dashboard...</div>
        </div>
      </div>
    );
  }

  if (!dashboard) {
    return (
      <div className="h-full flex items-center justify-center bg-[#0a0a0a]">
        <div className="text-center">
          <h2 className="text-xl font-semibold text-white mb-2">
            Dashboard Not Found
          </h2>
          <button
            onClick={() => router.push("/dashboard/visualizer")}
            className="text-orange-500 hover:text-orange-400"
          >
            ← Back to Dashboards
          </button>
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
              <button
                onClick={() => router.push("/dashboard/visualizer")}
                className="text-gray-500 hover:text-orange-500 mb-2 flex items-center gap-1 text-sm"
              >
                <svg
                  className="w-4 h-4"
                  fill="none"
                  stroke="currentColor"
                  viewBox="0 0 24 24"
                >
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    strokeWidth={2}
                    d="M15 19l-7-7 7-7"
                  />
                </svg>
                Back to Dashboards
              </button>
              <h1 className="text-2xl font-bold text-white">{dashboard.name}</h1>
              {dashboard.description && (
                <p className="text-sm text-gray-500 mt-1">
                  {dashboard.description}
                </p>
              )}
            </div>
            <div className="flex gap-3">
              <button
                onClick={() => loadDashboard()}
                className="px-4 py-2 bg-[#1a1a1a] hover:bg-[#2a2a2a] border border-[#2a2a2a] rounded-lg transition-colors flex items-center gap-2"
              >
                <svg
                  className="w-4 h-4"
                  fill="none"
                  stroke="currentColor"
                  viewBox="0 0 24 24"
                >
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    strokeWidth={2}
                    d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15"
                  />
                </svg>
                Refresh
              </button>
              <button
                onClick={() => {
                  setEditingChart(null);
                  setShowBuilder(true);
                }}
                className="px-4 py-2 bg-orange-500 hover:bg-orange-600 rounded-lg transition-colors flex items-center gap-2"
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
                Add Chart
              </button>
            </div>
          </div>
        </div>
      </div>

      {/* Content */}
      <div className="p-6 bg-[#0a0a0a] min-h-screen">
        {!dashboard.charts || dashboard.charts.length === 0 ? (
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
                d="M7 12l3-3 3 3 4-4M8 21l4-4 4 4M3 4h18M4 4h16v12a1 1 0 01-1 1H5a1 1 0 01-1-1V4z"
              />
            </svg>
            <h3 className="text-xl font-semibold text-white mb-2">
              No Charts Yet
            </h3>
            <p className="text-gray-500 mb-6 text-center max-w-md">
              Add your first chart to start visualizing your data
            </p>
            <button
              onClick={() => {
                setEditingChart(null);
                setShowBuilder(true);
              }}
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
              Create Chart
            </button>
          </div>
        ) : (
          /* Charts Grid */
          <div className="grid grid-cols-1 lg:grid-cols-2 xl:grid-cols-3 gap-6">
            {dashboard.charts.map((chart) => {
              const isKPI = chart.chart_type === "kpi" || chart.configuration?.chart_type === "kpi";
              
              return (
                <div
                  key={chart.id}
                  className={`${
                    isKPI 
                      ? "" 
                      : "bg-[#141414] border border-[#2a2a2a] rounded-lg overflow-hidden hover:border-orange-500/50 transition-colors group"
                  }`}
                >
                  {isKPI ? (
                    /* KPI Card - No wrapper */
                    <div className="group relative">
                      <ChartRenderer 
                        chart={chart} 
                        projectId={localStorage.getItem("current_project_id") || ""} 
                      />
                      {/* Hover Actions for KPI */}
                      <div className="absolute top-3 right-3 flex gap-2 opacity-0 group-hover:opacity-100 transition-opacity">
                        <button
                          onClick={(e) => {
                            e.stopPropagation();
                            setEditingChart(chart);
                            setShowBuilder(true);
                          }}
                          className="p-1.5 bg-white/90 hover:bg-white rounded-lg shadow-md transition-all"
                          title="Edit chart"
                        >
                          <svg
                            className="w-3.5 h-3.5 text-gray-700 hover:text-orange-500"
                            fill="none"
                            stroke="currentColor"
                            viewBox="0 0 24 24"
                          >
                            <path
                              strokeLinecap="round"
                              strokeLinejoin="round"
                              strokeWidth={2}
                              d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z"
                            />
                          </svg>
                        </button>
                        <button
                          onClick={(e) => {
                            e.stopPropagation();
                            deleteChart(chart.id);
                          }}
                          className="p-1.5 bg-white/90 hover:bg-white rounded-lg shadow-md transition-all"
                          title="Delete chart"
                        >
                          <svg
                            className="w-3.5 h-3.5 text-gray-700 hover:text-red-500"
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
                    </div>
                  ) : (
                    /* Regular Chart with Header */
                    <>
                      {/* Chart Header */}
                      <div className="flex items-start justify-between p-4 border-b border-[#2a2a2a] bg-[#0a0a0a]">
                        <div>
                          <h3 className="text-lg font-semibold text-white">
                            {chart.name}
                          </h3>
                          <div className="text-xs text-gray-500 mt-1">
                            {chart.configuration?.table || "No table"}
                          </div>
                        </div>
                        <div className="flex gap-2 opacity-0 group-hover:opacity-100 transition-opacity">
                          <button
                            onClick={() => {
                              setEditingChart(chart);
                              setShowBuilder(true);
                            }}
                            className="p-2 hover:bg-[#2a2a2a] rounded transition-colors"
                            title="Edit chart"
                          >
                            <svg
                              className="w-4 h-4 text-gray-400 hover:text-orange-500"
                              fill="none"
                              stroke="currentColor"
                              viewBox="0 0 24 24"
                            >
                              <path
                                strokeLinecap="round"
                                strokeLinejoin="round"
                                strokeWidth={2}
                                d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z"
                              />
                            </svg>
                          </button>
                          <button
                            onClick={() => deleteChart(chart.id)}
                            className="p-2 hover:bg-[#2a2a2a] rounded transition-colors"
                            title="Delete chart"
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
                      </div>

                      {/* Chart Content */}
                      <div className="h-80 p-0">
                        <ChartRenderer 
                          chart={chart} 
                          projectId={localStorage.getItem("current_project_id") || ""} 
                        />
                      </div>
                    </>
                  )}
                </div>
              );
            })}
          </div>
        )}
      </div>

      {/* Builder Modal */}
      {showBuilder && (
        <VisualizerBuilder
          dashboardId={dashboardId}
          chart={editingChart}
          onClose={() => {
            setShowBuilder(false);
            setEditingChart(null);
          }}
          onSave={() => {
            setShowBuilder(false);
            setEditingChart(null);
            loadDashboard();
          }}
        />
      )}
    </div>
  );
}
