'use client';

import { useState, useEffect, useRef } from 'react';
import { apiClient } from '@/lib/api';
import { useToast } from '@/lib/toast';
import { io, Socket } from 'socket.io-client';

interface Table {
  table_name: string;
  row_count: number;
  column_count: number;
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
  const socketRef = useRef<Socket | null>(null);
  const [isRealtimeConnected, setIsRealtimeConnected] = useState(false);
  const [showDeleteModal, setShowDeleteModal] = useState(false);
  const [deleteModalType, setDeleteModalType] = useState<'table' | 'row'>('table');
  const [deleteRowIndex, setDeleteRowIndex] = useState<number | null>(null);

  useEffect(() => {
    fetchTables();
    setupRealtimeConnection();
    
    return () => {
      // Cleanup WebSocket connection on unmount
      if (socketRef.current) {
        socketRef.current.disconnect();
      }
    };
  }, []);

  useEffect(() => {
    if (selectedTable) {
      fetchTableData(selectedTable);
      subscribeToTable(selectedTable);
    }
  }, [selectedTable]);

  const setupRealtimeConnection = () => {
    const projectId = localStorage.getItem('current_project_id');
    if (!projectId) return;

    // Connect to WebSocket server using environment variable
    const wsUrl = process.env.NEXT_PUBLIC_WS_URL!;
    const socket = io(wsUrl, {
      transports: ['websocket'],
      reconnection: true,
      reconnectionDelay: 1000,
      reconnectionAttempts: 5
    });

    socket.on('connect', () => {
      console.log('Connected to realtime server');
      setIsRealtimeConnected(true);
    });

    socket.on('disconnect', () => {
      console.log('Disconnected from realtime server');
      setIsRealtimeConnected(false);
    });

    socket.on('database_change', (data: any) => {
      handleRealtimeUpdate(data);
    });

    socketRef.current = socket;
  };

  const subscribeToTable = (tableName: string) => {
    const projectId = localStorage.getItem('current_project_id');
    if (!socketRef.current || !projectId) return;

    // Subscribe to table changes
    socketRef.current.emit('subscribe', {
      channel: `project:${projectId}:table:${tableName}`,
      table: tableName,
      project_id: projectId
    });
  };

  const handleRealtimeUpdate = (data: any) => {
    if (!selectedTable || !tableData) return;
    
    // Check if update is for current table
    if (data.table !== selectedTable) return;

    console.log('Realtime update received:', data);

    // Handle different operation types
    switch (data.operation) {
      case 'INSERT':
        // Add new row to table
        if (data.new_data) {
          setTableData((prev: any) => ({
            ...prev,
            rows: [...prev.rows, data.new_data],
            row_count: prev.row_count + 1
          }));
          showToast('New row added', 'success');
        }
        break;

      case 'UPDATE':
        // Update existing row
        if (data.new_data && data.old_data) {
          setTableData((prev: any) => ({
            ...prev,
            rows: prev.rows.map((row: any) => 
              row.id === data.new_data.id ? data.new_data : row
            )
          }));
          showToast('Row updated', 'success');
        }
        break;

      case 'DELETE':
        // Remove deleted row
        if (data.old_data) {
          setTableData((prev: any) => ({
            ...prev,
            rows: prev.rows.filter((row: any) => row.id !== data.old_data.id),
            row_count: prev.row_count - 1
          }));
          showToast('Row deleted', 'success');
        }
        break;
    }
  };

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
      
