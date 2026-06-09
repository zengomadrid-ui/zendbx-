import * as vscode from 'vscode';
import { ProjectService } from '../services/ProjectService';
import { ProjectItem } from '../providers/ProjectProvider';
import { Project } from '../sdk/types';
import { Logger } from '../utils/logger';

interface ProjectQuickPickItem extends vscode.QuickPickItem {
  project: Project;
}

async function promptForProjectSelection(projectService: ProjectService): Promise<Project | undefined> {
  const projects = await projectService.listProjects();

  if (projects.length === 0) {
    vscode.window.showWarningMessage('No projects available. Please create a project first.');
    return undefined;
  }

  const picked = await vscode.window.showQuickPick<ProjectQuickPickItem>(
    projects.map((project) => ({
      label: project.name,
      description: project.slug,
      detail: project.description || undefined,
      project,
    })),
    {
      placeHolder: 'Select a project to activate',
      canPickMany: false,
    }
  );

  return picked?.project;
}

export async function selectProjectCommand(
  projectService: ProjectService,
  projectItem: ProjectItem | undefined,
  onProjectSelected: () => void
): Promise<void> {
  try {
    console.log('Selected item:', projectItem);
    console.log('Selected project keys:', Object.keys(projectItem || {}));
    console.log('projectId:', projectItem?.projectId);
    console.log('id:', projectItem?.id);

    let projectId = projectItem?.projectId || projectItem?.id;
    let projectLabel = projectItem?.label;

    if (!projectId) {
      const selectedProject = await promptForProjectSelection(projectService);
      if (!selectedProject) {
        return;
      }

      projectId = selectedProject.id;
      projectLabel = selectedProject.name;
    }

    await vscode.window.withProgress(
      {
        location: vscode.ProgressLocation.Notification,
        title: `Activating project: ${projectLabel}`,
        cancellable: false,
      },
      async () => {
        const keys = await projectService.getProjectKeys(projectId!);

        if (!keys) {
          vscode.window.showErrorMessage('Failed to get project keys');
          return;
        }

        projectService.setActiveProject(projectId!);
        Logger.info(`Active project set: ${projectLabel} (${projectId})`);
        
        vscode.window.showInformationMessage(`Active project: ${projectLabel}`);
        
        onProjectSelected();
      }
    );
  } catch (error) {
    Logger.error(`Select project command error: ${error}`);
    vscode.window.showErrorMessage('Failed to select project');
  }
}
