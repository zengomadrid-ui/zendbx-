"use client";

import { useState, useEffect } from "react";
import { createPortal } from "react-dom";
import { useRouter } from "next/navigation";
import { apiFetch } from "@/lib/fetch-utils";

interface TableInfo {
  name: string;
  columns: Array<{
    name: string;
    type: string;
    nullable: boolean;
    primary_key: boolean;
  }>;
}

interface VisualizerBuilderProps {
  dashboardId: string;
  chart?: any;
  onClose: () => void;
  onSave: () => void;
}

const CHART_TYPES = [
  { value: "bar", label: "Bar Chart", icon: "📊" },
  { value: "line", label: "Line Chart", icon: "📈" },
  { value: "pie", label: "Pie Chart", icon: "🥧" },
  { value: "kpi", label: "KPI Card", icon: "🎯" },
];

const AGGREGATIONS = [
  { value: "count", label: "Count", types: ["all"] },
  { value: "count_distinct", label: "Count Distinct", types: ["all"] },
  { value: "sum", label: "Sum", types: ["numeric"] },
  { value: "avg", label: "Average", types: ["numeric"] },
  { value: "min", label: "Minimum", types: ["numeric", "date", "timestamp"] },
  { value: "max", label: "Maximum", types: ["numeric", "date", "timestamp"] },
];

// Numeric column types that support SUM/AVG
const NUMERIC_TYPES = [
  "integer",
  "bigint",
  "smallint",
  "numeric",
  "decimal",
  "real",
  "double precision",
  "money",
  "int",
  "int2",
  "int4",
  "int8",
  "float4",
  "float8",
];

