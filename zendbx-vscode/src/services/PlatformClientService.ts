import * as vscode from 'vscode';
import { PlatformClient, createPlatformClient } from '../sdk/platform-client';
import { AuthService } from './AuthService';

export class PlatformClientService {
  private static instance: PlatformClientService;
  private client: PlatformClient | null = null;
  private authService: AuthService;

  private constructor(context: vscode.ExtensionContext) {
    this.authService = AuthService.getInstance(context);
  }

  static getInstance(context: vscode.ExtensionContext): PlatformClientService {
    if (!PlatformClientService.instance) {
      PlatformClientService.instance = new PlatformClientService(context);
    }
    return PlatformClientService.instance;
  }

  async getClient(): Promise<PlatformClient | null> {
    const jwt = await this.authService.getJWT();
    
    if (!jwt) {
      return null;
    }

    if (!this.client) {
      const apiUrl = this.getApiUrl();
      this.client = createPlatformClient({ apiUrl, jwt });
    }

    return this.client;
  }

  reset(): void {
    this.client = null;
  }

  private getApiUrl(): string {
    const config = vscode.workspace.getConfiguration('zendbx');
    let apiUrl = config.get<string>('apiUrl') || 'http://localhost:8000';
    apiUrl = apiUrl.trim().replace(/\/$/, '');
    if (apiUrl.endsWith('/api')) {
      apiUrl = apiUrl.slice(0, -4);
    }
    return apiUrl;
  }
}
