import * as vscode from 'vscode';
import { AuthService } from '../services/AuthService';
import { Logger } from '../utils/logger';

export async function loginCommand(
  authService: AuthService,
  onLoginSuccess: () => void
): Promise<void> {
  try {
    const email = await vscode.window.showInputBox({
      prompt: 'Enter your email',
      placeHolder: 'user@example.com',
      validateInput: (value) => {
        if (!value || !value.includes('@')) {
          return 'Please enter a valid email address';
        }
        return null;
      },
    });

    if (!email) {
      return;
    }

    const password = await vscode.window.showInputBox({
      prompt: 'Enter your password',
      password: true,
      placeHolder: 'Password',
      validateInput: (value) => {
        if (!value || value.length < 6) {
          return 'Password must be at least 6 characters';
        }
        return null;
      },
    });

    if (!password) {
      return;
    }

    await vscode.window.withProgress(
      {
        location: vscode.ProgressLocation.Notification,
        title: 'Logging in to ZendBX...',
        cancellable: false,
      },
      async () => {
        const success = await authService.login({ email, password });

        if (success) {
          onLoginSuccess();
        }
      }
    );
  } catch (error) {
    Logger.error(`Login command error: ${error}`);
    vscode.window.showErrorMessage('Login failed');
  }
}
