'use client';

import { useState } from 'react';

const API_URL = process.env.NEXT_PUBLIC_API_URL!;

export default function MigratePage() {
  const [status, setStatus] = useState<any>(null);
  const [result, setResult] = useState<any>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const checkStatus = async () => {
    setLoading(true);
    setError(null);
    
    try {
      const token = localStorage.getItem('token');
      const response = await fetch(`${API_URL}/api/migrate/status`, {
        headers: {
          'Authorization': `Bearer ${token}`
        }
      });
      
      if (!response.ok) throw new Error('Failed to check status');
      
      const data = await response.json();
      setStatus(data);
    } catch (err: any) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  const runMigration = async () => {
    if (!confirm('Are you sure you want to run the migration? This will regenerate all API keys.')) {
      return;
    }
    
    setLoading(true);
    setError(null);
    
    try {
      const token = localStorage.getItem('token');
      const response = await fetch(`${API_URL}/api/migrate/api-keys`, {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${token}`
        }
      });
      
      if (!response.ok) throw new Error('Migration failed');
      
      const data = await response.json();
      setResult(data);
      
      // Refresh status
      await checkStatus();
    } catch (err: any) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="p-6 max-w-4xl">
      <h1 className="text-2xl font-bold text-[#ededed] mb-6">Database Migration</h1>
      
      <div className="bg-[#181818] border border-[#2a2a2a] rounded-lg p-6 mb-6">
        <h2 className="text-lg font-semibold text-[#ededed] mb-4">API Keys Migration</h2>
        <p className="text-sm text-[#a1a1a1] mb-4">
          This migration will regenerate full JWT tokens for all existing API keys.
          After running this, you'll be able to see complete keys in the API Keys page.
        </p>
        
        <div className="flex gap-4">
          <button
            onClick={checkStatus}
            disabled={loading}
            className="px-4 py-2 bg-blue-600 hover:bg-blue-500 text-white rounded text-sm font-medium transition-colors disabled:opacity-50"
          >
            {loading ? 'Checking...' : 'Check Status'}
          </button>
          
          <button
            onClick={runMigration}
            disabled={loading}
            className="px-4 py-2 bg-orange-600 hover:bg-orange-500 text-white rounded text-sm font-medium transition-colors disabled:opacity-50"
          >
            {loading ? 'Running...' : 'Run Migration'}
          </button>
        </div>
      </div>

      {error && (
        <div className="bg-red-500/10 border border-red-500/20 rounded-lg p-4 mb-6">
          <p className="text-sm text-red-500">{error}</p>
        </div>
      )}

      {status && (
        <div className="bg-[#181818] border border-[#2a2a2a] rounded-lg p-6 mb-6">
          <h3 className="text-md font-semibold text-[#ededed] mb-4">Migration Status</h3>
          <div className="space-y-2 text-sm">
            <div className="flex justify-between">
              <span className="text-[#a1a1a1]">Keys needing fix:</span>
              <span className="text-[#ededed] font-mono">{status.keys_needing_fix}</span>
            </div>
            <div className="flex justify-between">
              <span className="text-[#a1a1a1]">Keys already fixed:</span>
              <span className="text-[#ededed] font-mono">{status.keys_already_fixed}</span>
            </div>
            <div className="flex justify-between">
              <span className="text-[#a1a1a1]">Migration needed:</span>
              <span className={status.migration_needed ? 'text-orange-500' : 'text-green-500'}>
                {status.migration_needed ? 'Yes' : 'No'}
              </span>
            </div>
          </div>
        </div>
      )}

      {result && (
        <div className="bg-green-500/10 border border-green-500/20 rounded-lg p-6">
          <h3 className="text-md font-semibold text-green-500 mb-4">✅ Migration Complete!</h3>
          <div className="space-y-2 text-sm mb-4">
            <div className="flex justify-between">
              <span className="text-[#a1a1a1]">Keys fixed:</span>
              <span className="text-[#ededed] font-mono">{result.keys_fixed}</span>
            </div>
            <p className="text-[#a1a1a1]">{result.message}</p>
          </div>
          
          {result.keys && result.keys.length > 0 && (
            <div className="mt-4">
              <p className="text-xs text-[#a1a1a1] mb-2">Fixed keys:</p>
              <div className="space-y-2">
                {result.keys.map((key: any, index: number) => (
                  <div key={index} className="bg-black rounded p-3">
                    <div className="text-xs text-[#a1a1a1] mb-1">
                      {key.key_type} - Project: {key.project_id}
                    </div>
                    <code className="text-xs text-green-500 font-mono break-all">
                      {key.new_key_preview}
                    </code>
                  </div>
                ))}
              </div>
            </div>
          )}
          
          <div className="mt-4 pt-4 border-t border-green-500/20">
            <p className="text-xs text-[#a1a1a1]">
              ✅ You can now go to the API Keys page and see the full JWT tokens!
            </p>
          </div>
        </div>
      )}
    </div>
  );
}
