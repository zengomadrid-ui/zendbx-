import * as vscode from 'vscode';
import { DatabaseService } from '../services/DatabaseService';
import { ProjectService } from '../services/ProjectService';

export class DatabaseProvider implements vscode.TreeDataProvider<DatabaseItem> {
  private _onDidChangeTreeData: vscode.EventEmitter<DatabaseItem | undefined | null | void> = new vscode.EventEmitter<DatabaseItem | undefined | null | void>();
  readonly onDidChangeTreeData: vscode.Event<DatabaseItem | undefined | null | void> = this._onDidChangeTreeData.event;

  constructor(
    private databaseService: DatabaseService,
    private projectService: ProjectService
  ) {}

  refresh(): void {
    this._onDidChangeTreeData.fire();
  }

  getTreeItem(element: DatabaseItem): vscode.TreeItem {
    return element;
  }

  async getChildren(element?: DatabaseItem): Promise<DatabaseItem[]> {
    if (!element) {
      const projectId = this.projectService.getActiveProjectId();
      
      if (!projectId) {
        return [new DatabaseItem('Select a project first', '', vscode.TreeItemCollapsibleState.None, 'info')];
      }

      const tables = await this.databaseService.listTables();
      
      if (tables.length === 0) {
        return [new DatabaseItem('No tables found', '', vscode.TreeItemCollapsibleState.None, 'info')];
      }

      return tables.map(table => {
        const item = new DatabaseItem(
          table.table_name,
          table.table_name,
          vscode.TreeItemCollapsibleState.None,
          'table'
        );
        
        item.description = table.table_schema;
        item.tooltip = `${table.table_schema}.${table.table_name} (${table.table_type})`;
        item.iconPath = new vscode.ThemeIcon('table');
        
        return item;
      });
    }

    return [];
  }
}

export class DatabaseItem extends vscode.TreeItem {
  constructor(
    public readonly label: string,
    public readonly tableName: string,
    public readonly collapsibleState: vscode.TreeItemCollapsibleState,
    public readonly contextValue: string
  ) {
    super(label, collapsibleState);
  }
}
