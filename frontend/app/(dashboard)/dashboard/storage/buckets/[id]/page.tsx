'use client';

import { useState, useEffect, useRef } from 'react';
import { useParams } from 'next/navigation';
import { apiFetch } from '@/lib/fetch-utils';

interface StorageFile {
  id: string;
  file_name: string;
  original_name: string;
  file_size: number;
  mime_type: string;
  storage_key: string;
  download_count: number;
  created_at: string;
}

const EXPIRY_OPTIONS = [
  { label: '5 minutes', value: '5m' },
  { label: '15 minutes', value: '15m' },
  { label: '1 hour', value: '1h' },
  { label: '24 hours', value: '24h' },
  { label: '7 days', value: '7d' },
];

function formatBytes(bytes: number): string {
  if (!bytes) return '0 B';
  const k = 1024;
  const sizes = ['B', 'KB', 'MB', 'GB'];
  const i = Math.floor(Math.log(bytes) / Math.log(k));
  return `${parseFloat((bytes / Math.pow(k, i)).toFixed(1))} ${sizes[i]}`;
}

function getMimeIcon(mime: string): JSX.Element {
  const iconClass = "w-4 h-4";
  
  if (mime?.startsWith('image/')) {
    return (
      <svg className={iconClass} fill="none" stroke="currentColor" viewBox="0 0 24 24">
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 16l4.586-4.586a2 2 0 012.828 0L16 16m-2-2l1.586-1.586a2 2 0 012.828 0L20 14m-6-6h.01M6 20h12a2 2 0 002-2V6a2 2 0 00-2-2H6a2 2 0 00-2 2v12a2 2 0 002 2z" />
      </svg>
    );
  }
  if (mime?.startsWith('video/')) {
    return (
      <svg className={iconClass} fill="none" stroke="currentColor" viewBox="0 0 24 24">
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 10l4.553-2.276A1 1 0 0121 8.618v6.764a1 1 0 01-1.447.894L15 14M5 18h8a2 2 0 002-2V8a2 2 0 00-2-2H5a2 2 0 00-2 2v8a2 2 0 002 2z" />
      </svg>
    );
  }
  if (mime?.startsWith('text/') || mime === 'application/json') {
    return (
      <svg className={iconClass} fill="none" stroke="currentColor" viewBox="0 0 24 24">
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
      </svg>
    );
  }
  if (mime === 'application/pdf') {
    return (
      <svg className={iconClass} fill="none" stroke="currentColor" viewBox="0 0 24 24">
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M7 21h10a2 2 0 002-2V9.414a1 1 0 00-.293-.707l-5.414-5.414A1 1 0 0012.586 3H7a2 2 0 00-2 2v14a2 2 0 002 2z" />
      </svg>
    );
  }
  if (mime?.includes('zip')) {
    return (
      <svg className={iconClass} fill="none" stroke="currentColor" viewBox="0 0 24 24">
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 19a2 2 0 01-2-2V7a2 2 0 012-2h4l2 2h4a2 2 0 012 2v1M5 19h14a2 2 0 002-2v-5a2 2 0 00-2-2H9a2 2 0 00-2 2v5a2 2 0 01-2 2z" />
      </svg>
    );
  }
  return (
    <svg className={iconClass} fill="none" stroke="currentColor" viewBox="0 0 24 24">
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M7 21h10a2 2 0 002-2V9.414a1 1 0 00-.293-.707l-5.414-5.414A1 1 0 0012.586 3H7a2 2 0 00-2 2v14a2 2 0 002 2z" />
    </svg>
  );
}

