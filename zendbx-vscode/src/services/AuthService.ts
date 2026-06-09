import * as vscode from 'vscode';
import { createPlatformClient } from '../sdk/platform-client';
import { LoginRequest } from '../sdk/types';
import { Logger } from '../utils/logger';

export class AuthService {
  private static instance: AuthService;
  private context: vscode.ExtensionContext;
  private jwt: string | null = null;
  private readonly JWT_KEY = 'zendbx.jwt';

  private constructor(context: vscode.ExtensionContext) {
    this.context = context;
  }

  static getInstance(context: vscode.ExtensionContext): AuthService {
    if (!AuthService.instance) {
      AuthService.instance = new AuthService(context);
    }
    return AuthService.instance;
  }

  async login(credentials: LoginRequest): Promise<boolean> {
    try {
      const apiUrl = this.getApiUrl();
      
      const tempClient = createPlatformClient({
        apiUrl,
        jwt: 'temp',
      });

      const response = await tempClient.login(credentials);

      if (response.error || !response.data) {
        Logger.error(`Login failed: ${response.error}`);
        vscode.window.showErrorMessage(`Login failed: ${response.error || 'Unknown error'}`);
        return false;
      }

      this.jwt = response.data.access_token;
      await this.context.secrets.store(this.JWT_KEY, this.jwt);

      Logger.info(`User logged in: ${response.data.user.email}`);
      vscode.window.showInformationMessage(`Welcome, ${response.data.user.email}!`);
      
      return true;
    } catch (error) {
      Logger.error(`Login error: ${error}`);
      vscode.window.showErrorMessage('Login failed. Please try again.');
      return false;
    }
  }

  async logout(): Promise<void> {
    try {
      if (this.jwt) {
        const apiUrl = this.getApiUrl();
        const client = createPlatformClient({ apiUrl, jwt: this.jwt });
        await client.logout();
      }

      this.jwt = null;
      await this.context.secrets.delete(this.JWT_KEY);
      
      Logger.info('User logged out');
      vscode.window.showInformationMessage('Logged out successfully');
    } catch (error) {
      Logger.error(`Logout error: ${error}`);
      this.jwt = null;
      await this.context.secrets.delete(this.JWT_KEY);
    }
  }

  async getJWT(): Promise<string | null> {
    if (this.jwt) {
      return this.jwt;
    }

    this.jwt = await this.context.secrets.get(this.JWT_KEY) || null;
    return this.jwt;
  }

  async isAuthenticated(): Promise<boolean> {
    const jwt = await this.getJWT();
    return jwt !== null;
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
