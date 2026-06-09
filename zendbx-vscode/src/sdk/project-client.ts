import { HttpClient } from './http';
import {
  StorageBucket,
  StorageFile,
  ApiResponse,
} from './types';

export interface ProjectClientConfig {
  apiUrl: string;
  projectId: string;
  anonKey: string;
}

export class ProjectClient {
  private http: HttpClient;
  private projectId: string;

  constructor(config: ProjectClientConfig) {
    this.projectId = config.projectId;
    this.http = new HttpClient({
      baseUrl: config.apiUrl,
      authMode: 'api-key',
      authValue: config.anonKey,
    });
  }

  private getProjectHeaders() {
    return {
      'x-project-id': this.projectId,
    };
  }

  async listBuckets(): Promise<ApiResponse<StorageBucket[]>> {
    const path = `/storage/v1/bucket?project_id=${this.projectId}`;
    console.log('[ProjectClient] listBuckets ->', path);
    return this.http.get<StorageBucket[]>(path, {
      headers: this.getProjectHeaders(),
    });
  }

  async createBucket(name: string, isPublic = false): Promise<ApiResponse<StorageBucket>> {
    const path = '/storage/v1/bucket';
    const body = { name, public: isPublic, project_id: this.projectId };
    console.log('[ProjectClient] createBucket ->', path, body);
    return this.http.post<StorageBucket>(path, body, {
      headers: this.getProjectHeaders(),
    });
  }

  async deleteBucket(bucketId: string): Promise<ApiResponse<void>> {
    const path = `/storage/v1/bucket/${bucketId}?project_id=${this.projectId}`;
    console.log('[ProjectClient] deleteBucket ->', path);
    return this.http.delete<void>(path, {
      headers: this.getProjectHeaders(),
    });
  }

  async listFiles(bucketId: string, path = ''): Promise<ApiResponse<StorageFile[]>> {
    const endpoint = `/storage/v1/object/list/${bucketId}?path=${path}&project_id=${this.projectId}`;
    console.log('[ProjectClient] listFiles ->', endpoint);
    return this.http.get<StorageFile[]>(endpoint, {
      headers: this.getProjectHeaders(),
    });
  }

  async uploadFile(bucketId: string, path: string, file: Buffer): Promise<ApiResponse<StorageFile>> {
    const endpoint = `/storage/v1/object/${bucketId}/${path}?project_id=${this.projectId}`;
    console.log('[ProjectClient] uploadFile ->', endpoint);
    return this.http.post<StorageFile>(endpoint, file, {
      headers: {
        ...this.getProjectHeaders(),
        'Content-Type': 'application/octet-stream',
      },
    });
  }

  async deleteFile(bucketId: string, path: string): Promise<ApiResponse<void>> {
    const endpoint = `/storage/v1/object/${bucketId}/${path}?project_id=${this.projectId}`;
    console.log('[ProjectClient] deleteFile ->', endpoint);
    return this.http.delete<void>(endpoint, {
      headers: this.getProjectHeaders(),
    });
  }

  async downloadFile(bucketId: string, path: string): Promise<ApiResponse<Buffer>> {
    const endpoint = `/storage/v1/object/${bucketId}/${path}?project_id=${this.projectId}`;
    console.log('[ProjectClient] downloadFile ->', endpoint);
    return this.http.get<Buffer>(endpoint, {
      headers: this.getProjectHeaders(),
      responseType: 'arraybuffer',
    });
  }
}

export function createProjectClient(config: ProjectClientConfig): ProjectClient {
  return new ProjectClient(config);
}
