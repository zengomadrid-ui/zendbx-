'use client';


import { useState, useEffect } from 'react';
import Link from 'next/link';
import { apiFetch } from '@/lib/fetch-utils';

interface Analytics {
  storage_used: number;
  max_storage: number;
  storage_used_percent: number;
  file_count: number;
  bucket_count: number;
  download_count: number;
  largest_files: Array<{ id: string; original_name: string; file_size: number; mime_type: string }>;
  recent_uploads: Array<{ id: string; original_name: string; file_size: number; created_at: string }>;
  storage_growth: Array<{ day: string; uploads: number; bytes_added: number }>;
}

function formatBytes(bytes: number): string {
  if (bytes === 0) return '0 B';
  const k = 1024;
  const sizes = ['B', 'KB', 'MB', 'GB', 'TB'];
  const i = Math.floor(Math.log(bytes) / Math.log(k));
  return `${parseFloat((bytes / Math.pow(k, i)).toFixed(2))} ${sizes[i]}`;
}

export default function StoragePage() {
  const [analytics, setAnalytics] = useState<Analytics | null>(null);
  const [loading, setLoading] = useState(true);
  const [projectId, setProjectId] = useState('');

  useEffect(() => {
    const pid = localStorage.getItem('current_project_id') || '';
    setProjectId(pid);
    if (pid) fetchAnalytics(pid);
  }, []);

  async function fetchAnalytics(pid: string) {
    try {
      const res = await apiFetch(`api/storage/analytics?project_id=${pid}`);
      if (res.ok) setAnalytics(await res.json());
    } catch (e) {
      console.error(e);
    } finally {
      setLoading(false);
    }
  }

  const usedPercent = analytics?.storage_used_percent ?? 0;

  return (
    <div className="p-6 space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-white">Storage</h1>
          <p className="text-sm text-gray-400 mt-1">Manage files, buckets, and storage usage</p>
        </div>
        <Link
          href="/dashboard/storage/buckets"
          className="px-4 py-2 bg-orange-500 hover:bg-orange-600 text-white text-sm font-semibold rounded-lg transition-colors"
        >
          Manage Buckets
        </Link>
      </div>

      {loading ? (
        <div className="flex items-center justify-center h-64">
          <div className="w-8 h-8 border-2 border-orange-500 border-t-transparent rounded-full animate-spin" />
        </div>
      ) : (
        <>
          {/* Stats Grid */}
          <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
            {[
              { label: 'Storage Used', value: formatBytes(analytics?.storage_used ?? 0), sub: `of ${formatBytes(analytics?.max_storage ?? 0)}` },
              { label: 'Files', value: (analytics?.file_count ?? 0).toLocaleString(), sub: 'total files' },
              { label: 'Buckets', value: (analytics?.bucket_count ?? 0).toString(), sub: 'active buckets' },
              { label: 'Downloads', value: (analytics?.download_count ?? 0).toLocaleString(), sub: 'all time' },
            ].map((stat) => (
              <div key={stat.label} className="bg-[#0f0f0f] border border-[#2a2a2a] rounded-xl p-5">
                <p className="text-xs text-gray-500 uppercase tracking-wider">{stat.label}</p>
                <p className="text-2xl font-bold text-white mt-1">{stat.value}</p>
                <p className="text-xs text-gray-500 mt-1">{stat.sub}</p>
              </div>
            ))}
          </div>

          {/* Storage Usage Bar */}
          <div className="bg-[#0f0f0f] border border-[#2a2a2a] rounded-xl p-5">
            <div className="flex items-center justify-between mb-3">
              <p className="text-sm font-semibold text-white">Storage Usage</p>
              <p className="text-sm text-gray-400">{usedPercent.toFixed(1)}%</p>
            </div>
            <div className="w-full bg-[#1a1a1a] rounded-full h-3">
              <div
                className={`h-3 rounded-full transition-all ${usedPercent > 90 ? 'bg-red-500' : usedPercent > 70 ? 'bg-yellow-500' : 'bg-orange-500'}`}
                style={{ width: `${Math.min(usedPercent, 100)}%` }}
              />
            </div>
            <div className="flex justify-between mt-2 text-xs text-gray-500">
              <span>{formatBytes(analytics?.storage_used ?? 0)} used</span>
              <span>{formatBytes((analytics?.max_storage ?? 0) - (analytics?.storage_used ?? 0))} free</span>
            </div>
          </div>

          {/* Two-column: Largest Files + Recent Uploads */}
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
            {/* Largest Files */}
            <div className="bg-[#0f0f0f] border border-[#2a2a2a] rounded-xl p-5">
              <h3 className="text-sm font-semibold text-white mb-4">Largest Files</h3>
              {(analytics?.largest_files ?? []).length === 0 ? (
                <p className="text-sm text-gray-500">No files yet</p>
              ) : (
                <div className="space-y-3">
                  {analytics!.largest_files.map((f) => (
                    <div key={f.id} className="flex items-center justify-between">
                      <div className="flex items-center space-x-3 min-w-0">
                        <div className="w-8 h-8 bg-[#1a1a1a] rounded-lg flex items-center justify-center flex-shrink-0">
                          <span className="text-xs text-gray-400">{f.mime_type?.split('/')[0]?.slice(0, 3) ?? 'bin'}</span>
                        </div>
                        <p className="text-sm text-gray-300 truncate">{f.original_name}</p>
                      </div>
                      <span className="text-xs text-gray-500 flex-shrink-0 ml-2">{formatBytes(f.file_size)}</span>
                    </div>
                  ))}
                </div>
              )}
            </div>

            {/* Recent Uploads */}
            <div className="bg-[#0f0f0f] border border-[#2a2a2a] rounded-xl p-5">
              <h3 className="text-sm font-semibold text-white mb-4">Recent Uploads</h3>
              {(analytics?.recent_uploads ?? []).length === 0 ? (
                <p className="text-sm text-gray-500">No uploads yet</p>
              ) : (
                <div className="space-y-3">
                  {analytics!.recent_uploads.map((f) => (
                    <div key={f.id} className="flex items-center justify-between">
                      <p className="text-sm text-gray-300 truncate">{f.original_name}</p>
                      <div className="text-right flex-shrink-0 ml-2">
                        <p className="text-xs text-gray-500">{formatBytes(f.file_size)}</p>
                        <p className="text-xs text-gray-600">{new Date(f.created_at).toLocaleDateString()}</p>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>

          {/* Storage Growth Chart (simple bar) */}
          {(analytics?.storage_growth ?? []).length > 0 && (
            <div className="bg-[#0f0f0f] border border-[#2a2a2a] rounded-xl p-5">
              <h3 className="text-sm font-semibold text-white mb-4">Upload Activity (Last 30 Days)</h3>
              <div className="flex items-end space-x-1 h-24">
                {analytics!.storage_growth.map((d) => {
                  const maxUploads = Math.max(...analytics!.storage_growth.map((x) => x.uploads), 1);
                  const height = Math.max((d.uploads / maxUploads) * 100, 4);
                  return (
                    <div key={d.day} className="flex-1 flex flex-col items-center group relative">
                      <div
                        className="w-full bg-orange-500/60 hover:bg-orange-500 rounded-sm transition-colors cursor-pointer"
                        style={{ height: `${height}%` }}
                        title={`${d.day}: ${d.uploads} uploads`}
                      />
                    </div>
                  );
                })}
              </div>
              <p className="text-xs text-gray-600 mt-2">Each bar = 1 day</p>
            </div>
          )}
        </>
      )}
    </div>
  );
}
