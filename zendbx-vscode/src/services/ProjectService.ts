import * as vscode from 'vscode';
import { PlatformClientService } from './PlatformClientService';
import { Project, CreateProjectRequest, ProjectKeys } from '../sdk/types';
import { Logger } from '../utils/logger';
import { Cache } from '../utils/cache';

export class ProjectService {
  private static instance: ProjectService;
  private platformClientService: PlatformClientService;
  private cache: Cache;
  private activeProjectId: string | null = null;
  private context: vscode.ExtensionContext;

  private constructor(context: vscode.ExtensionContext) {
    this.context = context;
    this.platformClientService = PlatformClientService.getInstance(context);
    this.cache = Cache.getInstance();
  }

  static getInstance(context: vscode.ExtensionContext): ProjectService {
    if (!ProjectService.instance) {
      ProjectService.instance = new ProjectService(context);
    }
    return ProjectService.instance;
  }

  async listProjects(): Promise<Project[]> {
    try {
      const client = await this.platformClientService.getClient();
      
      if (!client) {
        vscode.window.showWarningMessage('Please login first');
        return [];
      }

      const response = await client.listProjects();

      if (response.error || !response.data) {
        Logger.error(`Failed to list projects: ${response.error}`);
        vscode.window.showErrorMessage('Failed to load projects');
        return [];
      }

      this.cache.set('projects', response.data);
      return response.data;
    } catch (error) {
      Logger.error(`List projects error: ${error}`);
      return [];
    }
  }

  async getProject(projectId: string): Promise<Project | null> {
    try {
      const client = await this.platformClientService.getClient();
      
      if (!client) {
        return null;
      }

      const response = await client.getProject(projectId);

      if (response.error || !response.data) {
        Logger.error(`Failed to get project: ${response.error}`);
        return null;
      }

      return response.data;
    } catch (error) {
      Logger.error(`Get project error: ${error}`);
      return null;
    }
  }

  async createProject(data: CreateProjectRequest): Promise<Project | null> {
    try {
      const client = await this.platformClientService.getClient();
      
      if (!client) {
        vscode.window.showWarningMessage('Please login first');
        return null;
      }

      const response = await client.createProject(data);

      if (response.error || !response.data) {
        Logger.error(`Failed to create project: ${response.error}`);
        vscode.window.showErrorMessage(`Failed to create project: ${response.error}`);
        return null;
      }

      Logger.info(`Project created: ${response.data.name}`);
      vscode.window.showInformationMessage(`Project "${response.data.name}" created successfully`);
      
      this.cache.delete('projects');
      return response.data;
    } catch (error) {
      Logger.error(`Create project error: ${error}`);
      vscode.window.showErrorMessage('Failed to create project');
      return null;
    }
  }

  async promptForProjectSelection(): Promise<Project | null> {
    const projects = await this.listProjects();

    if (projects.length === 0) {
      vscode.window.showWarningMessage('No projects available. Please create a project first.');
      return null;
    }

    const picked = await vscode.window.showQuickPick(
      projects.map((project) => ({
        label: project.name,
        description: project.slug,
        detail: project.description || undefined,
        project,
      })),
      {
        placeHolder: 'Select a project',
        canPickMany: false,
      }
    );

    return picked?.project || null;
  }

  async ensureActiveProject(): Promise<string | null> {
    const current = this.getActiveProjectId();
    if (current) {
      return current;
    }

    const project = await this.promptForProjectSelection();
    if (!project) {
      return null;
    }

    this.setActiveProject(project.id);
    return project.id;
  }

  async deleteProject(projectId: string): Promise<boolean> {
    try {
      const client = await this.platformClientService.getClient();
      
      if (!client) {
        return false;
      }

      const response = await client.deleteProject(projectId);

      if (response.error) {
        Logger.error(`Failed to delete project: ${response.error}`);
        vscode.window.showErrorMessage('Failed to delete project');
        return false;
      }

      Logger.info(`Project deleted: ${projectId}`);
      vscode.window.showInformationMessage('Project deleted successfully');
      
      this.cache.delete('projects');
      if (this.activeProjectId === projectId) {
        this.activeProjectId = null;
      }
      
      return true;
    } catch (error) {
      Logger.error(`Delete project error: ${error}`);
      return false;
    }
  }

  async getProjectKeys(projectId: string): Promise<ProjectKeys | null> {
    try {
      const cacheKey = `project-keys-${projectId}`;
      const cached = this.cache.get<ProjectKeys>(cacheKey);
      
      if (cached) {
        return cached;
      }

      const client = await this.platformClientService.getClient();
      
      if (!client) {
        return null;
      }

      const response = await client.getProjectKeys(projectId);

      if (response.error || !response.data) {
        Logger.error(`Failed to get project keys: ${response.error}`);
        return null;
      }

      const keysData = response.data;
      
      if (!keysData.keys || !keysData.keys.anon || !keysData.keys.service_role) {
        Logger.error('Invalid project keys response structure');
        return null;
      }

      const transformedKeys: ProjectKeys = {
        anon_key: keysData.keys.anon.full_key,
        service_role_key: keysData.keys.service_role.full_key,
      };

      this.cache.set(cacheKey, transformedKeys);
      return transformedKeys;
    } catch (error) {
      Logger.error(`Get project keys error: ${error}`);
      return null;
    }
  }

  setActiveProject(projectId: string): void {
    this.activeProjectId = projectId;
    this.cache.set('active-project', projectId);
    try {
      Promise.resolve(this.context.globalState.update('zendbx.activeProjectId', projectId)).catch((err: unknown) => {
        Logger.error(`Failed to persist active project: ${err}`);
      });
    } catch (err) {
      Logger.error(`Failed to update globalState: ${err}`);
    }
    console.log('[ProjectService] setActiveProject ->', projectId);
  }

  getActiveProjectId(): string | null {
    if (this.activeProjectId) {
      return this.activeProjectId;
    }
    
    const cached = this.cache.get<string>('active-project');
    if (cached) {
      this.activeProjectId = cached;
      return cached;
    }

    const persistent = this.context.globalState.get<string>('zendbx.activeProjectId');
    if (persistent) {
      this.activeProjectId = persistent;
      console.log('[ProjectService] Loaded active project from globalState:', persistent);
      return persistent;
    }

    console.log('[ProjectService] No active project found');
    return null;
  }

  async listProjectTables(projectId: string) {
    try {
      const client = await this.platformClientService.getClient();
      
      if (!client) {
        return null;
      }

      const response = await client.listProjectTables(projectId);

      if (response.error || !response.data) {
        Logger.error(`Failed to list tables: ${response.error}`);
        return null;
      }

      return response.data;
    } catch (error) {
      Logger.error(`List tables error: ${error}`);
      return null;
    }
  }

  async executeProjectQuery(projectId: string, sql: string, question?: string) {
    try {
      const client = await this.platformClientService.getClient();
      
      if (!client) {
        return null;
      }

      const response = await client.executeProjectQuery(projectId, {
        sql,
        question: question || 'SQL Query',
        enable_autofix: false,
      });

      if (response.error || !response.data) {
        Logger.error(`Query execution failed: ${response.error}`);
        return null;
      }

      return response.data;
    } catch (error) {
      Logger.error(`Execute query error: ${error}`);
      return null;
    }
  }
}
