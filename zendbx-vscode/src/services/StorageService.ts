import * as vscode from 'vscode';
import { ProjectClientService } from './ProjectClientService';
import { ProjectService } from './ProjectService';
import { StorageBucket, StorageFile } from '../sdk/types';
import { Logger } from '../utils/logger';
import { Cache } from '../utils/cache';

export class StorageService {
  private static instance: StorageService;
  private projectClientService: ProjectClientService;
  private projectService: ProjectService;
  private cache: Cache;

  private constructor(context: vscode.ExtensionContext) {
    this.projectClientService = ProjectClientService.getInstance();
    this.projectService = ProjectService.getInstance(context);
    this.cache = Cache.getInstance();
  }

  static getInstance(context: vscode.ExtensionContext): StorageService {
    if (!StorageService.instance) {
      StorageService.instance = new StorageService(context);
    }
    return StorageService.instance;
  }

  async listBuckets(): Promise<StorageBucket[]> {
    try {
      const projectId = this.projectService.getActiveProjectId();
      
      if (!projectId) {
        vscode.window.showWarningMessage('Please select a project first');
        return [];
      }

      const keys = await this.projectService.getProjectKeys(projectId);

      console.log('[StorageService] listBuckets - projectId:', projectId);
      console.log('[StorageService] project keys present:', !!keys);
      console.log('[StorageService] anon_key:', keys?.anon_key);
      
      if (!keys) {
        vscode.window.showErrorMessage('Failed to get project keys');
        return [];
      }

      const client = await this.projectClientService.getClient(projectId, keys.anon_key);
      const response = await client.listBuckets();
      console.log('[StorageService] listBuckets response:', response);

      if (response.error || !response.data) {
        Logger.error(`Failed to list buckets: ${response.error}`);
        vscode.window.showErrorMessage('Failed to load buckets');
        return [];
      }

      const cacheKey = `buckets-${projectId}`;
      this.cache.set(cacheKey, response.data);
      
      return response.data;
    } catch (error) {
      Logger.error(`List buckets error: ${error}`);
      return [];
    }
  }

  async createBucket(name: string, isPublic = false): Promise<StorageBucket | null> {
    try {
      const projectId = this.projectService.getActiveProjectId();
      
      if (!projectId) {
        vscode.window.showWarningMessage('Please select a project first');
        return null;
      }

      const keys = await this.projectService.getProjectKeys(projectId);
      
      if (!keys) {
        return null;
      }

      const client = await this.projectClientService.getClient(projectId, keys.anon_key);
      const response = await client.createBucket(name, isPublic);

      if (response.error || !response.data) {
        Logger.error(`Failed to create bucket: ${response.error}`);
        vscode.window.showErrorMessage(`Failed to create bucket: ${response.error}`);
        return null;
      }

      Logger.info(`Bucket created: ${name}`);
      vscode.window.showInformationMessage(`Bucket "${name}" created successfully`);
      
      const cacheKey = `buckets-${projectId}`;
      this.cache.delete(cacheKey);
      
      return response.data;
    } catch (error) {
      Logger.error(`Create bucket error: ${error}`);
      return null;
    }
  }

  async deleteBucket(bucketId: string): Promise<boolean> {
    try {
      const projectId = this.projectService.getActiveProjectId();
      
      if (!projectId) {
        return false;
      }

      const keys = await this.projectService.getProjectKeys(projectId);
      
      if (!keys) {
        return false;
      }

      const client = await this.projectClientService.getClient(projectId, keys.anon_key);
      const response = await client.deleteBucket(bucketId);

      if (response.error) {
        Logger.error(`Failed to delete bucket: ${response.error}`);
        vscode.window.showErrorMessage('Failed to delete bucket');
        return false;
      }

      Logger.info(`Bucket deleted: ${bucketId}`);
      vscode.window.showInformationMessage('Bucket deleted successfully');
      
      const cacheKey = `buckets-${projectId}`;
      this.cache.delete(cacheKey);
      
      return true;
    } catch (error) {
      Logger.error(`Delete bucket error: ${error}`);
      return false;
    }
  }

  async listFiles(bucketId: string, path = ''): Promise<StorageFile[]> {
    try {
      const projectId = this.projectService.getActiveProjectId();
      
      if (!projectId) {
        return [];
      }

      const keys = await this.projectService.getProjectKeys(projectId);
      
      if (!keys) {
        return [];
      }

      const client = await this.projectClientService.getClient(projectId, keys.anon_key);
      const response = await client.listFiles(bucketId, path);

      if (response.error || !response.data) {
        Logger.error(`Failed to list files: ${response.error}`);
        return [];
      }

      return response.data;
    } catch (error) {
      Logger.error(`List files error: ${error}`);
      return [];
    }
  }
}
