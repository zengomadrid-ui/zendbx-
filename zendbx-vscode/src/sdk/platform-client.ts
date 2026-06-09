import { HttpClient } from './http';
import {
  LoginRequest,
  LoginResponse,
  Project,
  ProjectKeysResponse,
  CreateProjectRequest,
  User,
  ApiResponse,
  QueryExecuteRequest,
  QueryResult,
  DatabaseTable,
} from './types';

export interface PlatformClientConfig {
  apiUrl: string;
  jwt: string;
}

export class PlatformClient {
  private http: HttpClient;

  constructor(config: PlatformClientConfig) {
    this.http = new HttpClient({
      baseUrl: config.apiUrl,
      authMode: 'jwt',
      authValue: config.jwt,
    });
  }

  async login(credentials: LoginRequest): Promise<ApiResponse<LoginResponse>> {
    return this.http.post<LoginResponse>('/api/auth/login', credentials);
  }

  async logout(): Promise<ApiResponse<void>> {
    return this.http.post<void>('/api/auth/logout');
  }

  async getCurrentUser(): Promise<ApiResponse<User>> {
    return this.http.get<User>('/api/auth/me');
  }

  async listProjects(): Promise<ApiResponse<Project[]>> {
    return this.http.get<Project[]>('/api/projects');
  }

  async getProject(projectId: string): Promise<ApiResponse<Project>> {
    return this.http.get<Project>(`/api/projects/${projectId}`);
  }

  async createProject(data: CreateProjectRequest): Promise<ApiResponse<Project>> {
    return this.http.post<Project>('/api/projects', data);
  }

  async deleteProject(projectId: string): Promise<ApiResponse<void>> {
    return this.http.delete<void>(`/api/projects/${projectId}`);
  }

  async getProjectKeys(projectId: string): Promise<ApiResponse<ProjectKeysResponse>> {
    return this.http.get<ProjectKeysResponse>(`/api/projects/${projectId}/keys`);
  }

  async updateProject(projectId: string, data: Partial<CreateProjectRequest>): Promise<ApiResponse<Project>> {
    return this.http.put<Project>(`/api/projects/${projectId}`, data);
  }

  // Project Operations (requires JWT)
  async listProjectTables(projectId: string): Promise<ApiResponse<DatabaseTable[]>> {
    const response = await this.http.get<{ tables: DatabaseTable[] }>(`/api/projects/${projectId}/db/tables/`, {
      headers: {
        'x-project-id': projectId,
      },
    });
    
    // Extract tables array from response
    if (response.data && 'tables' in response.data) {
      return { data: response.data.tables, error: response.error, message: response.message };
    }
    
    return { data: undefined, error: response.error, message: response.message };
  }

  async executeProjectQuery(projectId: string, request: QueryExecuteRequest): Promise<ApiResponse<QueryResult>> {
    return this.http.post<QueryResult>(`/api/projects/${projectId}/query`, request);
  }
}

export function createPlatformClient(config: PlatformClientConfig): PlatformClient {
  return new PlatformClient(config);
}
