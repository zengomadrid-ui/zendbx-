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
  private _token: string | null = null;

  constructor(apiUrl: string, anonKey: string) {
    this.baseUrl = apiUrl.replace(/\/$/, '');
    this.anonKey = anonKey;
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
    options: RequestOptions = {}
  ): Promise<ZendbxResponse<T>> {
    const url = `${this.baseUrl}${endpoint}`;

    const headers: Record<string, string> = {
      'Content-Type': 'application/json',
      ...(options.headers ?? {}),
    };

    if (!options.skipAuth) {
      const token = this._token ?? this.anonKey;
      if (token) headers['Authorization'] = `Bearer ${token}`;
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
          message: (p?.detail as string) || (p?.message as string) || `HTTP ${response.status}`,
          status: response.status,
          details: payload,
        };
        return { data: null, error };
      }

      return { data: payload as T, error: null };
    } catch (err) {
      return {
        data: null,
        error: { message: (err as Error).message || 'Network error' },
      };
    }
  }

  // ─── localStorage helpers (no-op in Node) ──────────────────────────────────

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
