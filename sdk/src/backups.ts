import type { HttpClient } from './http';
import type { ZendbxResponse, Backup } from './types';

export class BackupsModule {
  constructor(private http: HttpClient) {}

  /** Trigger a manual backup for a project */
  async create(projectId: string): Promise<ZendbxResponse<Backup>> {
    return this.http.request<Backup>('/api/backups', {
      method: 'POST',
      body: { project_id: projectId },
    });
  }

  /** List all backups for a project */
  async list(projectId: string): Promise<ZendbxResponse<Backup[]>> {
    return this.http.request<Backup[]>(`/api/backups?project_id=${projectId}`);
  }

  /** Restore from a backup */
  async restore(backupId: string): Promise<ZendbxResponse<{ message: string }>> {
    return this.http.request<{ message: string }>(
      `/api/backups/${backupId}/restore`,
      { method: 'POST' }
    );
  }

  /** Delete a backup */
  async delete(backupId: string): Promise<ZendbxResponse<{ message: string }>> {
    return this.http.request<{ message: string }>(
      `/api/backups/${backupId}`,
      { method: 'DELETE' }
    );
  }
}
