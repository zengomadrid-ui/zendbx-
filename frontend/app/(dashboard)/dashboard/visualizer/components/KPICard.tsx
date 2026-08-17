"use client";

import { useEffect, useState } from "react";
import { apiFetch } from "@/lib/fetch-utils";
import {
  LineChart,
  Line,
  ResponsiveContainer,
  BarChart,
  Bar,
} from "recharts";

interface KPICardProps {
  chart: any;
  projectId: string;
}

interface KPIData {
  value: number | string;
  previousValue?: number;
  trend?: number;
  trendData?: Array<{ value: number }>;
  target?: number;
  categories?: Array<{ label: string; value: number }>;
}

export default function KPICard({ chart, projectId }: KPICardProps) {
  const [data, setData] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    loadData();
  }, [chart.id]);

  const loadData = async () => {
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
        setError(errorData.detail || "Failed to load data");
      }
    } catch (err) {
      console.error("KPI data loading error:", err);
      setError("Failed to load data");
    } finally {
      setLoading(false);
    }
  };

  if (loading) {
    return (
      <div className="bg-[#141414] rounded-2xl p-8 border border-[#2a2a2a] shadow-xl animate-pulse">
        <div className="flex items-center gap-3 mb-6">
          <div className="w-14 h-14 bg-[#2a2a2a] rounded-xl"></div>
          <div className="h-4 bg-[#2a2a2a] rounded w-32"></div>
        </div>
        <div className="h-16 bg-[#2a2a2a] rounded-xl w-2/3 mb-4"></div>
        <div className="h-8 bg-[#2a2a2a] rounded-lg w-1/3"></div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="bg-[#141414] rounded-2xl p-8 border border-red-500/30 shadow-xl">
        <div className="flex items-center gap-3 mb-4">
          <div className="p-3 bg-red-500/10 rounded-xl border border-red-500/20">
            <svg className="w-6 h-6 text-red-500" fill="currentColor" viewBox="0 0 20 20">
              <path
                fillRule="evenodd"
                d="M10 18a8 8 0 100-16 8 8 0 000 16zM8.707 7.293a1 1 0 00-1.414 1.414L8.586 10l-1.293 1.293a1 1 0 101.414 1.414L10 11.414l1.293 1.293a1 1 0 001.414-1.414L11.414 10l1.293-1.293a1 1 0 00-1.414-1.414L10 8.586 8.707 7.293z"
                clipRule="evenodd"
              />
            </svg>
          </div>
          <div>
            <h4 className="text-sm font-semibold text-red-500 mb-1">Error Loading Data</h4>
            <p className="text-xs text-gray-500">{error}</p>
          </div>
        </div>
      </div>
    );
  }

  if (!data || data.row_count === 0) {
    return (
      <div className="bg-[#141414] rounded-2xl p-8 border border-[#2a2a2a] shadow-xl">
        <div className="text-center py-8">
          <div className="inline-flex items-center justify-center w-16 h-16 bg-[#1a1a1a] rounded-xl mb-4 border border-[#2a2a2a]">
            <svg className="w-8 h-8 text-gray-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 19v-6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2a2 2 0 002-2zm0 0V9a2 2 0 012-2h2a2 2 0 012 2v10m-6 0a2 2 0 002 2h2a2 2 0 002-2m0 0V5a2 2 0 012-2h2a2 2 0 012 2v14a2 2 0 01-2 2h-2a2 2 0 01-2-2z" />
            </svg>
          </div>
          <div className="text-sm font-medium text-gray-400">No data available</div>
          <div className="text-xs text-gray-600 mt-1">Try adjusting your query filters</div>
        </div>
      </div>
    );
  }

  const kpiConfig = chart.configuration.kpi_config || {};
  const kpiType = kpiConfig.type || "simple"; // simple, trend, progress, breakdown
  const metric = chart.configuration.metrics[0];
  const metricKey = metric.alias || `${metric.column}_${metric.aggregation}`;

  // Simple KPI (just number)
  if (kpiType === "simple") {
    const value = data.rows[0]?.[metricKey];
    const formattedValue = formatValue(value, kpiConfig.format);

    return (
      <div className="group relative bg-[#141414] rounded-2xl p-8 border border-[#2a2a2a] hover:border-orange-500/50 shadow-xl hover:shadow-2xl hover:shadow-orange-500/20 transition-all duration-300">
        {/* Decorative orange gradient glow */}
        <div className="absolute top-0 right-0 w-48 h-48 bg-gradient-to-br from-orange-500/20 via-orange-600/10 to-transparent rounded-full blur-3xl" />
        <div className="absolute bottom-0 left-0 w-32 h-32 bg-gradient-to-tr from-orange-500/10 to-transparent rounded-full blur-2xl" />
        
        <div className="relative z-10">
          {/* Header with icon */}
          <div className="flex items-start justify-between mb-6">
            <div className="flex items-center gap-3">
              <div className="p-3 bg-orange-500/10 rounded-xl border border-orange-500/20">
                <svg className="w-6 h-6 text-orange-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 7h8m0 0v8m0-8l-8 8-4-4-6 6" />
                </svg>
              </div>
              <div>
                <h3 className="text-sm font-semibold text-gray-400 uppercase tracking-wider">
                  {chart.name}
                </h3>
              </div>
            </div>
          </div>
          
          {/* Main value */}
          <div className="mb-4">
            <div className="text-6xl font-black text-white tracking-tight">
              {formattedValue}
            </div>
          </div>
          
          {/* Footer */}
          <div className="flex items-center justify-between pt-4 border-t border-[#2a2a2a]">
            <div className="flex items-center gap-2">
              <div className="h-2 w-2 bg-orange-500 rounded-full animate-pulse" />
              <span className="text-sm text-gray-500 font-medium">Live</span>
            </div>
            <div className="px-3 py-1 bg-orange-500/10 text-orange-500 rounded-full text-xs font-semibold border border-orange-500/20">
              Real-time
            </div>
          </div>
        </div>
      </div>
    );
  }

  // Trend KPI (with sparkline)
  if (kpiType === "trend") {
    const currentValue = data.rows[0]?.[metricKey];
    const formattedValue = formatValue(currentValue, kpiConfig.format);
    
    // Calculate trend if we have multiple rows
    let trendPercent = 0;
    let trendValue = 0;
    if (data.rows.length > 1) {
      const previousValue = data.rows[1]?.[metricKey];
      if (previousValue && previousValue !== 0) {
        trendPercent = ((currentValue - previousValue) / previousValue) * 100;
        trendValue = currentValue - previousValue;
      }
    }

    // Prepare sparkline data
    const sparklineData = data.rows
      .slice(0, 10)
      .reverse()
      .map((row: any) => ({ value: row[metricKey] || 0 }));

    const isPositive = trendPercent >= 0;
    const trendColor = isPositive ? "#10b981" : "#ef4444";

    return (
      <div className="group relative bg-[#141414] rounded-2xl p-8 border border-[#2a2a2a] hover:border-orange-500/50 shadow-xl hover:shadow-2xl hover:shadow-orange-500/20 transition-all duration-300">
        {/* Decorative background */}
        <div className={`absolute top-0 right-0 w-56 h-56 ${isPositive ? 'bg-gradient-to-br from-green-500/20 via-emerald-500/10' : 'bg-gradient-to-br from-red-500/20 via-rose-500/10'} to-transparent rounded-full blur-3xl`} />
        <div className="absolute -bottom-8 -left-8 w-40 h-40 bg-gradient-to-tr from-orange-500/10 to-transparent rounded-full blur-2xl" />
        
        <div className="relative z-10">
          {/* Header */}
          <div className="flex items-start justify-between mb-6">
            <div className="flex items-center gap-3">
              <div className={`p-3 rounded-xl border ${isPositive ? 'bg-green-500/10 border-green-500/20' : 'bg-red-500/10 border-red-500/20'}`}>
                <svg className={`w-6 h-6 ${isPositive ? 'text-green-500' : 'text-red-500'}`} fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d={isPositive ? "M13 7h8m0 0v8m0-8l-8 8-4-4-6 6" : "M13 17h8m0 0V9m0 8l-8-8-4 4-6-6"} />
                </svg>
              </div>
              <div>
                <h3 className="text-sm font-semibold text-gray-400 uppercase tracking-wider">
                  {chart.name}
                </h3>
              </div>
            </div>
          </div>

          {/* Value and Sparkline */}
          <div className="flex items-start justify-between mb-6">
            <div className="text-6xl font-black text-white tracking-tight">
              {formattedValue}
            </div>
            {sparklineData.length > 1 && (
              <div className="w-32 h-16 opacity-80">
                <ResponsiveContainer width="100%" height="100%">
                  <LineChart data={sparklineData}>
                    <defs>
                      <linearGradient id="sparklineGradient" x1="0" y1="0" x2="0" y2="1">
                        <stop offset="0%" stopColor={trendColor} stopOpacity={0.3}/>
                        <stop offset="100%" stopColor={trendColor} stopOpacity={0}/>
                      </linearGradient>
                    </defs>
                    <Line
                      type="monotone"
                      dataKey="value"
                      stroke={trendColor}
                      strokeWidth={3}
                      dot={false}
                      fill="url(#sparklineGradient)"
                    />
                  </LineChart>
                </ResponsiveContainer>
              </div>
            )}
          </div>

          {/* Trend Badge */}
          <div className="flex items-center justify-between pt-4 border-t border-[#2a2a2a]">
            <div
              className={`flex items-center gap-2 px-4 py-2 rounded-xl font-bold text-sm ${
                isPositive 
                  ? "bg-green-500 text-white shadow-lg shadow-green-500/30" 
                  : "bg-red-500 text-white shadow-lg shadow-red-500/30"
              }`}
            >
              <svg
                className={`w-5 h-5 ${isPositive ? "" : "rotate-180"}`}
                fill="currentColor"
                viewBox="0 0 20 20"
              >
                <path
                  fillRule="evenodd"
                  d="M5.293 9.707a1 1 0 010-1.414l4-4a1 1 0 011.414 0l4 4a1 1 0 01-1.414 1.414L11 7.414V15a1 1 0 11-2 0V7.414L6.707 9.707a1 1 0 01-1.414 0z"
                  clipRule="evenodd"
                />
              </svg>
              <span>{Math.abs(trendPercent).toFixed(1)}%</span>
            </div>
            <span className="text-sm text-gray-500 font-medium">
              from last month
            </span>
          </div>
        </div>
      </div>
    );
  }

  // Progress KPI (with progress bar)
  if (kpiType === "progress") {
    const currentValue = data.rows[0]?.[metricKey];
    const target = kpiConfig.target || 100;
    const progressPercent = Math.min((currentValue / target) * 100, 100);
    
    let trendPercent = 0;
    if (data.rows.length > 1) {
      const previousValue = data.rows[1]?.[metricKey];
      if (previousValue && previousValue !== 0) {
        trendPercent = ((currentValue - previousValue) / previousValue) * 100;
      }
    }

    const isPositive = trendPercent >= 0;

    return (
      <div className="group relative bg-[#141414] rounded-2xl p-8 border border-[#2a2a2a] hover:border-orange-500/50 shadow-xl hover:shadow-2xl hover:shadow-orange-500/20 transition-all duration-300">
        {/* Decorative background */}
        <div className="absolute top-0 right-0 w-56 h-56 bg-gradient-to-br from-orange-500/20 via-orange-600/10 to-transparent rounded-full blur-3xl" />
        <div className="absolute -bottom-8 -left-8 w-48 h-48 bg-gradient-to-tr from-orange-500/10 to-transparent rounded-full blur-3xl" />
        
        <div className="relative z-10">
          {/* Header */}
          <div className="flex items-start justify-between mb-6">
            <div className="flex items-center gap-3">
              <div className="p-3 bg-orange-500/10 rounded-xl border border-orange-500/20">
                <svg className="w-6 h-6 text-orange-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 19v-6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2a2 2 0 002-2zm0 0V9a2 2 0 012-2h2a2 2 0 012 2v10m-6 0a2 2 0 002 2h2a2 2 0 002-2m0 0V5a2 2 0 012-2h2a2 2 0 012 2v14a2 2 0 01-2 2h-2a2 2 0 01-2-2z" />
                </svg>
              </div>
              <div>
                <h3 className="text-sm font-semibold text-gray-400 uppercase tracking-wider">
                  {chart.name}
                </h3>
              </div>
            </div>
          </div>

          {/* Value and Progress % */}
          <div className="flex items-end justify-between mb-6">
            <div>
              <div className="text-6xl font-black text-white mb-3 tracking-tight">
                {formatValue(currentValue, kpiConfig.format)}
              </div>
              {trendPercent !== 0 && (
                <div
                  className={`inline-flex items-center gap-2 px-4 py-2 rounded-2xl text-sm font-bold ${
                    isPositive 
                      ? "bg-gradient-to-r from-green-500 to-emerald-500 text-white shadow-lg shadow-green-500/30" 
                      : "bg-gradient-to-r from-red-500 to-rose-500 text-white shadow-lg shadow-red-500/30"
                  }`}
                >
                  <svg
                    className={`w-4 h-4 ${isPositive ? "" : "rotate-180"}`}
                    fill="currentColor"
                    viewBox="0 0 20 20"
                  >
                    <path
                      fillRule="evenodd"
                      d="M5.293 9.707a1 1 0 010-1.414l4-4a1 1 0 011.414 0l4 4a1 1 0 01-1.414 1.414L11 7.414V15a1 1 0 11-2 0V7.414L6.707 9.707a1 1 0 01-1.414 0z"
                      clipRule="evenodd"
                    />
                  </svg>
                  <span>{Math.abs(trendPercent).toFixed(1)}%</span>
                </div>
              )}
            </div>
            <div className="text-right">
              <div className="text-4xl font-black text-gray-400">
                {progressPercent.toFixed(0)}%
              </div>
              <div className="text-xs text-gray-500 font-semibold uppercase tracking-wider mt-1">to target</div>
            </div>
          </div>

          {/* Progress Bar */}
          <div className="relative pt-4 border-t border-[#2a2a2a]">
            <div className="flex gap-1.5 h-4 bg-[#1a1a1a] rounded-full overflow-hidden shadow-inner">
              {Array.from({ length: 20 }).map((_, i) => (
                <div
                  key={i}
                  className={`flex-1 transition-all duration-500 rounded-sm ${
                    i < (progressPercent / 5)
                      ? "bg-gradient-to-r from-blue-500 via-indigo-500 to-purple-500 shadow-lg"
                      : "bg-transparent"
                  }`}
                  style={{ transitionDelay: `${i * 30}ms` }}
                />
              ))}
            </div>
          </div>
        </div>
      </div>
    );
  }

  // Breakdown KPI (with category bars)
  if (kpiType === "breakdown") {
    const dimension = chart.configuration.dimensions[0];
    const dimensionKey = dimension?.alias || dimension?.column;

    if (!dimensionKey) {
      return (
        <div className="bg-[#141414] rounded-2xl p-8 border border-[#2a2a2a] shadow-xl">
          <p className="text-sm text-gray-500">Breakdown requires a dimension</p>
        </div>
      );
    }

    const categories = data.rows.slice(0, 4).map((row: any) => ({
      label: row[dimensionKey],
      value: row[metricKey],
    }));

    const total = categories.reduce((sum: number, cat: any) => sum + cat.value, 0);
    const colors = [
      { bg: "bg-blue-500", light: "bg-blue-50", text: "text-orange-500" },
      { bg: "bg-orange-500", light: "bg-orange-50", text: "text-orange-600" },
      { bg: "bg-green-500", light: "bg-green-50", text: "text-green-600" },
      { bg: "bg-purple-500", light: "bg-purple-50", text: "text-orange-500" },
    ];

    return (
      <div className="group relative bg-[#141414] rounded-2xl p-8 border border-[#2a2a2a] hover:border-orange-500/50 shadow-xl hover:shadow-2xl hover:shadow-orange-500/20 transition-all duration-300">
        {/* Decorative background */}
        <div className="absolute top-0 right-0 w-56 h-56 bg-gradient-to-br from-orange-500/20 via-orange-600/10 to-transparent rounded-full blur-3xl" />
        <div className="absolute -bottom-8 -left-8 w-40 h-40 bg-gradient-to-tr from-pink-100/50 to-transparent rounded-full blur-3xl" />
        
        <div className="relative z-10">
          {/* Header */}
          <div className="flex items-start justify-between mb-6">
            <div className="flex items-center gap-3">
              <div className="p-3 bg-orange-500/10 rounded-xl border border-orange-500/20">
                <svg className="w-6 h-6 text-orange-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 19v-6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2a2 2 0 002-2zm0 0V9a2 2 0 012-2h2a2 2 0 012 2v10m-6 0a2 2 0 002 2h2a2 2 0 002-2m0 0V5a2 2 0 012-2h2a2 2 0 012 2v14a2 2 0 01-2 2h-2a2 2 0 01-2-2z" />
                </svg>
              </div>
              <div>
                <h3 className="text-sm font-semibold text-gray-400 uppercase tracking-wider">
                  {chart.name}
                </h3>
              </div>
            </div>
          </div>

          {/* Category Grid */}
          <div className="grid grid-cols-2 gap-4 mb-6">
            {categories.map((cat: { label: string; value: number }, index: number) => {
              const color = colors[index % colors.length];
              return (
                <div key={index} className={`${color.light} rounded-2xl p-4 border border-gray-100`}>
                  <div className="text-4xl font-black text-white mb-2">
                    {formatValue(cat.value, kpiConfig.format)}
                  </div>
                  <div className="flex items-center gap-2">
                    <div className={`w-2 h-2 ${color.bg} rounded-full`} />
                    <div className={`text-xs font-semibold ${color.text} uppercase tracking-wide`}>
                      {cat.label}
                    </div>
                  </div>
                </div>
              );
            })}
          </div>

          {/* Category Bars */}
          <div className="pt-4 border-t border-[#2a2a2a]">
            <div className="flex gap-2 h-4 rounded-full overflow-hidden shadow-inner bg-gray-100">
              {categories.map((cat, index) => {
                const percent = (cat.value / total) * 100;
                const color = colors[index % colors.length];
                return (
                  <div
                    key={index}
                    className={`${color.bg} transition-all duration-500 hover:opacity-80 cursor-pointer rounded-sm shadow-lg`}
                    style={{ width: `${percent}%`, transitionDelay: `${index * 100}ms` }}
                    title={`${cat.label}: ${percent.toFixed(1)}%`}
                  />
                );
              })}
            </div>
          </div>
        </div>
      </div>
    );
  }

  // Bar trend KPI (with mini bars)
  if (kpiType === "bar_trend") {
    const currentValue = data.rows[0]?.[metricKey];
    const formattedValue = formatValue(currentValue, kpiConfig.format);

    let trendPercent = 0;
    if (data.rows.length > 1) {
      const previousValue = data.rows[1]?.[metricKey];
      if (previousValue && previousValue !== 0) {
        trendPercent = ((currentValue - previousValue) / previousValue) * 100;
      }
    }

    // Prepare bar data (last 5-6 periods)
    const barData = data.rows
      .slice(0, 6)
      .reverse()
      .map((row: any, index: number) => ({
        value: row[metricKey] || 0,
        month: ["Apr", "May", "Jun", "Jul", "Aug", "Sep"][index] || `P${index}`,
      }));

    const maxValue = Math.max(...barData.map((d) => d.value));
    const isPositive = trendPercent >= 0;

    return (
      <div className="group relative bg-[#141414] rounded-2xl p-8 border border-[#2a2a2a] hover:border-orange-500/50 shadow-xl hover:shadow-2xl hover:shadow-orange-500/20 transition-all duration-300">
        {/* Decorative background */}
        <div className={`absolute top-0 right-0 w-56 h-56 bg-gradient-to-br ${isPositive ? 'from-green-400/20 via-emerald-300/10' : 'from-orange-400/20 via-amber-300/10'} to-transparent rounded-full blur-3xl`} />
        <div className="absolute -bottom-8 -left-8 w-40 h-40 bg-gradient-to-tr from-gray-100 to-transparent rounded-full blur-3xl" />
        
        <div className="relative z-10">
          {/* Header */}
          <div className="flex items-start justify-between mb-6">
            <div className="flex items-center gap-3">
              <div className={`p-3 ${isPositive ? 'bg-green-50' : 'bg-orange-50'} rounded-2xl`}>
                <svg className={`w-6 h-6 ${isPositive ? 'text-green-600' : 'text-orange-600'}`} fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M16 8v8m-4-5v5m-4-2v2m-2 4h12a2 2 0 002-2V6a2 2 0 00-2-2H6a2 2 0 00-2 2v12a2 2 0 002 2z" />
                </svg>
              </div>
              <div>
                <h3 className="text-sm font-semibold text-gray-400 uppercase tracking-wider">
                  {chart.name}
                </h3>
              </div>
            </div>
          </div>

          <div className="flex items-end justify-between mb-6">
            <div>
              <div className="text-6xl font-black text-white mb-3 tracking-tight">
                {formattedValue}
              </div>
              {trendPercent !== 0 && (
                <div
                  className={`inline-flex items-center gap-2 px-4 py-2 rounded-2xl text-sm font-bold ${
                    isPositive 
                      ? "bg-gradient-to-r from-green-500 to-emerald-500 text-white shadow-lg shadow-green-500/30" 
                      : "bg-gradient-to-r from-orange-500 to-amber-500 text-white shadow-lg shadow-orange-500/30"
                  }`}
                >
                  <svg
                    className={`w-4 h-4 ${isPositive ? "" : "rotate-180"}`}
                    fill="currentColor"
                    viewBox="0 0 20 20"
                  >
                    <path
                      fillRule="evenodd"
                      d="M5.293 9.707a1 1 0 010-1.414l4-4a1 1 0 011.414 0l4 4a1 1 0 01-1.414 1.414L11 7.414V15a1 1 0 11-2 0V7.414L6.707 9.707a1 1 0 01-1.414 0z"
                      clipRule="evenodd"
                    />
                  </svg>
                  <span>{Math.abs(trendPercent).toFixed(1)}% growth</span>
                </div>
              )}
            </div>

            {/* Mini Bar Chart */}
            <div className="flex items-end gap-2 h-24">
              {barData.map((item, index) => {
                const height = (item.value / maxValue) * 100;
                const isLast = index === barData.length - 1;
                return (
                  <div key={index} className="flex flex-col items-center gap-2 group/bar">
                    <div
                      className={`w-10 rounded-t-xl transition-all duration-500 hover:opacity-80 shadow-lg ${
                        isLast 
                          ? "bg-gradient-to-t from-green-500 to-emerald-400" 
                          : "bg-gradient-to-t from-gray-300 to-gray-200"
                      }`}
                      style={{ 
                        height: `${height}%`,
                        transitionDelay: `${index * 50}ms`
                      }}
                    />
                    <span className={`text-[10px] font-semibold uppercase tracking-wider ${
                      isLast ? 'text-green-600' : 'text-gray-400'
                    }`}>
                      {item.month}
                    </span>
                  </div>
                );
              })}
            </div>
          </div>

          {/* Footer */}
          <div className="pt-4 border-t border-[#2a2a2a]">
            <span className="text-xs text-gray-500 font-medium">Last 6 periods</span>
          </div>
        </div>
      </div>
    );
  }

  // Default fallback
  return (
    <div className="bg-[#141414] rounded-2xl p-8 border border-[#2a2a2a] shadow-xl">
      <p className="text-sm text-gray-500">Unknown KPI type: {kpiType}</p>
    </div>
  );
}

function formatValue(value: any, format?: string, withSign?: boolean): string {
  if (value === null || value === undefined) return "—";

  const num = typeof value === "number" ? value : parseFloat(value);
  if (isNaN(num)) return String(value);

  const sign = withSign ? (num >= 0 ? "+" : "") : "";

  switch (format) {
    case "currency":
      return sign + "$" + num.toLocaleString(undefined, {
        minimumFractionDigits: 0,
        maximumFractionDigits: 0,
      });
    case "percent":
      return sign + num.toFixed(1) + "%";
    case "decimal":
      return sign + num.toFixed(2);
    default:
      return sign + num.toLocaleString();
  }
}
