'use client';


import { useState, useEffect } from 'react';
import Link from 'next/link';
import { apiFetch } from '@/lib/fetch-utils';

interface Bucket {
  id: string;
  name: string;
  slug: string;
  description: string | null;
  is_public: boolean;
  storage_used: number;
  file_count: number;
  created_at: string;
}

function formatBytes(bytes: number): string {
  if (!bytes) return '0 B';
  const k = 1024;
  const sizes = ['B', 'KB', 'MB', 'GB'];
  const i = Math.floor(Math.log(bytes) / Math.log(k));
  return `${parseFloat((bytes / Math.pow(k, i)).toFixed(1))} ${sizes[i]}`;
}

export default function BucketsPage() {
  const [buckets, setBuckets] = useState<Bucket[]>([]);
  const [loading, setLoading] = useState(true);
  const [projectId, setProjectId] = useState('');
  const [showCreate, setShowCreate] = useState(false);
  const [editBucket, setEditBucket] = useState<Bucket | null>(null);
  const [form, setForm] = useState({ name: '', description: '', is_public: false });
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');

  useEffect(() => {
    const pid = localStorage.getItem('current_project_id') || '';
    setProjectId(pid);
    if (pid) fetchBuckets(pid);
  }, []);

  async function fetchBuckets(pid: string) {
    setLoading(true);
    try {
      const res = await apiFetch(`api/storage/buckets?project_id=${pid}`);
      if (res.ok) setBuckets(await res.json());
    } finally {
      setLoading(false);
    }
  }

  async function handleCreate() {
    if (!form.name.trim()) return;
    setSaving(true);
    setError('');
    try {
      const res = await apiFetch(`api/storage/buckets?project_id=${projectId}`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(form),
      });
      if (!res.ok) {
        const d = await res.json();
        setError(d.detail || 'Failed to create bucket');
        return;
      }
      setShowCreate(false);
      setForm({ name: '', description: '', is_public: false });
      fetchBuckets(projectId);
    } finally {
      setSaving(false);
    }
  }

  async function handleUpdate() {
    if (!editBucket) return;
    setSaving(true);
    setError('');
    try {
      const res = await apiFetch(`api/storage/buckets/${editBucket.id}?project_id=${projectId}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(form),
      });
      if (!res.ok) {
        const d = await res.json();
        setError(d.detail || 'Failed to update bucket');
        return;
      }
      setEditBucket(null);
      fetchBuckets(projectId);
    } finally {
      setSaving(false);
    }
  }

  async function handleDelete(bucket: Bucket) {
    if (!confirm(`Delete bucket "${bucket.name}" and all its files? This cannot be undone.`)) return;
    await apiFetch(`api/storage/buckets/${bucket.id}?project_id=${projectId}`, { method: 'DELETE' });
    fetchBuckets(projectId);
  }

  function openEdit(b: Bucket) {
    setEditBucket(b);
    setForm({ name: b.name, description: b.description || '', is_public: b.is_public });
    setError('');
  }

  return (
    <div className="p-6 space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-white">Buckets</h1>
          <p className="text-sm text-gray-400 mt-1">Organize your files into buckets</p>
        </div>
        <button
          onClick={() => { setShowCreate(true); setForm({ name: '', description: '', is_public: false }); setError(''); }}
          className="px-4 py-2 bg-orange-500 hover:bg-orange-600 text-white text-sm font-semibold rounded-lg transition-colors"
        >
          + New Bucket
        </button>
      </div>

      {/* Bucket List */}
      {loading ? (
        <div className="flex items-center justify-center h-48">
          <div className="w-8 h-8 border-2 border-orange-500 border-t-transparent rounded-full animate-spin" />
        </div>
      ) : buckets.length === 0 ? (
        <div className="bg-[#0f0f0f] border border-[#2a2a2a] rounded-xl p-12 text-center">
          <div className="w-12 h-12 bg-[#1a1a1a] rounded-xl flex items-center justify-center mx-auto mb-4">
            <svg className="w-6 h-6 text-gray-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 19a2 2 0 01-2-2V7a2 2 0 012-2h4l2 2h4a2 2 0 012 2v1M5 19h14a2 2 0 002-2v-5a2 2 0 00-2-2H9a2 2 0 00-2 2v5a2 2 0 01-2 2z" />
            </svg>
          </div>
          <p className="text-gray-400 font-medium">No buckets yet</p>
          <p className="text-sm text-gray-600 mt-1">Create a bucket to start storing files</p>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4">
          {buckets.map((b) => (
            <div key={b.id} className="bg-[#0f0f0f] border border-[#2a2a2a] rounded-xl p-5 hover:border-[#3a3a3a] transition-colors">
              <div className="flex items-start justify-between mb-3">
                <div className="flex items-center space-x-3">
                  <div className="w-10 h-10 bg-orange-500/10 rounded-lg flex items-center justify-center">
                    <svg className="w-5 h-5 text-orange-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 19a2 2 0 01-2-2V7a2 2 0 012-2h4l2 2h4a2 2 0 012 2v1M5 19h14a2 2 0 002-2v-5a2 2 0 00-2-2H9a2 2 0 00-2 2v5a2 2 0 01-2 2z" />
                    </svg>
                  </div>
                  <div>
                    <p className="text-sm font-semibold text-white">{b.name}</p>
                    <p className="text-xs text-gray-500">{b.slug}</p>
                  </div>
                </div>
                <span className={`px-2 py-0.5 text-xs rounded-full ${b.is_public ? 'bg-green-500/10 text-green-400' : 'bg-gray-500/10 text-gray-400'}`}>
                  {b.is_public ? 'Public' : 'Private'}
                </span>
              </div>

              {b.description && <p className="text-xs text-gray-500 mb-3 line-clamp-2">{b.description}</p>}

              <div className="flex items-center justify-between text-xs text-gray-500 mb-4">
                <span>{b.file_count} files</span>
                <span>{formatBytes(b.storage_used)}</span>
              </div>

              <div className="flex items-center space-x-2">
                <Link
                  href={`/dashboard/storage/buckets/${b.id}`}
                  className="flex-1 text-center py-1.5 bg-[#1a1a1a] hover:bg-[#242424] text-white text-xs rounded-lg transition-colors"
                >
                  Browse Files
                </Link>
                <button
                  onClick={() => openEdit(b)}
                  className="p-1.5 bg-[#1a1a1a] hover:bg-[#242424] text-gray-400 hover:text-white rounded-lg transition-colors"
                >
                  <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z" />
                  </svg>
                </button>
                <button
                  onClick={() => handleDelete(b)}
                  className="p-1.5 bg-[#1a1a1a] hover:bg-red-500/10 text-gray-400 hover:text-red-400 rounded-lg transition-colors"
                >
                  <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
                  </svg>
                </button>
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Create / Edit Modal */}
      {(showCreate || editBucket) && (
        <div className="fixed inset-0 bg-black/60 backdrop-blur-sm z-50 flex items-center justify-center p-4">
          <div className="bg-[#181818] border border-[#2a2a2a] rounded-xl w-full max-w-md p-6">
            <h2 className="text-lg font-semibold text-white mb-4">{editBucket ? 'Edit Bucket' : 'New Bucket'}</h2>

            {error && <p className="text-sm text-red-400 mb-3">{error}</p>}

            <div className="space-y-4">
              <div>
                <label className="block text-xs text-gray-400 mb-1">Name</label>
                <input
                  className="w-full bg-[#0f0f0f] border border-[#2a2a2a] rounded-lg px-3 py-2 text-sm text-white focus:outline-none focus:border-orange-500"
                  value={form.name}
                  onChange={(e) => setForm({ ...form, name: e.target.value })}
                  placeholder="my-bucket"
                />
              </div>
              <div>
                <label className="block text-xs text-gray-400 mb-1">Description (optional)</label>
                <input
                  className="w-full bg-[#0f0f0f] border border-[#2a2a2a] rounded-lg px-3 py-2 text-sm text-white focus:outline-none focus:border-orange-500"
                  value={form.description}
                  onChange={(e) => setForm({ ...form, description: e.target.value })}
                  placeholder="What's this bucket for?"
                />
              </div>
              <label className="flex items-center space-x-3 cursor-pointer">
                <div
                  onClick={() => setForm({ ...form, is_public: !form.is_public })}
                  className={`w-10 h-5 rounded-full transition-colors ${form.is_public ? 'bg-orange-500' : 'bg-[#2a2a2a]'} relative`}
                >
                  <div className={`absolute top-0.5 w-4 h-4 bg-white rounded-full transition-transform ${form.is_public ? 'translate-x-5' : 'translate-x-0.5'}`} />
                </div>
                <span className="text-sm text-gray-300">Public bucket (files accessible without auth)</span>
              </label>
            </div>

            <div className="flex space-x-3 mt-6">
              <button
                onClick={() => { setShowCreate(false); setEditBucket(null); }}
                className="flex-1 py-2 bg-[#1a1a1a] hover:bg-[#242424] text-gray-300 text-sm rounded-lg transition-colors"
              >
                Cancel
              </button>
              <button
                onClick={editBucket ? handleUpdate : handleCreate}
                disabled={saving || !form.name.trim()}
                className="flex-1 py-2 bg-orange-500 hover:bg-orange-600 disabled:opacity-50 text-white text-sm font-semibold rounded-lg transition-colors"
              >
                {saving ? 'Saving...' : editBucket ? 'Save Changes' : 'Create Bucket'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
