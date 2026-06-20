/**
 * Production-safe fetch utilities
 * Centralized fetch helpers with environment-aware URLs
 */

import { config, getApiUrl, getWsUrl } from './config';

// Re-export getApiUrl so pages can import it from a single location
export { getApiUrl };

/**
 * Get auth headers for API requests
 * Safe for SSR - returns empty object on server
 */
export const getAuthHeaders = (): Record<string, string> => {
  if (typeof window === 'undefined') {
    return {};
  }
  
  const token = localStorage.getItem(config.storage.token);
  if (!token) {
    return {};
  }
  
  return {
    'Authorization': `Bearer ${token}`,
  };
};

/**
 * Production-safe fetch wrapper
 * Automatically uses environment-based API URL
 */
export const apiFetch = async (
  endpoint: string,
  options: RequestInit = {}
): Promise<Response> => {
  const url = getApiUrl(endpoint);
  
  const headers = {
    'Content-Type': 'application/json',
    ...getAuthHeaders(),
    ...(options.headers || {}),
  };
  
  return fetch(url, {
    ...options,
    headers,
  });
};

/**
 * Get OAuth provider URL
 */
export const getOAuthUrl = (provider: string): string => {
  return getApiUrl(`api/auth/oauth/${provider}/login`);
};

/**
 * Get WebSocket URL for realtime connections
 */
export const getRealtimeWsUrl = (): string => {
  return getWsUrl();
};

/**
 * Get callback URL for OAuth
 */
export const getCallbackUrl = (): string => {
  return `${config.app.url}/callback`;
};
