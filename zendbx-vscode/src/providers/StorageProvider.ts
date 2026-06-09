import * as vscode from 'vscode';
import { StorageService } from '../services/StorageService';
import { ProjectService } from '../services/ProjectService';

export class StorageProvider implements vscode.TreeDataProvider<StorageItem> {
  private _onDidChangeTreeData: vscode.EventEmitter<StorageItem | undefined | null | void> = new vscode.EventEmitter<StorageItem | undefined | null | void>();
  readonly onDidChangeTreeData: vscode.Event<StorageItem | undefined | null | void> = this._onDidChangeTreeData.event;

  constructor(
    private storageService: StorageService,
    private projectService: ProjectService
  ) {}

  refresh(): void {
    this._onDidChangeTreeData.fire();
  }

  getTreeItem(element: StorageItem): vscode.TreeItem {
    return element;
  }

  async getChildren(element?: StorageItem): Promise<StorageItem[]> {
    if (!element) {
      const projectId = this.projectService.getActiveProjectId();
      
      if (!projectId) {
        return [new StorageItem('Select a project first', '', vscode.TreeItemCollapsibleState.None, 'info')];
      }

      const buckets = await this.storageService.listBuckets();
      
      if (buckets.length === 0) {
        return [new StorageItem('No buckets found', '', vscode.TreeItemCollapsibleState.None, 'info')];
      }

      return buckets.map(bucket => {
        const item = new StorageItem(
          bucket.name,
          bucket.id,
          vscode.TreeItemCollapsibleState.Collapsed,
          'bucket'
        );
        
        item.description = bucket.public ? 'Public' : 'Private';
        item.tooltip = `${bucket.name} (${bucket.public ? 'Public' : 'Private'})`;
        item.iconPath = new vscode.ThemeIcon('folder');
        
        return item;
      });
    }

    if (element.contextValue === 'bucket') {
      const files = await this.storageService.listFiles(element.bucketId);
      
      return files.map(file => {
        const item = new StorageItem(
          file.name,
          file.id,
          vscode.TreeItemCollapsibleState.None,
          'file'
        );
        
        item.tooltip = `${file.name}\nCreated: ${file.created_at}`;
        item.iconPath = new vscode.ThemeIcon('file');
        
        return item;
      });
    }

    return [];
  }
}

export class StorageItem extends vscode.TreeItem {
  constructor(
    public readonly label: string,
    public readonly bucketId: string,
    public readonly collapsibleState: vscode.TreeItemCollapsibleState,
    public readonly contextValue: string
  ) {
    super(label, collapsibleState);
  }
}
