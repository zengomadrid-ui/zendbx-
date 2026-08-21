"use client";

import { useEffect, useState } from "react";
import { apiFetch } from "@/lib/fetch-utils";
import {
  BarChart,
  Bar,
  LineChart,
  Line,
  PieChart,
  Pie,
  AreaChart,
  Area,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  Legend,
  ResponsiveContainer,
  Cell,
} from "recharts";
import KPICard from "./KPICard";

interface ChartRendererProps {
  chart: any;
  projectId: string;
}

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

export default function ChartRenderer({ chart, projectId }: ChartRendererProps) {
  const [data, setData] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    loadChartData();
  }, [chart.id]);

  const loadChartData = async () => {
    try {
      setLoading(true);
      setError(null);

      const response = await apiFetch(
        `/api/visualizer/projects/${projectId}/query`,
        {
          method: "POST",
          body: JSON.stringify({
            table: chart.configuration.table,
            dimensions: chart.configuration.dimensions || [],
            metrics: chart.configuration.metrics || [],
            filters: chart.configuration.filters || [],
            limit: chart.configuration.limit || 100,
          }),
        }
      );

      if (response.ok) {
        const result = await response.json();
        setData(result);
      } else {
        const errorData = await response.json();
        setError(errorData.detail || "Failed to load chart data");
      }
    } catch (err) {
      console.error("Chart data loading error:", err);
      setError("Failed to load chart data");
    } finally {
      setLoading(false);
    }
  };

  if (loading) {
    return (
      <div className="h-full flex items-center justify-center bg-[#0a0a0a] rounded border border-[#2a2a2a]">
        <div className="text-center">
          <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-orange-500 mx-auto mb-2"></div>
          <div className="text-sm text-gray-400">Loading chart...</div>
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="h-full flex items-center justify-center bg-[#0a0a0a] rounded border border-red-500/30">
        <div className="text-center p-4">
          <div className="text-red-500 mb-2">⚠️ Error</div>
          <div className="text-sm text-gray-400">{error}</div>
          <button
            onClick={loadChartData}
            className="mt-3 px-4 py-2 bg-orange-500 hover:bg-orange-600 rounded text-sm transition-colors"
          >
            Retry
          </button>
        </div>
      </div>
    );
  }

  if (!data || data.row_count === 0) {
    return (
      <div className="h-full flex items-center justify-center bg-[#0a0a0a] rounded border border-[#2a2a2a]">
        <div className="text-center text-gray-500">
          <div className="text-4xl mb-2">📊</div>
          <div className="text-sm">No data available</div>
        </div>
      </div>
    );
  }

  const chartType = chart.configuration.chart_type || chart.chart_type;

  // Render KPI Card - use new modern component
  if (chartType === "kpi") {
    return <KPICard chart={chart} projectId={projectId} />;
  }

  // Render Table
  if (chartType === "table") {
    return (
      <div className="h-full overflow-auto bg-[#0a0a0a] rounded border border-[#2a2a2a]">
        <table className="w-full text-sm">
          <thead className="bg-[#141414] sticky top-0">
            <tr>
              {data.columns.map((col: string) => (
                <th
                  key={col}
                  className="px-4 py-3 text-left text-gray-400 font-medium border-b border-[#2a2a2a]"
                >
                  {col}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {data.rows.map((row: any, i: number) => (
              <tr key={i} className="border-b border-[#2a2a2a] hover:bg-[#141414] transition-colors">
                {data.columns.map((col: string) => (
                  <td key={col} className="px-4 py-3 text-gray-300">
                    {row[col] !== null ? String(row[col]) : (
                      <span className="text-gray-600 italic">NULL</span>
                    )}
                  </td>
                ))}
              </tr>
            ))}
          </tbody>
        </table>
        <div className="px-4 py-2 bg-[#141414] border-t border-[#2a2a2a] text-xs text-gray-500">
          {data.row_count} rows • {data.execution_time_ms}ms
        </div>
      </div>
    );
  }

  // Prepare data for Recharts
  const chartData = data.rows;
  const dimensions = chart.configuration.dimensions || [];
  const metrics = chart.configuration.metrics || [];
  
  const xKey = dimensions[0]?.alias || dimensions[0]?.column || data.columns[0];
  const yKeys = metrics.map((m: any) => m.alias || `${m.column}_${m.aggregation}`);

  // Render Bar Chart
  if (chartType === "bar") {
    return (
      <div className="h-full bg-[#0a0a0a] rounded border border-[#2a2a2a] p-4">
        <ResponsiveContainer width="100%" height="100%">
          <BarChart data={chartData}>
            <CartesianGrid strokeDasharray="3 3" stroke="#2a2a2a" />
            <XAxis
              dataKey={xKey}
              stroke="#666"
              style={{ fontSize: "12px" }}
            />
            <YAxis stroke="#666" style={{ fontSize: "12px" }} />
            <Tooltip
              contentStyle={{
                backgroundColor: "#141414",
                border: "1px solid #2a2a2a",
                borderRadius: "8px",
                color: "#fff",
              }}
            />
            <Legend wrapperStyle={{ fontSize: "12px", color: "#999" }} />
            {yKeys.map((key: string, index: number) => (
              <Bar
                key={key}
                dataKey={key}
                fill={COLORS[index % COLORS.length]}
                radius={[4, 4, 0, 0]}
              />
            ))}
          </BarChart>
        </ResponsiveContainer>
      </div>
    );
  }

  // Render Line Chart
  if (chartType === "line") {
    return (
      <div className="h-full bg-[#0a0a0a] rounded border border-[#2a2a2a] p-4">
        <ResponsiveContainer width="100%" height="100%">
          <LineChart data={chartData}>
            <CartesianGrid strokeDasharray="3 3" stroke="#2a2a2a" />
            <XAxis
              dataKey={xKey}
              stroke="#666"
              style={{ fontSize: "12px" }}
            />
            <YAxis stroke="#666" style={{ fontSize: "12px" }} />
            <Tooltip
              contentStyle={{
                backgroundColor: "#141414",
                border: "1px solid #2a2a2a",
                borderRadius: "8px",
                color: "#fff",
              }}
            />
            <Legend wrapperStyle={{ fontSize: "12px", color: "#999" }} />
            {yKeys.map((key: string, index: number) => (
              <Line
                key={key}
                type="monotone"
                dataKey={key}
                stroke={COLORS[index % COLORS.length]}
                strokeWidth={2}
                dot={{ r: 4 }}
                activeDot={{ r: 6 }}
              />
            ))}
          </LineChart>
        </ResponsiveContainer>
      </div>
    );
  }

  // Render Area Chart
  if (chartType === "area") {
    return (
      <div className="h-full bg-[#0a0a0a] rounded border border-[#2a2a2a] p-4">
        <ResponsiveContainer width="100%" height="100%">
          <AreaChart data={chartData}>
            <CartesianGrid strokeDasharray="3 3" stroke="#2a2a2a" />
            <XAxis
              dataKey={xKey}
              stroke="#666"
              style={{ fontSize: "12px" }}
            />
            <YAxis stroke="#666" style={{ fontSize: "12px" }} />
            <Tooltip
              contentStyle={{
                backgroundColor: "#141414",
                border: "1px solid #2a2a2a",
                borderRadius: "8px",
                color: "#fff",
              }}
            />
            <Legend wrapperStyle={{ fontSize: "12px", color: "#999" }} />
            {yKeys.map((key: string, index: number) => (
              <Area
                key={key}
                type="monotone"
                dataKey={key}
                stroke={COLORS[index % COLORS.length]}
                fill={COLORS[index % COLORS.length]}
                fillOpacity={0.6}
              />
            ))}
          </AreaChart>
        </ResponsiveContainer>
      </div>
    );
  }

  // Render Pie Chart (Modern Donut Chart)
  if (chartType === "pie") {
    const pieData = chartData.map((row: any) => ({
      name: row[xKey],
      value: row[yKeys[0]],
    }));

    // Calculate total for percentages
    const total = pieData.reduce((sum: number, entry: any) => sum + (entry.value || 0), 0);

    return (
      <div className="h-full bg-[#0a0a0a] rounded border border-[#2a2a2a] p-4 overflow-hidden">
        <div className="w-full h-full flex items-center gap-6">
          {/* Donut Chart Container */}
          <div className="flex-shrink-0 h-full" style={{ width: "50%", minWidth: "200px", maxWidth: "350px" }}>
            <ResponsiveContainer width="100%" height="100%">
              <PieChart>
                <Pie
                  data={pieData}
                  cx="50%"
                  cy="50%"
                  innerRadius="45%"
                  outerRadius="70%"
                  paddingAngle={4}
                  dataKey="value"
                  stroke="#1a1a1a"
                  strokeWidth={2}
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
                    fontSize: "12px",
                    padding: "8px 12px",
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
            <div className="text-xs font-semibold text-gray-500 mb-3 uppercase tracking-wider">
              Distribution
            </div>
            <div className="flex-1 space-y-2 overflow-y-auto pr-2 min-h-0">
              {pieData.map((entry: any, index: number) => {
                const percentage = ((entry.value / total) * 100).toFixed(1);
                return (
                  <div
                    key={index}
                    className="flex items-center gap-3 p-2 rounded hover:bg-[#141414] transition-colors cursor-pointer"
                  >
                    <div
                      className="w-3 h-3 rounded flex-shrink-0"
                      style={{ 
                        backgroundColor: COLORS[index % COLORS.length],
                      }}
                    />
                    <div className="flex-1 min-w-0">
                      <div className="text-sm text-gray-300 truncate">
                        {entry.name}
                      </div>
                      <div className="flex items-center gap-2 mt-0.5">
                        <span className="text-xs text-gray-500">
                          {entry.value.toLocaleString()}
                        </span>
                        <span className="text-xs text-gray-600">•</span>
                        <span className="text-xs font-medium text-orange-500">
                          {percentage}%
                        </span>
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
            
            {/* Total */}
            <div className="mt-3 pt-3 border-t border-[#2a2a2a] flex-shrink-0">
              <div className="flex items-center justify-between px-2">
                <span className="text-xs text-gray-500 uppercase tracking-wider font-semibold">Total</span>
                <span className="text-base font-semibold text-white">{total.toLocaleString()}</span>
              </div>
            </div>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="h-full flex items-center justify-center bg-[#0a0a0a] rounded border border-[#2a2a2a]">
      <div className="text-center text-gray-500">
        <div className="text-sm">Unsupported chart type: {chartType}</div>
      </div>
    </div>
  );
}
