/**
 * ZendBX Client - Official SDK Client
 * Uses Route Builder exclusively - no manual URL construction
 */

import { RouteBuilder, createRouteBuilder } from './routes';
import { HttpClient } from './http';
import type { ZendbxResponse } from './types';

export interface ClientConfig {
  apiUrl: string;
  projectSlug: string;
  anonKey: string;
  accessToken?: string;
  autoRefreshToken?: boolean;
}

export interface SignUpData {
  email: string;
  password: string;
  name?: string;
}

export interface SignInData {
  email: string;
  password: string;
}

export interface User {
  id: string;
  email: string;
  username?: string;
  provider: string;
  email_verified: boolean;
  created_at: string;
}

export interface AuthResponse {
  access_token: string;
  user: User;
}

/**
 * ZendBX Client
 * 
 * Usage:
 *   const client = createClient({
 *     apiUrl: "https://api.zendbx.in",
 *     projectSlug: "my-project",
 *     anonKey: "eyJ..."
 *   });
 * 
 *   await client.auth.signUp({ email, password, name });
 */
export class ZendbxClient {
  private readonly routes: RouteBuilder;
  private readonly http: HttpClient;
  public readonly config: ClientConfig;

  constructor(config: ClientConfig) {
    // Validate configuration
    if (!config.apiUrl) {
      throw new Error('ZendbxClient: apiUrl is required');
    }
    if (!config.projectSlug) {
      throw new Error('ZendbxClient: projectSlug is required');
    }
    if (!config.anonKey) {
      throw new Error('ZendbxClient: anonKey is required');
    }

    this.config = config;
    
    // Initialize route builder
    this.routes = createRouteBuilder({
      apiUrl: config.apiUrl,
      projectSlug: config.projectSlug,
    });

    // Initialize HTTP client
    this.http = new HttpClient(
      config.apiUrl,
      config.anonKey,
      config.projectSlug,
      {
        accessToken: config.accessToken,
        autoRefreshToken: config.autoRefreshToken,
      }
    );
  }

  /**
   * Authentication API
   */
  get auth() {
    return {
      /**
       * Sign up a new user
       */
      signUp: async (data: SignUpData): Promise<AuthResponse> => {
        const url = this.routes.auth.signup();
        const response = await this.http.post<AuthResponse>(url, data, { skipAuth: true });
        
        if (response.error) {
          throw new Error(response.error.message || 'Signup failed');
        }
        
        // Store token
        if (response.data?.access_token) {
          this.http.setToken(response.data.access_token);
        }
        
        return response.data!;
      },

      /**
       * Sign in an existing user
       */
      signIn: async (data: SignInData): Promise<AuthResponse> => {
        const url = this.routes.auth.login();
        const response = await this.http.post<AuthResponse>(url, data, { skipAuth: true });
        
        if (response.error) {
          throw new Error(response.error.message || 'Login failed');
        }
        
        // Store token
        if (response.data?.access_token) {
          this.http.setToken(response.data.access_token);
        }
        
        return response.data!;
      },

      /**
       * Get current user
       */
      getUser: async (): Promise<User> => {
        const url = this.routes.auth.user();
        const response = await this.http.get<User>(url);
        
        if (response.error) {
          throw new Error(response.error.message || 'Failed to get user');
        }
        
        return response.data!;
      },

      /**
       * Sign out current user
       */
      signOut: async (): Promise<void> => {
        const url = this.routes.auth.logout();
        await this.http.post(url, {});
        this.http.clearToken();
      },

      /**
       * Get current session token
       */
      getSession: (): string | null => {
        return this.http.token;
      },

      /**
       * Set session token manually
       */
      setSession: (token: string): void => {
        this.http.setToken(token);
      },
    };
  }

  /**
   * REST API (Database Operations)
   */
  from(tableName: string) {
    const url = this.routes.rest.table(tableName);
    
    return {
      /**
       * SELECT query
       */
      select: async (columns: string = '*'): Promise<ZendbxResponse<any[]>> => {
        const selectUrl = `${url}?select=${encodeURIComponent(columns)}`;
        return this.http.get(selectUrl);
      },

      /**
       * INSERT query
       */
      insert: async (data: any | any[]): Promise<ZendbxResponse<any>> => {
        return this.http.post(url, data);
      },

      /**
       * UPDATE query
       */
      update: async (data: any): Promise<ZendbxResponse<any>> => {
        return this.http.patch(url, data);
      },

      /**
       * DELETE query
       */
      delete: async (): Promise<ZendbxResponse<any>> => {
        return this.http.delete(url);
      },

      /**
       * Query builder for filtering
       */
      eq: (column: string, value: any) => {
        // Return builder pattern for chaining
        return this.from(tableName);
      },
    };
  }

  /**
   * Storage API
   */
  get storage() {
    return {
      /**
       * List all buckets
       */
      listBuckets: async () => {
        const url = this.routes.storage.buckets();
        return this.http.get(url);
      },

      /**
       * Create a new bucket
       */
      createBucket: async (name: string, isPublic: boolean = false) => {
        const url = this.routes.storage.buckets();
        return this.http.post(url, { name, is_public: isPublic });
      },

      /**
       * Get bucket operations
       */
      from: (bucketId: string) => ({
        /**
         * List files in bucket
         */
        list: async (path: string = '') => {
          const url = this.routes.storage.files(bucketId);
          return this.http.get(`${url}?path=${encodeURIComponent(path)}`);
        },

        /**
         * Upload file to bucket
         */
        upload: async (path: string, file: File | Blob) => {
          const url = this.routes.storage.upload(bucketId);
          const formData = new FormData();
          formData.append('file', file);
          formData.append('path', path);
          return this.http.post(url, formData);
        },

        /**
         * Delete file from bucket
         */
        remove: async (fileId: string) => {
          const url = this.routes.storage.file(bucketId, fileId);
          return this.http.delete(url);
        },

        /**
         * Get public URL for file
         */
        getPublicUrl: (fileId: string): string => {
          return this.routes.storage.download(bucketId, fileId);
        },
      }),
    };
  }

  /**
   * Realtime subscriptions (Future)
   */
  get realtime() {
    return {
      /**
       * Get websocket URL
       */
      getWebSocketUrl: (): string => {
        return this.routes.realtime.websocket();
      },
    };
  }
}

/**
 * Create a new ZendBX client
 * 
 * @param config - Client configuration
 * @returns ZendbxClient instance
 */
export function createClient(config: ClientConfig): ZendbxClient {
  return new ZendbxClient(config);
}

// Export types
export type { ClientConfig, SignUpData, SignInData, User, AuthResponse };
