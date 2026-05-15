/**
 * API Client
 * Centralized API request handler with error handling and auth
 */

import { getApiUrl, config } from './config';

export class ApiError extends Error {
  constructor(
    message: string,
    public status: number,
    public data?: any
  ) {
    super(message);
    this.name = 'ApiError';
  }
}

interface RequestOptions extends RequestInit {
  requiresAuth?: boolean;
  timeout?: number;
}

export const apiClient = {
  async request<T = any>(
    endpoint: string,
    options: RequestOptions = {}
  ): Promise<T> {
    const {
      requiresAuth = true, // Changed default to true for better security
      timeout = config.api.timeout,
      headers,
      ...fetchOptions
    } = options;

    const url = getApiUrl(endpoint);
    
    // Production-safe headers handling using Headers API
    const requestHeaders = new Headers({
      'Content-Type': 'application/json',
    });

    // Safely merge custom headers
    if (headers) {
      if (headers instanceof Headers) {
        headers.forEach((value, key) => {
          requestHeaders.set(key, value);
        });
      } else if (Array.isArray(headers)) {
        headers.forEach(([key, value]) => {
          requestHeaders.set(key, value);
        });
      } else {
        Object.entries(headers as Record<string, string>).forEach(([key, value]) => {
          requestHeaders.set(key, value);
        });
      }
    }

    // Add auth token if required
    if (requiresAuth) {
      if (typeof window === 'undefined') {
        throw new ApiError('Not authenticated', 401);
      }
      const token = localStorage.getItem(config.storage.token);
      if (!token) {
        throw new ApiError('Not authenticated', 401);
      }
      requestHeaders.set('Authorization', `Bearer ${token}`);
    }

    // Create abort controller for timeout
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), timeout);

    try {
      const response = await fetch(url, {
        ...fetchOptions,
        headers: requestHeaders,
        signal: controller.signal,
      });

      clearTimeout(timeoutId);

      // Parse response
      const data = await response.json().catch(() => null);

      if (!response.ok) {
        throw new ApiError(
          data?.detail || data?.message || 'Request failed',
          response.status,
          data
        );
      }

      return data as T;
    } catch (error) {
      clearTimeout(timeoutId);

      if (error instanceof ApiError) {
        throw error;
      }

      if (error instanceof Error) {
        if (error.name === 'AbortError') {
          throw new ApiError('Request timeout', 408);
        }
        throw new ApiError(error.message, 0);
      }

      throw new ApiError('Unknown error occurred', 0);
    }
  },

  get<T = any>(endpoint: string, options?: RequestOptions): Promise<T> {
    return this.request<T>(endpoint, { ...options, method: 'GET' });
  },

  post<T = any>(
    endpoint: string,
    body?: any,
    options?: RequestOptions
  ): Promise<T> {
    return this.request<T>(endpoint, {
      ...options,
      method: 'POST',
      body: body ? JSON.stringify(body) : undefined,
    });
  },

  put<T = any>(
    endpoint: string,
    body?: any,
    options?: RequestOptions
  ): Promise<T> {
    return this.request<T>(endpoint, {
      ...options,
      method: 'PUT',
      body: body ? JSON.stringify(body) : undefined,
    });
  },

  delete<T = any>(endpoint: string, options?: RequestOptions): Promise<T> {
    return this.request<T>(endpoint, { ...options, method: 'DELETE' });
  },
};
