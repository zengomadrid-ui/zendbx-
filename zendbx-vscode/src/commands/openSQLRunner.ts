import * as vscode from 'vscode';
import { SQLRunnerPanel } from '../webviews/SQLRunnerPanel';
import { Logger } from '../utils/logger';

export async function openSQLRunnerCommand(
  context: vscode.ExtensionContext
): Promise<void> {
  try {
    Logger.info('Opening SQL Runner');
    SQLRunnerPanel.createOrShow(context);
  } catch (error) {
    Logger.error(`Open SQL Runner command error: ${error}`);
    vscode.window.showErrorMessage('Failed to open SQL Runner');
  }
}
