'use client';

// FORCE REBUILD: Modern table editor with black/orange theme - Updated 2026-06-24 21:45
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
  const [page, setPage] = useState(1);
  const [totalRows, setTotalRows] = useState(0);
  const [rlsEnabled, setRlsEnabled] = useState(false);
  const [rlsPolicyCount, setRlsPolicyCount] = useState(0);
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

      // Fetch RLS status for the selected table
      await fetchRLSStatus(tableName);
    } catch (err) {
      console.error('Failed to fetch table data:', err);
      setTableData(null);
      showToast('Failed to load table data', 'error');
    } finally {
      setLoading(false);
    }
  };

  const fetchRLSStatus = async (tableName: string) => {
    const projectId = localStorage.getItem('current_project_id');
    if (!projectId) return;

    try {
      const sql = `
        SELECT 
          t.rowsecurity as rls_enabled,
          COUNT(p.policyname) as policy_count
        FROM pg_tables t
        LEFT JOIN pg_policies p ON p.tablename = t.tablename AND p.schemaname = t.schemaname
        WHERE t.tablename = '${tableName}' AND t.schemaname = current_schema()
        GROUP BY t.rowsecurity
      `;
      
      const response = await apiClient.post(`/api/projects/${projectId}/query`, { sql });
      if (response.rows && response.rows.length > 0) {
        setRlsEnabled(response.rows[0].rls_enabled || false);
        setRlsPolicyCount(response.rows[0].policy_count || 0);
      } else {
        setRlsEnabled(false);
        setRlsPolicyCount(0);
      }
    } catch (err) {
      console.error('Failed to fetch RLS status:', err);
    }
  };

  const toggleRLS = async () => {
    if (!selectedTable) return;
    
    const projectId = localStorage.getItem('current_project_id');
    if (!projectId) return;

    try {
      const action = rlsEnabled ? 'DISABLE' : 'ENABLE';
      const sql = `ALTER TABLE "${selectedTable}" ${action} ROW LEVEL SECURITY;`;
      
      await apiClient.post(`/api/projects/${projectId}/query`, { sql });
      
      // Refresh RLS status
      await fetchRLSStatus(selectedTable);
      
      showToast(`RLS ${action.toLowerCase()}d successfully`, 'success');
    } catch (err: any) {
      showToast(err.message || `Failed to ${rlsEnabled ? 'disable' : 'enable'} RLS`, 'error');
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
          {/* Status badges and RLS controls */}
          <div className="flex items-center gap-2">
            {/* RLS Toggle Button */}
            <button
              onClick={toggleRLS}
              disabled={!selectedTable}
              className="px-3 py-1.5 text-xs rounded-md hover:opacity-80 transition-opacity flex items-center gap-2 disabled:opacity-50"
              style={{
                background: rlsEnabled ? 'rgba(59, 130, 246, 0.1)' : 'rgba(107, 107, 107, 0.1)',
                border: rlsEnabled ? '1px solid rgba(59, 130, 246, 0.3)' : '1px solid rgba(107, 107, 107, 0.3)',
                color: rlsEnabled ? '#3B82F6' : '#6B6B6B'
              }}
            >
              <svg className="w-3.5 h-3.5" fill="currentColor" viewBox="0 0 20 20">
                <path fillRule="evenodd" d="M5 9V7a5 5 0 0110 0v2a2 2 0 012 2v5a2 2 0 01-2 2H5a2 2 0 01-2-2v-5a2 2 0 012-2zm8-2v2H7V7a3 3 0 016 0z" clipRule="evenodd" />
              </svg>
              <span>RLS Enabled ({rlsPolicyCount})</span>
              <div 
                className="w-8 h-4 rounded-full relative"
                style={{ background: rlsEnabled ? '#3B82F6' : '#333333' }}
              >
                <div 
                  className="w-3 h-3 bg-white rounded-full absolute top-0.5"
                  style={{ 
                    transition: 'all 0.2s',
                    left: rlsEnabled ? '14px' : '2px'
                  }}
                />
              </div>
            </button>

            {/* Manage RLS Button */}
            <button
              onClick={() => window.location.href = '/dashboard/database/rls'}
              className="px-3 py-1.5 text-xs rounded-md hover:opacity-80 transition-opacity flex items-center gap-1.5"
              style={{
                background: '#1F1F1F',
                border: '1px solid #333333',
                color: '#CCCCCC'
              }}
            >
              <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 6V4m0 2a2 2 0 100 4m0-4a2 2 0 110 4m-6 8a2 2 0 100-4m0 4a2 2 0 110-4m0 4v2m0-6V4m6 6v10m6-2a2 2 0 100-4m0 4a2 2 0 110-4m0 4v2m0-6V4" />
              </svg>
              Manage RLS
            </button>

            {/* Realtime Status */}
            <span 
              className="px-2 py-0.5 text-xs rounded-md flex items-center gap-1"
              style={{
                background: 'rgba(34, 197, 94, 0.1)',
                color: '#22C55E',
                border: '1px solid rgba(34, 197, 94, 0.3)'
              }}
            >
              <svg className="w-3 h-3" fill="currentColor" viewBox="0 0 20 20">
                <path fillRule="evenodd" d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z" clipRule="evenodd" />
              </svg>
              Realtime On
            </span>
          </div>
        </div>

        {/* Action buttons */}
        <div className="flex items-center gap-2">
          <button
            onClick={() => selectedTable && fetchTableData(selectedTable)}
            className="px-3 py-1.5 text-xs rounded-md hover:opacity-80 transition-opacity flex items-center gap-1.5"
            style={{
              background: '#1F1F1F',
              border: '1px solid #333333'
            }}
          >
            <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
            </svg>
            Refresh
          </button>
          <button
            onClick={startAddRow}
            disabled={isAddingRow}
            className="px-3 py-1.5 text-xs rounded-md hover:opacity-80 transition-opacity flex items-center gap-1.5 disabled:opacity-50"
            style={{
              background: '#FF6B00',
              color: '#FFFFFF'
            }}
          >
            <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
            </svg>
            Add Row
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
            {/* Schema folders */}
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

              {/* Tables list */}
              {tables.length > 0 && (
                <div className="ml-4 mt-2 space-y-0.5">
                  {tables.map((table) => (
                    <div 
                      key={table.table_name}
                      onClick={() => setSelectedTable(table.table_name)}
                      className={`px-2 py-1.5 rounded text-xs cursor-pointer flex items-center gap-2 ${
                        selectedTable === table.table_name
                          ? 'text-[#FF6B00]'
                          : 'text-[#888888] hover:text-[#CCCCCC]'
                      }`}
                      style={{ 
                        background: selectedTable === table.table_name ? 'rgba(255, 107, 0, 0.1)' : 'transparent'
                      }}
                    >
                      <svg className="w-3 h-3" fill="currentColor" viewBox="0 0 24 24">
                        <path d="M3 3h18v2H3V3zm0 4h18v2H3V7zm0 4h18v2H3v-2zm0 4h18v2H3v-2zm0 4h18v2H3v-2z" />
                      </svg>
                      {table.table_name}
                    </div>
                  ))}
                </div>
              )}
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
              <div className="text-sm font-medium">{selectedTable || 'No table selected'}</div>
              <div className="text-xs text-[#888888]">{totalRows} rows</div>
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
            ) : !selectedTable ? (
              <div className="flex items-center justify-center h-64">
                <div className="text-center">
                  <div className="text-sm font-medium text-[#CCCCCC] mb-1">No table selected</div>
                  <div className="text-xs text-[#888888]">Select a table to view data</div>
                </div>
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
                    <th className="px-4 py-3 text-left text-xs font-medium text-[#CCCCCC] w-20">
                      Actions
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
                        background: 'rgba(34, 197, 94, 0.1)'
                      }}
                    >
                      <td className="px-4 py-3">
                        <input type="checkbox" className="w-3 h-3" />
                      </td>
                      {tableData.columns.map((col: string, colIndex: number) => (
                        <td key={colIndex} className="px-4 py-3">
                          <input
                            type="text"
                            value={newRow[col] || ''}
                            onChange={(e) => setNewRow({ ...newRow, [col]: e.target.value })}
                            placeholder={col}
                            className="w-full px-2 py-1 text-xs rounded focus:outline-none"
                            style={{
                              background: '#1F1F1F',
                              border: '1px solid #22C55E',
                              color: '#FFFFFF'
                            }}
                          />
                        </td>
                      ))}
                      <td className="px-4 py-3">
                        <div className="flex gap-1">
                          <button
                            onClick={saveNewRow}
                            className="text-green-400 hover:text-green-300 text-xs px-2 py-1 rounded"
                            style={{ background: 'rgba(34, 197, 94, 0.2)' }}
                          >
                            Save
                          </button>
                          <button
                            onClick={cancelAddRow}
                            className="text-red-400 hover:text-red-300 text-xs px-2 py-1 rounded"
                            style={{ background: 'rgba(239, 68, 68, 0.2)' }}
                          >
                            Cancel
                          </button>
                        </div>
                      </td>
                    </tr>
                  )}
                  
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
                                <button
                                  onClick={() => saveEdit(rowIndex, col)}
                                  className="text-green-400 hover:text-green-300 px-1"
                                >
                                  ✓
                                </button>
                                <button
                                  onClick={cancelEdit}
                                  className="text-red-400 hover:text-red-300 px-1"
                                >
                                  ✕
                                </button>
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
                      <td className="px-4 py-3">
                        <button
                          onClick={() => deleteRow(rowIndex)}
                          className="text-red-400 hover:text-red-300 text-xs px-2 py-1 rounded opacity-0 group-hover:opacity-100 transition-opacity"
                          style={{ background: 'rgba(239, 68, 68, 0.2)' }}
                        >
                          Delete
                        </button>
                      </td>
                    </tr>
                  ))}
                  
                  {tableData.rows.length === 0 && !isAddingRow && (
                    <tr>
                      <td colSpan={tableData.columns.length + 2} className="px-4 py-8 text-center">
                        <div className="flex flex-col items-center justify-center text-center">
                          <h3 className="text-sm font-semibold text-[#CCCCCC] mb-2">No data in this table</h3>
                          <p className="text-xs text-[#888888] mb-3">Click "Insert Row" to add data</p>
                        </div>
                      </td>
                    </tr>
                  )}
                </tbody>
              </table>
            ) : (
              <div className="flex items-center justify-center h-64">
                <div className="text-center">
                  <div className="text-sm font-medium text-[#CCCCCC] mb-1">Unable to load table</div>
                  <div className="text-xs text-[#888888]">There was an error loading this table's data</div>
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
