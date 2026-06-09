import * as vscode from 'vscode';
import { ProjectClient, createProjectClient } from '../sdk/project-client';

export class ProjectClientService {
  private static instance: ProjectClientService;
  private clients: Map<string, ProjectClient> = new Map();

  private constructor() {
  }

  static getInstance(): ProjectClientService {
    if (!ProjectClientService.instance) {
      ProjectClientService.instance = new ProjectClientService();
    }
    return ProjectClientService.instance;
  }

  async getClient(projectId: string, anonKey: string): Promise<ProjectClient> {
    const cacheKey = `project-client-${projectId}`;
    
    let client = this.clients.get(cacheKey);
    
    if (!client) {
      const apiUrl = this.getApiUrl();
      client = createProjectClient({
        apiUrl,
        projectId,
        anonKey,
      });
      this.clients.set(cacheKey, client);
    }

    return client;
  }

  clearClient(projectId: string): void {
    const cacheKey = `project-client-${projectId}`;
    this.clients.delete(cacheKey);
  }

  clearAll(): void {
    this.clients.clear();
  }

  private getApiUrl(): string {
    const config = vscode.workspace.getConfiguration('zendbx');
    let apiUrl = config.get<string>('apiUrl') || 'http://localhost:8000';
    apiUrl = apiUrl.trim().replace(/\/$/, '');
    if (apiUrl.endsWith('/api')) {
      apiUrl = apiUrl.slice(0, -4);
    }
    return apiUrl;
  }
}
