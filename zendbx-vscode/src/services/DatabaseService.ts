import * as vscode from 'vscode';
import { ProjectService } from './ProjectService';
import { DatabaseTable, QueryResult } from '../sdk/types';
import { Logger } from '../utils/logger';
import { Cache } from '../utils/cache';

export class DatabaseService {
  private static instance: DatabaseService;
  private projectService: ProjectService;
  private cache: Cache;

  private constructor(context: vscode.ExtensionContext) {
    this.projectService = ProjectService.getInstance(context);
    this.cache = Cache.getInstance();
  }

  static getInstance(context: vscode.ExtensionContext): DatabaseService {
    if (!DatabaseService.instance) {
      DatabaseService.instance = new DatabaseService(context);
    }
    return DatabaseService.instance;
  }

  async listTables(): Promise<DatabaseTable[]> {
    try {
      const projectId = await this.projectService.ensureActiveProject();
      
      if (!projectId) {
        vscode.window.showWarningMessage('Please select a project first');
        return [];
      }

      console.log('[DatabaseService] listTables - projectId:', projectId);
      
      const tables = await this.projectService.listProjectTables(projectId);

      if (!tables) {
        vscode.window.showErrorMessage('Failed to load tables');
        return [];
      }

      const cacheKey = `tables-${projectId}`;
      this.cache.set(cacheKey, tables);
      
      return tables;
    } catch (error) {
      Logger.error(`List tables error: ${error}`);
      return [];
    }
  }

  async executeQuery(sql: string): Promise<QueryResult | null> {
    try {
      const projectId = await this.projectService.ensureActiveProject();
      
      if (!projectId) {
        vscode.window.showWarningMessage('Please select a project first');
        return null;
      }

      const result = await this.projectService.executeProjectQuery(projectId, sql);

      if (!result) {
        vscode.window.showErrorMessage('Query execution failed');
        return null;
      }

      Logger.info(`Query executed successfully: ${result.row_count} rows`);
      return result;
    } catch (error) {
      Logger.error(`Execute query error: ${error}`);
      vscode.window.showErrorMessage('Query execution failed');
      return null;
    }
  }

  async getTableData(tableName: string, limit = 100): Promise<QueryResult | null> {
    try {
      const projectId = await this.projectService.ensureActiveProject();
      
      if (!projectId) {
        return null;
      }

      const sql = `SELECT * FROM ${tableName} LIMIT ${limit}`;
      const result = await this.projectService.executeProjectQuery(projectId, sql, `Get table data: ${tableName}`);

      if (!result) {
        Logger.error('Failed to get table data');
        return null;
      }

      return result;
    } catch (error) {
      Logger.error(`Get table data error: ${error}`);
      return null;
    }
  }
}
