'use client';

// Prevent static generation - this page needs client-side rendering
export const dynamic = 'force-dynamic';

import { useState, useEffect } from 'react';
import { apiClient } from '@/lib/api';
import { useToast } from '@/lib/toast';

interface Backup {
  id: string;
  backup_name: string;
  backup_type: string;
  status: string;
  file_size: number | null;
  created_at: string;
  completed_at: string | null;
  error_message: string | null;
  created_by_email: string | null;
  metadata: any;
}

export default function BackupsPage() {
  const { showToast } = useToast();
  const [backups, setBackups] = useState<Backup[]>([]);
  const [projects, setProjects] = useState<any[]>([]);
  const [selectedProject, setSelectedProject] = useState<string>('');
  const [loading, setLoading] = useState(false);
  const [creating, setCreating] = useState(false);
  const [showCreateModal, setShowCreateModal] = useState(false);
  const [showRestoreModal, setShowRestoreModal] = useState(false);
  const [selectedBackup, setSelectedBackup] = useState<Backup | null>(null);
  const [backupName, setBackupName] = useState('');
  const [confirmRestore, setConfirmRestore] = useState(false);

  useEffect(() => {
    loadProjects();
  }, []);

  useEffect(() => {
    if (selectedProject) {
      loadBackups();
    }
  }, [selectedProject]);

  const loadProjects = async () => {
    try {
      const response = await apiClient.get('/api/projects', { requiresAuth: true });
      // Response is an array directly, not wrapped in {projects: [...]}
      const projectsList = Array.isArray(response) ? response : (response.projects || []);
      console.log('Projects loaded:', projectsList);
      setProjects(projectsList);
      if (projectsList.length > 0) {
        setSelectedProject(projectsList[0].id);
      }
    } catch (error: any) {
      console.error('Failed to load projects:', error);
      
      // Handle authentication errors
      if (error.status === 401 || error.status === 403) {
        showToast('Please log in to continue', 'error');
        setTimeout(() => {
          window.location.href = '/login';
        }, 1500);
        return;
      }
      
      showToast(error.message || 'Failed to load projects', 'error');
    }
  };

  const loadBackups = async () => {
    if (!selectedProject) return;
    
    setLoading(true);
    try {
      console.log('Loading backups for project:', selectedProject);
      const response = await apiClient.get(`/api/backups/list/${selectedProject}`, { requiresAuth: true });
      console.log('Backups response:', response);
      setBackups(response.backups || []);
    } catch (error: any) {
      console.error('Failed to load backups:', error);
      
      // Handle authentication errors
      if (error.status === 401 || error.status === 403) {
        showToast('Authentication required', 'error');
        return;
      }
      
      showToast(error.message || 'Failed to load backups', 'error');
      setBackups([]); // Clear backups on error
    } finally {
      setLoading(false);
    }
  };

  const createBackup = async () => {
    if (!selectedProject) {
      showToast('Please select a project first', 'error');
      return;
    }
    
    setCreating(true);
    try {
      console.log('Creating backup for project:', selectedProject);
      const response = await apiClient.post('/api/backups/create', {
        project_id: selectedProject,
        backup_name: backupName || undefined,
        backup_type: 'manual'
      }, { requiresAuth: true });
      
      console.log('Backup created:', response);
      showToast(response.message || 'Backup created successfully', 'success');
      setShowCreateModal(false);
      setBackupName('');
      await loadBackups();
    } catch (error: any) {
      console.error('Failed to create backup:', error);
      showToast(error.message || 'Failed to create backup', 'error');
    } finally {
      setCreating(false);
    }
  };

  const restoreBackup = async () => {
    if (!selectedBackup || !confirmRestore) return;
    
    setLoading(true);
    try {
      const response = await apiClient.post('/api/backups/restore', {
        backup_id: selectedBackup.id,
        confirm: true
      }, { requiresAuth: true });
      
      showToast(response.message || 'Backup restored successfully', 'success');
      setShowRestoreModal(false);
      setSelectedBackup(null);
      setConfirmRestore(false);
    } catch (error: any) {
      showToast(error.message || 'Failed to restore backup', 'error');
    } finally {
      setLoading(false);
    }
  };

  const deleteBackup = async (backupId: string) => {
    if (!confirm('Are you sure you want to delete this backup? This action cannot be undone.')) {
      return;
    }
    
    try {
      const response = await apiClient.delete(`/api/backups/${backupId}`, { requiresAuth: true });
      showToast(response.message || 'Backup deleted successfully', 'success');
      loadBackups();
    } catch (error: any) {
      showToast(error.message || 'Failed to delete backup', 'error');
    }
  };

  const downloadBackup = async (backupId: string, backupName: string) => {
    try {
      showToast('Preparing download...', 'info');
      
      // Get the auth token
      const token = localStorage.getItem('token');
      
      // Create a download link
      const url = `${process.env.NEXT_PUBLIC_API_URL!}/api/backups/${backupId}/download`;
      
      // Use fetch to download with auth header
      const response = await fetch(url, {
        headers: {
          'Authorization': `Bearer ${token}`
        }
      });
      
      if (!response.ok) {
        throw new Error('Download failed');
      }
      
      // Get the blob
      const blob = await response.blob();
      
      // Create download link
      const downloadUrl = window.URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = downloadUrl;
      a.download = `${backupName}.sql.gz`;
      document.body.appendChild(a);
      a.click();
      window.URL.revokeObjectURL(downloadUrl);
      document.body.removeChild(a);
      
      showToast('Backup downloaded successfully', 'success');
    } catch (error: any) {
      showToast(error.message || 'Failed to download backup', 'error');
    }
  };

  const formatFileSize = (bytes: number | null) => {
    if (!bytes) return 'N/A';
    const mb = bytes / (1024 * 1024);
    if (mb < 1) return `${(bytes / 1024).toFixed(2)} KB`;
    if (mb < 1024) return `${mb.toFixed(2)} MB`;
    return `${(mb / 1024).toFixed(2)} GB`;
  };

  const formatDate = (dateString: string | null) => {
    if (!dateString) return 'N/A';
    return new Date(dateString).toLocaleString();
  };

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'completed': return 'text-green-500';
      case 'failed': return 'text-red-500';
      case 'in_progress': return 'text-yellow-500';
      default: return 'text-gray-500';
    }
  };

  return (
    <div className="p-6">
      <div className="flex justify-between items-center mb-6">
        <div>
          <h1 className="text-2xl font-bold text-white">Backup & Restore</h1>
          <p className="text-gray-400 mt-1">Create and manage database backups</p>
        </div>
        <button
          onClick={() => setShowCreateModal(true)}
          disabled={!selectedProject}
          className="px-4 py-2 bg-orange-500 text-white rounded hover:bg-orange-600 disabled:opacity-50 disabled:cursor-not-allowed"
        >
          Create Backup
        </button>
      </div>

      {/* Project Selector */}
      <div className="mb-6">
        <label className="block text-sm font-medium text-gray-300 mb-2">
          Select Project
        </label>
        <select
          value={selectedProject}
          onChange={(e) => setSelectedProject(e.target.value)}
          className="w-full md:w-64 px-3 py-2 bg-[#1c1c1c] border border-gray-700 rounded text-white"
        >
          <option value="">Select a project</option>
          {projects.map((project) => (
            <option key={project.id} value={project.id}>
              {project.name}
            </option>
          ))}
        </select>
      </div>

      {/* Backups List */}
      {loading ? (
        <div className="text-center py-12">
          <div className="inline-block animate-spin rounded-full h-8 w-8 border-b-2 border-orange-500"></div>
          <p className="text-gray-400 mt-2">Loading backups...</p>
        </div>
      ) : backups.length === 0 ? (
        <div className="text-center py-12 bg-[#1c1c1c] rounded-lg border border-gray-800">
          <p className="text-gray-400">No backups found</p>
          <p className="text-gray-500 text-sm mt-1">Create your first backup to get started</p>
        </div>
      ) : (
        <div className="bg-[#1c1c1c] rounded-lg border border-gray-800 overflow-hidden">
          <table className="w-full">
            <thead className="bg-[#181818] border-b border-gray-800">
              <tr>
                <th className="px-4 py-3 text-left text-sm font-medium text-gray-300">Name</th>
                <th className="px-4 py-3 text-left text-sm font-medium text-gray-300">Type</th>
                <th className="px-4 py-3 text-left text-sm font-medium text-gray-300">Status</th>
                <th className="px-4 py-3 text-left text-sm font-medium text-gray-300">Size</th>
                <th className="px-4 py-3 text-left text-sm font-medium text-gray-300">Created</th>
                <th className="px-4 py-3 text-left text-sm font-medium text-gray-300">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-800">
              {backups.map((backup) => (
                <tr key={backup.id} className="hover:bg-[#222] transition-colors">
                  <td className="px-4 py-3 text-sm text-white">{backup.backup_name}</td>
                  <td className="px-4 py-3 text-sm text-gray-400 capitalize">{backup.backup_type}</td>
                  <td className="px-4 py-3 text-sm">
                    <span className={`capitalize ${getStatusColor(backup.status)}`}>
                      {backup.status}
                    </span>
                  </td>
                  <td className="px-4 py-3 text-sm text-gray-400">{formatFileSize(backup.file_size)}</td>
                  <td className="px-4 py-3 text-sm text-gray-400">{formatDate(backup.created_at)}</td>
                  <td className="px-4 py-3 text-sm">
                    <div className="flex gap-2">
                      {backup.status === 'completed' && (
                        <>
                          <button
                            onClick={() => downloadBackup(backup.id, backup.backup_name)}
                            className="px-3 py-1 bg-green-500 text-white text-xs rounded hover:bg-green-600"
                            title="Download backup file"
                          >
                            Download
                          </button>
                          <button
                            onClick={() => {
                              setSelectedBackup(backup);
                              setShowRestoreModal(true);
                            }}
                            className="px-3 py-1 bg-blue-500 text-white text-xs rounded hover:bg-blue-600"
                            title="Restore this backup"
                          >
                            Restore
                          </button>
                        </>
                      )}
                      <button
                        onClick={() => deleteBackup(backup.id)}
                        className="px-3 py-1 bg-red-500 text-white text-xs rounded hover:bg-red-600"
                        title="Delete backup"
                      >
                        Delete
                      </button>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {/* Create Backup Modal */}
      {showCreateModal && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
          <div className="bg-[#1c1c1c] rounded-lg p-6 w-full max-w-md border border-gray-800">
            <h2 className="text-xl font-bold text-white mb-4">Create Backup</h2>
            
            <div className="mb-4">
              <label className="block text-sm font-medium text-gray-300 mb-2">
                Backup Name (optional)
              </label>
              <input
                type="text"
                value={backupName}
                onChange={(e) => setBackupName(e.target.value)}
                placeholder="Leave empty for auto-generated name"
                className="w-full px-3 py-2 bg-[#181818] border border-gray-700 rounded text-white"
              />
              <p className="text-xs text-gray-500 mt-1">
                Format: dbname_YYYYMMDD_HHMMSS
              </p>
            </div>

            <div className="flex gap-3 justify-end">
              <button
                onClick={() => {
                  setShowCreateModal(false);
                  setBackupName('');
                }}
                disabled={creating}
                className="px-4 py-2 bg-gray-700 text-white rounded hover:bg-gray-600 disabled:opacity-50"
              >
                Cancel
              </button>
              <button
                onClick={createBackup}
                disabled={creating}
                className="px-4 py-2 bg-orange-500 text-white rounded hover:bg-orange-600 disabled:opacity-50"
              >
                {creating ? 'Creating...' : 'Create Backup'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Restore Backup Modal */}
      {showRestoreModal && selectedBackup && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
          <div className="bg-[#1c1c1c] rounded-lg p-6 w-full max-w-md border border-gray-800">
            <h2 className="text-xl font-bold text-white mb-4">Restore Backup</h2>
            
            <div className="mb-4 p-4 bg-red-900 bg-opacity-20 border border-red-500 rounded">
              <p className="text-red-400 text-sm font-medium">Warning</p>
              <p className="text-red-300 text-sm mt-1">
                This will restore the database to the state of this backup. All current data will be replaced.
              </p>
            </div>

            <div className="mb-4">
              <p className="text-sm text-gray-400">
                <span className="font-medium text-white">Backup:</span> {selectedBackup.backup_name}
              </p>
              <p className="text-sm text-gray-400 mt-1">
                <span className="font-medium text-white">Created:</span> {formatDate(selectedBackup.created_at)}
              </p>
              <p className="text-sm text-gray-400 mt-1">
                <span className="font-medium text-white">Size:</span> {formatFileSize(selectedBackup.file_size)}
              </p>
            </div>

            <div className="mb-4">
              <label className="flex items-center gap-2 cursor-pointer">
                <input
                  type="checkbox"
                  checked={confirmRestore}
                  onChange={(e) => setConfirmRestore(e.target.checked)}
                  className="w-4 h-4"
                />
                <span className="text-sm text-gray-300">
                  I understand this will replace all current data
                </span>
              </label>
            </div>

            <div className="flex gap-3 justify-end">
              <button
                onClick={() => {
                  setShowRestoreModal(false);
                  setSelectedBackup(null);
                  setConfirmRestore(false);
                }}
                disabled={loading}
                className="px-4 py-2 bg-gray-700 text-white rounded hover:bg-gray-600 disabled:opacity-50"
              >
                Cancel
              </button>
              <button
                onClick={restoreBackup}
                disabled={!confirmRestore || loading}
                className="px-4 py-2 bg-red-500 text-white rounded hover:bg-red-600 disabled:opacity-50 disabled:cursor-not-allowed"
              >
                {loading ? 'Restoring...' : 'Restore Backup'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
