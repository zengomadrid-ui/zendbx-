import * as vscode from 'vscode';
import { ProjectItem } from '../providers/ProjectProvider';
import { ProjectService } from '../services/ProjectService';
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
      placeHolder: 'Select a project to open in dashboard',
      canPickMany: false,
    }
  );

  return picked?.project;
}

export async function openDashboardCommand(
  projectItem: ProjectItem | undefined,
  projectService: ProjectService
): Promise<void> {
  try {
    console.log('Selected project:', projectItem);
    console.log('Selected project keys:', Object.keys(projectItem || {}));
    console.log('projectId:', projectItem?.projectId);
    console.log('id:', projectItem?.id);

    const activeId = projectService.getActiveProjectId();
    console.log('[openDashboard] projectItem arg:', projectItem);
    console.log('[openDashboard] projectService.getActiveProjectId():', activeId);

    let selectedProject: Project | undefined;
    let projectIdToUse = projectItem?.projectId || projectItem?.id || activeId;

    if (!projectIdToUse) {
      console.log('[openDashboard] No active project, prompting user to select...');
      selectedProject = await promptForProjectSelection(projectService);
      if (!selectedProject) {
        return;
      }
      projectIdToUse = selectedProject.id;
    }

    const project = selectedProject || await projectService.getProject(projectIdToUse);
    console.log('[openDashboard] Active Project:', project);
    console.log('[openDashboard] Project ID:', project?.id);
    console.log('[openDashboard] Project Slug:', (project as any)?.slug);

    const config = vscode.workspace.getConfiguration('zendbx');
    const apiUrl = config.get<string>('apiUrl') || 'http://localhost:8000';
    
    const dashboardUrl = apiUrl.replace('/api', '').replace(':8000', ':3000');
    const targetUrl = `${dashboardUrl}/dashboard/projects`;

    Logger.info(`Opening dashboard: ${targetUrl}`);
    console.log('[openDashboard] Opening dashboard base page:', targetUrl);
    await vscode.env.openExternal(vscode.Uri.parse(targetUrl));
  } catch (error) {
    Logger.error(`Open dashboard command error: ${error}`);
    vscode.window.showErrorMessage('Failed to open dashboard');
  }
}
