import type { ZendbxResponse } from './types';

export interface RequestOptions {
  method?: string;
  body?: unknown;
  headers?: Record<string, string>;
  skipAuth?: boolean;
  allowAnon?: boolean;
}

export interface HttpClientOptions {
  accessToken?: string;
  getAccessToken?: () => string | null | Promise<string | null>;
  storageKey?: string | null;
}

export class HttpClient {
  readonly baseUrl: string;
  private readonly anonKey: string;
  private readonly projectSlug: string;
  private _token: string | null = null;
  private readonly _getAccessToken: (() => string | null | Promise<string | null>) | null;
  private readonly _storageKey: string | null;

  constructor(
    apiUrl: string,
    anonKey: string,
    projectSlug: string,
    opts: HttpClientOptions = {},
  ) {
    this.baseUrl = apiUrl.replace(/\/$/, '');
    this.anonKey = anonKey;
    this.projectSlug = projectSlug;
    this._getAccessToken = opts.getAccessToken ?? null;
    this._storageKey = opts.storageKey !== undefined ? opts.storageKey : 'zendbx_token';
    if (opts.accessToken) {
      this._token = opts.accessToken;
    } else {
      this._loadStoredToken();
    }
  }

  get token(): string | null {
    return this._token;
  }

  setToken(token: string): void {
    this._token = token;
    if (this._storageKey) this._persist(this._storageKey, token);
  }

  clearToken(): void {
    this._token = null;
    if (this._storageKey) this._clear(this._storageKey);
  }

  async resolveToken(): Promise<string | null> {
    if (this._token) return this._token;
    if (this._getAccessToken) {
      const t = await this._getAccessToken();
      if (t) return t;
    }
    return null;
  }

  async get<T = unknown>(endpoint: string, options: RequestOptions = {}): Promise<ZendbxResponse<T>> {
    return this.request<T>(endpoint, { ...options, method: 'GET' });
  }

  async post<T = unknown>(endpoint: string, body?: unknown, options: RequestOptions = {}): Promise<ZendbxResponse<T>> {
    return this.request<T>(endpoint, { ...options, method: 'POST', body });
  }

  async patch<T = unknown>(endpoint: string, body?: unknown, options: RequestOptions = {}): Promise<ZendbxResponse<T>> {
    return this.request<T>(endpoint, { ...options, method: 'PATCH', body });
  }

  async delete<T = unknown>(endpoint: string, options: RequestOptions = {}): Promise<ZendbxResponse<T>> {
    return this.request<T>(endpoint, { ...options, method: 'DELETE' });
  }

  async request<T = unknown>(
    endpoint: string,
    options: RequestOptions = {},
  ): Promise<ZendbxResponse<T>> {
    // If endpoint is already a full URL, use it as-is; otherwise prepend baseUrl
    const url = endpoint.startsWith('http://') || endpoint.startsWith('https://') 
      ? endpoint 
      : `${this.baseUrl}${endpoint}`;
    
    const headers: Record<string, string> = {
      'Content-Type': 'application/json',
      ...(options.headers ?? {}),
    };

    if (!options.skipAuth) {
      headers['apikey'] = this.anonKey;
      const userToken = await this.resolveToken();
      if (userToken) {
        headers['Authorization'] = `Bearer ${userToken}`;
      } else if (options.allowAnon) {
        headers['Authorization'] = `Bearer ${this.anonKey}`;
      } else {
        return {
          data: null,
          error: {
            message: 'No authenticated session. Call auth.signIn() or provide getAccessToken() in createClient().',
            status: 401,
          },
        };
      }
    }

    try {
      const response = await fetch(url, {
        method: options.method ?? 'GET',
        headers,
        body: options.body !== undefined ? JSON.stringify(options.body) : undefined,
      });
      let payload: unknown;
      try { payload = await response.json(); } catch { payload = null; }
      if (!response.ok) {
        const p = payload as Record<string, unknown> | null;
        return { data: null, error: { message: this._msg(response.status, p), status: response.status, details: payload } };
      }
      return { data: payload as T, error: null };
    } catch (err) {
      return { data: null, error: { message: (err as Error).message || 'Network error.' } };
    }
  }

  async requestFormData<T = unknown>(
    endpoint: string,
    formData: FormData,
  ): Promise<ZendbxResponse<T>> {
    const userToken = await this.resolveToken();
    if (!userToken) {
      return {
        data: null,
        error: {
          message: 'No authenticated session. Call auth.signIn() or provide getAccessToken() in createClient().',
          status: 401,
        },
      };
    }
    
    // If endpoint is already a full URL, use it as-is; otherwise prepend baseUrl
    const url = endpoint.startsWith('http://') || endpoint.startsWith('https://') 
      ? endpoint 
      : `${this.baseUrl}${endpoint}`;
      
    const headers: Record<string, string> = {
      apikey: this.anonKey,
      Authorization: `Bearer ${userToken}`,
    };
    try {
      const response = await fetch(url, { method: 'POST', headers, body: formData });
      let payload: unknown;
      try { payload = await response.json(); } catch { payload = null; }
      if (!response.ok) {
        const p = payload as Record<string, unknown> | null;
        return { data: null, error: { message: this._msg(response.status, p), status: response.status, details: payload } };
      }
      return { data: payload as T, error: null };
    } catch (err) {
      return { data: null, error: { message: (err as Error).message || 'Network error during upload.' } };
    }
  }

  async requestRaw(endpoint: string): Promise<Response> {
    const userToken = await this.resolveToken();
    const url = `${this.baseUrl}${endpoint}`;
    return fetch(url, {
      headers: {
        apikey: this.anonKey,
        Authorization: `Bearer ${userToken ?? this.anonKey}`,
      },
    });
  }

  private _msg(status: number, payload: Record<string, unknown> | null): string {
    const s = (payload?.detail as string) || (payload?.message as string);
    if (s) return s;
    switch (status) {
      case 400: return 'Bad request.';
      case 401: return 'Authentication token expired or invalid. Call client.auth.signIn() to get a new token.';
      case 403: return 'Permission denied.';
      case 404: return 'Resource not found.';
      case 409: return 'Conflict — a resource with this name already exists.';
      case 413: return 'File too large or storage quota exceeded.';
      case 503: return 'Storage provider unavailable.';
      default:  return `HTTP ${status} error.`;
    }
  }

  private _loadStoredToken(): void {
    if (this._storageKey && typeof window !== 'undefined' && window.localStorage) {
      const stored = localStorage.getItem(this._storageKey);
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
