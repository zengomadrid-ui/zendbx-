'use client';

import { useState, useEffect } from 'react';
import Link from 'next/link';
import { apiFetch } from '@/lib/fetch-utils';
import LoadingSpinner from '@/components/ui/LoadingSpinner';

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

function getMimeLabel(mime: string): string {
  if (mime?.startsWith('image/')) return 'img';
  if (mime?.startsWith('video/')) return 'vid';
  if (mime?.startsWith('text/'))  return 'txt';
  if (mime?.includes('pdf'))      return 'pdf';
  if (mime?.includes('zip'))      return 'zip';
  return 'bin';
}

export default function StoragePage() {
  const [analytics, setAnalytics] = useState<Analytics | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const pid = localStorage.getItem('current_project_id') || '';
    if (pid) fetchAnalytics(pid);
    else setLoading(false);
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
  const barColor = usedPercent > 90 ? 'bg-red-500' : usedPercent > 70 ? 'bg-yellow-500' : 'bg-orange-600';

  if (loading) {
    return (
      <div className="min-h-full bg-[#1c1c1c] p-6 flex items-center justify-center h-64">
        <LoadingSpinner size="md" text="Loading storage data..." />
      </div>
    );
  }

  return (
    <div className="min-h-full bg-[#1c1c1c] p-6">
      <div className="max-w-[1600px] mx-auto space-y-6">

        {/* Header */}
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-xl font-semibold text-[#ededed]">Storage</h1>
            <p className="text-xs text-[#a1a1a1] mt-1">Manage files, buckets, and storage usage</p>
          </div>
          <Link
            href="/dashboard/storage/buckets"
            className="px-4 py-2 bg-orange-600 hover:bg-orange-500 text-white text-sm font-medium rounded transition-colors"
          >
            Manage Buckets
          </Link>
        </div>

        {/* Stats Grid */}
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
          {[
            { label: 'Storage Used', value: formatBytes(analytics?.storage_used ?? 0), sub: `of ${formatBytes(analytics?.max_storage ?? 0)}` },
            { label: 'Files',         value: (analytics?.file_count ?? 0).toLocaleString(),    sub: 'total files' },
            { label: 'Buckets',       value: (analytics?.bucket_count ?? 0).toString(),         sub: 'active buckets' },
            { label: 'Downloads',     value: (analytics?.download_count ?? 0).toLocaleString(), sub: 'all time' },
          ].map((s) => (
            <div key={s.label} className="bg-[#181818] border border-[#2a2a2a] rounded-lg p-4">
              <p className="text-[10px] text-[#a1a1a1] uppercase tracking-wider">{s.label}</p>
              <p className="text-2xl font-semibold text-[#ededed] mt-1">{s.value}</p>
              <p className="text-[10px] text-[#6b6b6b] mt-1">{s.sub}</p>
            </div>
          ))}
        </div>

        {/* Storage Usage Bar */}
        <div className="bg-[#181818] border border-[#2a2a2a] rounded-lg p-4">
          <div className="flex items-center justify-between mb-3">
            <h3 className="text-sm font-semibold text-[#ededed]">Storage Usage</h3>
            <span className="text-xs text-[#a1a1a1]">{usedPercent.toFixed(1)}%</span>
          </div>
          <div className="w-full bg-[#2a2a2a] rounded-full h-2 mb-2">
            <div
              className={`h-2 rounded-full transition-all ${barColor}`}
              style={{ width: `${Math.min(usedPercent, 100)}%` }}
            />
          </div>
          <div className="flex justify-between text-[10px] text-[#6b6b6b]">
            <span>{formatBytes(analytics?.storage_used ?? 0)} used</span>
            <span>{formatBytes((analytics?.max_storage ?? 0) - (analytics?.storage_used ?? 0))} free</span>
          </div>
        </div>

        {/* Largest Files + Recent Uploads */}
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
          {/* Largest Files */}
          <div className="bg-[#181818] border border-[#2a2a2a] rounded-lg p-4">
            <h3 className="text-sm font-semibold text-[#ededed] mb-4">Largest Files</h3>
            {(analytics?.largest_files ?? []).length === 0 ? (
              <p className="text-xs text-[#a1a1a1]">No files yet</p>
            ) : (
              <div className="space-y-2">
                {analytics!.largest_files.map((f) => (
                  <div key={f.id} className="flex items-center justify-between py-2 border-b border-[#2a2a2a] last:border-0">
                    <div className="flex items-center space-x-3 min-w-0">
                      <div className="w-8 h-8 bg-[#2a2a2a] rounded flex items-center justify-center flex-shrink-0">
                        <span className="text-[10px] text-[#a1a1a1] font-mono">{getMimeLabel(f.mime_type)}</span>
                      </div>
                      <p className="text-xs text-[#ededed] truncate">{f.original_name}</p>
                    </div>
                    <span className="text-xs text-[#a1a1a1] flex-shrink-0 ml-2">{formatBytes(f.file_size)}</span>
                  </div>
                ))}
              </div>
            )}
          </div>

          {/* Recent Uploads */}
          <div className="bg-[#181818] border border-[#2a2a2a] rounded-lg p-4">
            <h3 className="text-sm font-semibold text-[#ededed] mb-4">Recent Uploads</h3>
            {(analytics?.recent_uploads ?? []).length === 0 ? (
              <p className="text-xs text-[#a1a1a1]">No uploads yet</p>
            ) : (
              <div className="space-y-2">
                {analytics!.recent_uploads.map((f) => (
                  <div key={f.id} className="flex items-center justify-between py-2 border-b border-[#2a2a2a] last:border-0">
                    <p className="text-xs text-[#ededed] truncate">{f.original_name}</p>
                    <div className="text-right flex-shrink-0 ml-3">
                      <p className="text-xs text-[#a1a1a1]">{formatBytes(f.file_size)}</p>
                      <p className="text-[10px] text-[#6b6b6b]">{new Date(f.created_at).toLocaleDateString()}</p>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>

        {/* Upload Activity Chart */}
        {(analytics?.storage_growth ?? []).length > 0 && (
          <div className="bg-[#181818] border border-[#2a2a2a] rounded-lg p-4">
            <h3 className="text-sm font-semibold text-[#ededed] mb-4">Upload Activity (Last 30 Days)</h3>
            <div className="flex items-end space-x-0.5 h-20 mb-2">
              {analytics!.storage_growth.map((d) => {
                const maxUploads = Math.max(...analytics!.storage_growth.map((x) => x.uploads), 1);
                const height = Math.max((d.uploads / maxUploads) * 100, 2);
                return (
                  <div key={d.day} className="flex-1 flex flex-col justify-end group relative">
                    <div
                      className="w-full bg-orange-600/60 hover:bg-orange-500 rounded-sm transition-colors cursor-pointer"
                      style={{ height: `${height}%` }}
                      title={`${d.day}: ${d.uploads} uploads`}
                    />
                  </div>
                );
              })}
            </div>
            <p className="text-[10px] text-[#6b6b6b]">Each bar = 1 day</p>
          </div>
        )}

      </div>
    </div>
  );
}