export default function VisualizerBuilder({
  dashboardId,
  chart,
  onClose,
  onSave,
}: VisualizerBuilderProps) {
  const router = useRouter();
  const [step, setStep] = useState(1);
  const [tables, setTables] = useState<TableInfo[]>([]);
  const [loading, setLoading] = useState(true);
  const [executing, setExecuting] = useState(false);

  // Configuration state
  const [chartName, setChartName] = useState(chart?.name || "");
  const [selectedTable, setSelectedTable] = useState(
    chart?.configuration?.table || ""
  );
  const [chartType, setChartType] = useState(
    chart?.configuration?.chart_type || "bar"
  );
  const [metrics, setMetrics] = useState<Array<{ column: string; aggregation: string }>>(
    chart?.configuration?.metrics || [{ column: "", aggregation: "count" }]
  );
  const [dimensions, setDimensions] = useState<Array<{ column: string; time_bucket?: string }>>(
    chart?.configuration?.dimensions || []
  );
  const [kpiConfig, setKpiConfig] = useState<{
    type: string;
    format: string;
    target?: number;
  }>(
    chart?.configuration?.kpi_config || {
      type: "simple",
      format: "number",
    }
  );

  // Preview data
  const [previewData, setPreviewData] = useState<any>(null);
  const [previewSql, setPreviewSql] = useState("");

  useEffect(() => {
    loadSchema();
  }, []);

  const loadSchema = async () => {
    try {
      const projectId = localStorage.getItem("current_project_id");
      const response = await apiFetch(
        `/api/visualizer/projects/${projectId}/schema`
      );

      if (response.ok) {
        const data = await response.json();
        setTables(data.tables || []);
      } else {
        console.error("Failed to load schema:", await response.text());
      }
    } catch (error) {
      console.error("Failed to load schema:", error);
    } finally {
      setLoading(false);
    }
  };

  const executeQuery = async () => {
    if (!selectedTable || metrics.length === 0) return;

    // Validate that at least one metric has a column selected
    const validMetrics = metrics.filter((m) => m.column);
    if (validMetrics.length === 0) {
      alert("Please select at least one column for metrics");
      return;
    }

    setExecuting(true);
    try {
      const projectId = localStorage.getItem("current_project_id");
      const response = await apiFetch(
        `/api/visualizer/projects/${projectId}/query`,
        {
          method: "POST",
          body: JSON.stringify({
            table: selectedTable,
            dimensions: dimensions.filter((d) => d.column),
            metrics: validMetrics,
            filters: [],
            limit: 100,
          }),
        }
      );

      if (response.ok) {
        const data = await response.json();
        setPreviewData(data);
        setPreviewSql(data.generated_sql);
      } else {
        const error = await response.json();
        const errorMsg = error.detail || "Query execution failed";
        
        // Provide helpful error messages
        if (errorMsg.includes("function sum(uuid)")) {
          alert("❌ Cannot use SUM on UUID columns. Use COUNT instead.");
        } else if (errorMsg.includes("function avg(") || errorMsg.includes("function sum(")) {
          alert("❌ SUM and AVG only work on numeric columns. Use COUNT for text/UUID columns.");
        } else {
          alert(`Query failed: ${errorMsg}`);
        }
      }
    } catch (error) {
      console.error("Query execution error:", error);
      alert("Failed to execute query. Check console for details.");
    } finally {
      setExecuting(false);
    }
  };

  const saveChart = async () => {
    console.log("saveChart called", { chartName, selectedTable, metrics });
    
    if (!chartName || !selectedTable || metrics.length === 0) {
      alert("Please fill in all required fields");
      return;
    }

    // Validate that at least one metric has a column selected
    const validMetrics = metrics.filter((m) => m.column);
    if (validMetrics.length === 0) {
      alert("Please select at least one column for metrics");
      return;
    }

    console.log("Validation passed, saving chart...");

    try {
      const projectId = localStorage.getItem("current_project_id");
      const configuration = {
        table: selectedTable,
        chart_type: chartType,
        dimensions: dimensions.filter((d) => d.column),
        metrics: validMetrics,
        filters: [],
        limit: 100,
        kpi_config: chartType === "kpi" ? kpiConfig : undefined,
      };

      console.log("Configuration:", configuration);

      const url = chart
        ? `/api/visualizer/projects/${projectId}/charts/${chart.id}`
        : `/api/visualizer/projects/${projectId}/charts`;

      console.log("Making request to:", url);

      const response = await apiFetch(url, {
        method: chart ? "PUT" : "POST",
        body: JSON.stringify({
          dashboard_id: dashboardId,
          name: chartName,
          configuration,
        }),
      });

      console.log("Response received:", response.status);

      if (response.ok) {
        console.log("Chart saved successfully!");
        const savedChart = await response.json();
        
        // If it's a pie, line, or bar chart, redirect to preview page
        if (chartType === "pie" || chartType === "line" || chartType === "bar") {
          router.push(`/dashboard/visualizer/preview/${savedChart.id}`);
        } else {
          onSave();
        }
      } else {
        const error = await response.json();
        console.error("Save failed:", error);
        alert(`Failed to save chart: ${error.detail}`);
      }
    } catch (error) {
      console.error("Save error:", error);
      alert("Failed to save chart");
    }
  };

  const selectedTableInfo = tables.find((t) => t.name === selectedTable);

  // Helper to check if column is numeric
  const isNumericColumn = (columnType: string) => {
    const lowerType = columnType.toLowerCase();
    return NUMERIC_TYPES.some((t) => lowerType.includes(t));
  };

  // Helper to get valid aggregations for a column
  const getValidAggregations = (columnType: string) => {
    if (!columnType) return AGGREGATIONS;
    
    const lowerType = columnType.toLowerCase();
    const isNumeric = isNumericColumn(columnType);
    const isDate = lowerType.includes("date") || lowerType.includes("timestamp");
    
    return AGGREGATIONS.filter((agg) => {
      if (agg.types.includes("all")) return true;
      if (agg.types.includes("numeric") && isNumeric) return true;
      if (agg.types.includes("date") && isDate) return true;
      return false;
    });
  };

  // Don't render on server (Next.js SSR safety)
  if (typeof window === 'undefined') return null;

  const modalContent = (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-[9999] p-4">
      <div className="bg-[#0a0a0a] border border-[#2a2a2a] rounded-lg w-full max-w-6xl h-[90vh] flex flex-col relative">
        {/* Header */}
        <div className="border-b border-[#2a2a2a] p-6 flex items-center justify-between">
          <h2 className="text-xl font-semibold text-white">
            {chart ? "Edit Chart" : "Create Chart"}
          </h2>
          <button
            onClick={onClose}
            className="p-2 hover:bg-[#1a1a1a] rounded transition-colors"
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
                d="M6 18L18 6M6 6l12 12"
              />
            </svg>
          </button>
        </div>

        {/* Content */}
        <div className="flex-1 overflow-hidden flex">
          {/* Left Panel - Configuration */}
          <div className="w-1/2 border-r border-[#2a2a2a] overflow-y-auto p-6">
            <div className="space-y-6">
              {/* Chart Name */}
              <div>
                <label className="block text-sm font-medium text-gray-300 mb-2">
                  Chart Name *
                </label>
                <input
                  type="text"
                  value={chartName}
                  onChange={(e) => setChartName(e.target.value)}
                  placeholder="Monthly Revenue"
                  className="w-full px-3 py-2 bg-[#141414] border border-[#2a2a2a] rounded text-white placeholder-gray-600 focus:outline-none focus:border-orange-500"
                />
              </div>

              {/* Table Selection */}
              <div>
                <label className="block text-sm font-medium text-gray-300 mb-2">
                  Data Source *
                </label>
                <select
                  value={selectedTable}
                  onChange={(e) => setSelectedTable(e.target.value)}
                  className="w-full px-3 py-2 bg-[#141414] border border-[#2a2a2a] rounded text-white focus:outline-none focus:border-orange-500"
                >
                  <option value="">Select a table...</option>
                  {tables.map((table) => (
                    <option key={table.name} value={table.name}>
                      {table.name}
                    </option>
                  ))}
                </select>
              </div>

              {/* Chart Type */}
              <div>
                <label className="block text-sm font-medium text-gray-300 mb-3">
                  Chart Type *
                </label>
                <div className="grid grid-cols-2 gap-3">
                  {CHART_TYPES.map((type) => (
                    <button
                      key={type.value}
                      type="button"
                      onClick={(e) => {
                        e.preventDefault();
                        e.stopPropagation();
                        setChartType(type.value);
                      }}
                      className={`group relative px-4 py-4 border-2 rounded-xl transition-all duration-200 ${
                        chartType === type.value
                          ? "border-orange-500 bg-gradient-to-br from-orange-500/20 to-orange-600/10 text-orange-400 shadow-lg shadow-orange-500/30 scale-105"
                          : "border-[#2a2a2a] bg-[#0a0a0a] hover:border-orange-500/60 hover:bg-orange-500/5 text-gray-400 hover:text-white hover:scale-102"
                      }`}
                    >
                      <div className="flex items-center gap-3">
                        <div className={`text-3xl transition-transform ${
                          chartType === type.value ? "scale-110" : "group-hover:scale-110"
                        }`}>
                          {type.icon}
                        </div>
                        <div className="text-left">
                          <div className="text-sm font-semibold">{type.label}</div>
                          {chartType === type.value && (
                            <div className="text-xs text-orange-400/70 mt-0.5">Selected</div>
                          )}
                        </div>
                      </div>
                      {chartType === type.value && (
                        <div className="absolute top-2 right-2">
                          <svg className="w-5 h-5 text-orange-500" fill="currentColor" viewBox="0 0 20 20">
                            <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zm3.707-9.293a1 1 0 00-1.414-1.414L9 10.586 7.707 9.293a1 1 0 00-1.414 1.414l2 2a1 1 0 001.414 0l4-4z" clipRule="evenodd"/>
                          </svg>
                        </div>
                      )}
                    </button>
                  ))}
                </div>
                
                {/* Pie Chart Tip */}
                {chartType === "pie" && (
                  <div className="mt-3 p-3 bg-blue-500/10 border border-blue-500/30 rounded-lg text-xs text-blue-400">
                    <strong>💡 Pie Chart Tip:</strong> Add a dimension below (e.g., category, status, type) to create multiple slices with different colors. Without a dimension, you'll only see one slice.
                  </div>
                )}
              </div>

              {/* Metrics */}
              {selectedTableInfo && (
                <div>
                  <label className="block text-sm font-medium text-gray-300 mb-2">
                    Metrics * <span className="text-gray-500 text-xs">(What to measure)</span>
                  </label>
                  {metrics.map((metric, index) => {
                    const selectedColumn = selectedTableInfo.columns.find(
                      (col) => col.name === metric.column
                    );
                    const validAggregations = selectedColumn
                      ? getValidAggregations(selectedColumn.type)
                      : AGGREGATIONS;
                    
                    return (
                      <div key={index} className="mb-3">
                        <div className="flex gap-2 mb-2">
                          <select
                            value={metric.column}
                            onChange={(e) => {
                              const newMetrics = [...metrics];
                              newMetrics[index].column = e.target.value;
                              
                              // Reset aggregation if it's not valid for new column
                              const newColumn = selectedTableInfo.columns.find(
                                (col) => col.name === e.target.value
                              );
                              if (newColumn) {
                                const validAggs = getValidAggregations(newColumn.type);
                                if (!validAggs.some((agg) => agg.value === metric.aggregation)) {
                                  newMetrics[index].aggregation = "count";
                                }
                              }
                              
                              setMetrics(newMetrics);
                            }}
                            className="flex-1 px-3 py-2 bg-[#141414] border border-[#2a2a2a] rounded text-white text-sm focus:outline-none focus:border-orange-500"
                          >
                            <option value="">Select column...</option>
                            {selectedTableInfo.columns.map((col) => (
                              <option key={col.name} value={col.name}>
                                {col.name} ({col.type})
                              </option>
                            ))}
                          </select>
                          <select
                            value={metric.aggregation}
                            onChange={(e) => {
                              const newMetrics = [...metrics];
                              newMetrics[index].aggregation = e.target.value;
                              setMetrics(newMetrics);
                            }}
                            className="w-40 px-3 py-2 bg-[#141414] border border-[#2a2a2a] rounded text-white text-sm focus:outline-none focus:border-orange-500"
                            disabled={!metric.column}
                          >
                            {validAggregations.map((agg) => (
                              <option key={agg.value} value={agg.value}>
                                {agg.label}
                              </option>
                            ))}
                          </select>
                          {metrics.length > 1 && (
                            <button
                              type="button"
                              onClick={() =>
                                setMetrics(metrics.filter((_, i) => i !== index))
                              }
                              className="p-2 hover:bg-[#1a1a1a] rounded text-gray-400 hover:text-red-500 transition-colors"
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
                                  d="M6 18L18 6M6 6l12 12"
                                />
                              </svg>
                            </button>
                          )}
                        </div>
                        {selectedColumn && !isNumericColumn(selectedColumn.type) && 
                         metric.aggregation !== "count" && metric.aggregation !== "count_distinct" && (
                          <div className="p-2 bg-yellow-500/10 border border-yellow-500/30 rounded text-yellow-400 text-xs">
                            <strong>⚠️ Note:</strong> {selectedColumn.type} columns only support COUNT aggregations.
                          </div>
                        )}
                      </div>
                    );
                  })}
                  <button
                    type="button"
                    onClick={() =>
                      setMetrics([...metrics, { column: "", aggregation: "count" }])
                    }
                    className="text-sm text-orange-500 hover:text-orange-400 flex items-center gap-1 mt-1 transition-colors"
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
                        d="M12 4v16m8-8H4"
                      />
                    </svg>
                    Add Metric
                  </button>
                </div>
              )}

              {/* Dimensions */}
              {selectedTableInfo && chartType !== "kpi" && (
                <div>
                  <label className="block text-sm font-medium text-gray-300 mb-2">
                    Dimensions 
                    {chartType === "pie" ? (
                      <span className="text-orange-500 text-xs ml-1">* Required for pie chart</span>
                    ) : (
                      <span className="text-gray-500 text-xs">(Group By - optional)</span>
                    )}
                  </label>
                  {chartType === "pie" && dimensions.length === 0 && (
                    <div className="mb-3 p-3 bg-orange-500/10 border border-orange-500/30 rounded text-xs text-orange-400">
                      ⚠️ Add a dimension to create multiple colored slices (e.g., status, category, type, region)
                    </div>
                  )}
                  {dimensions.map((dimension, index) => (
                    <div key={index} className="flex gap-2 mb-2">
                      <select
                        value={dimension.column}
                        onChange={(e) => {
                          const newDimensions = [...dimensions];
                          newDimensions[index].column = e.target.value;
                          setDimensions(newDimensions);
                        }}
                        className="flex-1 px-3 py-2 bg-[#141414] border border-[#2a2a2a] rounded text-white text-sm focus:outline-none focus:border-orange-500"
                      >
                        <option value="">Select column...</option>
                        {selectedTableInfo.columns.map((col) => (
                          <option key={col.name} value={col.name}>
                            {col.name} ({col.type})
                          </option>
                        ))}
                      </select>
                      <button
                        type="button"
                        onClick={() =>
                          setDimensions(dimensions.filter((_, i) => i !== index))
                        }
                        className="p-2 hover:bg-[#1a1a1a] rounded text-gray-400 hover:text-red-500 transition-colors"
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
                            d="M6 18L18 6M6 6l12 12"
                          />
                        </svg>
                      </button>
                    </div>
                  ))}
                  <button
                    type="button"
                    onClick={() =>
                      setDimensions([...dimensions, { column: "" }])
                    }
                    className="text-sm text-orange-500 hover:text-orange-400 flex items-center gap-1 mt-1 transition-colors"
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
                        d="M12 4v16m8-8H4"
                      />
                    </svg>
                    Add Dimension
                  </button>
                </div>
              )}

              {/* KPI Configuration */}
              {chartType === "kpi" && (
                <div className="space-y-4 p-4 bg-[#141414] border border-[#2a2a2a] rounded-lg">
                  <h3 className="text-sm font-semibold text-white mb-3">KPI Card Style</h3>
                  
                  {/* KPI Type */}
                  <div>
                    <label className="block text-xs font-medium text-gray-400 mb-2">
                      Display Type
                    </label>
                    <div className="grid grid-cols-2 gap-2">
                      <button
                        type="button"
                        onClick={() => setKpiConfig({ ...kpiConfig, type: "simple" })}
                        className={`px-3 py-2 text-xs rounded border transition-all ${
                          kpiConfig.type === "simple"
                            ? "border-orange-500 bg-orange-500/20 text-orange-400"
                            : "border-[#2a2a2a] bg-[#0a0a0a] text-gray-400 hover:border-orange-500/50"
                        }`}
                      >
                        Simple Number
                      </button>
                      <button
                        type="button"
                        onClick={() => setKpiConfig({ ...kpiConfig, type: "trend" })}
                        className={`px-3 py-2 text-xs rounded border transition-all ${
                          kpiConfig.type === "trend"
                            ? "border-orange-500 bg-orange-500/20 text-orange-400"
                            : "border-[#2a2a2a] bg-[#0a0a0a] text-gray-400 hover:border-orange-500/50"
                        }`}
                      >
                        With Sparkline
                      </button>
                      <button
                        type="button"
                        onClick={() => setKpiConfig({ ...kpiConfig, type: "progress" })}
                        className={`px-3 py-2 text-xs rounded border transition-all ${
                          kpiConfig.type === "progress"
                            ? "border-orange-500 bg-orange-500/20 text-orange-400"
                            : "border-[#2a2a2a] bg-[#0a0a0a] text-gray-400 hover:border-orange-500/50"
                        }`}
                      >
                        Progress Bar
                      </button>
                      <button
                        type="button"
                        onClick={() => setKpiConfig({ ...kpiConfig, type: "bar_trend" })}
                        className={`px-3 py-2 text-xs rounded border transition-all ${
                          kpiConfig.type === "bar_trend"
                            ? "border-orange-500 bg-orange-500/20 text-orange-400"
                            : "border-[#2a2a2a] bg-[#0a0a0a] text-gray-400 hover:border-orange-500/50"
                        }`}
                      >
                        Mini Bars
                      </button>
                      <button
                        type="button"
                        onClick={() => setKpiConfig({ ...kpiConfig, type: "breakdown" })}
                        className={`px-3 py-2 text-xs rounded border transition-all col-span-2 ${
                          kpiConfig.type === "breakdown"
                            ? "border-orange-500 bg-orange-500/20 text-orange-400"
                            : "border-[#2a2a2a] bg-[#0a0a0a] text-gray-400 hover:border-orange-500/50"
                        }`}
                      >
                        Category Breakdown
                      </button>
                    </div>
                  </div>

                  {/* Value Format */}
                  <div>
                    <label className="block text-xs font-medium text-gray-400 mb-2">
                      Number Format
                    </label>
                    <select
                      value={kpiConfig.format}
                      onChange={(e) => setKpiConfig({ ...kpiConfig, format: e.target.value })}
                      className="w-full px-3 py-2 bg-[#0a0a0a] border border-[#2a2a2a] rounded text-white text-sm focus:outline-none focus:border-orange-500"
                    >
                      <option value="number">Number (1,234)</option>
                      <option value="currency">Currency ($1,234)</option>
                      <option value="percent">Percent (12.5%)</option>
                      <option value="decimal">Decimal (1,234.56)</option>
                    </select>
                  </div>

                  {/* Target (for progress type) */}
                  {kpiConfig.type === "progress" && (
                    <div>
                      <label className="block text-xs font-medium text-gray-400 mb-2">
                        Target Value
                      </label>
                      <input
                        type="number"
                        value={kpiConfig.target || ""}
                        onChange={(e) =>
                          setKpiConfig({
                            ...kpiConfig,
                            target: parseFloat(e.target.value) || undefined,
                          })
                        }
                        placeholder="e.g., 10000"
                        className="w-full px-3 py-2 bg-[#0a0a0a] border border-[#2a2a2a] rounded text-white text-sm focus:outline-none focus:border-orange-500"
                      />
                    </div>
                  )}

                  {/* Breakdown Note */}
                  {kpiConfig.type === "breakdown" && (
                    <div className="p-3 bg-blue-500/10 border border-blue-500/30 rounded text-xs text-blue-400">
                      <strong>💡 Tip:</strong> Add a dimension below to group data by category (e.g., status, type, source).
                    </div>
                  )}
                </div>
              )}

              {/* Dimensions for breakdown KPI */}
              {selectedTableInfo && chartType === "kpi" && kpiConfig.type === "breakdown" && (
                <div>
                  <label className="block text-sm font-medium text-gray-300 mb-2">
                    Category Dimension * <span className="text-gray-500 text-xs">(Required for breakdown)</span>
                  </label>
                  {dimensions.length === 0 && (
                    <button
                      type="button"
                      onClick={() => setDimensions([{ column: "" }])}
                      className="w-full px-3 py-2 border-2 border-dashed border-[#2a2a2a] rounded text-gray-500 hover:border-orange-500/50 hover:text-orange-500 transition-colors"
                    >
                      + Add Dimension
                    </button>
                  )}
                  {dimensions.map((dimension, index) => (
                    <div key={index} className="flex gap-2 mb-2">
                      <select
                        value={dimension.column}
                        onChange={(e) => {
                          const newDimensions = [...dimensions];
                          newDimensions[index].column = e.target.value;
                          setDimensions(newDimensions);
                        }}
                        className="flex-1 px-3 py-2 bg-[#141414] border border-[#2a2a2a] rounded text-white text-sm focus:outline-none focus:border-orange-500"
                      >
                        <option value="">Select column...</option>
                        {selectedTableInfo.columns.map((col) => (
                          <option key={col.name} value={col.name}>
                            {col.name} ({col.type})
                          </option>
                        ))}
                      </select>
                      <button
                        type="button"
                        onClick={() => setDimensions([])}
                        className="p-2 hover:bg-[#1a1a1a] rounded text-gray-400 hover:text-red-500 transition-colors"
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
                            d="M6 18L18 6M6 6l12 12"
                          />
                        </svg>
                      </button>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>

          {/* Right Panel - Preview */}
          <div className="w-1/2 overflow-y-auto p-6">
            <div className="space-y-4">
              <button
                onClick={executeQuery}
                disabled={!selectedTable || metrics.length === 0 || executing}
                className="w-full px-4 py-3 bg-orange-500 hover:bg-orange-600 disabled:bg-gray-700 disabled:cursor-not-allowed rounded transition-colors flex items-center justify-center gap-2"
              >
                {executing ? (
                  <>
                    <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-white"></div>
                    Executing...
                  </>
                ) : (
                  <>
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
                        d="M14.752 11.168l-3.197-2.132A1 1 0 0010 9.87v4.263a1 1 0 001.555.832l3.197-2.132a1 1 0 000-1.664z"
                      />
                      <path
                        strokeLinecap="round"
                        strokeLinejoin="round"
                        strokeWidth={2}
                        d="M21 12a9 9 0 11-18 0 9 9 0 0118 0z"
                      />
                    </svg>
                    Run Query
                  </>
                )}
              </button>

              {previewData && (
                <>
                  <div className="bg-[#141414] border border-[#2a2a2a] rounded p-4">
                    <div className="text-sm text-gray-400 mb-2">
                      {previewData.row_count} rows • {previewData.execution_time_ms}ms
                    </div>
                    <div className="max-h-96 overflow-auto">
                      {previewData.row_count > 0 ? (
                        <table className="w-full text-sm">
                          <thead className="bg-[#0a0a0a] sticky top-0">
                            <tr>
                              {previewData.columns.map((col: string) => (
                                <th
                                  key={col}
                                  className="px-3 py-2 text-left text-gray-400 font-medium"
                                >
                                  {col}
                                </th>
                              ))}
                            </tr>
                          </thead>
                          <tbody>
                            {previewData.rows.slice(0, 50).map((row: any, i: number) => (
                              <tr key={i} className="border-t border-[#2a2a2a]">
                                {previewData.columns.map((col: string) => (
                                  <td key={col} className="px-3 py-2 text-gray-300">
                                    {row[col] !== null ? String(row[col]) : "NULL"}
                                  </td>
                                ))}
                              </tr>
                            ))}
                          </tbody>
                        </table>
                      ) : (
                        <div className="text-center text-gray-500 py-8">
                          No data returned
                        </div>
                      )}
                    </div>
                  </div>

                  {previewSql && (
                    <details className="bg-[#141414] border border-[#2a2a2a] rounded">
                      <summary className="px-4 py-3 cursor-pointer text-sm text-gray-400 hover:text-white">
                        Generated SQL
                      </summary>
                      <pre className="px-4 pb-4 text-xs text-gray-500 overflow-x-auto">
                        {previewSql}
                      </pre>
                    </details>
                  )}
                </>
              )}
            </div>
          </div>
        </div>

        {/* Footer */}
        <div className="border-t border-[#2a2a2a] p-6 flex justify-end gap-3">
          <button
            onClick={onClose}
            className="px-6 py-2 bg-[#1a1a1a] hover:bg-[#2a2a2a] border border-[#2a2a2a] rounded transition-colors"
          >
            Cancel
          </button>
          <button
            onClick={(e) => {
              console.log("Create Chart button clicked!");
              e.preventDefault();
              e.stopPropagation();
              saveChart();
            }}
            disabled={!chartName || !selectedTable || metrics.length === 0}
            className="px-6 py-2 bg-orange-500 hover:bg-orange-600 disabled:bg-gray-700 disabled:cursor-not-allowed rounded transition-colors"
          >
            {chart ? "Update Chart" : "Create Chart"}
          </button>
        </div>
      </div>
    </div>
  );

  // Render modal using Portal to ensure it's on top of everything
  return createPortal(modalContent, document.body);
}
