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

export default function ModernTableEditor() {
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
  const rowsPerPage = 50;

  useEffect(() => {
    fetchTables();
  }, []);

  useEffect(() => {
    if (selectedTable) {
      fetchTableData(selectedTable);
    }
  }, [selectedTable, page]);

  const fetchTables = async () => {
    let projectId = localStorage.getItem('current_project_id');
    
    if (!projectId) {
      try {
        const projects = await apiClient.get('/api/projects');
        if (projects.length > 0) {
          projectId = projects[0].id;
          if (projectId) {
            localStorage.setItem('current_project_id', projectId);
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

    setLoading(true);
    try {
      // Get schema
      const schemaSql = `
        SELECT 
          column_name as name,
          data_type as type,
          is_nullable,
          column_default
        FROM information_schema.columns 
        WHERE table_name = '${tableName}'
        ORDER BY ordinal_position
      `;
      
      const schemaRes = await apiClient.post(`/api/projects/${projectId}/query`, { sql: schemaSql });
      const columns = schemaRes.rows || [];
      
      // Get total count
      const countSql = `SELECT COUNT(*) as total FROM "${tableName}"`;
      const countRes = await apiClient.post(`/api/projects/${projectId}/query`, { sql: countSql });
      const total = countRes.rows[0]?.total || 0;
      setTotalRows(total);
      
      // Get paginated data
      const offset = (page - 1) * rowsPerPage;
      const dataSql = `SELECT * FROM "${tableName}" LIMIT ${rowsPerPage} OFFSET ${offset}`;
      const dataRes = await apiClient.post(`/api/projects/${projectId}/query`, { sql: dataSql });
      
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

  const totalPages = Math.ceil(totalRows / rowsPerPage);
  const startRow = (page - 1) * rowsPerPage + 1;
  const endRow = Math.min(page * rowsPerPage, totalRows);

  return (
    <div 
      className="min-h-screen flex flex-col"
      style={{ 
        background: '#0A0A0A',
        color: '#FFFFFF'
      }}
    >
      {/* Header Bar */}
      <div 
        className="flex items-center justify-between px-6 py-3"
        style={{
          background: '#000000',
          borderBottom: '1px solid #1F1F1F'
        }}
      >
        <div className="flex items-center gap-4">
          <h1 className="text-sm font-semibold">Tables</h1>
          <div className="flex items-center gap-2">
            <span className="text-xs text-[#888888]">
              {selectedTable || 'Select a table'}
            </span>
            {tableData && (
              <span 
                className="px-2 py-0.5 text-xs rounded-md"
                style={{
                  background: '#1F1F1F',
                  color: '#CCCCCC'
                }}
              >
                {totalRows} rows
              </span>
            )}
          </div>
          {/* Status badges like your reference */}
          <div className="flex items-center gap-2">
            <span 
              className="px-2 py-0.5 text-xs rounded-md flex items-center gap-1"
              style={{
                background: 'rgba(251, 191, 36, 0.1)',
                color: '#FBB F24',
                border: '1px solid rgba(251, 191, 36, 0.3)'
              }}
            >
              ⚠ RLS Disabled
            </span>
            <span 
              className="px-2 py-0.5 text-xs rounded-md flex items-center gap-1"
              style={{
                background: 'rgba(34, 197, 94, 0.1)',
                color: '#22C55E',
                border: '1px solid rgba(34, 197, 94, 0.3)'
              }}
            >
              ✓ Realtime On
            </span>
          </div>
        </div>

        {/* Action buttons */}
        <div className="flex items-center gap-2">
          <button
            className="px-3 py-1.5 text-xs rounded-md hover:opacity-80 transition-opacity flex items-center gap-1"
            style={{
              background: '#1F1F1F',
              border: '1px solid #333333'
            }}
          >
            <svg className="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 4a1 1 0 011-1h16a1 1 0 011 1v2.586a1 1 0 01-.293.707l-6.414 6.414a1 1 0 00-.293.707V17l-4 4v-6.586a1 1 0 00-.293-.707L3.293 7.707A1 1 0 013 7V4z" />
            </svg>
            Filter
          </button>
          <button
            className="px-3 py-1.5 text-xs rounded-md hover:opacity-80 transition-opacity flex items-center gap-1"
            style={{
              background: '#1F1F1F',
              border: '1px solid #333333'
            }}
          >
            <svg className="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M7 16V4m0 0L3 8m4-4l4 4m6 0v12m0 0l4-4m-4 4l-4-4" />
            </svg>
            Sort
          </button>
          <button
            onClick={() => setIsAddingRow(true)}
            className="px-3 py-1.5 text-xs rounded-md hover:opacity-80 transition-opacity flex items-center gap-1"
            style={{
              background: '#FF6B00',
              color: '#FFFFFF'
            }}
          >
            <svg className="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
            </svg>
            Insert Row
          </button>
        </div>
      </div>

      <div className="flex flex-1">
        {/* Left Sidebar - Table List */}
        <div 
          className="w-64 flex flex-col"
          style={{
            background: '#000000',
            borderRight: '1px solid #1F1F1F'
          }}
        >
          <div className="p-3">
            <div className="text-xs font-medium text-[#CCCCCC] mb-3">SCHEMA</div>
            {/* Schema folders like your reference */}
            <div className="space-y-1">
              <div 
                className="px-2 py-1.5 rounded text-xs font-medium flex items-center gap-2"
                style={{ background: '#FF6B00', color: '#FFFFFF' }}
              >
                <svg className="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 7v10a2 2 0 002 2h14a2 2 0 002-2V9a2 2 0 00-2-2h-6l-2-2H5a2 2 0 00-2 2z" />
                </svg>
                public
              </div>
              
              {/* Other schema folders */}
              <div className="px-2 py-1.5 rounded text-xs text-[#888888] flex items-center gap-2 hover:bg-[#1F1F1F] cursor-pointer">
                <svg className="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 7v10a2 2 0 002 2h14a2 2 0 002-2V9a2 2 0 00-2-2h-6l-2-2H5a2 2 0 00-2 2z" />
                </svg>
                auth
                <span 
                  className="ml-auto px-1.5 py-0.5 text-[10px] rounded"
                  style={{
                    background: '#1F1F1F',
                    color: '#888888'
                  }}
                >
                  5
                </span>
              </div>

              <div className="px-2 py-1.5 rounded text-xs text-[#888888] flex items-center gap-2 hover:bg-[#1F1F1F] cursor-pointer">
                <svg className="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 7v10a2 2 0 002 2h14a2 2 0 002-2V9a2 2 0 00-2-2h-6l-2-2H5a2 2 0 00-2 2z" />
                </svg>
                realtime
                <span 
                  className="ml-auto px-1.5 py-0.5 text-[10px] rounded"
                  style={{
                    background: '#1F1F1F',
                    color: '#888888'
                  }}
                >
                  2
                </span>
              </div>

              <div className="px-2 py-1.5 rounded text-xs text-[#888888] flex items-center gap-2 hover:bg-[#1F1F1F] cursor-pointer">
                <svg className="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 7v10a2 2 0 002 2h14a2 2 0 002-2V9a2 2 0 00-2-2h-6l-2-2H5a2 2 0 00-2 2z" />
                </svg>
                storage
                <span 
                  className="ml-auto px-1.5 py-0.5 text-[10px] rounded"
                  style={{
                    background: '#1F1F1F',
                    color: '#888888'
                  }}
                >
                  2
                </span>
              </div>

              {/* Selected table indicator */}
              <div 
                className="ml-4 px-2 py-1.5 rounded text-xs text-[#FF6B00] flex items-center gap-2"
                style={{ background: 'rgba(255, 107, 0, 0.1)' }}
              >
                <svg className="w-3 h-3" fill="currentColor" viewBox="0 0 24 24">
                  <path d="M3 3h18v2H3V3zm0 4h18v2H3V7zm0 4h18v2H3v-2zm0 4h18v2H3v-2zm0 4h18v2H3v-2z" />
                </svg>
                indian_states
              </div>
            </div>
          </div>
        </div>

        {/* Main Content Area */}
        <div className="flex-1 flex flex-col">
          {/* Table Header */}
          <div 
            className="flex items-center justify-between px-6 py-3"
            style={{
              background: '#000000',
              borderBottom: '1px solid #1F1F1F'
            }}
          >
            <div className="flex items-center gap-3">
              <div className="text-sm font-medium">indian_states</div>
              <div className="text-xs text-[#888888]">8 rows</div>
            </div>
            
            <div className="flex items-center gap-2">
              <button
                className="text-xs text-[#888888] hover:text-white"
                style={{ 
                  background: 'transparent',
                  border: 'none'
                }}
              >
                ⚙ Manage RLS
              </button>
            </div>
          </div>

          {/* Data Grid */}
          <div className="flex-1 overflow-auto">
            {loading ? (
              <div className="flex items-center justify-center h-64">
                <div className="text-sm text-[#888888]">Loading...</div>
              </div>
            ) : tableData && tableData.columns ? (
              <table className="w-full">
                <thead 
                  className="sticky top-0"
                  style={{
                    background: '#0A0A0A',
                    borderBottom: '1px solid #1F1F1F'
                  }}
                >
                  <tr>
                    <td className="w-12 px-4 py-3 text-xs font-medium text-[#888888]">
                      <input type="checkbox" className="w-3 h-3" />
                    </td>
                    {tableData.columns.map((col: string, i: number) => {
                      const colSchema = tableData.schema?.find((s: any) => s.name === col);
                      return (
                        <th key={i} className="px-4 py-3 text-left text-xs font-medium text-[#CCCCCC]">
                          <div className="flex flex-col gap-1">
                            <span>{col}</span>
                            {colSchema && (
                              <span 
                                className="text-[10px] font-normal"
                                style={{ color: '#666666' }}
                              >
                                {colSchema.type}
                                {colSchema.is_nullable === 'NO' ? ' • NOT NULL' : ' • nullable'}
                              </span>
                            )}
                          </div>
                        </th>
                      );
                    })}
                  </tr>
                </thead>
                <tbody>
                  {tableData.rows && tableData.rows.map((row: any, rowIndex: number) => (
                    <tr 
                      key={rowIndex}
                      className="hover:bg-[#0F0F0F] group"
                      style={{ borderBottom: '1px solid #1A1A1A' }}
                    >
                      <td className="px-4 py-3">
                        <input type="checkbox" className="w-3 h-3" />
                      </td>
                      {tableData.columns.map((col: string, colIndex: number) => {
                        const value = row[col];
                        const isEditing = editingCell?.row === rowIndex && editingCell?.col === col;
                        
                        return (
                          <td 
                            key={colIndex} 
                            className="px-4 py-3 text-xs cursor-pointer relative"
                            onClick={() => !isEditing && startEdit(rowIndex, col, value)}
                          >
                            {isEditing ? (
                              <div className="flex items-center gap-1">
                                <input
                                  type="text"
                                  value={editValue}
                                  onChange={(e) => setEditValue(e.target.value)}
                                  onKeyDown={(e) => {
                                    if (e.key === 'Enter') saveEdit(rowIndex, col);
                                    if (e.key === 'Escape') cancelEdit();
                                  }}
                                  className="flex-1 px-2 py-1 text-xs rounded focus:outline-none"
                                  style={{
                                    background: '#1F1F1F',
                                    border: '1px solid #FF6B00',
                                    color: '#FFFFFF'
                                  }}
                                  autoFocus
                                />
                              </div>
                            ) : (
                              <div className="flex items-center justify-between group-hover:bg-[#1A1A1A] -mx-2 px-2 py-1 rounded">
                                <span className="text-[#FFFFFF]">
                                  {value !== null ? String(value) : (
                                    <span className="text-[#666666] italic">NULL</span>
                                  )}
                                </span>
                                <button 
                                  className="opacity-0 group-hover:opacity-100 text-[#666666] hover:text-[#FF6B00] ml-2"
                                  onClick={(e) => {
                                    e.stopPropagation();
                                    startEdit(rowIndex, col, value);
                                  }}
                                >
                                  <svg className="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z" />
                                  </svg>
                                </button>
                              </div>
                            )}
                          </td>
                        );
                      })}
                    </tr>
                  ))}
                </tbody>
              </table>
            ) : (
              <div className="flex items-center justify-center h-64">
                <div className="text-center">
                  <div className="text-sm font-medium text-[#CCCCCC] mb-1">No table selected</div>
                  <div className="text-xs text-[#888888]">Select a table to view data</div>
                </div>
              </div>
            )}
          </div>

          {/* Footer with pagination */}
          {tableData && (
            <div 
              className="flex items-center justify-between px-6 py-3"
              style={{
                background: '#000000',
                borderTop: '1px solid #1F1F1F'
              }}
            >
              <div className="text-xs text-[#888888]">
                Showing {startRow} to {endRow} of {totalRows} rows
              </div>
              
              <div className="flex items-center gap-2">
                <button
                  onClick={() => setPage(Math.max(1, page - 1))}
                  disabled={page === 1}
                  className="px-3 py-1 text-xs rounded disabled:opacity-50 hover:opacity-80"
                  style={{
                    background: '#1F1F1F',
                    border: '1px solid #333333'
                  }}
                >
                  Previous
                </button>
                
                <span className="text-xs text-[#CCCCCC] px-2">
                  Page {page} of {totalPages}
                </span>
                
                <button
                  onClick={() => setPage(Math.min(totalPages, page + 1))}
                  disabled={page === totalPages}
                  className="px-3 py-1 text-xs rounded disabled:opacity-50 hover:opacity-80"
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
    </div>
  );
}