export default function BucketDetailPage() {
  const params = useParams();
  const bucketId = params.id as string;
  const [files, setFiles] = useState<StorageFile[]>([]);
  const [loading, setLoading] = useState(true);
  const [projectId, setProjectId] = useState('');
  const [search, setSearch] = useState('');
  const [sortBy, setSortBy] = useState('created_at');
  const [sortDir, setSortDir] = useState('desc');
  const [uploading, setUploading] = useState(false);
  const [selectedFiles, setSelectedFiles] = useState<Set<string>>(new Set());
  const [signedUrlFile, setSignedUrlFile] = useState<StorageFile | null>(null);
  const [signedUrl, setSignedUrl] = useState('');
  const [signedExpiry, setSignedExpiry] = useState('1h');
  const [renameFile, setRenameFile] = useState<StorageFile | null>(null);
  const [newName, setNewName] = useState('');
  const [previewFile, setPreviewFile] = useState<StorageFile | null>(null);
  const [previewUrl, setPreviewUrl] = useState('');
  const fileInputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    const pid = localStorage.getItem('current_project_id') || '';
    setProjectId(pid);
    if (pid) fetchFiles(pid);
  }, [bucketId]);

  async function fetchFiles(pid: string, q?: string) {
    setLoading(true);
    try {
      const params = new URLSearchParams({ project_id: pid, sort_by: sortBy, sort_dir: sortDir });
      if (q) params.set('search', q);
      const res = await apiFetch(`api/storage/buckets/${bucketId}/files?${params}`);
      if (res.ok) setFiles(await res.json());
    } finally {
      setLoading(false);
    }
  }

  async function handleUpload(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file || !projectId) return;
    setUploading(true);
    try {
      const fd = new FormData();
      fd.append('project_id', projectId);
      fd.append('bucket_id', bucketId);
      fd.append('file', file);
      
      // For file uploads, we need to use fetch directly without Content-Type header
      // The browser will set it automatically with the correct boundary
      const token = localStorage.getItem('token');
      const apiUrl = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:8000';
      const res = await fetch(`${apiUrl}/api/storage/upload`, {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${token}`,
        },
        body: fd,
      });
      
      if (!res.ok) {
        const d = await res.json();
        alert(d.detail || 'Upload failed');
        return;
      }
      fetchFiles(projectId);
    } finally {
      setUploading(false);
      if (fileInputRef.current) fileInputRef.current.value = '';
    }
  }

  async function handleDelete(file: StorageFile) {
    if (!confirm(`Delete "${file.original_name}"?`)) return;
    await apiFetch(`api/storage/files/${file.id}?project_id=${projectId}`, { method: 'DELETE' });
    fetchFiles(projectId);
  }

  async function handleBulkDelete() {
    if (!confirm(`Delete ${selectedFiles.size} selected files?`)) return;
    await apiFetch(`api/storage/files/bulk-delete?project_id=${projectId}`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ file_ids: Array.from(selectedFiles) }),
    });
    setSelectedFiles(new Set());
    fetchFiles(projectId);
  }

  async function handleDownload(file: StorageFile) {
    const res = await apiFetch(`api/storage/files/${file.id}/download?project_id=${projectId}`);
    if (!res.ok) return;
    const blob = await res.blob();
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = file.original_name;
    a.click();
    URL.revokeObjectURL(url);
  }

  async function handlePreview(file: StorageFile) {
    setPreviewFile(file);
    const res = await apiFetch(`api/storage/files/${file.id}/preview?project_id=${projectId}`);
    if (res.ok) {
      const blob = await res.blob();
      setPreviewUrl(URL.createObjectURL(blob));
    }
  }

  async function handleGenerateSignedUrl() {
    if (!signedUrlFile) return;
    const res = await apiFetch(`api/storage/files/${signedUrlFile.id}/signed-url?project_id=${projectId}`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ expiry: signedExpiry }),
    });
    if (res.ok) {
      const d = await res.json();
      setSignedUrl(d.url);
    }
  }

  async function handleRename() {
    if (!renameFile || !newName.trim()) return;
    await apiFetch(`api/storage/files/${renameFile.id}?project_id=${projectId}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ file_name: newName }),
    });
    setRenameFile(null);
    fetchFiles(projectId);
  }

  function toggleSelect(id: string) {
    setSelectedFiles((prev) => {
      const next = new Set(prev);
      next.has(id) ? next.delete(id) : next.add(id);
      return next;
    });
  }

  const filtered = files.filter(
    (f) =>
      !search ||
      f.original_name.toLowerCase().includes(search.toLowerCase()) ||
      f.file_name.toLowerCase().includes(search.toLowerCase()),
  );

  return (
    <div className="p-6 space-y-4">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-white">File Browser</h1>
          <p className="text-sm text-gray-400 mt-1">Bucket: {bucketId}</p>
        </div>
        <div className="flex items-center space-x-3">
          {selectedFiles.size > 0 && (
            <button
              onClick={handleBulkDelete}
              className="px-3 py-2 bg-red-500/10 hover:bg-red-500/20 text-red-400 text-sm rounded-lg transition-colors"
            >
              Delete {selectedFiles.size} selected
            </button>
          )}
          <input ref={fileInputRef} type="file" className="hidden" onChange={handleUpload} />
          <button
            onClick={() => fileInputRef.current?.click()}
            disabled={uploading}
            className="px-4 py-2 bg-orange-500 hover:bg-orange-600 disabled:opacity-50 text-white text-sm font-semibold rounded-lg transition-colors"
          >
            {uploading ? 'Uploading...' : '+ Upload File'}
          </button>
        </div>
      </div>

      {/* Search + Sort */}
      <div className="flex items-center space-x-3">
        <input
          className="flex-1 bg-[#0f0f0f] border border-[#2a2a2a] rounded-lg px-3 py-2 text-sm text-white placeholder-gray-600 focus:outline-none focus:border-orange-500"
          placeholder="Search files..."
          value={search}
          onChange={(e) => setSearch(e.target.value)}
        />
        <select
          className="bg-[#0f0f0f] border border-[#2a2a2a] rounded-lg px-3 py-2 text-sm text-gray-300 focus:outline-none"
          value={sortBy}
          onChange={(e) => { setSortBy(e.target.value); fetchFiles(projectId); }}
        >
          <option value="created_at">Date</option>
          <option value="file_size">Size</option>
          <option value="original_name">Name</option>
          <option value="download_count">Downloads</option>
        </select>
        <button
          onClick={() => { setSortDir(sortDir === 'desc' ? 'asc' : 'desc'); fetchFiles(projectId); }}
          className="p-2 bg-[#0f0f0f] border border-[#2a2a2a] rounded-lg text-gray-400 hover:text-white transition-colors"
        >
          {sortDir === 'desc' ? '↓' : '↑'}
        </button>
      </div>

      {/* File Table */}
      {loading ? (
        <div className="flex items-center justify-center h-48">
          <div className="w-8 h-8 border-2 border-orange-500 border-t-transparent rounded-full animate-spin" />
        </div>
      ) : filtered.length === 0 ? (
        <div className="bg-[#0f0f0f] border border-[#2a2a2a] rounded-xl p-12 text-center">
          <p className="text-gray-400">No files found</p>
          <p className="text-sm text-gray-600 mt-1">Upload a file to get started</p>
        </div>
      ) : (
        <div className="bg-[#0f0f0f] border border-[#2a2a2a] rounded-xl overflow-hidden">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-[#2a2a2a]">
                <th className="px-4 py-3 text-left">
                  <input
                    type="checkbox"
                    className="rounded"
                    checked={selectedFiles.size === filtered.length && filtered.length > 0}
                    onChange={(e) => setSelectedFiles(e.target.checked ? new Set(filtered.map((f) => f.id)) : new Set())}
                  />
                </th>
                <th className="px-4 py-3 text-left text-xs text-gray-500 font-medium">Name</th>
                <th className="px-4 py-3 text-left text-xs text-gray-500 font-medium">Size</th>
                <th className="px-4 py-3 text-left text-xs text-gray-500 font-medium">Type</th>
                <th className="px-4 py-3 text-left text-xs text-gray-500 font-medium">Downloads</th>
                <th className="px-4 py-3 text-left text-xs text-gray-500 font-medium">Uploaded</th>
                <th className="px-4 py-3 text-right text-xs text-gray-500 font-medium">Actions</th>
              </tr>
            </thead>
            <tbody>
              {filtered.map((f) => (
                <tr key={f.id} className="border-b border-[#1a1a1a] hover:bg-[#141414] transition-colors">
                  <td className="px-4 py-3">
                    <input type="checkbox" className="rounded" checked={selectedFiles.has(f.id)} onChange={() => toggleSelect(f.id)} />
                  </td>
                  <td className="px-4 py-3">
                    <div className="flex items-center space-x-2">
                      <div className="text-gray-400">{getMimeIcon(f.mime_type)}</div>
                      <span className="text-white truncate max-w-[200px]">{f.original_name}</span>
                    </div>
                  </td>
                  <td className="px-4 py-3 text-gray-400">{formatBytes(f.file_size)}</td>
                  <td className="px-4 py-3 text-gray-500 text-xs">{f.mime_type}</td>
                  <td className="px-4 py-3 text-gray-400">{f.download_count}</td>
                  <td className="px-4 py-3 text-gray-500 text-xs">{new Date(f.created_at).toLocaleDateString()}</td>
                  <td className="px-4 py-3">
                    <div className="flex items-center justify-end space-x-1">
                      <button
                        onClick={() => handlePreview(f)}
                        className="p-1.5 hover:bg-[#2a2a2a] text-gray-400 hover:text-white rounded transition-colors"
                        title="Preview"
                      >
                        <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M2.458 12C3.732 7.943 7.523 5 12 5c4.478 0 8.268 2.943 9.542 7-1.274 4.057-5.064 7-9.542 7-4.477 0-8.268-2.943-9.542-7z" />
                        </svg>
                      </button>
                      <button
                        onClick={() => handleDownload(f)}
                        className="p-1.5 hover:bg-[#2a2a2a] text-gray-400 hover:text-white rounded transition-colors"
                        title="Download"
                      >
                        <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-4l-4 4m0 0l-4-4m4 4V4" />
                        </svg>
                      </button>
                      <button
                        onClick={() => { setRenameFile(f); setNewName(f.original_name); }}
                        className="p-1.5 hover:bg-[#2a2a2a] text-gray-400 hover:text-white rounded transition-colors"
                        title="Rename"
                      >
                        <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z" />
                        </svg>
                      </button>
                      <button
                        onClick={() => { setSignedUrlFile(f); setSignedUrl(''); setSignedExpiry('1h'); }}
                        className="p-1.5 hover:bg-[#2a2a2a] text-gray-400 hover:text-white rounded transition-colors"
                        title="Signed URL"
                      >
                        <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13.828 10.172a4 4 0 00-5.656 0l-4 4a4 4 0 105.656 5.656l1.102-1.101m-.758-4.899a4 4 0 005.656 0l4-4a4 4 0 00-5.656-5.656l-1.1 1.1" />
                        </svg>
                      </button>
                      <button
                        onClick={() => handleDelete(f)}
                        className="p-1.5 hover:bg-red-500/10 text-gray-400 hover:text-red-400 rounded transition-colors"
                        title="Delete"
                      >
                        <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
                        </svg>
                      </button>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {/* Signed URL Modal */}
      {signedUrlFile && (
        <div className="fixed inset-0 bg-black/60 backdrop-blur-sm z-50 flex items-center justify-center p-4">
          <div className="bg-[#181818] border border-[#2a2a2a] rounded-xl w-full max-w-md p-6">
            <h2 className="text-lg font-semibold text-white mb-4">Generate Signed URL</h2>
            <p className="text-sm text-gray-400 mb-4">{signedUrlFile.original_name}</p>
            <div className="mb-4">
              <label className="block text-xs text-gray-400 mb-1">Expiry</label>
              <select
                className="w-full bg-[#0f0f0f] border border-[#2a2a2a] rounded-lg px-3 py-2 text-sm text-white"
                value={signedExpiry}
                onChange={(e) => setSignedExpiry(e.target.value)}
              >
                {EXPIRY_OPTIONS.map((o) => <option key={o.value} value={o.value}>{o.label}</option>)}
              </select>
            </div>
            {signedUrl && (
              <div className="mb-4">
                <label className="block text-xs text-gray-400 mb-1">Signed URL</label>
                <div className="flex space-x-2">
                  <input readOnly className="flex-1 bg-[#0f0f0f] border border-[#2a2a2a] rounded-lg px-3 py-2 text-xs text-gray-300" value={signedUrl} />
                  <button
                    onClick={() => navigator.clipboard.writeText(signedUrl)}
                    className="px-3 py-2 bg-[#1a1a1a] hover:bg-[#242424] text-gray-300 text-xs rounded-lg"
                  >Copy</button>
                </div>
              </div>
            )}
            <div className="flex space-x-3">
              <button onClick={() => setSignedUrlFile(null)} className="flex-1 py-2 bg-[#1a1a1a] text-gray-300 text-sm rounded-lg">Cancel</button>
              <button onClick={handleGenerateSignedUrl} className="flex-1 py-2 bg-orange-500 hover:bg-orange-600 text-white text-sm font-semibold rounded-lg">Generate</button>
            </div>
          </div>
        </div>
      )}

      {/* Rename Modal */}
      {renameFile && (
        <div className="fixed inset-0 bg-black/60 backdrop-blur-sm z-50 flex items-center justify-center p-4">
          <div className="bg-[#181818] border border-[#2a2a2a] rounded-xl w-full max-w-md p-6">
            <h2 className="text-lg font-semibold text-white mb-4">Rename File</h2>
            <input
              className="w-full bg-[#0f0f0f] border border-[#2a2a2a] rounded-lg px-3 py-2 text-sm text-white focus:outline-none focus:border-orange-500 mb-4"
              value={newName}
              onChange={(e) => setNewName(e.target.value)}
            />
            <div className="flex space-x-3">
              <button onClick={() => setRenameFile(null)} className="flex-1 py-2 bg-[#1a1a1a] text-gray-300 text-sm rounded-lg">Cancel</button>
              <button onClick={handleRename} className="flex-1 py-2 bg-orange-500 hover:bg-orange-600 text-white text-sm font-semibold rounded-lg">Rename</button>
            </div>
          </div>
        </div>
      )}

      {/* Preview Modal */}
      {previewFile && (
        <div className="fixed inset-0 bg-black/80 backdrop-blur-sm z-50 flex items-center justify-center p-4" onClick={() => { setPreviewFile(null); setPreviewUrl(''); }}>
          <div className="bg-[#181818] border border-[#2a2a2a] rounded-xl max-w-3xl w-full max-h-[80vh] overflow-auto p-4" onClick={(e) => e.stopPropagation()}>
            <div className="flex items-center justify-between mb-4">
              <p className="text-sm font-semibold text-white">{previewFile.original_name}</p>
              <button onClick={() => { setPreviewFile(null); setPreviewUrl(''); }} className="text-gray-400 hover:text-white">✕</button>
            </div>
            {previewUrl && previewFile.mime_type?.startsWith('image/') && (
              <img src={previewUrl} alt={previewFile.original_name} className="max-w-full rounded-lg" />
            )}
            {previewUrl && previewFile.mime_type?.startsWith('text/') && (
              <iframe src={previewUrl} className="w-full h-96 rounded-lg bg-white" />
            )}
            {previewUrl && previewFile.mime_type === 'application/pdf' && (
              <iframe src={previewUrl} className="w-full h-96 rounded-lg" />
            )}
            {!previewUrl && <div className="flex items-center justify-center h-32"><div className="w-6 h-6 border-2 border-orange-500 border-t-transparent rounded-full animate-spin" /></div>}
          </div>
        </div>
      )}
    </div>
  );
}
