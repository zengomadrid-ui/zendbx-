import * as vscode from 'vscode';
import { ProjectService } from '../services/ProjectService';

export class ProjectProvider implements vscode.TreeDataProvider<ProjectItem> {
  private _onDidChangeTreeData: vscode.EventEmitter<ProjectItem | undefined | null | void> = new vscode.EventEmitter<ProjectItem | undefined | null | void>();
  readonly onDidChangeTreeData: vscode.Event<ProjectItem | undefined | null | void> = this._onDidChangeTreeData.event;

  constructor(private projectService: ProjectService) {}

  refresh(): void {
    this._onDidChangeTreeData.fire();
  }

  getTreeItem(element: ProjectItem): vscode.TreeItem {
    return element;
  }

  async getChildren(element?: ProjectItem): Promise<ProjectItem[]> {
    if (!element) {
      const projects = await this.projectService.listProjects();
      
      if (projects.length === 0) {
        return [new ProjectItem('No projects found', '', vscode.TreeItemCollapsibleState.None, 'info')];
      }

      const activeProjectId = this.projectService.getActiveProjectId();
      
      return projects.map(project => {
        const item = new ProjectItem(
          project.name,
          project.id,
          vscode.TreeItemCollapsibleState.None,
          'project'
        );
        
        item.description = project.slug;
        item.tooltip = `${project.name}\n${project.description || 'No description'}`;
        
        if (project.id === activeProjectId) {
          item.iconPath = new vscode.ThemeIcon('check', new vscode.ThemeColor('charts.green'));
        } else {
          item.iconPath = new vscode.ThemeIcon('folder');
        }
        
        return item;
      });
    }

    return [];
  }
}

export class ProjectItem extends vscode.TreeItem {
  constructor(
    public readonly label: string,
    public readonly projectId: string,
    public readonly collapsibleState: vscode.TreeItemCollapsibleState,
    public readonly contextValue: string
  ) {
    super(label, collapsibleState);
    this.id = projectId;
  }
}
