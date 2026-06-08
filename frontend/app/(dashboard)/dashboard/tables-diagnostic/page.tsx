'use client';

import { useState } from 'react';
import { apiClient } from '@/lib/api';

export default function TableDiagnosticPage() {
  const [results, setResults] = useState<any>(null);
  const [loading, setLoading] = useState(false);
  const [projectId, setProjectId] = useState('718af5ef-8ffb-49ba-b54a-26cc37755d2c');

  const runDiagnostic = async () => {
    setLoading(true);
    const diagnostics: any = {
      timestamp: new Date().toISOString(),
      projectId: projectId,
      steps: []
    };

    try {
      // Step 1: Get project info
      diagnostics.steps.push({ name: 'Getting project info...', status: 'running' });
      setResults({ ...diagnostics });
      
      const project = await apiClient.get(`/api/projects/${projectId}`);
      diagnostics.steps[0] = { 
        name: 'Get project info', 
        status: 'success',
        data: {
          name: project.name,
          database_name: project.database_name,
          schema_name: project.database_name
        }
      };
      setResults({ ...diagnostics });

      // Step 2: Fetch tables from API
      diagnostics.steps.push({ name: 'Fetching tables from API...', status: 'running' });
      setResults({ ...diagnostics });

      const tablesResponse = await apiClient.get(`/api/projects/${projectId}/db/tables/`, {
        headers: {
          'x-project-id': projectId
        }
      });
      
      const tablesArray = tablesResponse.tables || tablesResponse;
      diagnostics.steps[1] = { 
        name: 'Fetch tables from API', 
        status: 'success',
        data: {
          count: tablesArray.length,
          tables: tablesArray.map((t: any) => ({
            schema: t.table_schema,
            name: t.table_name,
            full_name: t.full_name,
            columns: t.columns?.length || 0
          }))
        }
      };
      setResults({ ...diagnostics });

      // Step 3: Try direct SQL query to verify schema has tables
      diagnostics.steps.push({ name: 'Running SQL query to check schema...', status: 'running' });
      setResults({ ...diagnostics });

      const schemaCheck = await apiClient.post(
        `/api/projects/${projectId}/query`,
        {
          sql: `
            SELECT table_name
            FROM information_schema.tables
            WHERE table_schema = '${project.database_name}'
            AND table_type = 'BASE TABLE'
            AND table_name NOT LIKE '_zendbx_%'
            ORDER BY table_name
          `
        },
        {
          headers: {
            'x-project-id': projectId
          }
        }
      );

      diagnostics.steps[2] = { 
        name: 'SQL query to check schema', 
        status: 'success',
        data: {
          count: schemaCheck.rows?.length || 0,
          tables: schemaCheck.rows || []
        }
      };
      setResults({ ...diagnostics });

      // Final summary
      diagnostics.summary = {
        project_schema: project.database_name,
        api_returns: tablesArray.length,
        sql_returns: schemaCheck.rows?.length || 0,
        issue: tablesArray.length === 0 && (schemaCheck.rows?.length || 0) > 0 
          ? 'API returns empty but SQL finds tables - backend issue'
          : tablesArray.length === 0 && (schemaCheck.rows?.length || 0) === 0
          ? 'No tables exist in this schema'
          : 'Working correctly'
      };

    } catch (error: any) {
      diagnostics.steps[diagnostics.steps.length - 1] = {
        ...diagnostics.steps[diagnostics.steps.length - 1],
        status: 'error',
        error: error.message || String(error)
      };
    } finally {
      setLoading(false);
      setResults(diagnostics);
    }
  };

  return (
    <div className="p-8">
      <h1 className="text-2xl font-bold mb-6">Table Editor Diagnostic Tool</h1>
      
      <div className="mb-6">
        <label className="block text-sm font-medium mb-2">Project ID:</label>
        <input
          type="text"
          value={projectId}
          onChange={(e) => setProjectId(e.target.value)}
          className="w-full px-4 py-2 border rounded text-gray-900"
          placeholder="Enter project ID"
        />
      </div>

      <button
        onClick={runDiagnostic}
        disabled={loading}
        className="px-6 py-3 bg-blue-600 text-white rounded hover:bg-blue-700 disabled:bg-gray-400"
      >
        {loading ? 'Running Diagnostic...' : 'Run Diagnostic'}
      </button>

      {results && (
        <div className="mt-8">
          <h2 className="text-xl font-semibold mb-4">Results</h2>
          <pre className="bg-gray-100 text-gray-900 p-4 rounded overflow-auto max-h-[600px] text-xs">
            {JSON.stringify(results, null, 2)}
          </pre>

          {results.summary && (
            <div className={`mt-4 p-4 rounded ${
              results.summary.issue.includes('Working')
                ? 'bg-green-100 border border-green-400 text-green-900'
                : 'bg-red-100 border border-red-400 text-red-900'
            }`}>
              <h3 className="font-semibold mb-2">Diagnosis:</h3>
              <p>{results.summary.issue}</p>
              <div className="mt-2">
                <p>Schema: {results.summary.project_schema}</p>
                <p>API Returns: {results.summary.api_returns} tables</p>
                <p>SQL Returns: {results.summary.sql_returns} tables</p>
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
