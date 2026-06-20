'use client';


import { useState } from 'react';

export default function SQLQueryPage() {
  const [sql, setSql] = useState('');
  const [loading, setLoading] = useState(false);
  const [result, setResult] = useState<any>(null);
  const [error, setError] = useState('');

  const runQuery = async () => {
    if (!sql.trim()) {
      setError('Please enter a SQL query');
      return;
    }

    const projectId = localStorage.getItem('current_project_id');
    if (!projectId) {
      setError('No project selected');
      return;
    }

    setLoading(true);
    setError('');
    setResult(null);

    try {
      const { apiFetch } = await import('@/lib/fetch-utils');
      const res = await apiFetch(`api/projects/${projectId}/query`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ sql }),
      });

      const data = await res.json();
      if (!res.ok) throw new Error(data.detail || 'Query failed');
      setResult(data);
    } catch (err: any) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="h-full flex flex-col bg-zinc-900 p-6">
      <h1 className="text-2xl font-bold text-white mb-6">SQL Editor (NEW - WORKING)</h1>
      
      <button
        onClick={runQuery}
        disabled={loading}
        className="mb-4 px-6 py-2 bg-orange-600 hover:bg-orange-500 text-white rounded font-medium disabled:opacity-50"
      >
        {loading ? 'Running...' : 'Run Query'}
      </button>

      <textarea 
        value={sql}
        onChange={(e) => setSql(e.target.value)}
        className="w-full h-64 bg-zinc-800 text-white p-4 rounded border border-zinc-700 font-mono text-sm mb-4"
        placeholder="SELECT * FROM your_table LIMIT 10;"
      />

      {error && (
        <div className="p-4 bg-red-900/20 border border-red-800 rounded text-red-400 mb-4">
          {error}
        </div>
      )}

      {result?.logs && result.logs.length > 0 && (
        <div className="mb-4 p-4 bg-zinc-800 rounded">
          <p className="text-white font-semibold mb-2">Execution Logs:</p>
          {result.logs.map((log: any, i: number) => (
            <div key={i} className={`text-xs mb-1 ${log.status === 'error' ? 'text-red-400' : 'text-green-400'}`}>
              {log.status}: {log.message}
            </div>
          ))}
        </div>
      )}

      {result?.rows && (
        <div className="flex-1 overflow-auto">
          <p className="text-sm text-zinc-400 mb-2">{result.rowCount} rows in {result.executionTime}ms</p>
          <table className="w-full text-sm bg-zinc-800">
            <thead>
              <tr className="bg-zinc-900">
                {result.columns?.map((col: string, i: number) => (
                  <th key={i} className="px-4 py-2 text-left text-zinc-400">{col}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {result.rows?.map((row: any, i: number) => (
                <tr key={i} className="border-t border-zinc-700">
                  {result.columns?.map((col: string, j: number) => (
                    <td key={j} className="px-4 py-2 text-white">
                      {row[col] !== null ? String(row[col]) : <span className="text-zinc-500">NULL</span>}
                    </td>
                  ))}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
