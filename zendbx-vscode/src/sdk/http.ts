import axios, { AxiosInstance, AxiosError, AxiosRequestConfig } from 'axios';
import { HttpClientConfig, ApiResponse } from './types';

export class HttpClient {
  private client: AxiosInstance;
  private authMode: 'jwt' | 'api-key';
  private authValue: string;

  constructor(config: HttpClientConfig) {
    this.authMode = config.authMode;
    this.authValue = config.authValue;

    this.client = axios.create({
      baseURL: config.baseUrl,
      timeout: config.timeout || 30000,
      headers: {
        'Content-Type': 'application/json',
        Accept: 'application/json',
      },
    });

    this.client.interceptors.request.use((requestConfig) => {
      if (this.authMode === 'jwt') {
        requestConfig.headers.Authorization = `Bearer ${this.authValue}`;
      } else if (this.authMode === 'api-key') {
        requestConfig.headers['x-api-key'] = this.authValue;
        requestConfig.headers.apikey = this.authValue;
        requestConfig.headers.Authorization = `Bearer ${this.authValue}`;
      }

      // Debug: log outgoing request url and headers
      try {
        console.log('[HttpClient] Request:', requestConfig.method?.toUpperCase(), requestConfig.baseURL + (requestConfig.url || ''));
        console.log('[HttpClient] Headers:', requestConfig.headers);
      } catch (e) {
        // ignore
      }

      return requestConfig;
    });
  }

  async get<T>(url: string, config?: AxiosRequestConfig): Promise<ApiResponse<T>> {
    try {
      const response = await this.client.get<T>(url, config);
      return { data: response.data };
    } catch (error) {
      return this.handleError<T>(error);
    }
  }

  async post<T>(url: string, data?: unknown, config?: AxiosRequestConfig): Promise<ApiResponse<T>> {
    try {
      const response = await this.client.post<T>(url, data, config);
      return { data: response.data };
    } catch (error) {
      return this.handleError<T>(error);
    }
  }

  async put<T>(url: string, data?: unknown, config?: AxiosRequestConfig): Promise<ApiResponse<T>> {
    try {
      const response = await this.client.put<T>(url, data, config);
      return { data: response.data };
    } catch (error) {
      return this.handleError<T>(error);
    }
  }

  async delete<T>(url: string, config?: AxiosRequestConfig): Promise<ApiResponse<T>> {
    try {
      const response = await this.client.delete<T>(url, config);
      return { data: response.data };
    } catch (error) {
      return this.handleError<T>(error);
    }
  }

  private handleError<T>(error: unknown): ApiResponse<T> {
    if (axios.isAxiosError(error)) {
      const axiosError = error as AxiosError;
      const message = axiosError.response?.data 
        ? JSON.stringify(axiosError.response.data)
        : axiosError.message;
      // Debug: log error response
      try {
        console.error('[HttpClient] Error response:', axiosError.response?.status, axiosError.response?.data);
      } catch (e) {}
      return {
        error: message,
        message: axiosError.response?.statusText || 'Request failed',
      };
    }

    return {
      error: String(error),
      message: 'An unknown error occurred',
    };
  }

  updateAuth(authMode: 'jwt' | 'api-key', authValue: string): void {
    this.authMode = authMode;
    this.authValue = authValue;
  }
}
