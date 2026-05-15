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

export default function TablesPageEditable() {
  const { showToast } = useToast();
  const [tables, setTables] = useState<Table[]>([]);
  const [selectedTable, setSelectedTable] = useState<string | null>(null);
  const [tableData, setTableData] = useState<any>(null);
  const [loading, setLoading] = useState(false);
  const [editingCell, setEditingCell] = useState<{row: number, col: string} | null>(null);
  const [editValue, setEditValue] = useState<string>('');
  const [newRow, setNewRow] = useState<any>(null);
  const [isAddingRow, setIsAddingRow] = useState(false);

  useEffect(() => {
    fetchTables();
    const interval = setInterval(() => fetchTables(), 5000);
    return () => clearInterval(interval);
  }, []);

  useEffect(() => {
    if (selectedTable) {
      fetchTableData(selectedTable);
    }
  }, [selectedTable]);

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
      
      // Get data
      const dataSql = `SELECT * FROM "${tableName}" LIMIT 100`;
      const dataRes = await apiClient.post(`/api/projects/${projectId}/query`, { sql: dataSql });
      
      setTableData({
        columns: columns.map((c: any) => c.name),
        rows: dataRes.rows || [],
        row_count: dataRes.row_count || 0,
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
    const primaryKey = tableData.schema.find((s: any) => s.name === 'id');
    
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
    const primaryKey = tableData.schema.find((s: any) => s.name === 'id');
    
    if (!primaryKey) {
      showToast('Cannot delete: No primary key found', 'error');
      return;
    }

    const pkValue = row[primaryKey.name];
    const deleteSql = `DELETE FROM "${selectedTable}" WHERE "${primaryKey.name}" = '${pkValue}'`;

    try {
      await apiClient.post(`/api/projects/${projectId}/query`, { sql: deleteSql });
      
      // Update local state
      const newRows = tableData.rows.filter((_: any, i: number) => i !== rowIndex);
      setTableData({ ...tableData, rows: newRows, row_count: newRows.length });
      
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
      
      // Add new row to local state
      if (result.rows && result.rows.length > 0) {
        const newRows = [...tableData.rows, result.rows[0]];
        setTableData({ ...tableData, rows: newRows, row_count: newRows.length });
      }
      
      setNewRow(null);
      setIsAddingRow(false);
      showToast('Row added successfully', 'success');
    } catch (err: any) {
      showToast(err.message || 'Failed to add row', 'error');
    }
  };

  return (
    <div className="h-full flex bg-[#1c1c1c]">
      {/* Left Sidebar */}
      <div className="w-64 bg-[#181818] border-r border-[#2a2a2a] flex flex-col">
        <div className="h-10 flex items-center justify-between px-3 border-b border-[#2a2a2a]">
          <h2 className="text-xs font-semibold text-[#ededed]">Tables</h2>
          <button 
            onClick={fetchTables}
            className="p-1 rounded hover:bg-[#2a2a2a] text-[#a1a1a1] hover:text-[#ededed]"
          >
            <svg className="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
            </svg>
          </button>
        </div>

        <div className="flex-1 overflow-y-auto p-2">
          {tables.length === 0 ? (
            <div className="flex flex-col items-center justify-center h-full text-center p-4">
              <p className="text-xs text-[#6b6b6b]">No tables yet</p>
            </div>
          ) : (
            <div className="space-y-0.5">
              {tables.map((table) => (
                <button
                  key={table.table_name}
                  onClick={() => setSelectedTable(table.table_name)}
                  className={`w-full text-left px-2 py-1.5 rounded transition-colors ${
                    selectedTable === table.table_name
                      ? 'bg-[#2a2a2a] text-[#ededed]'
                      : 'text-[#a1a1a1] hover:bg-[#2a2a2a] hover:text-[#ededed]'
                  }`}
                >
                  <div className="flex items-center space-x-2">
                    <svg className="w-3 h-3 flex-shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 10h18M3 14h18m-9-4v8m-7 0h14a2 2 0 002-2V8a2 2 0 00-2-2H5a2 2 0 00-2 2v8a2 2 0 002 2z" />
                    </svg>
                    <span className="text-xs truncate">{table.table_name}</span>
                  </div>
                </button>
              ))}
            </div>
          )}
        </div>
      </div>

      {/* Main Content */}
      <div className="flex-1 flex flex-col">
        {/* Toolbar */}
        <div className="h-10 flex items-center justify-between px-4 border-b border-[#2a2a2a] bg-[#181818]">
          <div className="flex items-center space-x-2">
            <h1 className="text-xs font-semibold text-[#ededed]">{selectedTable || 'Select a table'}</h1>
            {tableData && (
              <span className="text-[10px] text-[#6b6b6b]">
                {tableData.row_count} rows
              </span>
            )}
          </div>
          <div className="flex items-center space-x-2">
            {selectedTable && (
              <>
                <button
                  onClick={startAddRow}
                  disabled={isAddingRow}
                  className="px-2 py-1 text-[10px] bg-green-900/20 hover:bg-green-900/30 text-green-400 rounded disabled:opacity-50"
                >
                  + Add Row
                </button>
                <button
                  onClick={() => selectedTable && fetchTableData(selectedTable)}
                  className="px-2 py-1 text-[10px] bg-[#2a2a2a] hover:bg-[#3a3a3a] text-[#ededed] rounded"
                >
                  Refresh
                </button>
              </>
            )}
          </div>
        </div>

        {/* Table Content */}
        <div className="flex-1 overflow-auto p-4">
          {!selectedTable ? (
            <div className="flex flex-col items-center justify-center h-full text-center">
              <svg className="w-16 h-16 text-[#3a3a3a] mb-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 10h18M3 14h18m-9-4v8m-7 0h14a2 2 0 002-2V8a2 2 0 00-2-2H5a2 2 0 00-2 2v8a2 2 0 002 2z" />
              </svg>
              <h3 className="text-sm font-semibold text-[#ededed] mb-2">No table selected</h3>
              <p className="text-xs text-[#6b6b6b]">Select a table from the sidebar</p>
            </div>
          ) : loading ? (
            <div className="flex items-center justify-center h-full">
              <div className="text-xs text-[#6b6b6b]">Loading...</div>
            </div>
          ) : tableData && tableData.columns && tableData.columns.length > 0 ? (
            <table className="w-full text-xs border border-[#2a2a2a]">
              <thead className="bg-[#181818] sticky top-0">
                <tr>
                  {tableData.columns.map((col: string, i: number) => {
                    const colSchema = tableData.schema?.find((s: any) => s.name === col);
                    return (
                      <th key={i} className="px-3 py-2 text-left border-b border-[#2a2a2a]">
                        <div className="flex flex-col gap-0.5">
                          <span className="text-[#ededed] font-medium">{col}</span>
                          {colSchema && (
                            <span className="text-[10px] text-[#6b6b6b] font-normal">
                              {colSchema.type}
                              {colSchema.is_nullable === 'NO' && ' • NOT NULL'}
                            </span>
                          )}
                        </div>
                      </th>
                    );
                  })}
                  <th className="px-3 py-2 text-left border-b border-[#2a2a2a] w-20">
                    <span className="text-[#ededed] font-medium">Actions</span>
                  </th>
                </tr>
              </thead>
              <tbody>
                {tableData.rows && tableData.rows.map((row: any, rowIndex: number) => (
                  <tr key={rowIndex} className="border-b border-[#2a2a2a] hover:bg-[#2a2a2a]">
                    {tableData.columns.map((col: string, colIndex: number) => {
                      const value = row[col];
                      const isEditing = editingCell?.row === rowIndex && editingCell?.col === col;
                      
                      return (
                        <td 
                          key={colIndex} 
                          className="px-3 py-2 text-[#ededed] cursor-pointer hover:bg-[#3a3a3a]"
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
                                className="flex-1 bg-[#1c1c1c] border border-orange-600 rounded px-1 py-0.5 text-xs text-[#ededed] focus:outline-none"
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
                            <span>
                              {value !== null ? String(value) : <span className="text-[#6b6b6b] italic">NULL</span>}
                            </span>
                          )}
                        </td>
                      );
                    })}
                    <td className="px-3 py-2">
                      <button
                        onClick={() => deleteRow(rowIndex)}
                        className="text-red-400 hover:text-red-300 text-xs"
                      >
                        Delete
                      </button>
                    </td>
                  </tr>
                ))}
                
                {/* New Row Form */}
                {isAddingRow && newRow && (
                  <tr className="border-b border-[#2a2a2a] bg-green-900/10">
                    {tableData.columns.map((col: string, colIndex: number) => (
                      <td key={colIndex} className="px-3 py-2">
                        <input
                          type="text"
                          value={newRow[col] || ''}
                          onChange={(e) => setNewRow({ ...newRow, [col]: e.target.value })}
                          placeholder={col}
                          className="w-full bg-[#1c1c1c] border border-green-600 rounded px-1 py-0.5 text-xs text-[#ededed] focus:outline-none"
                        />
                      </td>
                    ))}
                    <td className="px-3 py-2">
                      <div className="flex gap-1">
                        <button
                          onClick={saveNewRow}
                          className="text-green-400 hover:text-green-300 text-xs"
                        >
                          Save
                        </button>
                        <button
                          onClick={cancelAddRow}
                          className="text-red-400 hover:text-red-300 text-xs"
                        >
                          Cancel
                        </button>
                      </div>
                    </td>
                  </tr>
                )}
                
                {tableData.rows.length === 0 && !isAddingRow && (
                  <tr>
                    <td colSpan={tableData.columns.length + 1} className="px-3 py-8 text-center">
                      <div className="flex flex-col items-center justify-center text-center">
                        <h3 className="text-sm font-semibold text-[#ededed] mb-2">No data in this table</h3>
                        <p className="text-xs text-[#6b6b6b] mb-3">Click "+ Add Row" to insert data</p>
                      </div>
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          ) : (
            <div className="flex flex-col items-center justify-center h-full text-center">
              <h3 className="text-sm font-semibold text-[#ededed] mb-2">Unable to load table</h3>
              <p className="text-xs text-[#6b6b6b]">There was an error loading this table's data</p>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
