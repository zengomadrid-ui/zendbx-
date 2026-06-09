import * as vscode from 'vscode';
import { ProjectService } from '../services/ProjectService';

export class StatusBarManager {
  private statusBarItem: vscode.StatusBarItem;
  private projectService: ProjectService;

  constructor(context: vscode.ExtensionContext, projectService: ProjectService) {
    this.projectService = projectService;
    this.statusBarItem = vscode.window.createStatusBarItem(
      vscode.StatusBarAlignment.Left,
      100
    );
    this.statusBarItem.command = 'zendbx.selectProject';
    context.subscriptions.push(this.statusBarItem);
  }

  async updateStatus(): Promise<void> {
    const projectId = this.projectService.getActiveProjectId();

    if (!projectId) {
      this.statusBarItem.text = '$(database) ZendBX: No Project';
      this.statusBarItem.tooltip = 'Click to select a project';
      this.statusBarItem.show();
      return;
    }

    const project = await this.projectService.getProject(projectId);

    if (project) {
      this.statusBarItem.text = `$(database) ZendBX: ${project.name}`;
      this.statusBarItem.tooltip = `Active Project: ${project.name}\nClick to change project`;
    } else {
      this.statusBarItem.text = '$(database) ZendBX: Unknown Project';
      this.statusBarItem.tooltip = 'Click to select a project';
    }

    this.statusBarItem.show();
  }

  hide(): void {
    this.statusBarItem.hide();
  }

  dispose(): void {
    this.statusBarItem.dispose();
  }
}
