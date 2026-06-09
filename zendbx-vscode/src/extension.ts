import * as vscode from 'vscode';
import { Logger } from './utils/logger';
import { AuthService } from './services/AuthService';
import { ProjectService } from './services/ProjectService';
import { DatabaseService } from './services/DatabaseService';
import { StorageService } from './services/StorageService';
import { ProjectProvider } from './providers/ProjectProvider';
import { DatabaseProvider } from './providers/DatabaseProvider';
import { StorageProvider } from './providers/StorageProvider';
import { StatusBarManager } from './views/StatusBarManager';
import { loginCommand } from './commands/login';
import { logoutCommand } from './commands/logout';
import { createProjectCommand } from './commands/createProject';
import { refreshProjectsCommand } from './commands/refreshProjects';
import { selectProjectCommand } from './commands/selectProject';
import { openDashboardCommand } from './commands/openDashboard';
import { openSQLRunnerCommand } from './commands/openSQLRunner';
import { WelcomePanel } from './webviews/WelcomePanel';

export async function activate(context: vscode.ExtensionContext): Promise<void> {
  Logger.initialize();
  Logger.info('ZendBX extension activating...');
  console.log('ZendBX extension activating...');

  try {

  const authService = AuthService.getInstance(context);
  const projectService = ProjectService.getInstance(context);
  const databaseService = DatabaseService.getInstance(context);
  const storageService = StorageService.getInstance(context);

  const projectProvider = new ProjectProvider(projectService);
  const databaseProvider = new DatabaseProvider(databaseService, projectService);
  const storageProvider = new StorageProvider(storageService, projectService);

  const statusBarManager = new StatusBarManager(context, projectService);

  vscode.window.registerTreeDataProvider('zendbx.projects', projectProvider);
  vscode.window.registerTreeDataProvider('zendbx.database', databaseProvider);
  vscode.window.registerTreeDataProvider('zendbx.storage', storageProvider);

  const refreshAll = () => {
    projectProvider.refresh();
    databaseProvider.refresh();
    storageProvider.refresh();
    statusBarManager.updateStatus();
  };

  context.subscriptions.push(
    vscode.commands.registerCommand('zendbx.login', loginCommand.bind(null, authService, refreshAll))
  );

  context.subscriptions.push(
    vscode.commands.registerCommand('zendbx.logout', async () => {
      await logoutCommand(context, authService, () => {
        statusBarManager.hide();
        refreshAll();
      });
    })
  );

  context.subscriptions.push(
    vscode.commands.registerCommand('zendbx.createProject', async () => {
      await createProjectCommand(projectService, refreshAll);
    })
  );

  context.subscriptions.push(
    vscode.commands.registerCommand('zendbx.refreshProjects', async () => {
      await refreshProjectsCommand(projectProvider);
    })
  );

  context.subscriptions.push(
    vscode.commands.registerCommand('zendbx.selectProject', async (projectItem) => {
      await selectProjectCommand(projectService, projectItem, refreshAll);
    })
  );

  context.subscriptions.push(
    vscode.commands.registerCommand('zendbx.openDashboard', async (projectItem) => {
      await openDashboardCommand(projectItem, projectService);
    })
  );

  context.subscriptions.push(
    vscode.commands.registerCommand('zendbx.openSQLRunner', async () => {
      await openSQLRunnerCommand(context);
    })
  );

  context.subscriptions.push(
    vscode.commands.registerCommand('zendbx.refreshDatabase', async () => {
      databaseProvider.refresh();
    })
  );

  context.subscriptions.push(
    vscode.commands.registerCommand('zendbx.refreshStorage', async () => {
      storageProvider.refresh();
    })
  );

  context.subscriptions.push(
    vscode.commands.registerCommand('zendbx.showWelcome', () => {
      WelcomePanel.createOrShow(context);
    })
  );

    const isAuthenticated = await authService.isAuthenticated();
  
  if (isAuthenticated) {
    Logger.info('User is authenticated, loading projects');
    await statusBarManager.updateStatus();
    refreshAll();
  } else {
    Logger.info('User not authenticated');
    statusBarManager.hide();
    
    const showWelcome = await vscode.window.showInformationMessage(
      'Welcome to ZendBX! Please login to get started.',
      'Login',
      'Show Welcome'
    );

    if (showWelcome === 'Login') {
      vscode.commands.executeCommand('zendbx.login');
    } else if (showWelcome === 'Show Welcome') {
      WelcomePanel.createOrShow(context);
    }
  }

    Logger.info('ZendBX extension activated successfully');
    console.log('ZendBX extension activated successfully');
  }
  catch (err) {
    Logger.error(`Activation error: ${err}`);
    console.error('ZendBX activation error:', err);
    throw err;
  }
}

export function deactivate(): void {
  Logger.info('ZendBX extension deactivating...');
  Logger.dispose();
}
