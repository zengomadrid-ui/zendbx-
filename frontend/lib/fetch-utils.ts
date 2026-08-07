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
 * Requires project context - gets from localStorage or uses default project
 */
export const getOAuthUrl = (provider: string, projectSlug?: string): string => {
  // If project slug is provided, use it
  if (projectSlug) {
    return getApiUrl(`oauth/${provider}/${projectSlug}`);
  }
  
  // Try to get from localStorage (for logged-in users switching projects)
  if (typeof window !== 'undefined') {
    const storedSlug = localStorage.getItem('current_project_slug');
    if (storedSlug) {
      return getApiUrl(`oauth/${provider}/${storedSlug}`);
    }
  }
  
  // Default to 'mark-32' project for initial login/signup
  // TODO: Make this configurable or fetch default project from API
  return getApiUrl(`oauth/${provider}/mark-32`);
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
