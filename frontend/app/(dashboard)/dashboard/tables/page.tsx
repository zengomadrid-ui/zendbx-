'use client';

import { useState, useEffect } from 'react';
import { apiClient } from '@/lib/api';
import { useToast } from '@/lib/toast';

interface Table {
  table_name: string;
  row_count: number;
  column_count: number;
}

interface ColumnSchema {
  name: string;
  type: string;
  is_nullable: string;
  column_default: string | null;
}

export default function TablesPage() {
  const { showToast } = useToast();
  const [tables, setTables] = useState<Table[]>([]);
  const [selectedTable, setSelectedTable] = useState<string | null>(null);
  const [tableData, setTableData] = useState<any>(null);
  const [loading, setLoading] = useState(false);
  const [editingCell, setEditingCell] = useState<{row: number, col: string} | null>(null);
  const [editValue, setEditValue] = useState<string>('');
  const [newRow, setNewRow] = useState<any>(null);
  const [isAddingRow, setIsAddingRow] = useState(false);
  const [page, setPage] = useState(1);
  const [totalRows, setTotalRows] = useState(0);
  const [currentProjectId, setCurrentProjectId] = useState<string | null>(null);
  const rowsPerPage = 50;

  useEffect(() => {
    fetchTables();
  }, []);

  useEffect(() => {
    if (selectedTable && currentProjectId) {
      fetchTableData(selectedTable);
    }
  }, [selectedTable, page, currentProjectId]);

  // Clear table data when table selection changes
  useEffect(() => {
    // Reset to page 1 when table changes
    if (selectedTable) {
      setPage(1);
      setEditingCell(null);
      setNewRow(null);
      setIsAddingRow(false);
    }
  }, [selectedTable]);

  // Clear table state when project changes
  useEffect(() => {
    const projectId = localStorage.getItem('current_project_id');
    if (projectId !== currentProjectId) {
      // Project changed - clear all table-specific state
      setSelectedTable(null);
      setTableData(null);
      setPage(1);
      setTotalRows(0);
      setEditingCell(null);
      setNewRow(null);
      setIsAddingRow(false);
      setCurrentProjectId(projectId);
    }
  }, []); // Run on mount and whenever fetchTables is called

  const fetchTables = async () => {
    let projectId = localStorage.getItem('current_project_id');
    
    if (!projectId) {
      try {
        const projects = await apiClient.get('/api/projects');
        if (projects.length > 0) {
          projectId = projects[0].id;
          if (projectId) {
            localStorage.setItem('current_project_id', projectId);
            setCurrentProjectId(projectId);
          }
        }
      } catch (err) {
        console.error('Failed to fetch projects:', err);
      }
    }
    
    if (!projectId) {
      setTables([]);
      return;
    }

    // Check if project changed while fetching
    if (currentProjectId && projectId !== currentProjectId) {
      // Project changed - clear table state
      setSelectedTable(null);
      setTableData(null);
      setPage(1);
      setTotalRows(0);
      setCurrentProjectId(projectId);
    }

    try {
      const data = await apiClient.get(`/api/projects/${projectId}/tables`);
      setTables(data);
      if (data.length > 0 && !selectedTable) {
        setSelectedTable(data[0].table_name);
      }
    } catch (err) {
      console.error('Failed to fetch tables:', err);
    }
  };

  const fetchTableData = async (tableName: string) => {
    const projectId = localStorage.getItem('current_project_id');
    if (!projectId) return;

    // Store request context to prevent stale responses
    const requestProjectId = projectId;
    const requestTableName = tableName;

    setLoading(true);
    try {
      // First, get the project's database schema name
      const projectData = await apiClient.get(`/api/projects/${projectId}`);
      const schemaName = projectData.database_name;

      // CRITICAL FIX: Query schema metadata with table_schema filter
      // This prevents cross-project metadata leakage
      const schemaSql = `
        SELECT 
          column_name as name,
          data_type as type,
          is_nullable,
          column_default
        FROM information_schema.columns 
        WHERE table_schema = '${schemaName}'
          AND table_name = '${tableName}'
        ORDER BY ordinal_position
      `;
      
      const schemaRes = await apiClient.post(`/api/projects/${projectId}/query`, { sql: schemaSql });
      const columns = schemaRes.rows || [];
      
      // Verify request is still valid (project/table didn't change)
      const currentProjectId = localStorage.getItem('current_project_id');
      if (currentProjectId !== requestProjectId || selectedTable !== requestTableName) {
        console.log('Stale response discarded - project or table changed');
        return;
      }

      // Get total count
      const countSql = `SELECT COUNT(*) as total FROM "${tableName}"`;
      const countRes = await apiClient.post(`/api/projects/${projectId}/query`, { sql: countSql });
      const total = countRes.rows[0]?.total || 0;
      setTotalRows(total);
      
      // Get paginated data
      const offset = (page - 1) * rowsPerPage;
      const dataSql = `SELECT * FROM "${tableName}" LIMIT ${rowsPerPage} OFFSET ${offset}`;
      const dataRes = await apiClient.post(`/api/projects/${projectId}/query`, { sql: dataSql });
      
      // Final check before updating state
      const finalProjectId = localStorage.getItem('current_project_id');
      if (finalProjectId !== requestProjectId || selectedTable !== requestTableName) {
        console.log('Stale response discarded at final check');
        return;
      }

      setTableData({
        columns: columns.map((c: any) => c.name),
        rows: dataRes.rows || [],
        schema: columns
      });
    } catch (err) {
      console.error('Failed to fetch table data:', err);
      setTableData(null);
      showToast('Failed to load table data', 'error');
    } finally {
      setLoading(false);
    }
  };
  const startEdit = (rowIndex: number, colName: string, currentValue: any) => {
    setEditingCell({ row: rowIndex, col: colName });
    setEditValue(currentValue === null ? '' : String(currentValue));
  };

  const cancelEdit = () => {
    setEditingCell(null);
    setEditValue('');
  };

  const saveEdit = async (rowIndex: number, colName: string) => {
    if (!selectedTable || !tableData) return;
    
    const projectId = localStorage.getItem('current_project_id');
    if (!projectId) return;

    const row = tableData.rows[rowIndex];
    const primaryKey = tableData.schema.find((s: any) => s.name === 'id' || s.name.includes('id'));
    
    if (!primaryKey) {
      showToast('Cannot update: No primary key found', 'error');
      return;
    }

    const pkValue = row[primaryKey.name];
    const colSchema = tableData.schema.find((s: any) => s.name === colName);
    
    // Format value based on type
    let formattedValue = editValue;
    if (editValue === '' && colSchema?.is_nullable === 'YES') {
      formattedValue = 'NULL';
    } else if (colSchema?.type.includes('int') || colSchema?.type.includes('numeric')) {
      formattedValue = editValue;
    } else {
      formattedValue = `'${editValue.replace(/'/g, "''")}'`;
    }

    const updateSql = `UPDATE "${selectedTable}" SET "${colName}" = ${formattedValue} WHERE "${primaryKey.name}" = '${pkValue}'`;

    try {
      await apiClient.post(`/api/projects/${projectId}/query`, { sql: updateSql });
      
      // Update local state
      const newRows = [...tableData.rows];
      newRows[rowIndex] = { ...newRows[rowIndex], [colName]: editValue === '' ? null : editValue };
      setTableData({ ...tableData, rows: newRows });
      
      setEditingCell(null);
      setEditValue('');
      showToast('Cell updated successfully', 'success');
    } catch (err: any) {
      showToast(err.message || 'Failed to update cell', 'error');
    }
  };
  const deleteRow = async (rowIndex: number) => {
    if (!selectedTable || !tableData) return;
    if (!confirm('Are you sure you want to delete this row?')) return;
    
    const projectId = localStorage.getItem('current_project_id');
    if (!projectId) return;

    const row = tableData.rows[rowIndex];
    const primaryKey = tableData.schema.find((s: any) => s.name === 'id' || s.name.includes('id'));
    
    if (!primaryKey) {
      showToast('Cannot delete: No primary key found', 'error');
      return;
    }

    const pkValue = row[primaryKey.name];
    const deleteSql = `DELETE FROM "${selectedTable}" WHERE "${primaryKey.name}" = '${pkValue}'`;

    try {
      await apiClient.post(`/api/projects/${projectId}/query`, { sql: deleteSql });
      
      // Refresh the table data
      await fetchTableData(selectedTable);
      
      showToast('Row deleted successfully', 'success');
    } catch (err: any) {
      showToast(err.message || 'Failed to delete row', 'error');
    }
  };

  const startAddRow = () => {
    if (!tableData) return;
    
    const emptyRow: any = {};
    tableData.columns.forEach((col: string) => {
      emptyRow[col] = '';
    });
    
    setNewRow(emptyRow);
    setIsAddingRow(true);
  };

  const cancelAddRow = () => {
    setNewRow(null);
    setIsAddingRow(false);
  };

  const saveNewRow = async () => {
    if (!selectedTable || !newRow || !tableData) return;
    
    const projectId = localStorage.getItem('current_project_id');
    if (!projectId) return;
    // Build INSERT statement
    const columns = Object.keys(newRow).filter(key => newRow[key] !== '');
    const values = columns.map(col => {
      const colSchema = tableData.schema.find((s: any) => s.name === col);
      const value = newRow[col];
      
      if (value === '' && colSchema?.is_nullable === 'YES') {
        return 'NULL';
      } else if (colSchema?.type.includes('int') || colSchema?.type.includes('numeric')) {
        return value;
      } else {
        return `'${value.replace(/'/g, "''")}'`;
      }
    });

    const insertSql = `INSERT INTO "${selectedTable}" (${columns.map(c => `"${c}"`).join(', ')}) VALUES (${values.join(', ')}) RETURNING *`;

    try {
      const result = await apiClient.post(`/api/projects/${projectId}/query`, { sql: insertSql });
      
      // Refresh the table data
      await fetchTableData(selectedTable);
      
      setNewRow(null);
      setIsAddingRow(false);
      showToast('Row added successfully', 'success');
    } catch (err: any) {
      showToast(err.message || 'Failed to add row', 'error');
    }
  };

  const totalPages = Math.ceil(totalRows / rowsPerPage);
  const startRow = (page - 1) * rowsPerPage + 1;
  const endRow = Math.min(page * rowsPerPage, totalRows);

  return (
    <div 
      className="h-screen flex"
      style={{ 
        background: '#0A0A0A',
        color: '#FFFFFF'
      }}
    >
      <style jsx global>{`
        .custom-scrollbar {
          scrollbar-width: thin;
          scrollbar-color: #FF6B00 #1F1F1F;
        }
        
        .custom-scrollbar::-webkit-scrollbar {
          width: 14px;
          height: 14px;
          background: #1F1F1F;
        }
        
        .custom-scrollbar::-webkit-scrollbar-track {
          background: #1F1F1F;
          border-radius: 0;
        }
        
        .custom-scrollbar::-webkit-scrollbar-thumb {
          background: #FF6B00;
          border-radius: 7px;
          border: 3px solid #1F1F1F;
        }
        
        .custom-scrollbar::-webkit-scrollbar-thumb:hover {
          background: #FF8533;
        }
        
        .custom-scrollbar::-webkit-scrollbar-corner {
          background: #1F1F1F;
        }
      `}</style>
      {/* Left Sidebar */}
      <div 
        className="w-64 flex flex-col"
        style={{
          background: '#000000',
          borderRight: '1px solid #1F1F1F'
        }}
      >
        {/* Sidebar Header */}
        <div 
          className="p-4"
          style={{
            borderBottom: '1px solid #1F1F1F'
          }}
        >
          <h2 className="text-sm font-medium text-[#CCCCCC] mb-3">Tables</h2>
          <div className="relative">
            <input
              type="text"
              placeholder="Search or jump to..."
              className="w-full text-white text-sm px-3 py-2 rounded focus:outline-none focus:ring-2 focus:ring-[#FF6B00]"
              style={{
                background: '#1F1F1F',
                border: '1px solid #333333'
              }}
            />
            <div className="absolute right-2 top-2">
              <span className="text-xs text-[#888888]">⌘K</span>
            </div>
          </div>
        </div>

        {/* Tables List */}
        <div className="flex-1 overflow-y-auto">
          <div className="p-2">
            {/* Project info */}
            <div className="mb-4 px-2">
              <div className="flex items-center gap-2 text-sm text-[#CCCCCC]">
                <div 
                  className="w-2 h-2 rounded-full"
                  style={{ backgroundColor: '#FF6B00' }}
                ></div>
                <span>Live</span>
                <span 
                  className="text-xs px-2 py-0.5 rounded text-white ml-auto"
                  style={{ backgroundColor: '#FF6B00' }}
                >
                  PG
                </span>
              </div>
              <div className="text-xs text-[#888888] mt-1">
                {selectedTable} • {totalRows} rows • Offline
              </div>
            </div>

            {/* Tables */}
            {tables.map((table) => (
              <div
                key={table.table_name}
                onClick={() => setSelectedTable(table.table_name)}
                className={`flex items-center gap-2 px-2 py-1.5 rounded cursor-pointer transition-colors ${
                  selectedTable === table.table_name ? 'text-[#FF6B00]' : 'text-[#888888] hover:text-[#CCCCCC]'
                }`}
                style={{ 
                  background: selectedTable === table.table_name ? 'rgba(255, 107, 0, 0.1)' : 'transparent'
                }}
              >
                <svg className="w-4 h-4" fill="currentColor" viewBox="0 0 20 20">
                  <path d="M3 4a1 1 0 011-1h12a1 1 0 011 1v2a1 1 0 01-1 1H4a1 1 0 01-1-1V4zM3 10a1 1 0 011-1h6a1 1 0 011 1v6a1 1 0 01-1 1H4a1 1 0 01-1-1v-6zM14 9a1 1 0 00-1 1v6a1 1 0 001 1h2a1 1 0 001-1v-6a1 1 0 00-1-1h-2z" />
                </svg>
                <span className="text-sm">{table.table_name}</span>
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* Main Content */}
      <div className="flex-1 flex flex-col" style={{ minWidth: 0, maxWidth: '100%', overflow: 'hidden', width: '100%' }}>
        {/* Top Header */}
        <div 
          className="px-6 py-4 flex items-center justify-between"
          style={{
            background: '#000000',
            borderBottom: '1px solid #1F1F1F'
          }}
        >
          <div className="flex items-center gap-4">
            <h1 className="text-lg font-medium text-white">Tables</h1>
            <div className="flex items-center gap-2">
              <div className="text-sm text-[#888888]">
                {selectedTable || 'Select a table'}
              </div>
              {tableData && (
                <div className="text-sm text-[#888888]">
                  {totalRows} rows • Offline
                </div>
              )}
            </div>
          </div>

          <div className="flex items-center gap-2">
            <button
              onClick={() => fetchTableData(selectedTable || '')}
              className="px-3 py-1.5 text-white text-sm rounded hover:opacity-80 transition-opacity"
              style={{
                background: '#1F1F1F',
                border: '1px solid #333333'
              }}
            >
              Refresh
            </button>
            <button 
              className="px-3 py-1.5 text-white text-sm rounded hover:opacity-80 transition-opacity"
              style={{
                background: '#1F1F1F',
                border: '1px solid #333333'
              }}
            >
              Delete Table
            </button>
            <button
              onClick={startAddRow}
              disabled={isAddingRow}
              className="px-3 py-1.5 text-white text-sm rounded transition-opacity disabled:opacity-50"
              style={{
                background: '#FF6B00'
              }}
            >
              + Add Row
            </button>
          </div>
        </div>
        
        {/* Table Content Wrapper */}
        <div className="flex-1" style={{ position: 'relative' }}>
          <div 
            className="custom-scrollbar"
            style={{ 
              background: '#0A0A0A',
              overflowX: 'auto',
              overflowY: 'auto',
              position: 'absolute',
              top: 0,
              left: 0,
              right: 0,
              bottom: 0
            }}
          >
          {loading ? (
            <div className="flex items-center justify-center h-64">
              <div className="text-[#888888]">Loading...</div>
            </div>
          ) : !selectedTable ? (
            <div className="flex items-center justify-center h-64">
              <div className="text-center">
                <div className="text-[#CCCCCC] mb-2">No table selected</div>
                <div className="text-[#888888] text-sm">Select a table from the sidebar to view data</div>
              </div>
            </div>
          ) : tableData && tableData.columns ? (
            <div style={{ display: 'inline-block' }}>
              {/* Debug: Log table dimensions */}
              {(() => {
                const calculatedWidth = (tableData.columns.length + 1) * 250;
                console.log('Table Debug:', {
                  columnCount: tableData.columns.length,
                  calculatedWidth,
                  shouldScroll: calculatedWidth > window.innerWidth
                });
                return null;
              })()}
              <table style={{ 
                width: `${(tableData.columns.length + 1) * 250}px`,
                tableLayout: 'fixed',
                borderCollapse: 'collapse'
              }}>
              <thead 
                className="sticky top-0"
                style={{
                  background: '#000000',
                  borderBottom: '1px solid #1F1F1F'
                }}
              >
                <tr>
                  {tableData.columns.map((col: string, i: number) => {
                    const colSchema = tableData.schema?.find((s: any) => s.name === col);
                    return (
                      <th 
                        key={i} 
                        className="px-4 py-3 text-left"
                        style={{ 
                          borderBottom: '1px solid #1F1F1F',
                          width: '250px',
                          minWidth: '250px',
                          maxWidth: '250px',
                          whiteSpace: 'nowrap',
                          overflow: 'hidden',
                          textOverflow: 'ellipsis'
                        }}
                      >
                        <div className="flex flex-col">
                          <span className="text-sm font-medium text-white">{col}</span>
                          {colSchema && (
                            <span className="text-xs text-[#666666]">
                              {colSchema.type}
                              {colSchema.is_nullable === 'NO' ? ' • NOT NULL' : ''}
                            </span>
                          )}
                        </div>
                      </th>
                    );
                  })}
                  <th 
                    className="px-4 py-3 text-left"
                    style={{ 
                      borderBottom: '1px solid #1F1F1F',
                      minWidth: '120px',
                      whiteSpace: 'nowrap'
                    }}
                  >
                    <span className="text-sm font-medium text-white">Actions</span>
                  </th>
                </tr>
              </thead>
              <tbody>
                {/* New Row Form */}
                {isAddingRow && newRow && (
                  <tr 
                    className="group"
                    style={{ 
                      borderBottom: '1px solid #1A1A1A',
                      background: 'rgba(255, 107, 0, 0.1)'
                    }}
                  >
                    {tableData.columns.map((col: string, colIndex: number) => (
                      <td key={colIndex} className="px-4 py-2" style={{ minWidth: '200px', whiteSpace: 'nowrap' }}>
                        <input
                          type="text"
                          value={newRow[col] || ''}
                          onChange={(e) => setNewRow({ ...newRow, [col]: e.target.value })}
                          placeholder={col}
                          className="w-full text-white text-sm px-2 py-1 rounded focus:outline-none"
                          style={{
                            background: '#1F1F1F',
                            border: '1px solid #FF6B00'
                          }}
                        />
                      </td>
                    ))}
                    <td className="px-4 py-2">
                      <div className="flex gap-2">
                        <button
                          onClick={saveNewRow}
                          className="text-green-400 hover:text-green-300 text-sm"
                        >
                          Save
                        </button>
                        <button
                          onClick={cancelAddRow}
                          className="text-red-400 hover:text-red-300 text-sm"
                        >
                          Cancel
                        </button>
                      </div>
                    </td>
                  </tr>
                )}
                
                {/* Data Rows */}
                {tableData.rows && tableData.rows.map((row: any, rowIndex: number) => (
                  <tr 
                    key={rowIndex} 
                    className="hover:bg-[#0F0F0F] group"
                    style={{ borderBottom: '1px solid #1A1A1A' }}
                  >
                    {tableData.columns.map((col: string, colIndex: number) => {
                      const value = row[col];
                      const isEditing = editingCell?.row === rowIndex && editingCell?.col === col;
                      
                      return (
                        <td 
                          key={colIndex} 
                          className="px-4 py-2 text-sm cursor-pointer"
                          style={{ 
                            width: '250px',
                            minWidth: '250px',
                            maxWidth: '250px',
                            whiteSpace: 'nowrap',
                            overflow: 'hidden',
                            textOverflow: 'ellipsis'
                          }}
                          onClick={() => !isEditing && startEdit(rowIndex, col, value)}
                        >
                          {isEditing ? (
                            <div className="flex items-center gap-2">
                              <input
                                type="text"
                                value={editValue}
                                onChange={(e) => setEditValue(e.target.value)}
                                onKeyDown={(e) => {
                                  if (e.key === 'Enter') saveEdit(rowIndex, col);
                                  if (e.key === 'Escape') cancelEdit();
                                }}
                                className="flex-1 text-white px-2 py-1 rounded focus:outline-none"
                                style={{
                                  background: '#1F1F1F',
                                  border: '1px solid #FF6B00'
                                }}
                                autoFocus
                              />
                              <button
                                onClick={() => saveEdit(rowIndex, col)}
                                className="text-green-400 hover:text-green-300"
                              >
                                ✓
                              </button>
                              <button
                                onClick={cancelEdit}
                                className="text-red-400 hover:text-red-300"
                              >
                                ✕
                              </button>
                            </div>
                          ) : (
                            <span className="text-[#FFFFFF]">
                              {value !== null ? String(value) : (
                                <span className="text-[#666666] italic">NULL</span>
                              )}
                            </span>
                          )}
                        </td>
                      );
                    })}
                    <td className="px-4 py-2">
                      <button
                        onClick={() => deleteRow(rowIndex)}
                        className="text-red-400 hover:text-red-300 p-1 rounded"
                        title="Delete row"
                      >
                        <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
                        </svg>
                      </button>
                    </td>
                  </tr>
                ))}
                
                {tableData.rows.length === 0 && !isAddingRow && (
                  <tr>
                    <td colSpan={tableData.columns.length + 1} className="px-4 py-8 text-center">
                      <div className="text-[#888888]">
                        <div className="mb-2">No data in this table</div>
                        <div className="text-sm">Click "Add Row" to add data</div>
                      </div>
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
            </div>
          ) : (
            <div className="flex items-center justify-center h-64">
              <div className="text-center">
                <div className="text-[#CCCCCC] mb-2">Unable to load table</div>
                <div className="text-[#888888] text-sm">There was an error loading this table's data</div>
              </div>
            </div>
          )}
        </div>
        </div>

        {/* Bottom Pagination */}
        {tableData && (
          <div 
            className="px-6 py-3 flex items-center justify-between"
            style={{
              background: '#000000',
              borderTop: '1px solid #1F1F1F'
            }}
          >
            <div className="text-sm text-[#888888]">
              Showing {startRow} to {endRow} of {totalRows} rows
            </div>
            
            <div className="flex items-center gap-2">
              <button
                onClick={() => setPage(Math.max(1, page - 1))}
                disabled={page === 1}
                className="px-3 py-1 text-white text-sm rounded disabled:opacity-50 disabled:cursor-not-allowed hover:opacity-80 transition-opacity"
                style={{
                  background: '#1F1F1F',
                  border: '1px solid #333333'
                }}
              >
                Previous
              </button>
              
              <span className="text-sm text-[#CCCCCC] px-2">
                Page {page} of {totalPages}
              </span>
              
              <button
                onClick={() => setPage(Math.min(totalPages, page + 1))}
                disabled={page === totalPages}
                className="px-3 py-1 text-white text-sm rounded disabled:opacity-50 disabled:cursor-not-allowed hover:opacity-80 transition-opacity"
                style={{
                  background: '#1F1F1F',
                  border: '1px solid #333333'
                }}
              >
                Next
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}