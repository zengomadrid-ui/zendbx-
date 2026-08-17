"use client";

import { useEffect, useState } from "react";
import { useParams, useRouter } from "next/navigation";
import { apiFetch } from "@/lib/fetch-utils";
import {
  PieChart,
  Pie,
  Cell,
  LineChart,
  Line,
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  ResponsiveContainer,
  Tooltip,
  Legend,
} from "recharts";

const COLORS = [
  "#f97316", // orange-500 (primary brand)
  "#22d3ee", // cyan-400
  "#84cc16", // lime-500
  "#facc15", // yellow-400
  "#a855f7", // purple-500
  "#3b82f6", // blue-500
  "#10b981", // emerald-500
  "#ef4444", // red-500
  "#ec4899", // pink-500
  "#14b8a6", // teal-500
];

export default function ChartPreviewPage() {
  const params = useParams();
  const router = useRouter();
  const chartId = params.chart_id as string;

  const [chart, setChart] = useState<any>(null);
  const [data, setData] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    loadChartAndData();
  }, [chartId]);

  const loadChartAndData = async () => {
    try {
      setLoading(true);
      setError(null);

      const projectId = localStorage.getItem("current_project_id");
      
      // Load chart metadata
      const chartResponse = await apiFetch(
        `/api/visualizer/projects/${projectId}/charts/${chartId}`
      );

      if (!chartResponse.ok) {
        throw new Error("Failed to load chart");
      }

      const chartData = await chartResponse.json();
      setChart(chartData);

      // Load chart data
      const dataResponse = await apiFetch(
        `/api/visualizer/projects/${projectId}/query`,
        {
          method: "POST",
          body: JSON.stringify({
            table: chartData.configuration.table,
            dimensions: chartData.configuration.dimensions || [],
            metrics: chartData.configuration.metrics || [],
            filters: chartData.configuration.filters || [],
            limit: chartData.configuration.limit || 100,
          }),
        }
      );

      if (!dataResponse.ok) {
        throw new Error("Failed to load data");
      }

      const result = await dataResponse.json();
      setData(result);
    } catch (err) {
      console.error("Load error:", err);
      setError(err instanceof Error ? err.message : "Failed to load chart");
    } finally {
      setLoading(false);
    }
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-[#0a0a0a] flex items-center justify-center">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-orange-500 mx-auto mb-4"></div>
          <div className="text-gray-400">Loading chart...</div>
        </div>
      </div>
    );
  }

  if (error || !chart || !data) {
    return (
      <div className="min-h-screen bg-[#0a0a0a] flex items-center justify-center">
        <div className="text-center">
          <div className="text-red-500 text-4xl mb-4">⚠️</div>
          <div className="text-gray-400 mb-4">{error || "Chart not found"}</div>
          <button
            onClick={() => router.back()}
            className="px-6 py-2 bg-orange-500 hover:bg-orange-600 rounded transition-colors"
          >
            Go Back
          </button>
        </div>
      </div>
    );
  }

  // Prepare chart data based on type
  const dimensions = chart.configuration.dimensions || [];
  const metrics = chart.configuration.metrics || [];
  const xKey = dimensions[0]?.alias || dimensions[0]?.column || data.columns[0];
  const yKeys = metrics.map((m: any) => m.alias || `${m.column}_${m.aggregation}`);
  const chartType = chart.configuration.chart_type || chart.chart_type;

  // Render different chart types
  const renderChart = () => {
    if (chartType === "pie") {
      const pieData = data.rows.map((row: any) => ({
        name: row[xKey],
        value: row[yKeys[0]],
      }));

      const total = pieData.reduce((sum: number, entry: any) => sum + (entry.value || 0), 0);

      return (
        <div className="h-[500px] flex items-center gap-12">
          {/* Donut Chart */}
          <div className="flex-shrink-0 h-full" style={{ width: "45%", minWidth: "300px" }}>
            <ResponsiveContainer width="100%" height="100%">
              <PieChart>
                <Pie
                  data={pieData}
                  cx="50%"
                  cy="50%"
                  innerRadius="50%"
                  outerRadius="80%"
                  paddingAngle={4}
                  dataKey="value"
                  stroke="#1a1a1a"
                  strokeWidth={3}
                >
                  {pieData.map((entry: any, index: number) => (
                    <Cell
                      key={`cell-${index}`}
                      fill={COLORS[index % COLORS.length]}
                    />
                  ))}
                </Pie>
                <Tooltip
                  contentStyle={{
                    backgroundColor: "#141414",
                    border: "1px solid #2a2a2a",
                    borderRadius: "8px",
                    color: "#fff",
                    fontSize: "14px",
                    padding: "12px 16px",
                  }}
                  formatter={(value: any) => {
                    const percentage = ((value / total) * 100).toFixed(1);
                    return [`${value.toLocaleString()} (${percentage}%)`, "Value"];
                  }}
                />
              </PieChart>
            </ResponsiveContainer>
          </div>

          {/* Legend */}
          <div className="flex-1 min-w-0 h-full flex flex-col">
            <div className="text-sm font-semibold text-gray-500 mb-6 uppercase tracking-wider">
              Distribution by {xKey}
            </div>
            <div className="flex-1 space-y-3 overflow-y-auto pr-4 min-h-0">
              {pieData.map((entry: any, index: number) => {
                const percentage = ((entry.value / total) * 100).toFixed(1);
                return (
                  <div
                    key={index}
                    className="flex items-center gap-4 p-3 rounded-lg hover:bg-[#1a1a1a] transition-colors cursor-pointer group"
                  >
                    <div
                      className="w-5 h-5 rounded flex-shrink-0 shadow-lg transition-transform group-hover:scale-110"
                      style={{
                        backgroundColor: COLORS[index % COLORS.length],
                        boxShadow: `0 0 12px ${COLORS[index % COLORS.length]}40`,
                      }}
                    />
                    <div className="flex-1 min-w-0">
                      <div className="text-base text-gray-200 truncate font-medium group-hover:text-white transition-colors">
                        {entry.name}
                      </div>
                      <div className="flex items-center gap-3 mt-1">
                        <span className="text-sm text-gray-500">
                          {entry.value.toLocaleString()}
                        </span>
                        <span className="text-sm text-gray-600">•</span>
                        <span className="text-sm font-semibold text-orange-500">
                          {percentage}%
                        </span>
                      </div>
                    </div>
                    <div className="flex-shrink-0">
                      <div
                        className="h-2 rounded-full transition-all"
                        style={{
                          width: `${Math.max(percentage, 5)}px`,
                          backgroundColor: COLORS[index % COLORS.length],
                        }}
                      />
                    </div>
                  </div>
                );
              })}
            </div>

            {/* Total */}
            <div className="mt-6 pt-6 border-t border-[#2a2a2a] flex-shrink-0">
              <div className="flex items-center justify-between px-3 py-2 bg-[#0a0a0a] rounded-lg">
                <div>
                  <div className="text-xs text-gray-500 uppercase tracking-wider font-semibold">
                    Total {yKeys[0]}
                  </div>
                  <div className="text-2xl font-bold text-white mt-1">
                    {total.toLocaleString()}
                  </div>
                </div>
                <div className="text-right">
                  <div className="text-xs text-gray-500">Categories</div>
                  <div className="text-xl font-semibold text-orange-500 mt-1">
                    {pieData.length}
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>
      );
    }

    if (chartType === "line") {
      const lineData = data.rows;
      
      // Calculate min and max for better visualization
      const allValues = lineData.flatMap((row: any) => 
        yKeys.map((key: string) => row[key])
      ).filter((v: any) => v != null);
      
      const minValue = Math.min(...allValues);
      const maxValue = Math.max(...allValues);
      const range = maxValue - minValue;
      const yMin = Math.floor(minValue - range * 0.1);
      const yMax = Math.ceil(maxValue + range * 0.1);

      // Find highest and lowest points for annotation
      const findExtreme = (isMax: boolean) => {
        let extremeValue = isMax ? -Infinity : Infinity;
        let extremePoint = null;
        
        lineData.forEach((row: any) => {
          yKeys.forEach((key: string) => {
            const value = row[key];
            if (value != null) {
              if ((isMax && value > extremeValue) || (!isMax && value < extremeValue)) {
                extremeValue = value;
                extremePoint = { x: row[xKey], y: value, key };
              }
            }
          });
        });
        
        return extremePoint;
      };

      const highest = findExtreme(true);
      const lowest = findExtreme(false);

      return (
        <div className="h-[500px]">
          <ResponsiveContainer width="100%" height="100%">
            <LineChart data={lineData} margin={{ top: 40, right: 30, left: 20, bottom: 20 }}>
              <CartesianGrid strokeDasharray="3 3" stroke="#2a2a2a" />
              <XAxis
                dataKey={xKey}
                stroke="#666"
                style={{ fontSize: "13px" }}
                tick={{ fill: "#999" }}
              />
              <YAxis
                stroke="#666"
                style={{ fontSize: "13px" }}
                tick={{ fill: "#999" }}
                domain={[yMin, yMax]}
              />
              <Tooltip
                contentStyle={{
                  backgroundColor: "#141414",
                  border: "1px solid #2a2a2a",
                  borderRadius: "8px",
                  color: "#fff",
                  fontSize: "13px",
                  padding: "12px 16px",
                }}
                labelStyle={{ color: "#999", marginBottom: "8px" }}
              />
              <Legend
                wrapperStyle={{
                  fontSize: "13px",
                  paddingTop: "20px",
                }}
                iconType="line"
              />
              {yKeys.map((key: string, index: number) => (
                <Line
                  key={key}
                  type="monotone"
                  dataKey={key}
                  stroke={COLORS[index % COLORS.length]}
                  strokeWidth={3}
                  dot={{
                    r: 6,
                    fill: COLORS[index % COLORS.length],
                    strokeWidth: 2,
                    stroke: "#0a0a0a",
                  }}
                  activeDot={{
                    r: 8,
                    fill: COLORS[index % COLORS.length],
                    strokeWidth: 3,
                    stroke: "#0a0a0a",
                  }}
                  name={key}
                />
              ))}
            </LineChart>
          </ResponsiveContainer>

          {/* Stats Cards */}
          <div className="grid grid-cols-3 gap-4 mt-6">
            {/* Highest Point */}
            {highest && (
              <div className="bg-[#0a0a0a] border border-green-500/30 rounded-lg p-4">
                <div className="flex items-center gap-2 mb-2">
                  <svg className="w-5 h-5 text-green-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 10l7-7m0 0l7 7m-7-7v18" />
                  </svg>
                  <span className="text-xs text-gray-500 uppercase tracking-wider font-semibold">Highest</span>
                </div>
                <div className="text-2xl font-bold text-green-500">{highest.y.toLocaleString()}</div>
                <div className="text-xs text-gray-500 mt-1">at {highest.x}</div>
              </div>
            )}

            {/* Lowest Point */}
            {lowest && (
              <div className="bg-[#0a0a0a] border border-red-500/30 rounded-lg p-4">
                <div className="flex items-center gap-2 mb-2">
                  <svg className="w-5 h-5 text-red-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 14l-7 7m0 0l-7-7m7 7V3" />
                  </svg>
                  <span className="text-xs text-gray-500 uppercase tracking-wider font-semibold">Lowest</span>
                </div>
                <div className="text-2xl font-bold text-red-500">{lowest.y.toLocaleString()}</div>
                <div className="text-xs text-gray-500 mt-1">at {lowest.x}</div>
              </div>
            )}

            {/* Average */}
            <div className="bg-[#0a0a0a] border border-orange-500/30 rounded-lg p-4">
              <div className="flex items-center gap-2 mb-2">
                <svg className="w-5 h-5 text-orange-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 19v-6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2a2 2 0 002-2zm0 0V9a2 2 0 012-2h2a2 2 0 012 2v10m-6 0a2 2 0 002 2h2a2 2 0 002-2m0 0V5a2 2 0 012-2h2a2 2 0 012 2v14a2 2 0 01-2 2h-2a2 2 0 01-2-2z" />
                </svg>
                <span className="text-xs text-gray-500 uppercase tracking-wider font-semibold">Average</span>
              </div>
              <div className="text-2xl font-bold text-orange-500">
                {(allValues.reduce((a: number, b: number) => a + b, 0) / allValues.length).toFixed(1)}
              </div>
              <div className="text-xs text-gray-500 mt-1">{allValues.length} data points</div>
            </div>
          </div>
        </div>
      );
    }

    if (chartType === "bar") {
      const barData = data.rows;
      
      // Calculate statistics for all values
      const allValues = barData.flatMap((row: any) => 
        yKeys.map((key: string) => row[key])
      ).filter((v: any) => v != null);
      
      const minValue = Math.min(...allValues);
      const maxValue = Math.max(...allValues);
      const totalValue = allValues.reduce((a: number, b: number) => a + b, 0);
      const avgValue = totalValue / allValues.length;

      return (
        <div className="h-[500px]">
          <ResponsiveContainer width="100%" height="100%">
            <BarChart data={barData} margin={{ top: 20, right: 30, left: 20, bottom: 20 }}>
              <CartesianGrid strokeDasharray="3 3" stroke="#2a2a2a" vertical={false} />
              <XAxis
                dataKey={xKey}
                stroke="#666"
                style={{ fontSize: "13px" }}
                tick={{ fill: "#999" }}
              />
              <YAxis
                stroke="#666"
                style={{ fontSize: "13px" }}
                tick={{ fill: "#999" }}
              />
              <Tooltip
                contentStyle={{
                  backgroundColor: "#141414",
                  border: "1px solid #2a2a2a",
                  borderRadius: "8px",
                  color: "#fff",
                  fontSize: "13px",
                  padding: "12px 16px",
                }}
                labelStyle={{ color: "#999", marginBottom: "8px" }}
                cursor={{ fill: "rgba(249, 115, 22, 0.1)" }}
              />
              <Legend
                wrapperStyle={{
                  fontSize: "13px",
                  paddingTop: "20px",
                }}
              />
              {yKeys.map((key: string, index: number) => (
                <Bar
                  key={key}
                  dataKey={key}
                  fill={COLORS[index % COLORS.length]}
                  radius={[8, 8, 0, 0]}
                  name={key}
                />
              ))}
            </BarChart>
          </ResponsiveContainer>

          {/* Stats Cards */}
          <div className="grid grid-cols-4 gap-4 mt-6">
            {/* Maximum */}
            <div className="bg-[#0a0a0a] border border-green-500/30 rounded-lg p-4">
              <div className="flex items-center gap-2 mb-2">
                <svg className="w-5 h-5 text-green-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 10l7-7m0 0l7 7m-7-7v18" />
                </svg>
                <span className="text-xs text-gray-500 uppercase tracking-wider font-semibold">Maximum</span>
              </div>
              <div className="text-2xl font-bold text-green-500">{maxValue.toLocaleString()}</div>
              <div className="text-xs text-gray-500 mt-1">Highest value</div>
            </div>

            {/* Minimum */}
            <div className="bg-[#0a0a0a] border border-red-500/30 rounded-lg p-4">
              <div className="flex items-center gap-2 mb-2">
                <svg className="w-5 h-5 text-red-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 14l-7 7m0 0l-7-7m7 7V3" />
                </svg>
                <span className="text-xs text-gray-500 uppercase tracking-wider font-semibold">Minimum</span>
              </div>
              <div className="text-2xl font-bold text-red-500">{minValue.toLocaleString()}</div>
              <div className="text-xs text-gray-500 mt-1">Lowest value</div>
            </div>

            {/* Average */}
            <div className="bg-[#0a0a0a] border border-orange-500/30 rounded-lg p-4">
              <div className="flex items-center gap-2 mb-2">
                <svg className="w-5 h-5 text-orange-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 19v-6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2a2 2 0 002-2zm0 0V9a2 2 0 012-2h2a2 2 0 012 2v10m-6 0a2 2 0 002 2h2a2 2 0 002-2m0 0V5a2 2 0 012-2h2a2 2 0 012 2v14a2 2 0 01-2 2h-2a2 2 0 01-2-2z" />
                </svg>
                <span className="text-xs text-gray-500 uppercase tracking-wider font-semibold">Average</span>
              </div>
              <div className="text-2xl font-bold text-orange-500">{avgValue.toFixed(1)}</div>
              <div className="text-xs text-gray-500 mt-1">Mean value</div>
            </div>

            {/* Total */}
            <div className="bg-[#0a0a0a] border border-blue-500/30 rounded-lg p-4">
              <div className="flex items-center gap-2 mb-2">
                <svg className="w-5 h-5 text-blue-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 6V4m0 2a2 2 0 100 4m0-4a2 2 0 110 4m-6 8a2 2 0 100-4m0 4a2 2 0 110-4m0 4v2m0-6V4m6 6v10m6-2a2 2 0 100-4m0 4a2 2 0 110-4m0 4v2m0-6V4" />
                </svg>
                <span className="text-xs text-gray-500 uppercase tracking-wider font-semibold">Total</span>
              </div>
              <div className="text-2xl font-bold text-blue-500">{totalValue.toLocaleString()}</div>
              <div className="text-xs text-gray-500 mt-1">Sum of all values</div>
            </div>
          </div>
        </div>
      );
    }

    return null;
  };

  return (
    <div className="min-h-screen bg-[#0a0a0a]">
      {/* Header */}
      <div className="bg-[#141414] border-b border-[#2a2a2a] px-6 py-4">
        <div className="max-w-7xl mx-auto flex items-center justify-between">
          <div className="flex items-center gap-4">
            <button
              onClick={() => router.back()}
              className="p-2 hover:bg-[#2a2a2a] rounded transition-colors"
            >
              <svg
                className="w-5 h-5 text-gray-400"
                fill="none"
                stroke="currentColor"
                viewBox="0 0 24 24"
              >
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth={2}
                  d="M10 19l-7-7m0 0l7-7m-7 7h18"
                />
              </svg>
            </button>
            <div>
              <h1 className="text-2xl font-bold text-white">{chart.name}</h1>
              <p className="text-sm text-gray-500">
                {chart.configuration.table} • {data.row_count} categories • {data.execution_time_ms}ms
              </p>
            </div>
          </div>
          <button
            onClick={loadChartAndData}
            className="px-4 py-2 bg-orange-500 hover:bg-orange-600 rounded transition-colors flex items-center gap-2"
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
        </div>
      </div>

      {/* Main Content */}
      <div className="max-w-7xl mx-auto p-6">
        <div className="grid grid-cols-1 gap-6">
          {/* Large Chart Display */}
          <div className="bg-[#141414] border border-[#2a2a2a] rounded-lg p-8">
            {renderChart()}
          </div>

          {/* Data Table */}
          <div className="bg-[#141414] border border-[#2a2a2a] rounded-lg overflow-hidden">
            <div className="px-6 py-4 border-b border-[#2a2a2a]">
              <h2 className="text-lg font-semibold text-white">Raw Data</h2>
            </div>
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead className="bg-[#0a0a0a]">
                  <tr>
                    {data.columns.map((col: string) => (
                      <th
                        key={col}
                        className="px-6 py-3 text-left text-gray-400 font-medium border-b border-[#2a2a2a]"
                      >
                        {col}
                      </th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {data.rows.map((row: any, i: number) => (
                    <tr
                      key={i}
                      className="border-b border-[#2a2a2a] hover:bg-[#1a1a1a] transition-colors"
                    >
                      {data.columns.map((col: string) => (
                        <td key={col} className="px-6 py-3 text-gray-300">
                          {row[col] !== null ? String(row[col]) : (
                            <span className="text-gray-600 italic">NULL</span>
                          )}
                        </td>
                      ))}
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>

          {/* Generated SQL */}
          {data.generated_sql && (
            <details className="bg-[#141414] border border-[#2a2a2a] rounded-lg">
              <summary className="px-6 py-4 cursor-pointer text-sm text-gray-400 hover:text-white transition-colors flex items-center gap-2">
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
                    d="M10 20l4-16m4 4l4 4-4 4M6 16l-4-4 4-4"
                  />
                </svg>
                View Generated SQL
              </summary>
              <pre className="px-6 pb-6 text-xs text-gray-500 overflow-x-auto bg-[#0a0a0a] mx-6 mb-6 p-4 rounded">
                {data.generated_sql}
              </pre>
            </details>
          )}
        </div>
      </div>
    </div>
  );
}
