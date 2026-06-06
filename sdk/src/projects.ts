import type { HttpClient } from './http';
import type {
  ZendbxResponse,
  Project,
  ProjectKeys,
  CreateProjectInput,
  UpdateProjectInput,
  ApiKey,
} from './types';

export class ProjectsModule {
  constructor(private http: HttpClient) {}

  /** List all projects for the authenticated user */
  async list(): Promise<ZendbxResponse<Project[]>> {
    return this.http.request<Project[]>('/api/projects');
  }

  /** Create a new project (provisions a dedicated PostgreSQL database) */
  async create(input: CreateProjectInput): Promise<ZendbxResponse<Project>> {
    return this.http.request<Project>('/api/projects', {
      method: 'POST',
      body: input,
    });
  }

  /** Get details for a single project */
  async get(projectId: string): Promise<ZendbxResponse<Project>> {
    return this.http.request<Project>(`/api/projects/${projectId}`);
  }

  /** Update project name / description */
  async update(projectId: string, input: UpdateProjectInput): Promise<ZendbxResponse<Project>> {
    return this.http.request<Project>(`/api/projects/${projectId}`, {
      method: 'PUT',
      body: input,
    });
  }

  /** Delete a project and drop its database */
  async delete(projectId: string): Promise<ZendbxResponse<{ message: string }>> {
    return this.http.request<{ message: string }>(`/api/projects/${projectId}`, {
      method: 'DELETE',
    });
  }

  /** Get anon + service_role API keys for a project */
  async getKeys(projectId: string): Promise<ZendbxResponse<ProjectKeys>> {
    return this.http.request<ProjectKeys>(`/api/projects/${projectId}/keys`);
  }

  /** Get the public API URL and Supabase-compatible URL for a project */
  async getApiUrls(projectId: string): Promise<ZendbxResponse<Record<string, string>>> {
    return this.http.request<Record<string, string>>(`/api/projects/${projectId}/api-urls`);
  }

  // ─── API Key Management ──────────────────────────────────────────────────

  /** List API keys for a project */
  async listApiKeys(projectId: string): Promise<ZendbxResponse<ApiKey[]>> {
    return this.http.request<ApiKey[]>(`/api/projects/${projectId}/api-keys`);
  }

  /** Generate a new API key */
  async createApiKey(
    projectId: string,
    input: { name: string; role?: string }
  ): Promise<ZendbxResponse<ApiKey & { full_key: string }>> {
    return this.http.request<ApiKey & { full_key: string }>(
      `/api/projects/${projectId}/api-keys`,
      { method: 'POST', body: input }
    );
  }

  /** Revoke (delete) an API key */
  async deleteApiKey(
    projectId: string,
    keyId: string
  ): Promise<ZendbxResponse<{ message: string }>> {
    return this.http.request<{ message: string }>(
      `/api/projects/${projectId}/api-keys/${keyId}`,
      { method: 'DELETE' }
    );
  }

  /** Enable or disable an API key */
  async toggleApiKey(
    projectId: string,
    keyId: string
  ): Promise<ZendbxResponse<ApiKey>> {
    return this.http.request<ApiKey>(
      `/api/projects/${projectId}/api-keys/${keyId}/toggle`,
      { method: 'PATCH' }
    );
  }
}
