import * as vscode from 'vscode';
import { AuthService } from '../services/AuthService';
import { PlatformClientService } from '../services/PlatformClientService';
import { ProjectClientService } from '../services/ProjectClientService';
import { Cache } from '../utils/cache';
import { Logger } from '../utils/logger';

export async function logoutCommand(
  context: vscode.ExtensionContext,
  authService: AuthService,
  onLogoutSuccess: () => void
): Promise<void> {
  try {
    const confirm = await vscode.window.showWarningMessage(
      'Are you sure you want to logout?',
      { modal: true },
      'Logout'
    );

    if (confirm !== 'Logout') {
      return;
    }

    await authService.logout();

    PlatformClientService.getInstance(context).reset();
    ProjectClientService.getInstance().clearAll();
    Cache.getInstance().clear();

    Logger.info('User logged out');
    
    onLogoutSuccess();
  } catch (error) {
    Logger.error(`Logout command error: ${error}`);
    vscode.window.showErrorMessage('Logout failed');
  }
}
