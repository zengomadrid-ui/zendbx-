import * as vscode from 'vscode';
import { ProjectProvider } from '../providers/ProjectProvider';
import { Logger } from '../utils/logger';

export async function refreshProjectsCommand(projectProvider: ProjectProvider): Promise<void> {
  try {
    Logger.info('Refreshing projects...');
    projectProvider.refresh();
    vscode.window.showInformationMessage('Projects refreshed');
  } catch (error) {
    Logger.error(`Refresh projects command error: ${error}`);
    vscode.window.showErrorMessage('Failed to refresh projects');
  }
}
