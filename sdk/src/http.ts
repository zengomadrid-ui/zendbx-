import type { ZendbxResponse, ZendbxError } from './types';

export interface RequestOptions {
  method?: string;
  body?: unknown;
  headers?: Record<string, string>;
  /** Skip adding auth header (for public endpoints) */
  skipAuth?: boolean;
}

export class HttpClient {
  /** @internal exposed for modules that need to build absolute URLs (e.g. storage) */
  readonly baseUrl: string;
  private anonKey: string;
  private projectId: string;
  private _token: string | null = null;

  constructor(apiUrl: string, anonKey: string, projectId: string) {
    this.baseUrl = apiUrl.replace(/\/$/, '');
    this.anonKey = anonKey;
    this.projectId = projectId;
    this._loadStoredToken();
  }

  get token(): string | null {
    return this._token;
  }

  setToken(token: string): void {
    this._token = token;
    this._persist('zendbx_token', token);
  }

  clearToken(): void {
    this._token = null;
    this._clear('zendbx_token');
  }

  async request<T = unknown>(
    endpoint: string,
    options: RequestOptions = {},
  ): Promise<ZendbxResponse<T>> {
    const url = `${this.baseUrl}${endpoint}`;

    const headers: Record<string, string> = {
      'Content-Type': 'application/json',
      ...(options.headers ?? {}),
    };

    if (!options.skipAuth) {
      headers['apikey'] = this.anonKey;
      const authToken = this._token ?? this.anonKey;
      headers['Authorization'] = `Bearer ${authToken}`;
    }

    try {
      const response = await fetch(url, {
        method: options.method ?? 'GET',
        headers,
        body: options.body !== undefined ? JSON.stringify(options.body) : undefined,
      });

      let payload: unknown;
      try {
        payload = await response.json();
      } catch {
        payload = null;
      }

      if (!response.ok) {
        const p = payload as Record<string, unknown> | null;
        const error: ZendbxError = {
          message: this._friendlyMessage(response.status, p),
          status: response.status,
          details: payload,
        };
        return { data: null, error };
      }

      return { data: payload as T, error: null };
    } catch (err) {
      return {
        data: null,
        error: { message: (err as Error).message || 'Network error — check your API URL and internet connection.' },
      };
    }
  }

  /**
   * Upload multipart/form-data. Does NOT set Content-Type — browser sets the correct boundary.
   */
  async requestFormData<T = unknown>(
    endpoint: string,
    formData: FormData,
  ): Promise<ZendbxResponse<T>> {
    const url = `${this.baseUrl}${endpoint}`;
    const headers: Record<string, string> = {
      apikey: this.anonKey,
      Authorization: `Bearer ${this._token ?? this.anonKey}`,
    };

    try {
      const response = await fetch(url, {
        method: 'POST',
        headers,
        body: formData,
      });

      let payload: unknown;
      try {
        payload = await response.json();
      } catch {
        payload = null;
      }

      if (!response.ok) {
        const p = payload as Record<string, unknown> | null;
        return {
          data: null,
          error: {
            message: this._friendlyMessage(response.status, p),
            status: response.status,
            details: payload,
          },
        };
      }

      return { data: payload as T, error: null };
    } catch (err) {
      return {
        data: null,
        error: { message: (err as Error).message || 'Network error during file upload.' },
      };
    }
  }

  /**
   * Return raw Response for streaming downloads.
   */
  async requestRaw(endpoint: string): Promise<Response> {
    const url = `${this.baseUrl}${endpoint}`;
    return fetch(url, {
      headers: {
        apikey: this.anonKey,
        Authorization: `Bearer ${this._token ?? this.anonKey}`,
      },
    });
  }

  // ─── Private helpers ───────────────────────────────────────────────────────

  private _friendlyMessage(status: number, payload: Record<string, unknown> | null): string {
    const serverMsg = (payload?.detail as string) || (payload?.message as string);
    if (serverMsg) return serverMsg;

    switch (status) {
      case 400: return 'Bad request — check the data you are sending.';
      case 401: return 'Authentication token expired or invalid. Call client.auth.signIn() to get a new token.';
      case 403: return 'Permission denied — you do not have access to this resource.';
      case 404: return 'Resource not found — check your project slug, bucket name, or file ID.';
      case 409: return 'Conflict — a resource with this name already exists.';
      case 413: return 'File too large or storage quota exceeded.';
      case 415: return 'Unsupported file type — check the MIME type of the file you are uploading.';
      case 503: return 'Storage provider unavailable — configure B2_KEY_ID and B2_APPLICATION_KEY on the server.';
      default:  return `HTTP ${status} error.`;
    }
  }

  private _loadStoredToken(): void {
    if (typeof window !== 'undefined' && window.localStorage) {
      const stored = localStorage.getItem('zendbx_token');
      if (stored) this._token = stored;
    }
  }

  private _persist(key: string, value: string): void {
    if (typeof window !== 'undefined' && window.localStorage) {
      localStorage.setItem(key, value);
    }
  }

  private _clear(key: string): void {
    if (typeof window !== 'undefined' && window.localStorage) {
      localStorage.removeItem(key);
    }
  }
}