      // Only auto-select first table if no table is currently selected
      // This prevents resetting the selection when refreshing the table list
      if (data.length > 0 && !selectedTable) {
        setSelectedTable(data[0].table_name);
      } else if (selectedTable) {
        // Verify the currently selected table still exists in the list
        const tableExists = data.some((t: Table) => t.table_name === selectedTable);
        if (!tableExists && data.length > 0) {
          // If selected table was deleted, select the first available table
          setSelectedTable(data[0].table_name);
        }
      }
    } catch (err) {
      console.error('Failed to fetch tables:', err);
    }
  };

  const fetchTableData = async (tableName: string) => {
    const projectId = localStorage.getItem('current_project_id');
    if (!projectId) {
      showToast('No project selected', 'error');
      return;
    }

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
    if (!projectId) {
      showToast('No project selected', 'error');
      return;
    }

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
    
    setDeleteModalType('row');
    setDeleteRowIndex(rowIndex);
    setShowDeleteModal(true);
  };

  const confirmDeleteRow = async () => {
    if (!selectedTable || !tableData || deleteRowIndex === null) return;
    
    const projectId = localStorage.getItem('current_project_id');
    if (!projectId) {
      showToast('No project selected', 'error');
      return;
    }

    const row = tableData.rows[deleteRowIndex];
    const primaryKey = tableData.schema.find((s: any) => s.name === 'id');
    
    if (!primaryKey) {
      showToast('Cannot delete: No primary key found', 'error');
      setShowDeleteModal(false);
      return;
    }

    const pkValue = row[primaryKey.name];
    const deleteSql = `DELETE FROM "${selectedTable}" WHERE "${primaryKey.name}" = '${pkValue}'`;

    try {
      await apiClient.post(`/api/projects/${projectId}/query`, { sql: deleteSql });
      
      // Update local state
      const newRows = tableData.rows.filter((_: any, i: number) => i !== deleteRowIndex);
      setTableData({ ...tableData, rows: newRows, row_count: newRows.length });
      
      showToast('Row deleted successfully', 'success');
    } catch (err: any) {
      showToast(err.message || 'Failed to delete row', 'error');
    } finally {
      setShowDeleteModal(false);
      setDeleteRowIndex(null);
    }
  };

  const deleteTable = async () => {
    if (!selectedTable) return;
    
    setDeleteModalType('table');
    setShowDeleteModal(true);
  };

  const confirmDeleteTable = async () => {
    if (!selectedTable) return;
    
    const projectId = localStorage.getItem('current_project_id');
    if (!projectId) {
      showToast('No project selected', 'error');
      return;
    }

    const dropSql = `DROP TABLE "${selectedTable}"`;

    try {
      await apiClient.post(`/api/projects/${projectId}/query`, { sql: dropSql });
      
      showToast(`Table "${selectedTable}" deleted successfully`, 'success');
      
      // Clear selection and refresh tables list
      setSelectedTable(null);
      setTableData(null);
      fetchTables();
    } catch (err: any) {
      showToast(err.message || 'Failed to delete table', 'error');
    } finally {
      setShowDeleteModal(false);
    }
  };

  const startAddRow = () => {
    if (!tableData) return;
    
    const emptyRow: any = {};
    const autoGeneratedCols = ['id', 'created_at', 'updated_at'];
    
    // Only include non-auto-generated columns in the form
    tableData.columns.forEach((col: string) => {
      if (!autoGeneratedCols.includes(col.toLowerCase())) {
        emptyRow[col] = '';
      }
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
    if (!projectId) {
      showToast('No project selected', 'error');
      return;
    }

    // Skip auto-generated columns and only include columns with values
    const autoGeneratedCols = ['id', 'created_at', 'updated_at'];
    const columns = Object.keys(newRow).filter(key => {
      // Skip auto-generated columns
      if (autoGeneratedCols.includes(key.toLowerCase())) return false;
      // Skip empty values
      if (newRow[key] === '') return false;
      return true;
    });

    if (columns.length === 0) {
      showToast('Please fill in at least one field', 'error');
      return;
    }

    const values = columns.map(col => {
      const colSchema = tableData.schema.find((s: any) => s.name === col);
      const value = newRow[col];
      
      if (value === '' && colSchema?.is_nullable === 'YES') {
        return 'NULL';
      } else if (colSchema?.type.includes('int') || colSchema?.type.includes('numeric') || colSchema?.type.includes('double') || colSchema?.type.includes('float')) {
        return value;
      } else if (colSchema?.type.includes('bool')) {
        return value.toLowerCase() === 'true' ? 'true' : 'false';
      } else {
        return `'${value.replace(/'/g, "''")}'`;
      }
    });

    const insertSql = `INSERT INTO "${selectedTable}" (${columns.map(c => `"${c}"`).join(', ')}) VALUES (${values.join(', ')}) RETURNING *`;

    console.log('Insert SQL:', insertSql); // Debug log

    try {
      const result = await apiClient.post(`/api/projects/${projectId}/query`, { sql: insertSql });
      
      // Refresh table data to ensure we see the inserted row
      await fetchTableData(selectedTable);
      
      setNewRow(null);
      setIsAddingRow(false);
      showToast('Row added successfully', 'success');
    } catch (err: any) {
      console.error('Insert error:', err); // Debug log
      showToast(err.message || 'Failed to add row', 'error');
    }
  };

  return (
    <>
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
            {/* Realtime Indicator */}
            <div className="flex items-center space-x-1">
              <div className={`w-1.5 h-1.5 rounded-full ${isRealtimeConnected ? 'bg-green-500' : 'bg-gray-500'}`} />
              <span className="text-[10px] text-[#6b6b6b]">
                {isRealtimeConnected ? 'Live' : 'Offline'}
              </span>
            </div>
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
                <button
                  onClick={deleteTable}
                  className="px-2 py-1 text-[10px] bg-red-900/20 hover:bg-red-900/30 text-red-400 rounded flex items-center space-x-1"
                  title="Delete table"
                >
                  <svg className="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
                  </svg>
                  <span>Delete Table</span>
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
                        className="text-red-400 hover:text-red-300 hover:bg-red-900/20 p-1.5 rounded transition-colors"
                        title="Delete row"
                      >
                        <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
                        </svg>
                      </button>
                    </td>
                  </tr>
                ))}
                
                {/* New Row Form */}
                {isAddingRow && newRow && (
                  <tr className="border-b border-[#2a2a2a] bg-green-900/10">
                    {tableData.columns.map((col: string, colIndex: number) => {
                      const autoGeneratedCols = ['id', 'created_at', 'updated_at'];
                      const isAutoGenerated = autoGeneratedCols.includes(col.toLowerCase());
                      const colSchema = tableData.schema?.find((s: any) => s.name === col);
                      const isRequired = colSchema?.is_nullable === 'NO' && !isAutoGenerated && !colSchema?.column_default;
                      
                      return (
                        <td key={colIndex} className="px-3 py-2">
                          {isAutoGenerated ? (
                            <span className="text-[10px] text-[#6b6b6b] italic">auto</span>
                          ) : (
                            <input
                              type="text"
                              value={newRow[col] || ''}
                              onChange={(e) => setNewRow({ ...newRow, [col]: e.target.value })}
                              placeholder={isRequired ? `${col} (required)` : col}
                              className={`w-full bg-[#1c1c1c] border rounded px-1 py-0.5 text-xs text-[#ededed] focus:outline-none ${
                                isRequired ? 'border-orange-600' : 'border-green-600'
                              }`}
                            />
                          )}
                        </td>
                      );
                    })}
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

    {/* Delete Confirmation Modal */}
    {showDeleteModal && (
      <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50">
        <div className="bg-[#1c1c1c] border border-[#2a2a2a] rounded-lg p-6 max-w-md w-full mx-4">
          <div className="flex items-start space-x-4">
            <div className="flex-shrink-0">
              <svg className="w-6 h-6 text-red-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
              </svg>
            </div>
            <div className="flex-1">
              <h3 className="text-lg font-semibold text-[#ededed] mb-2">
                {deleteModalType === 'table' ? 'Delete Table' : 'Delete Row'}
              </h3>
              <p className="text-sm text-[#a1a1a1] mb-4">
                {deleteModalType === 'table' 
                  ? `Are you sure you want to delete the table "${selectedTable}"? This action cannot be undone and all data will be lost.`
                  : 'Are you sure you want to delete this row? This action cannot be undone.'
                }
              </p>
              <div className="flex justify-end space-x-3">
                <button
                  onClick={() => {
                    setShowDeleteModal(false);
                    setDeleteRowIndex(null);
                  }}
                  className="px-4 py-2 text-sm bg-[#2a2a2a] hover:bg-[#3a3a3a] text-[#ededed] rounded transition-colors"
                >
                  Cancel
                </button>
                <button
                  onClick={deleteModalType === 'table' ? confirmDeleteTable : confirmDeleteRow}
                  className="px-4 py-2 text-sm bg-red-600 hover:bg-red-700 text-white rounded transition-colors"
                >
                  Delete
                </button>
              </div>
            </div>
          </div>
        </div>
      </div>
    )}
    </>
  );
}
