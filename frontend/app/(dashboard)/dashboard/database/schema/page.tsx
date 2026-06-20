"use client";

import { apiFetch } from '@/lib/fetch-utils';
import { useState, useEffect } from "react";

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
  const [selectedTable, setSelectedTable] = useState<Table | null>(null);
  const [loading, setLoading] = useState(true);
  const [viewMode, setViewMode] = useState<'diagram' | 'list'>('diagram');

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
        // Parse columns if they come as JSON string
        const parsedTables = (data.tables || []).map((table: any) => ({
          ...table,
          columns: typeof table.columns === 'string' ? JSON.parse(table.columns) : table.columns
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
    return schema.relationships.filter(
      r => r.from_table === tableName || r.to_table === tableName
    );
  };

  if (loading) {
    return (
      <div className="h-full flex items-center justify-center bg-[#1c1c1c]">
        <div className="text-[#a1a1a1]">Loading schema...</div>
      </div>
    );
  }

  return (
    <div className="h-full flex flex-col bg-[#1c1c1c]">
      {/* Header */}
      <div className="bg-[#181818] border-b border-[#2a2a2a] px-6 py-4">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-xl font-semibold text-[#ededed]">Database Schema</h1>
            <p className="text-sm text-[#6b6b6b] mt-1">
              {schema.tables.length} tables • {schema.relationships.length} relationships
            </p>
          </div>
          <div className="flex gap-2">
            <button
              onClick={() => setViewMode('diagram')}
              className={`px-3 py-1.5 text-sm rounded transition-colors ${
                viewMode === 'diagram'
                  ? 'bg-green-600 text-white'
                  : 'bg-[#2a2a2a] text-[#a1a1a1] hover:bg-[#3a3a3a] hover:text-[#ededed]'
              }`}
            >
              Diagram View
            </button>
            <button
              onClick={() => setViewMode('list')}
              className={`px-3 py-1.5 text-sm rounded transition-colors ${
                viewMode === 'list'
                  ? 'bg-green-600 text-white'
                  : 'bg-[#2a2a2a] text-[#a1a1a1] hover:bg-[#3a3a3a] hover:text-[#ededed]'
              }`}
            >
              List View
            </button>
          </div>
        </div>
      </div>

      {/* Content */}
      <div className="flex-1 overflow-hidden">
        {viewMode === 'diagram' ? (
          <div className="h-full flex">
            {/* Diagram Area */}
            <div className="flex-1 overflow-auto p-8 bg-[#1c1c1c]">
              {schema.tables.length === 0 ? (
                <div className="h-full flex items-center justify-center">
                  <div className="text-center">
                    <svg className="w-16 h-16 mx-auto text-[#3a3a3a] mb-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M4 7v10c0 2.21 3.582 4 8 4s8-1.79 8-4V7M4 7c0 2.21 3.582 4 8 4s8-1.79 8-4M4 7c0-2.21 3.582-4 8-4s8 1.79 8 4m0 5c0 2.21-3.582 4-8 4s-8-1.79-8-4" />
                    </svg>
                    <h3 className="text-lg font-medium text-[#ededed] mb-2">No tables found</h3>
                    <p className="text-sm text-[#6b6b6b]">Create your first table to see the schema</p>
                  </div>
                </div>
              ) : (
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                  {schema.tables.map((table) => {
                    const relationships = getRelationshipsForTable(table.table_name);
                    const columns = Array.isArray(table.columns) ? table.columns : [];
                    
                    return (
                      <div
                        key={table.table_name}
                        onClick={() => setSelectedTable(table)}
                        className={`bg-[#181818] border-2 rounded-lg overflow-hidden cursor-pointer transition-all hover:shadow-lg ${
                          selectedTable?.table_name === table.table_name
                            ? 'border-green-600 shadow-lg shadow-green-600/20'
                            : 'border-[#2a2a2a] hover:border-[#3a3a3a]'
                        }`}
                      >
                        {/* Table Header */}
                        <div className="bg-[#1c1c1c] px-4 py-3 border-b border-[#2a2a2a]">
                          <div className="flex items-center gap-2">
                            <svg className="w-4 h-4 text-green-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 10h18M3 14h18m-9-4v8m-7 0h14a2 2 0 002-2V8a2 2 0 00-2-2H5a2 2 0 00-2 2v8a2 2 0 002 2z" />
                            </svg>
                            <h3 className="text-sm font-semibold text-[#ededed]">{table.table_name}</h3>
                          </div>
                          {relationships.length > 0 && (
                            <div className="mt-1 text-xs text-[#6b6b6b]">
                              {relationships.length} relationship{relationships.length !== 1 ? 's' : ''}
                            </div>
                          )}
                        </div>

                        {/* Columns List */}
                        <div className="p-2">
                          {columns.length === 0 ? (
                            <div className="px-2 py-4 text-center text-xs text-[#6b6b6b]">
                              No columns
                            </div>
                          ) : (
                            <div className="space-y-1">
                              {columns.slice(0, 8).map((column, idx) => (
                                <div
                                  key={idx}
                                  className="flex items-center gap-2 px-2 py-1.5 rounded hover:bg-[#1c1c1c] transition-colors"
                                >
                                  {column.primary_key ? (
                                    <svg className="w-3 h-3 text-yellow-500 flex-shrink-0" fill="currentColor" viewBox="0 0 20 20">
                                      <path fillRule="evenodd" d="M5 9V7a5 5 0 0110 0v2a2 2 0 012 2v5a2 2 0 01-2 2H5a2 2 0 01-2-2v-5a2 2 0 012-2zm8-2v2H7V7a3 3 0 016 0z" clipRule="evenodd" />
                                    </svg>
                                  ) : (
                                    <div className="w-3 h-3 flex-shrink-0"></div>
                                  )}
                                  <span className="text-xs text-[#ededed] truncate flex-1">{column.name}</span>
                                  <span className="text-xs text-[#6b6b6b] font-mono">{column.type}</span>
                                </div>
                              ))}
                              {columns.length > 8 && (
                                <div className="px-2 py-1 text-xs text-[#6b6b6b] text-center">
                                  +{columns.length - 8} more
                                </div>
                              )}
                            </div>
                          )}
                        </div>
                      </div>
                    );
                  })}
                </div>
              )}
            </div>

            {/* Side Panel - Table Details */}
            {selectedTable && (
              <div className="w-96 bg-[#181818] border-l border-[#2a2a2a] overflow-y-auto">
                <div className="p-6">
                  <div className="flex items-center justify-between mb-4">
                    <h2 className="text-lg font-semibold text-[#ededed]">{selectedTable.table_name}</h2>
                    <button
                      onClick={() => setSelectedTable(null)}
                      className="text-[#6b6b6b] hover:text-[#ededed] transition-colors"
                    >
                      <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                      </svg>
                    </button>
                  </div>

                  {/* Columns Section */}
                  <div className="mb-6">
                    <h3 className="text-sm font-medium text-[#a1a1a1] mb-3">Columns</h3>
                    <div className="space-y-2">
                      {Array.isArray(selectedTable.columns) && selectedTable.columns.map((column, idx) => (
                        <div key={idx} className="p-3 bg-[#1c1c1c] border border-[#2a2a2a] rounded">
                          <div className="flex items-center gap-2 mb-1">
                            {column.primary_key && (
                              <svg className="w-3 h-3 text-yellow-500" fill="currentColor" viewBox="0 0 20 20">
                                <path fillRule="evenodd" d="M5 9V7a5 5 0 0110 0v2a2 2 0 012 2v5a2 2 0 01-2 2H5a2 2 0 01-2-2v-5a2 2 0 012-2zm8-2v2H7V7a3 3 0 016 0z" clipRule="evenodd" />
                              </svg>
                            )}
                            <span className="text-sm font-medium text-[#ededed]">{column.name}</span>
                          </div>
                          <div className="flex items-center gap-2 text-xs text-[#6b6b6b]">
                            <span className="px-1.5 py-0.5 bg-[#2a2a2a] rounded font-mono">{column.type}</span>
                            {!column.nullable && (
                              <span className="px-1.5 py-0.5 bg-orange-600/10 text-orange-500 rounded">NOT NULL</span>
                            )}
                            {column.default && (
                              <span className="px-1.5 py-0.5 bg-blue-600/10 text-blue-500 rounded">DEFAULT</span>
                            )}
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>

                  {/* Relationships Section */}
                  {getRelationshipsForTable(selectedTable.table_name).length > 0 && (
                    <div>
                      <h3 className="text-sm font-medium text-[#a1a1a1] mb-3">Relationships</h3>
                      <div className="space-y-2">
                        {getRelationshipsForTable(selectedTable.table_name).map((rel, idx) => (
                          <div key={idx} className="p-3 bg-[#1c1c1c] border border-[#2a2a2a] rounded">
                            <div className="flex items-center gap-2 text-xs">
                              <span className="text-[#ededed] font-medium">{rel.from_table}</span>
                              <span className="text-[#6b6b6b]">.</span>
                              <span className="text-green-500">{rel.from_column}</span>
                              <svg className="w-3 h-3 text-[#6b6b6b]" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M14 5l7 7m0 0l-7 7m7-7H3" />
                              </svg>
                              <span className="text-[#ededed] font-medium">{rel.to_table}</span>
                              <span className="text-[#6b6b6b]">.</span>
                              <span className="text-green-500">{rel.to_column}</span>
                            </div>
                          </div>
                        ))}
                      </div>
                    </div>
                  )}
                </div>
              </div>
            )}
          </div>
        ) : (
          /* List View */
          <div className="h-full overflow-auto p-6">
            <div className="max-w-6xl mx-auto space-y-4">
              {schema.tables.map((table) => {
                const columns = Array.isArray(table.columns) ? table.columns : [];
                const relationships = getRelationshipsForTable(table.table_name);
                
                return (
                  <div key={table.table_name} className="bg-[#181818] border border-[#2a2a2a] rounded-lg overflow-hidden">
                    {/* Table Header */}
                    <div className="px-6 py-4 border-b border-[#2a2a2a] bg-[#1c1c1c]">
                      <div className="flex items-center justify-between">
                        <div className="flex items-center gap-3">
                          <svg className="w-5 h-5 text-green-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 10h18M3 14h18m-9-4v8m-7 0h14a2 2 0 002-2V8a2 2 0 00-2-2H5a2 2 0 00-2 2v8a2 2 0 002 2z" />
                          </svg>
                          <h3 className="text-lg font-semibold text-[#ededed]">{table.table_name}</h3>
                        </div>
                        <div className="text-sm text-[#6b6b6b]">
                          {columns.length} columns • {relationships.length} relationships
                        </div>
                      </div>
                    </div>

                    {/* Columns Table */}
                    <div className="overflow-x-auto">
                      <table className="w-full">
                        <thead className="bg-[#1c1c1c] border-b border-[#2a2a2a]">
                          <tr>
                            <th className="px-6 py-3 text-left text-xs font-medium text-[#a1a1a1] uppercase">Column</th>
                            <th className="px-6 py-3 text-left text-xs font-medium text-[#a1a1a1] uppercase">Type</th>
                            <th className="px-6 py-3 text-left text-xs font-medium text-[#a1a1a1] uppercase">Default</th>
                            <th className="px-6 py-3 text-left text-xs font-medium text-[#a1a1a1] uppercase">Constraints</th>
                          </tr>
                        </thead>
                        <tbody className="divide-y divide-[#2a2a2a]">
                          {columns.map((column, idx) => (
                            <tr key={idx} className="hover:bg-[#1c1c1c] transition-colors">
                              <td className="px-6 py-3">
                                <div className="flex items-center gap-2">
                                  {column.primary_key && (
                                    <svg className="w-3 h-3 text-yellow-500" fill="currentColor" viewBox="0 0 20 20">
                                      <path fillRule="evenodd" d="M5 9V7a5 5 0 0110 0v2a2 2 0 012 2v5a2 2 0 01-2 2H5a2 2 0 01-2-2v-5a2 2 0 012-2zm8-2v2H7V7a3 3 0 016 0z" clipRule="evenodd" />
                                    </svg>
                                  )}
                                  <span className="text-sm text-[#ededed] font-medium">{column.name}</span>
                                </div>
                              </td>
                              <td className="px-6 py-3">
                                <span className="px-2 py-1 bg-[#2a2a2a] text-[#a1a1a1] rounded text-xs font-mono">
                                  {column.type}
                                </span>
                              </td>
                              <td className="px-6 py-3 text-sm text-[#a1a1a1]">
                                {column.default || <span className="text-[#6b6b6b]">NULL</span>}
                              </td>
                              <td className="px-6 py-3">
                                <div className="flex gap-1">
                                  {column.primary_key && (
                                    <span className="px-2 py-1 bg-yellow-600/10 text-yellow-500 rounded text-xs">PK</span>
                                  )}
                                  {!column.nullable && (
                                    <span className="px-2 py-1 bg-orange-600/10 text-orange-500 rounded text-xs">NOT NULL</span>
                                  )}
                                </div>
                              </td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>

                    {/* Relationships */}
                    {relationships.length > 0 && (
                      <div className="px-6 py-4 border-t border-[#2a2a2a] bg-[#1c1c1c]">
                        <h4 className="text-xs font-medium text-[#a1a1a1] mb-2">RELATIONSHIPS</h4>
                        <div className="space-y-1">
                          {relationships.map((rel, idx) => (
                            <div key={idx} className="text-xs text-[#6b6b6b]">
                              <span className="text-[#ededed]">{rel.from_table}</span>
                              <span className="text-[#6b6b6b]">.</span>
                              <span className="text-green-500">{rel.from_column}</span>
                              <span className="mx-2">→</span>
                              <span className="text-[#ededed]">{rel.to_table}</span>
                              <span className="text-[#6b6b6b]">.</span>
                              <span className="text-green-500">{rel.to_column}</span>
                            </div>
                          ))}
                        </div>
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
