"use client";

import { useState, useEffect } from "react";

interface RLSTable {
  tablename: string;
  rls_enabled: boolean;
  policy_count: number;
  policies: RLSPolicy[];
}

interface RLSPolicy {
  policyname: string;
  cmd: string;
  permissive: string;
  roles: string[];
  qual: string;
  with_check: string;
}

export default function RLSPage() {
  const [tables, setTables] = useState<RLSTable[]>([]);
  const [loading, setLoading] = useState(true);
  const [selectedTable, setSelectedTable] = useState<RLSTable | null>(null);
  const [rlsStats, setRlsStats] = useState({
    total_tables: 0,
    rls_enabled: 0,
    total_policies: 0
  });

  useEffect(() => {
    fetchRLSStatus();
  }, []);

  const fetchRLSStatus = async () => {
    try {
      const projectId = localStorage.getItem("current_project_id");
      const token = localStorage.getItem("token");
      
      // Query to get RLS status and policies
      const sql = `
        SELECT 
          t.tablename,
          t.rowsecurity as rls_enabled,
          COALESCE(
            json_agg(
              json_build_object(
                'policyname', p.policyname,
                'cmd', p.cmd,
                'permissive', p.permissive,
                'roles', p.roles,
                'qual', p.qual,
                'with_check', p.with_check
              )
            ) FILTER (WHERE p.policyname IS NOT NULL),
            '[]'
          ) as policies
        FROM pg_tables t
        LEFT JOIN pg_policies p ON p.tablename = t.tablename AND p.schemaname = t.schemaname
        WHERE t.schemaname = 'public'
        GROUP BY t.tablename, t.rowsecurity
        ORDER BY t.tablename;
      `;
      
      const response = await fetch(`http://localhost:8000/api/projects/${projectId}/query`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "Authorization": `Bearer ${token}`,
          "x-project-id": projectId || ""
        },
        body: JSON.stringify({ sql })
      });
      
      if (response.ok) {
        const result = await response.json();
        const tablesData = result.rows.map((row: any) => ({
          tablename: row.tablename,
          rls_enabled: row.rls_enabled,
          policies: typeof row.policies === 'string' ? JSON.parse(row.policies) : row.policies,
          policy_count: (typeof row.policies === 'string' ? JSON.parse(row.policies) : row.policies).length
        }));
        
        setTables(tablesData);
        
        // Calculate stats
        const stats = {
          total_tables: tablesData.length,
          rls_enabled: tablesData.filter((t: RLSTable) => t.rls_enabled).length,
          total_policies: tablesData.reduce((sum: number, t: RLSTable) => sum + t.policy_count, 0)
        };
        setRlsStats(stats);
        
        if (tablesData.length > 0) {
          setSelectedTable(tablesData[0]);
        }
      }
    } catch (error) {
      console.error("Failed to fetch RLS status:", error);
    } finally {
      setLoading(false);
    }
  };

  const enableRLS = async (tableName: string) => {
    try {
      const projectId = localStorage.getItem("current_project_id");
      const token = localStorage.getItem("token");
      
      const sql = `ALTER TABLE ${tableName} ENABLE ROW LEVEL SECURITY;`;
      
      const response = await fetch(`http://localhost:8000/api/projects/${projectId}/query`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "Authorization": `Bearer ${token}`,
          "x-project-id": projectId || ""
        },
        body: JSON.stringify({ sql })
      });
      
      if (response.ok) {
        fetchRLSStatus();
      }
    } catch (error) {
      console.error("Failed to enable RLS:", error);
    }
  };

  const disableRLS = async (tableName: string) => {
    if (!confirm(`Disable RLS on table "${tableName}"? This will remove security restrictions.`)) return;
    
    try {
      const projectId = localStorage.getItem("current_project_id");
      const token = localStorage.getItem("token");
      
      const sql = `ALTER TABLE ${tableName} DISABLE ROW LEVEL SECURITY;`;
      
      const response = await fetch(`http://localhost:8000/api/projects/${projectId}/query`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "Authorization": `Bearer ${token}`,
          "x-project-id": projectId || ""
        },
        body: JSON.stringify({ sql })
      });
      
      if (response.ok) {
        fetchRLSStatus();
      }
    } catch (error) {
      console.error("Failed to disable RLS:", error);
    }
  };

  if (loading) {
    return (
      <div className="h-full flex items-center justify-center bg-[#1c1c1c]">
        <div className="text-[#a1a1a1]">Loading RLS status...</div>
      </div>
    );
  }

  return (
    <div className="h-full flex flex-col bg-[#1c1c1c]">
      {/* Header */}
      <div className="bg-[#181818] border-b border-[#2a2a2a] px-6 py-4">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-xl font-semibold text-[#ededed]">Row Level Security (RLS)</h1>
            <p className="text-sm text-[#6b6b6b] mt-1">
              Manage database security policies and access control
            </p>
          </div>
          <a
            href="https://www.postgresql.org/docs/current/ddl-rowsecurity.html"
            target="_blank"
            rel="noopener noreferrer"
            className="px-3 py-1.5 bg-[#2a2a2a] hover:bg-[#3a3a3a] text-[#ededed] text-sm rounded transition-colors flex items-center gap-2"
          >
            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
            </svg>
            Documentation
          </a>
        </div>
      </div>

      {/* Stats Cards */}
      <div className="px-6 py-4 grid grid-cols-3 gap-4">
        <div className="bg-[#181818] border border-[#2a2a2a] rounded-lg p-4">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm text-[#6b6b6b]">Total Tables</p>
              <p className="text-2xl font-semibold text-[#ededed] mt-1">{rlsStats.total_tables}</p>
            </div>
            <div className="w-12 h-12 bg-blue-600/10 rounded-lg flex items-center justify-center">
              <svg className="w-6 h-6 text-blue-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 10h18M3 14h18m-9-4v8m-7 0h14a2 2 0 002-2V8a2 2 0 00-2-2H5a2 2 0 00-2 2v8a2 2 0 002 2z" />
              </svg>
            </div>
          </div>
        </div>

        <div className="bg-[#181818] border border-[#2a2a2a] rounded-lg p-4">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm text-[#6b6b6b]">RLS Enabled</p>
              <p className="text-2xl font-semibold text-green-500 mt-1">{rlsStats.rls_enabled}</p>
              <p className="text-xs text-[#6b6b6b] mt-1">
                {rlsStats.total_tables > 0 ? Math.round((rlsStats.rls_enabled / rlsStats.total_tables) * 100) : 0}% of tables
              </p>
            </div>
            <div className="w-12 h-12 bg-green-600/10 rounded-lg flex items-center justify-center">
              <svg className="w-6 h-6 text-green-500" fill="currentColor" viewBox="0 0 20 20">
                <path fillRule="evenodd" d="M5 9V7a5 5 0 0110 0v2a2 2 0 012 2v5a2 2 0 01-2 2H5a2 2 0 01-2-2v-5a2 2 0 012-2zm8-2v2H7V7a3 3 0 016 0z" clipRule="evenodd" />
              </svg>
            </div>
          </div>
        </div>

        <div className="bg-[#181818] border border-[#2a2a2a] rounded-lg p-4">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm text-[#6b6b6b]">Total Policies</p>
              <p className="text-2xl font-semibold text-[#ededed] mt-1">{rlsStats.total_policies}</p>
              <p className="text-xs text-[#6b6b6b] mt-1">
                Across all tables
              </p>
            </div>
            <div className="w-12 h-12 bg-purple-600/10 rounded-lg flex items-center justify-center">
              <svg className="w-6 h-6 text-purple-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m5.618-4.016A11.955 11.955 0 0112 2.944a11.955 11.955 0 01-8.618 3.04A12.02 12.02 0 003 9c0 5.591 3.824 10.29 9 11.622 5.176-1.332 9-6.03 9-11.622 0-1.042-.133-2.052-.382-3.016z" />
              </svg>
            </div>
          </div>
        </div>
      </div>

      {/* Tables List */}
      <div className="flex-1 overflow-auto px-6 pb-6">
        <div className="bg-[#181818] border border-[#2a2a2a] rounded-lg overflow-hidden">
          <table className="w-full">
            <thead className="bg-[#1c1c1c] border-b border-[#2a2a2a]">
              <tr>
                <th className="px-4 py-3 text-left text-xs font-medium text-[#a1a1a1] uppercase tracking-wider">
                  Table Name
                </th>
                <th className="px-4 py-3 text-left text-xs font-medium text-[#a1a1a1] uppercase tracking-wider">
                  RLS Status
                </th>
                <th className="px-4 py-3 text-left text-xs font-medium text-[#a1a1a1] uppercase tracking-wider">
                  Policies
                </th>
                <th className="px-4 py-3 text-left text-xs font-medium text-[#a1a1a1] uppercase tracking-wider">
                  Actions
                </th>
              </tr>
            </thead>
            <tbody className="divide-y divide-[#2a2a2a]">
              {tables.map((table) => (
                <tr key={table.tablename} className="hover:bg-[#1c1c1c] transition-colors">
                  <td className="px-4 py-3">
                    <div className="flex items-center gap-2">
                      <svg className="w-4 h-4 text-[#6b6b6b]" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 10h18M3 14h18m-9-4v8m-7 0h14a2 2 0 002-2V8a2 2 0 00-2-2H5a2 2 0 00-2 2v8a2 2 0 002 2z" />
                      </svg>
                      <span className="text-sm font-medium text-[#ededed]">{table.tablename}</span>
                    </div>
                  </td>
                  <td className="px-4 py-3">
                    {table.rls_enabled ? (
                      <span className="inline-flex items-center px-2.5 py-1 bg-green-600/10 text-green-500 rounded-full text-xs font-medium">
                        <svg className="w-3 h-3 mr-1.5" fill="currentColor" viewBox="0 0 20 20">
                          <path fillRule="evenodd" d="M5 9V7a5 5 0 0110 0v2a2 2 0 012 2v5a2 2 0 01-2 2H5a2 2 0 01-2-2v-5a2 2 0 012-2zm8-2v2H7V7a3 3 0 016 0z" clipRule="evenodd" />
                        </svg>
                        Enabled
                      </span>
                    ) : (
                      <span className="inline-flex items-center px-2.5 py-1 bg-yellow-600/10 text-yellow-500 rounded-full text-xs font-medium">
                        <svg className="w-3 h-3 mr-1.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 15v2m-6 4h12a2 2 0 002-2v-6a2 2 0 00-2-2H6a2 2 0 00-2 2v6a2 2 0 002 2zm10-10V7a4 4 0 00-8 0v4h8z" />
                        </svg>
                        Disabled
                      </span>
                    )}
                  </td>
                  <td className="px-4 py-3">
                    <span className="text-sm text-[#a1a1a1]">
                      {table.policy_count} {table.policy_count === 1 ? 'policy' : 'policies'}
                    </span>
                  </td>
                  <td className="px-4 py-3">
                    <div className="flex items-center gap-2">
                      {table.rls_enabled ? (
                        <button
                          onClick={() => disableRLS(table.tablename)}
                          className="px-3 py-1 bg-yellow-600/10 hover:bg-yellow-600/20 text-yellow-500 text-xs rounded transition-colors"
                        >
                          Disable RLS
                        </button>
                      ) : (
                        <button
                          onClick={() => enableRLS(table.tablename)}
                          className="px-3 py-1 bg-green-600/10 hover:bg-green-600/20 text-green-500 text-xs rounded transition-colors"
                        >
                          Enable RLS
                        </button>
                      )}
                      <button
                        onClick={() => setSelectedTable(table)}
                        className="px-3 py-1 bg-[#2a2a2a] hover:bg-[#3a3a3a] text-[#ededed] text-xs rounded transition-colors"
                      >
                        View Policies
                      </button>
                    </div>
                  </td>
                </tr>
              ))}
              {tables.length === 0 && (
                <tr>
                  <td colSpan={4} className="px-4 py-8 text-center text-[#6b6b6b] text-sm">
                    No tables found
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>

        {/* Selected Table Policies */}
        {selectedTable && selectedTable.policies.length > 0 && (
          <div className="mt-6 bg-[#181818] border border-[#2a2a2a] rounded-lg p-6">
            <h3 className="text-lg font-semibold text-[#ededed] mb-4">
              Policies for {selectedTable.tablename}
            </h3>
            <div className="space-y-3">
              {selectedTable.policies.map((policy, index) => (
                <div key={index} className="bg-[#1c1c1c] border border-[#2a2a2a] rounded-lg p-4">
                  <div className="flex items-start justify-between mb-2">
                    <div>
                      <h4 className="text-sm font-medium text-[#ededed]">{policy.policyname}</h4>
                      <div className="flex items-center gap-2 mt-1">
                        <span className="px-2 py-0.5 bg-blue-600/10 text-blue-500 rounded text-xs font-medium">
                          {policy.cmd}
                        </span>
                        <span className="px-2 py-0.5 bg-purple-600/10 text-purple-500 rounded text-xs font-medium">
                          {policy.permissive}
                        </span>
                      </div>
                    </div>
                  </div>
                  {policy.qual && (
                    <div className="mt-2">
                      <p className="text-xs text-[#6b6b6b] mb-1">USING:</p>
                      <code className="block text-xs text-[#a1a1a1] bg-[#0d0d0d] p-2 rounded font-mono">
                        {policy.qual}
                      </code>
                    </div>
                  )}
                  {policy.with_check && (
                    <div className="mt-2">
                      <p className="text-xs text-[#6b6b6b] mb-1">WITH CHECK:</p>
                      <code className="block text-xs text-[#a1a1a1] bg-[#0d0d0d] p-2 rounded font-mono">
                        {policy.with_check}
                      </code>
                    </div>
                  )}
                </div>
              ))}
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
