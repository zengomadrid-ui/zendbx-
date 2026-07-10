/**
 * ZendBX Client - Official SDK Client
 * Uses Route Builder exclusively - no manual URL construction
 */

import { RouteBuilder, createRouteBuilder } from './routes';
import { HttpClient } from './http';
import { QueryBuilder } from './query-builder-v2';
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
      }
    );
  }

  /**
   * Authentication API - Complete implementation
   */
  get auth() {
    return {
      /**
       * Sign up a new user
       */
      signUp: async (data: SignUpData): Promise<AuthResponse> => {
        const url = this.routes.auth.signup();
        const response = await this.http.post<AuthResponse>(url, data, { 
          skipAuth: false,  // Include apikey header
          allowAnon: true   // Use anon key if no user token
        });
        
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
        const response = await this.http.post<AuthResponse>(url, data, { 
          skipAuth: false,  // Include apikey header
          allowAnon: true   // Use anon key if no user token
        });
        
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
        // Clear token locally (logout endpoint may not exist)
        this.http.clearToken();
        
        // Try to call logout endpoint (may 404, that's okay)
        try {
          const url = this.routes.auth.logout();
          await this.http.post(url, {});
        } catch (error) {
          // Ignore logout endpoint errors - token is cleared locally
        }
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

      /**
       * Refresh access token
       */
      refreshSession: async (): Promise<AuthResponse> => {
        const url = this.routes.auth.refresh();
        const response = await this.http.post<AuthResponse>(url, {});
        
        if (response.error) {
          throw new Error(response.error.message || 'Token refresh failed');
        }
        
        // Store new token
        if (response.data?.access_token) {
          this.http.setToken(response.data.access_token);
        }
        
        return response.data!;
      },

      /**
       * Request password reset email
       */
      resetPasswordForEmail: async (email: string): Promise<{ message: string }> => {
        const url = this.routes.auth.forgotPassword();
        const response = await this.http.post<{ message: string }>(
          url, 
          { email },
          { skipAuth: false, allowAnon: true }
        );
        
        if (response.error) {
          throw new Error(response.error.message || 'Password reset request failed');
        }
        
        return response.data!;
      },

      /**
       * Update password with reset token
       */
      updatePassword: async (token: string, newPassword: string): Promise<{ message: string }> => {
        const url = this.routes.auth.resetPassword();
        const response = await this.http.post<{ message: string }>(
          url,
          { token, password: newPassword },
          { skipAuth: false, allowAnon: true }
        );
        
        if (response.error) {
          throw new Error(response.error.message || 'Password update failed');
        }
        
        return response.data!;
      },

      /**
       * Update current user data
       */
      updateUser: async (data: Partial<User>): Promise<User> => {
        const url = this.routes.auth.user();
        const response = await this.http.patch<User>(url, data);
        
        if (response.error) {
          throw new Error(response.error.message || 'User update failed');
        }
        
        return response.data!;
      },

      /**
       * Verify email with token
       */
      verifyEmail: async (token: string): Promise<{ message: string }> => {
        const url = this.routes.auth.verifyEmail();
        const response = await this.http.post<{ message: string }>(
          url,
          { token },
          { skipAuth: false, allowAnon: true }
        );
        
        if (response.error) {
          throw new Error(response.error.message || 'Email verification failed');
        }
        
        return response.data!;
      },
    };
  }

  /**
   * REST API (Database Operations) with Query Builder
   */
  from<T = any>(tableName: string) {
    const url = this.routes.rest.table(tableName);
    const http = this.http; // Capture for closures
    
    // Create query builder instance
    const builder = new QueryBuilder<T>(this.http, url);
    
    // Add insert method (doesn't use filters)
    (builder as any).insert = async (data: T | T[]): Promise<ZendbxResponse<T>> => {
      return http.post<T>(url, data);
    };
    
    // Add update method - returns a builder with filters
    (builder as any).update = (data: Partial<T>) => {
      const updateBuilder = {
        _filters: [] as Array<{ column: string; operator: string; value: any }>,
        _data: data,
        
        eq(column: string, value: any) {
          this._filters.push({ column, operator: 'eq', value });
          return this;
        },
        
        neq(column: string, value: any) {
          this._filters.push({ column, operator: 'neq', value });
          return this;
        },
        
        then(onfulfilled?: any, onrejected?: any) {
          return this._execute().then(onfulfilled, onrejected);
        },
        
        catch(onrejected: any) {
          return this._execute().catch(onrejected);
        },
        
        async _execute(): Promise<ZendbxResponse<T>> {
          // Build query string from filters
          const params = new URLSearchParams();
          for (const filter of this._filters) {
            params.append(filter.column, `${filter.operator}.${filter.value}`);
          }
          
          const queryUrl = params.toString() ? `${url}?${params.toString()}` : url;
          return http.patch<T>(queryUrl, this._data);
        }
      };
      
      return updateBuilder;
    };
    
    // Add delete method - returns a builder with filters
    (builder as any).delete = () => {
      const deleteBuilder = {
        _filters: [] as Array<{ column: string; operator: string; value: any }>,
        
        eq(column: string, value: any) {
          this._filters.push({ column, operator: 'eq', value });
          return this;
        },
        
        neq(column: string, value: any) {
          this._filters.push({ column, operator: 'neq', value });
          return this;
        },
        
        then(onfulfilled?: any, onrejected?: any) {
          return this._execute().then(onfulfilled, onrejected);
        },
        
        catch(onrejected: any) {
          return this._execute().catch(onrejected);
        },
        
        async _execute(): Promise<ZendbxResponse<void>> {
          // Build query string from filters
          const params = new URLSearchParams();
          for (const filter of this._filters) {
            params.append(filter.column, `${filter.operator}.${filter.value}`);
          }
          
          const queryUrl = params.toString() ? `${url}?${params.toString()}` : url;
          return http.delete(queryUrl);
        }
      };
      
      return deleteBuilder;
    };
    
    return builder;
  }

  /**
   * Storage API - Complete implementation
   */
  get storage() {
    return {
      /**
       * List all buckets
       */
      listBuckets: async (): Promise<ZendbxResponse<any[]>> => {
        const url = this.routes.storage.buckets();
        return this.http.get(url);
      },

      /**
       * Create a new bucket
       */
      createBucket: async (name: string, options?: { public?: boolean }): Promise<ZendbxResponse<any>> => {
        const url = this.routes.storage.buckets();
        return this.http.post(url, { 
          name, 
          is_public: options?.public ?? false 
        });
      },

      /**
       * Get bucket by ID
       */
      getBucket: async (bucketId: string): Promise<ZendbxResponse<any>> => {
        const url = this.routes.storage.bucket(bucketId);
        return this.http.get(url);
      },

      /**
       * Delete bucket
       */
      deleteBucket: async (bucketId: string): Promise<ZendbxResponse<void>> => {
        const url = this.routes.storage.bucket(bucketId);
        return this.http.delete(url);
      },

      /**
       * Get bucket operations
       */
      from: (bucketId: string) => ({
        /**
         * List files in bucket
         */
        list: async (path: string = ''): Promise<ZendbxResponse<any[]>> => {
          const url = this.routes.storage.files(bucketId);
          return this.http.get(`${url}?path=${encodeURIComponent(path)}`);
        },

        /**
         * Upload file to bucket
         */
        upload: async (path: string, file: File | Blob, options?: { 
          contentType?: string;
          cacheControl?: string;
          upsert?: boolean;
        }): Promise<ZendbxResponse<any>> => {
          const url = this.routes.storage.upload(bucketId);
          const formData = new FormData();
          formData.append('file', file);
          formData.append('path', path);
          
          if (options?.contentType) {
            formData.append('contentType', options.contentType);
          }
          if (options?.cacheControl) {
            formData.append('cacheControl', options.cacheControl);
          }
          if (options?.upsert !== undefined) {
            formData.append('upsert', String(options.upsert));
          }
          
          return this.http.requestFormData(url, formData);
        },

        /**
         * Download file from bucket
         */
        download: async (fileId: string): Promise<ZendbxResponse<Blob>> => {
          const url = this.routes.storage.file(bucketId, fileId);
          // Note: This would need special handling for blob responses
          return this.http.get(url);
        },

        /**
         * Delete file from bucket
         */
        remove: async (paths: string[]): Promise<ZendbxResponse<any>> => {
          const url = this.routes.storage.files(bucketId);
          return this.http.delete(url, { body: { paths } } as any);
        },

        /**
         * Get public URL for file
         */
        getPublicUrl: (fileId: string): { data: { publicUrl: string } } => {
          const publicUrl = this.routes.storage.download(bucketId, fileId);
          return {
            data: { publicUrl }
          };
        },

        /**
         * Create signed URL for private file
         */
        createSignedUrl: async (
          fileId: string, 
          expiresIn: number
        ): Promise<ZendbxResponse<{ signedUrl: string }>> => {
          const url = `${this.routes.storage.file(bucketId, fileId)}/sign`;
          return this.http.post(url, { expiresIn });
        },

        /**
         * Move file
         */
        move: async (fromPath: string, toPath: string): Promise<ZendbxResponse<any>> => {
          const url = `${this.routes.storage.files(bucketId)}/move`;
          return this.http.post(url, { fromPath, toPath });
        },

        /**
         * Copy file
         */
        copy: async (fromPath: string, toPath: string): Promise<ZendbxResponse<any>> => {
          const url = `${this.routes.storage.files(bucketId)}/copy`;
          return this.http.post(url, { fromPath, toPath });
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
