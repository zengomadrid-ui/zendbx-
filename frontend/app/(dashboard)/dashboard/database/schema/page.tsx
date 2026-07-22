"use client";

import { apiFetch } from '@/lib/fetch-utils';
import { useState, useEffect, useRef } from "react";

interface Column {
  name: string;
  type: string;
  nullable: boolean;
  default: string | null;
  primary_key: boolean;
}

interface Table {
  table_name: string;
  columns: Column[];
  x?: number;
  y?: number;
}

interface Relationship {
  from_table: string;
  from_column: string;
  to_table: string;
  to_column: string;
  constraint_name: string;
}

export default function SchemaVisualizerPage() {
  const [schema, setSchema] = useState<{ tables: Table[]; relationships: Relationship[] }>({
    tables: [],
    relationships: []
  });
  const [selectedTable, setSelectedTable] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState('');
  const [zoom, setZoom] = useState(100);
  const [showLinks, setShowLinks] = useState(true);
  const [pan, setPan] = useState({ x: 0, y: 0 });
  const [isPanning, setIsPanning] = useState(false);
  const [panStart, setPanStart] = useState({ x: 0, y: 0 });
  const [draggingTable, setDraggingTable] = useState<string | null>(null);
  const [dragStart, setDragStart] = useState({ x: 0, y: 0 });
  const canvasRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    fetchSchema();
  }, []);

  const fetchSchema = async () => {
    try {
      const projectId = localStorage.getItem("current_project_id");
      const response = await apiFetch(`api/projects/${projectId}/db/schema`, {
        headers: { "x-project-id": projectId || "" }
      });
      
      if (response.ok) {
        const data = await response.json();
        const parsedTables = (data.tables || []).map((table: any, index: number) => ({
          ...table,
          columns: typeof table.columns === 'string' ? JSON.parse(table.columns) : table.columns,
          // Auto-layout tables in a grid
          x: 50 + (index % 3) * 320,
          y: 50 + Math.floor(index / 3) * 300,
        }));
        setSchema({
          tables: parsedTables,
          relationships: data.relationships || []
        });
      }
    } catch (error) {
      console.error("Failed to fetch schema:", error);
    } finally {
      setLoading(false);
    }
  };

  const getRelationshipsForTable = (tableName: string) => {
    return schema.relationships.filter(r => {
      const fromTableName = r.from_table.split('.').pop() || r.from_table;
      const toTableName = r.to_table.split('.').pop() || r.to_table;
      return fromTableName === tableName || toTableName === tableName;
    });
  };

  const filteredTables = schema.tables.filter(table =>
    table.table_name.toLowerCase().includes(searchQuery.toLowerCase())
  );

  const handleMouseDown = (e: React.MouseEvent) => {
    if (e.button === 0 && (e.target as HTMLElement).classList.contains('canvas-area')) {
      setIsPanning(true);
      setPanStart({ x: e.clientX - pan.x, y: e.clientY - pan.y });
      e.preventDefault();
    }
  };

  const handleMouseMove = (e: React.MouseEvent) => {
    if (isPanning) {
      e.preventDefault();
      setPan({
        x: e.clientX - panStart.x,
        y: e.clientY - panStart.y
      });
    }
  };

  const handleMouseUp = () => {
    setIsPanning(false);
  };

  const handleTableMouseDown = (e: React.MouseEvent, tableName: string) => {
    e.stopPropagation();
    setDraggingTable(tableName);
    const table = schema.tables.find(t => t.table_name === tableName);
    if (table) {
      setDragStart({
        x: e.clientX - (table.x || 0) * (zoom / 100),
        y: e.clientY - (table.y || 0) * (zoom / 100)
      });
    }
  };

  const handleTableMouseMove = (e: React.MouseEvent) => {
    if (draggingTable) {
      e.preventDefault();
      
      // Use requestAnimationFrame for smooth updates
      requestAnimationFrame(() => {
        const newX = (e.clientX - dragStart.x) / (zoom / 100);
        const newY = (e.clientY - dragStart.y) / (zoom / 100);
        
        setSchema(prev => ({
          ...prev,
          tables: prev.tables.map(t =>
            t.table_name === draggingTable
              ? { ...t, x: newX, y: newY }
              : t
          )
        }));
      });
    }
  };

  const handleTableMouseUp = () => {
    setDraggingTable(null);
  };

  if (loading) {
    return (
      <div className="h-full flex items-center justify-center bg-[#0a0a0a]">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-orange-500 mx-auto mb-4"></div>
          <div className="text-gray-400">Loading schema...</div>
        </div>
      </div>
    );
  }

  return (
    <div className="h-full flex bg-[#0a0a0a]">
      {/* Left Sidebar - Table List */}
      <div className="w-72 bg-[#0a0a0a] border-r border-[#2a2a2a] flex flex-col">
        {/* Sidebar Header */}
        <div className="p-4 border-b border-[#2a2a2a]">
          <h2 className="text-sm font-semibold text-white mb-1">Schema Visualizer</h2>
          <p className="text-xs text-gray-500">{schema.tables.length} tables • {schema.relationships.length} relationships</p>
        </div>

        {/* Search */}
        <div className="p-4 border-b border-[#2a2a2a]">
          <div className="relative">
            <svg className="absolute left-3 top-1/2 transform -translate-y-1/2 w-4 h-4 text-gray-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
            </svg>
            <input
              type="text"
              placeholder="Search tables..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="w-full pl-10 pr-4 py-2 bg-[#141414] border border-[#2a2a2a] rounded text-sm text-white placeholder-gray-600 focus:outline-none focus:border-orange-500 transition-colors"
            />
          </div>
        </div>

        {/* Tables List */}
        <div className="flex-1 overflow-y-auto">
          {filteredTables.map((table) => {
            const columns = Array.isArray(table.columns) ? table.columns : [];
            const isSelected = selectedTable === table.table_name;
            
            return (
              <button
                key={table.table_name}
                onClick={() => setSelectedTable(table.table_name)}
                className={`w-full px-4 py-2.5 text-left text-sm transition-colors border-l-2 ${
                  isSelected
                    ? 'bg-[#1a1a1a] text-white border-orange-500'
                    : 'text-gray-400 hover:text-white hover:bg-[#141414] border-transparent'
                }`}
              >
                <div className="flex items-center gap-2">
                  <svg className="w-4 h-4 flex-shrink-0 text-orange-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 10h18M3 14h18m-9-4v8m-7 0h14a2 2 0 002-2V8a2 2 0 00-2-2H5a2 2 0 00-2 2v8a2 2 0 002 2z" />
                  </svg>
                  <div className="flex-1 min-w-0">
                    <div className="truncate">{table.table_name}</div>
                    <div className="text-xs text-gray-600 mt-0.5">{columns.length} columns</div>
                  </div>
                  <svg className="w-3 h-3 flex-shrink-0 text-gray-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
                  </svg>
                </div>
              </button>
            );
          })}
        </div>
      </div>

      {/* Main Canvas Area */}
      <div className="flex-1 flex flex-col">
        {/* Top Toolbar */}
        <div className="h-14 bg-[#0a0a0a] border-b border-[#2a2a2a] px-4 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <span className="text-sm text-gray-500">{schema.tables.length} tables</span>
            {showLinks && schema.relationships.length > 0 && (
              <>
                <div className="h-4 w-px bg-[#2a2a2a]"></div>
                <span className="text-sm text-gray-500">{schema.relationships.length} links</span>
              </>
            )}
            <button
              onClick={() => setShowLinks(!showLinks)}
              className={`ml-2 px-3 py-1.5 text-xs rounded transition-colors ${
                showLinks ? 'bg-orange-500 text-white' : 'bg-[#1a1a1a] text-gray-400 hover:text-white'
              }`}
            >
              <div className="flex items-center gap-1.5">
                <svg className="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13.828 10.172a4 4 0 00-5.656 0l-4 4a4 4 0 105.656 5.656l1.102-1.101m-.758-4.899a4 4 0 005.656 0l4-4a4 4 0 00-5.656-5.656l-1.1 1.1" />
                </svg>
                Links
              </div>
            </button>
          </div>

          <div className="flex items-center gap-2">
            <div className="flex items-center gap-2 px-3 py-1.5 bg-[#1a1a1a] rounded text-sm">
              <button
                onClick={() => setZoom(Math.max(25, zoom - 25))}
                className="text-gray-400 hover:text-orange-500 transition-colors"
              >
                <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M20 12H4" />
                </svg>
              </button>
              <span className="text-gray-400 w-12 text-center">{zoom}%</span>
              <button
                onClick={() => setZoom(Math.min(200, zoom + 25))}
                className="text-gray-400 hover:text-orange-500 transition-colors"
              >
                <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
                </svg>
              </button>
            </div>
            <button 
              onClick={fetchSchema}
              className="p-2 hover:bg-[#1a1a1a] rounded text-gray-400 hover:text-orange-500 transition-colors"
            >
              <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
              </svg>
            </button>
            <button className="p-2 hover:bg-[#1a1a1a] rounded text-gray-400 hover:text-orange-500 transition-colors">
              <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 8V4m0 0h4M4 4l5 5m11-1V4m0 0h-4m4 0l-5 5M4 16v4m0 0h4m-4 0l5-5m11 5l-5-5m5 5v-4m0 4h-4" />
              </svg>
            </button>
          </div>
        </div>

        {/* Canvas */}
        <div 
          ref={canvasRef}
          className="flex-1 relative overflow-hidden canvas-area"
          style={{
            backgroundImage: `
              linear-gradient(#1a1a1a 1px, transparent 1px),
              linear-gradient(90deg, #1a1a1a 1px, transparent 1px)
            `,
            backgroundSize: '20px 20px',
            backgroundColor: '#0a0a0a',
            cursor: isPanning ? 'grabbing' : draggingTable ? 'grabbing' : 'grab'
          }}
          onMouseDown={handleMouseDown}
          onMouseMove={(e) => {
            handleMouseMove(e);
            handleTableMouseMove(e);
          }}
          onMouseUp={() => {
            handleMouseUp();
            handleTableMouseUp();
          }}
          onMouseLeave={() => {
            handleMouseUp();
            handleTableMouseUp();
          }}
        >
          {/* SVG for relationship lines - outside transform */}
          {showLinks && (
            <svg
              className="absolute inset-0 pointer-events-none"
              style={{ 
                width: '100%', 
                height: '100%', 
                zIndex: 1,
                overflow: 'visible'
              }}
            >
              {schema.relationships.length === 0 ? (
                // Debug: Show a test line if no relationships
                <line
                  x1="100"
                  y1="100"
                  x2="300"
                  y2="200"
                  stroke="#f97316"
                  strokeWidth="2"
                  strokeDasharray="5,5"
                  opacity="0.3"
                />
              ) : (
                schema.relationships.map((rel, idx) => {
                  // Remove schema prefix from relationship table names to match with table list
                  const getTableName = (fullName: string) => {
                    const parts = fullName.split('.');
                    return parts.length > 1 ? parts[1] : fullName;
                  };
                  
                  const fromTableName = getTableName(rel.from_table);
                  const toTableName = getTableName(rel.to_table);
                  
                  const fromTable = schema.tables.find(t => t.table_name === fromTableName);
                  const toTable = schema.tables.find(t => t.table_name === toTableName);
                  
                  if (!fromTable || !toTable) {
                    // Skip relationships to tables in other projects
                    return null;
                  }
                  
                  // Calculate absolute positions with pan and zoom
                  // Card dimensions
                  const cardWidth = 280 * (zoom / 100);
                  const cardHeight = 150 * (zoom / 100);
                  
                  const fromCardX = (fromTable.x || 0) * (zoom / 100) + pan.x;
                  const fromCardY = (fromTable.y || 0) * (zoom / 100) + pan.y;
                  const toCardX = (toTable.x || 0) * (zoom / 100) + pan.x;
                  const toCardY = (toTable.y || 0) * (zoom / 100) + pan.y;
                  
                  // Determine connection points based on relative position
                  const dx = (toTable.x || 0) - (fromTable.x || 0);
                  const dy = (toTable.y || 0) - (fromTable.y || 0);
                  
                  let fromX, fromY, toX, toY;
                  
                  // Connect from right edge if target is to the right, else from left edge
                  if (dx > 50) {
                    fromX = fromCardX + cardWidth;
                    fromY = fromCardY + cardHeight / 2;
                    toX = toCardX;
                    toY = toCardY + cardHeight / 2;
                  } else if (dx < -50) {
                    fromX = fromCardX;
                    fromY = fromCardY + cardHeight / 2;
                    toX = toCardX + cardWidth;
                    toY = toCardY + cardHeight / 2;
                  } else {
                    // Vertical connection
                    fromX = fromCardX + cardWidth / 2;
                    fromY = dy > 0 ? fromCardY + cardHeight : fromCardY;
                    toX = toCardX + cardWidth / 2;
                    toY = dy > 0 ? toCardY : toCardY + cardHeight;
                  }
                  
                  // Create orthogonal (step-based) path like flowcharts
                  const distance = Math.abs(toX - fromX);
                  const midX = (fromX + toX) / 2;
                  
                  let path;
                  
                  if (Math.abs(dx) > 50) {
                    // Horizontal connection with right-angle bends
                    path = `M ${fromX} ${fromY} L ${midX} ${fromY} L ${midX} ${toY} L ${toX} ${toY}`;
                  } else {
                    // Vertical connection with right-angle bends
                    const midY = (fromY + toY) / 2;
                    path = `M ${fromX} ${fromY} L ${fromX} ${midY} L ${toX} ${midY} L ${toX} ${toY}`;
                  }
                  
                  return (
                    <g key={idx}>
                      {/* Subtle glow effect */}
                      <path
                        d={path}
                        stroke="#f97316"
                        strokeWidth="2"
                        fill="none"
                        opacity="0.15"
                        filter="blur(2px)"
                      />
                      {/* Main thin line */}
                      <path
                        d={path}
                        stroke="#f97316"
                        strokeWidth="1.5"
                        fill="none"
                        opacity="0.95"
                        strokeLinecap="square"
                        strokeLinejoin="miter"
                      />
                      {/* Small connection dots */}
                      <circle cx={fromX} cy={fromY} r="2.5" fill="#f97316" opacity="1" />
                      <circle cx={toX} cy={toY} r="2.5" fill="#f97316" opacity="1" />
                    </g>
                  );
                })
              )}
            </svg>
          )}

          {/* Transform container */}
          <div
            className="pointer-events-none"
            style={{
              transform: `translate(${pan.x}px, ${pan.y}px) scale(${zoom / 100})`,
              transformOrigin: '0 0',
              transition: isPanning || draggingTable ? 'none' : 'transform 0.1s ease-out',
              width: '100%',
              height: '100%',
              position: 'relative',
              zIndex: 2
            }}
          >
            {/* Empty State */}
            {schema.tables.length === 0 ? (
              <div className="absolute inset-0 flex items-center justify-center">
                <div className="text-center">
                  <svg className="w-16 h-16 mx-auto text-gray-700 mb-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1} d="M4 7v10c0 2.21 3.582 4 8 4s8-1.79 8-4V7M4 7c0 2.21 3.582 4 8 4s8-1.79 8-4M4 7c0-2.21 3.582-4 8-4s8 1.79 8 4m0 5c0 2.21-3.582 4-8 4s-8-1.79-8-4" />
                  </svg>
                  <h3 className="text-lg font-medium text-white mb-2">No tables found</h3>
                  <p className="text-sm text-gray-500">Create your first table to visualize your schema</p>
                </div>
              </div>
            ) : (
              /* Table Cards */
              <div className="relative" style={{ pointerEvents: 'none' }}>
                {filteredTables.map((table) => {
                  const columns = Array.isArray(table.columns) ? table.columns : [];
                  const isSelected = selectedTable === table.table_name;
                  const relationships = getRelationshipsForTable(table.table_name);
                  
                  return (
                    <div
                      key={table.table_name}
                      onMouseDown={(e) => handleTableMouseDown(e, table.table_name)}
                      onClick={(e) => {
                        e.stopPropagation();
                        setSelectedTable(table.table_name);
                      }}
                      className={`absolute bg-[#0f0f0f] border rounded-lg overflow-hidden transition-all hover:shadow-2xl ${
                        isSelected ? 'border-orange-500 shadow-2xl shadow-orange-500/20' : 'border-[#2a2a2a]'
                      } ${draggingTable === table.table_name ? 'cursor-grabbing' : 'cursor-grab'}`}
                      style={{
                        left: table.x,
                        top: table.y,
                        width: '280px',
                        pointerEvents: 'auto',
                        userSelect: 'none'
                      }}
                    >
                    {/* Table Header */}
                    <div className="px-4 py-3 bg-[#1a1a1a] border-b border-[#2a2a2a] flex items-center justify-between">
                      <div className="flex items-center gap-2 flex-1 min-w-0">
                        <svg className="w-4 h-4 text-orange-500 flex-shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 10h18M3 14h18m-9-4v8m-7 0h14a2 2 0 002-2V8a2 2 0 00-2-2H5a2 2 0 00-2 2v8a2 2 0 002 2z" />
                        </svg>
                        <span className="text-white text-sm font-medium truncate">{table.table_name}</span>
                      </div>
                      {relationships.length > 0 && (
                        <span className="text-xs px-2 py-0.5 bg-orange-500/10 text-orange-400 rounded">
                          {relationships.length}
                        </span>
                      )}
                    </div>

                    {/* Columns */}
                    <div className="max-h-64 overflow-y-auto">
                      {columns.slice(0, 10).map((column, idx) => (
                        <div
                          key={idx}
                          className="px-4 py-2 border-b border-[#1a1a1a] hover:bg-[#1a1a1a] transition-colors flex items-center gap-3"
                        >
                          {column.primary_key ? (
                            <svg className="w-3 h-3 text-yellow-400 flex-shrink-0" fill="currentColor" viewBox="0 0 20 20">
                              <path fillRule="evenodd" d="M5 9V7a5 5 0 0110 0v2a2 2 0 012 2v5a2 2 0 01-2 2H5a2 2 0 01-2-2v-5a2 2 0 012-2zm8-2v2H7V7a3 3 0 016 0z" clipRule="evenodd" />
                            </svg>
                          ) : (
                            <div className="w-3 h-3 flex-shrink-0"></div>
                          )}
                          <span className="text-xs text-white truncate flex-1">{column.name}</span>
                          <span className="text-xs text-gray-500 font-mono flex-shrink-0">{column.type}</span>
                        </div>
                      ))}
                      {columns.length > 10 && (
                        <div className="px-4 py-2 text-center text-xs text-gray-600">
                          +{columns.length - 10} more columns
                        </div>
                      )}
                    </div>
                  </div>
                );
              })}
              </div>
            )}
          </div>

          {/* Helper Text */}
          <div className="absolute bottom-4 left-4 px-4 py-2.5 bg-[#1a1a1a]/95 backdrop-blur border border-[#2a2a2a] rounded-lg text-xs text-gray-400 flex items-center gap-5">
            <span className="flex items-center gap-2">
              <svg className="w-3.5 h-3.5 text-orange-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 15l-2 5L9 9l11 4-5 2zm0 0l5 5M7.188 2.239l.777 2.897M5.136 7.965l-2.898-.777M13.95 4.05l-2.122 2.122m-5.657 5.656l-2.12 2.122" />
              </svg>
              <span className="text-white">Drag to pan</span>
            </span>
            <div className="h-4 w-px bg-[#2a2a2a]"></div>
            <span className="flex items-center gap-2">
              <svg className="w-3.5 h-3.5 text-yellow-400" fill="currentColor" viewBox="0 0 20 20">
                <path fillRule="evenodd" d="M5 9V7a5 5 0 0110 0v2a2 2 0 012 2v5a2 2 0 01-2 2H5a2 2 0 01-2-2v-5a2 2 0 012-2zm8-2v2H7V7a3 3 0 016 0z" clipRule="evenodd" />
              </svg>
              <span className="text-white">Primary key</span>
            </span>
            <div className="h-4 w-px bg-[#2a2a2a]"></div>
            <span className="flex items-center gap-2">
              <svg className="w-3.5 h-3.5 text-orange-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13.828 10.172a4 4 0 00-5.656 0l-4 4a4 4 0 105.656 5.656l1.102-1.101m-.758-4.899a4 4 0 005.656 0l4-4a4 4 0 00-5.656-5.656l-1.1 1.1" />
              </svg>
              <span className="text-white">Relationship</span>
            </span>
          </div>
        </div>
      </div>
    </div>
  );
}
