import * as vscode from 'vscode';
import { ProjectService } from '../services/ProjectService';
import { Logger } from '../utils/logger';

export async function createProjectCommand(
  projectService: ProjectService,
  onProjectCreated: () => void
): Promise<void> {
  try {
    const name = await vscode.window.showInputBox({
      prompt: 'Enter project name',
      placeHolder: 'my-awesome-project',
      validateInput: (value) => {
        if (!value || value.trim().length === 0) {
          return 'Project name is required';
        }
        if (value.length < 3) {
          return 'Project name must be at least 3 characters';
        }
        return null;
      },
    });

    if (!name) {
      return;
    }

    const description = await vscode.window.showInputBox({
      prompt: 'Enter project description (optional)',
      placeHolder: 'A brief description of your project',
    });

    await vscode.window.withProgress(
      {
        location: vscode.ProgressLocation.Notification,
        title: 'Creating project...',
        cancellable: false,
      },
      async () => {
        const project = await projectService.createProject({
          name: name.trim(),
          description: description?.trim(),
        });

        if (project) {
          Logger.info(`Project created: ${project.id}`);
          onProjectCreated();
        }
      }
    );
  } catch (error) {
    Logger.error(`Create project command error: ${error}`);
    vscode.window.showErrorMessage('Failed to create project');
  }
}
