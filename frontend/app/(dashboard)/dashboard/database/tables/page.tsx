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
  rls_enabled?: boolean;
  policy_count?: number;
}

export default function TablesPage() {
  const [tables, setTables] = useState<Table[]>([]);
  const [selectedTable, setSelectedTable] = useState<Table | null>(null);
  const [loading, setLoading] = useState(true);
  const [showCreateModal, setShowCreateModal] = useState(false);
  const [newTable, setNewTable] = useState({
    table_name: "",
    columns: [{ name: "id", type: "SERIAL", primary_key: true, unique: false, not_null: true }]
  });

  useEffect(() => {
    fetchTables();
  }, []);

  const fetchTables = async () => {
    try {
      const projectId = localStorage.getItem("current_project_id");
      
      const response = await apiFetch(`api/projects/${projectId}/db/tables`, {
        headers: {
          "x-project-id": projectId || ""
        }
      });
      
      if (response.ok) {
        const data = await response.json();
        // Parse columns if they come as JSON string
        const parsedTables = (data.tables || []).map((table: any) => ({
          ...table,
          columns: typeof table.columns === 'string' ? JSON.parse(table.columns) : table.columns
        }));
        setTables(parsedTables);
        
        // Fetch RLS status for each table
        await fetchRLSStatus(parsedTables);
        
        if (parsedTables.length > 0 && !selectedTable) {
          setSelectedTable(parsedTables[0]);
        }
      }
    } catch (error) {
      console.error("Failed to fetch tables:", error);
    } finally {
      setLoading(false);
    }
  };

  const fetchRLSStatus = async (tablesList: Table[]) => {
    try {
      const projectId = localStorage.getItem("current_project_id");
      
      // Query to check RLS status
      const sql = `
        SELECT 
          t.tablename,
          t.rowsecurity as rls_enabled,
          COUNT(p.policyname) as policy_count
        FROM pg_tables t
        LEFT JOIN pg_policies p ON p.tablename = t.tablename AND p.schemaname = t.schemaname
        WHERE t.schemaname = 'public'
        GROUP BY t.tablename, t.rowsecurity
        ORDER BY t.tablename;
      `;
      
      const response = await apiFetch(`api/projects/${projectId}/query`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "x-project-id": projectId || ""
        },
        body: JSON.stringify({ sql })
      });
      
      if (response.ok) {
        const result = await response.json();
        const rlsData = result.rows || [];
        
        // Update tables with RLS status
        const updatedTables = tablesList.map(table => {
          const rlsInfo = rlsData.find((r: any) => r.tablename === table.table_name);
          return {
            ...table,
            rls_enabled: rlsInfo?.rls_enabled || false,
            policy_count: rlsInfo?.policy_count || 0
          };
        });
        
        setTables(updatedTables);
      }
    } catch (error) {
      console.error("Failed to fetch RLS status:", error);
    }
  };

  const createTable = async () => {
    try {
      const projectId = localStorage.getItem("current_project_id");
      
      const response = await apiFetch(`api/projects/${projectId}/db/tables`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "x-project-id": projectId || ""
        },
        body: JSON.stringify(newTable)
      });
      
      if (response.ok) {
        setShowCreateModal(false);
        setNewTable({
          table_name: "",
          columns: [{ name: "id", type: "SERIAL", primary_key: true, unique: false, not_null: true }]
        });
        fetchTables();
      }
    } catch (error) {
      console.error("Failed to create table:", error);
    }
  };

  const deleteTable = async (tableName: string) => {
    if (!confirm(`Delete table "${tableName}"? This action cannot be undone.`)) return;
    
    try {
      const projectId = localStorage.getItem("current_project_id");
      
      const response = await apiFetch(`api/projects/${projectId}/db/tables/${tableName}`, {
        method: "DELETE",
        headers: {
          "x-project-id": projectId || ""
        }
      });
      
      if (response.ok) {
        if (selectedTable?.table_name === tableName) {
          setSelectedTable(null);
        }
        fetchTables();
      }
    } catch (error) {
      console.error("Failed to delete table:", error);
    }
  };

  const addColumn = () => {
    setNewTable({
      ...newTable,
      columns: [...newTable.columns, { name: "", type: "TEXT", primary_key: false, unique: false, not_null: false }]
    });
  };

  const updateColumn = (index: number, field: string, value: any) => {
    const updatedColumns = [...newTable.columns];
    updatedColumns[index] = { ...updatedColumns[index], [field]: value };
    setNewTable({ ...newTable, columns: updatedColumns });
  };

  const removeColumn = (index: number) => {
    setNewTable({
      ...newTable,
      columns: newTable.columns.filter((_, i) => i !== index)
    });
  };

  if (loading) {
    return (
      <div className="h-full flex items-center justify-center bg-[#1c1c1c]">
        <div className="text-[#a1a1a1]">Loading tables...</div>
      </div>
    );
  }

  return (
    <div className="h-full flex bg-[#1c1c1c]">
      {/* Sidebar - Table List */}
      <div className="w-64 bg-[#181818] border-r border-[#2a2a2a] flex flex-col">
        <div className="p-4 border-b border-[#2a2a2a]">
          <button
            onClick={() => setShowCreateModal(true)}
            className="w-full px-3 py-2 bg-green-600 hover:bg-green-700 text-white text-sm font-medium rounded transition-colors flex items-center justify-center gap-2"
          >
            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
            </svg>
            New Table
          </button>
        </div>

        <div className="flex-1 overflow-y-auto p-2">
          {tables.length === 0 ? (
            <div className="p-4 text-center text-[#6b6b6b] text-sm">
              No tables yet
            </div>
          ) : (
            <div className="space-y-1">
              {tables.map((table) => (
                <button
                  key={table.table_name}
                  onClick={() => setSelectedTable(table)}
                  className={`w-full text-left px-3 py-2 rounded text-sm transition-colors ${
                    selectedTable?.table_name === table.table_name
                      ? "bg-[#2a2a2a] text-[#ededed]"
                      : "text-[#a1a1a1] hover:bg-[#2a2a2a] hover:text-[#ededed]"
                  }`}
                >
                  <div className="flex items-center gap-2">
                    <svg className="w-4 h-4 flex-shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 10h18M3 14h18m-9-4v8m-7 0h14a2 2 0 002-2V8a2 2 0 00-2-2H5a2 2 0 00-2 2v8a2 2 0 002 2z" />
                    </svg>
                    <span className="truncate">{table.table_name}</span>
                    {table.rls_enabled && (
                      <svg className="w-3.5 h-3.5 text-green-500 flex-shrink-0" fill="currentColor" viewBox="0 0 20 20">
                        <path fillRule="evenodd" d="M5 9V7a5 5 0 0110 0v2a2 2 0 012 2v5a2 2 0 01-2 2H5a2 2 0 01-2-2v-5a2 2 0 012-2zm8-2v2H7V7a3 3 0 016 0z" clipRule="evenodd" />
                      </svg>
                    )}
                  </div>
                  <div className="text-xs text-[#6b6b6b] mt-1 flex items-center gap-2">
                    <span>{Array.isArray(table.columns) ? table.columns.length : 0} columns</span>
                    {table.rls_enabled && table.policy_count !== undefined && (
                      <span className="text-green-500">• {table.policy_count} policies</span>
                    )}
                  </div>
                </button>
              ))}
            </div>
          )}
        </div>
      </div>

      {/* Main Content - Table Details */}
      <div className="flex-1 flex flex-col">
        {selectedTable ? (
          <>
            {/* Header */}
            <div className="bg-[#181818] border-b border-[#2a2a2a] px-6 py-4">
              <div className="flex items-center justify-between">
                <div>
                  <div className="flex items-center gap-3">
                    <h1 className="text-xl font-semibold text-[#ededed]">{selectedTable.table_name}</h1>
                    {selectedTable.rls_enabled ? (
                      <span className="inline-flex items-center px-2.5 py-1 bg-green-600/10 text-green-500 rounded-full text-xs font-medium">
                        <svg className="w-3.5 h-3.5 mr-1.5" fill="currentColor" viewBox="0 0 20 20">
                          <path fillRule="evenodd" d="M5 9V7a5 5 0 0110 0v2a2 2 0 012 2v5a2 2 0 01-2 2H5a2 2 0 01-2-2v-5a2 2 0 012-2zm8-2v2H7V7a3 3 0 016 0z" clipRule="evenodd" />
                        </svg>
                        RLS Enabled
                      </span>
                    ) : (
                      <span className="inline-flex items-center px-2.5 py-1 bg-yellow-600/10 text-yellow-500 rounded-full text-xs font-medium">
                        <svg className="w-3.5 h-3.5 mr-1.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 15v2m-6 4h12a2 2 0 002-2v-6a2 2 0 00-2-2H6a2 2 0 00-2 2v6a2 2 0 002 2zm10-10V7a4 4 0 00-8 0v4h8z" />
                        </svg>
                        RLS Disabled
                      </span>
                    )}
                  </div>
                  <p className="text-sm text-[#6b6b6b] mt-1">
                    {Array.isArray(selectedTable.columns) ? selectedTable.columns.length : 0} columns
                    {selectedTable.rls_enabled && selectedTable.policy_count !== undefined && (
                      <span className="text-green-500"> • {selectedTable.policy_count} RLS policies</span>
                    )}
                  </p>
                </div>
                <div className="flex gap-2">
                  <button className="px-3 py-1.5 bg-[#2a2a2a] hover:bg-[#3a3a3a] text-[#ededed] text-sm rounded transition-colors">
                    Add Column
                  </button>
                  <button
                    onClick={() => deleteTable(selectedTable.table_name)}
                    className="px-3 py-1.5 bg-red-600/10 hover:bg-red-600/20 text-red-500 text-sm rounded transition-colors"
                  >
                    Delete Table
                  </button>
                </div>
              </div>
            </div>

            {/* Table Content */}
            <div className="flex-1 overflow-auto p-6">
              <div className="bg-[#181818] border border-[#2a2a2a] rounded-lg overflow-hidden">
                <table className="w-full">
                  <thead className="bg-[#1c1c1c] border-b border-[#2a2a2a]">
                    <tr>
                      <th className="px-4 py-3 text-left text-xs font-medium text-[#a1a1a1] uppercase tracking-wider">
                        Name
                      </th>
                      <th className="px-4 py-3 text-left text-xs font-medium text-[#a1a1a1] uppercase tracking-wider">
                        Type
                      </th>
                      <th className="px-4 py-3 text-left text-xs font-medium text-[#a1a1a1] uppercase tracking-wider">
                        Default
                      </th>
                      <th className="px-4 py-3 text-left text-xs font-medium text-[#a1a1a1] uppercase tracking-wider">
                        Primary
                      </th>
                      <th className="px-4 py-3 text-left text-xs font-medium text-[#a1a1a1] uppercase tracking-wider">
                        Nullable
                      </th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-[#2a2a2a]">
                    {Array.isArray(selectedTable.columns) && selectedTable.columns.map((column, index) => (
                      <tr key={index} className="hover:bg-[#1c1c1c] transition-colors">
                        <td className="px-4 py-3 text-sm text-[#ededed] font-medium">
                          {column.name}
                        </td>
                        <td className="px-4 py-3 text-sm">
                          <span className="px-2 py-1 bg-[#2a2a2a] text-[#a1a1a1] rounded text-xs font-mono">
                            {column.type}
                          </span>
                        </td>
                        <td className="px-4 py-3 text-sm text-[#a1a1a1]">
                          {column.default || <span className="text-[#6b6b6b]">NULL</span>}
                        </td>
                        <td className="px-4 py-3 text-sm">
                          {column.primary_key ? (
                            <span className="inline-flex items-center px-2 py-1 bg-green-600/10 text-green-500 rounded text-xs font-medium">
                              <svg className="w-3 h-3 mr-1" fill="currentColor" viewBox="0 0 20 20">
                                <path fillRule="evenodd" d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z" clipRule="evenodd" />
                              </svg>
                              Yes
                            </span>
                          ) : (
                            <span className="text-[#6b6b6b]">-</span>
                          )}
                        </td>
                        <td className="px-4 py-3 text-sm">
                          {column.nullable ? (
                            <span className="text-[#a1a1a1]">Yes</span>
                          ) : (
                            <span className="text-[#6b6b6b]">No</span>
                          )}
                        </td>
                      </tr>
                    ))}
                    {(!Array.isArray(selectedTable.columns) || selectedTable.columns.length === 0) && (
                      <tr>
                        <td colSpan={5} className="px-4 py-8 text-center text-[#6b6b6b] text-sm">
                          No columns found
                        </td>
                      </tr>
                    )}
                  </tbody>
                </table>
              </div>
            </div>
          </>
        ) : (
          <div className="flex-1 flex items-center justify-center">
            <div className="text-center">
              <svg className="w-16 h-16 mx-auto text-[#3a3a3a] mb-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M3 10h18M3 14h18m-9-4v8m-7 0h14a2 2 0 002-2V8a2 2 0 00-2-2H5a2 2 0 00-2 2v8a2 2 0 002 2z" />
              </svg>
              <h3 className="text-lg font-medium text-[#ededed] mb-2">No table selected</h3>
              <p className="text-sm text-[#6b6b6b]">
                Select a table from the sidebar or create a new one
              </p>
            </div>
          </div>
        )}
      </div>

      {/* Create Table Modal */}
      {showCreateModal && (
        <div className="fixed inset-0 bg-black/60 backdrop-blur-sm z-50 flex items-center justify-center p-4">
          <div className="bg-[#181818] border border-[#2a2a2a] rounded-lg shadow-2xl w-full max-w-3xl max-h-[90vh] overflow-hidden flex flex-col">
            {/* Modal Header */}
            <div className="px-6 py-4 border-b border-[#2a2a2a] flex items-center justify-between">
              <h2 className="text-lg font-semibold text-[#ededed]">Create New Table</h2>
              <button
                onClick={() => setShowCreateModal(false)}
                className="text-[#6b6b6b] hover:text-[#ededed] transition-colors"
              >
                <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                </svg>
              </button>
            </div>

            {/* Modal Body */}
            <div className="flex-1 overflow-y-auto p-6">
              <div className="space-y-6">
                <div>
                  <label className="block text-sm font-medium text-[#ededed] mb-2">
                    Table Name
                  </label>
                  <input
                    type="text"
                    value={newTable.table_name}
                    onChange={(e) => setNewTable({ ...newTable, table_name: e.target.value })}
                    className="w-full px-3 py-2 bg-[#1c1c1c] border border-[#2a2a2a] rounded text-[#ededed] placeholder-[#6b6b6b] focus:outline-none focus:border-green-600"
                    placeholder="users"
                  />
                </div>

                <div>
                  <div className="flex items-center justify-between mb-3">
                    <label className="block text-sm font-medium text-[#ededed]">
                      Columns
                    </label>
                    <button
                      onClick={addColumn}
                      className="text-sm text-green-500 hover:text-green-400 transition-colors"
                    >
                      + Add Column
                    </button>
                  </div>

                  <div className="space-y-2">
                    {newTable.columns.map((col, index) => (
                      <div key={index} className="flex gap-2 items-start p-3 bg-[#1c1c1c] border border-[#2a2a2a] rounded">
                        <input
                          type="text"
                          value={col.name}
                          onChange={(e) => updateColumn(index, "name", e.target.value)}
                          placeholder="column_name"
                          className="flex-1 px-3 py-2 bg-[#181818] border border-[#2a2a2a] rounded text-sm text-[#ededed] placeholder-[#6b6b6b] focus:outline-none focus:border-green-600"
                        />
                        <select
                          value={col.type}
                          onChange={(e) => updateColumn(index, "type", e.target.value)}
                          className="px-3 py-2 bg-[#181818] border border-[#2a2a2a] rounded text-sm text-[#ededed] focus:outline-none focus:border-green-600"
                        >
                          <option value="TEXT">TEXT</option>
                          <option value="INTEGER">INTEGER</option>
                          <option value="BIGINT">BIGINT</option>
                          <option value="SERIAL">SERIAL</option>
                          <option value="BOOLEAN">BOOLEAN</option>
                          <option value="TIMESTAMP">TIMESTAMP</option>
                          <option value="UUID">UUID</option>
                          <option value="JSONB">JSONB</option>
                        </select>
                        <label className="flex items-center gap-1.5 px-3 py-2 bg-[#181818] border border-[#2a2a2a] rounded text-sm text-[#a1a1a1] whitespace-nowrap">
                          <input
                            type="checkbox"
                            checked={col.primary_key}
                            onChange={(e) => updateColumn(index, "primary_key", e.target.checked)}
                            className="rounded"
                          />
                          PK
                        </label>
                        <label className="flex items-center gap-1.5 px-3 py-2 bg-[#181818] border border-[#2a2a2a] rounded text-sm text-[#a1a1a1] whitespace-nowrap">
                          <input
                            type="checkbox"
                            checked={col.not_null}
                            onChange={(e) => updateColumn(index, "not_null", e.target.checked)}
                            className="rounded"
                          />
                          NOT NULL
                        </label>
                        <button
                          onClick={() => removeColumn(index)}
                          className="p-2 text-red-500 hover:bg-red-600/10 rounded transition-colors"
                        >
                          <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
                          </svg>
                        </button>
                      </div>
                    ))}
                  </div>
                </div>
              </div>
            </div>

            {/* Modal Footer */}
            <div className="px-6 py-4 border-t border-[#2a2a2a] flex justify-end gap-2">
              <button
                onClick={() => setShowCreateModal(false)}
                className="px-4 py-2 bg-[#2a2a2a] hover:bg-[#3a3a3a] text-[#ededed] text-sm rounded transition-colors"
              >
                Cancel
              </button>
              <button
                onClick={createTable}
                disabled={!newTable.table_name || newTable.columns.length === 0}
                className="px-4 py-2 bg-green-600 hover:bg-green-700 text-white text-sm rounded transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
              >
                Create Table
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
