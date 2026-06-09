import * as vscode from 'vscode';

export class Logger {
  private static outputChannel: vscode.OutputChannel;

  static initialize(): void {
    if (!Logger.outputChannel) {
      Logger.outputChannel = vscode.window.createOutputChannel('ZendBX');
    }
  }

  static info(message: string): void {
    Logger.log('INFO', message);
  }

  static error(message: string): void {
    Logger.log('ERROR', message);
  }

  static warn(message: string): void {
    Logger.log('WARN', message);
  }

  static debug(message: string): void {
    Logger.log('DEBUG', message);
  }

  private static log(level: string, message: string): void {
    if (!Logger.outputChannel) {
      Logger.initialize();
    }

    const timestamp = new Date().toISOString();
    const logMessage = `[${timestamp}] [${level}] ${message}`;
    
    Logger.outputChannel.appendLine(logMessage);
  }

  static show(): void {
    if (Logger.outputChannel) {
      Logger.outputChannel.show();
    }
  }

  static dispose(): void {
    if (Logger.outputChannel) {
      Logger.outputChannel.dispose();
    }
  }
}
