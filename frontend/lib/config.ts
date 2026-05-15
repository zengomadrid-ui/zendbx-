/**
 * Application Configuration
 * Centralized configuration for API endpoints and app settings
 */

// Helper to get environment variable with fallback
const getEnvVar = (key: string, fallback: string): string => {
  if (typeof window === 'undefined') {
    // Server-side
    return process.env[key] || fallback;
  }
  // Client-side - Next.js injects NEXT_PUBLIC_ vars
  return process.env[key] || fallback;
};

export const config = {
  // API Configuration
  api: {
    baseUrl: getEnvVar('NEXT_PUBLIC_API_URL', 'http://localhost:8000'),
    wsUrl: getEnvVar('NEXT_PUBLIC_WS_URL', 'http://localhost:8001'),
    timeout: 30000, // 30 seconds
  },

  // App Configuration
  app: {
    name: 'ZenDBX',
    description: 'Backend-as-a-Service with AI-powered database management',
    url: getEnvVar('NEXT_PUBLIC_APP_URL', 'http://localhost:3000'),
  },

  // Feature Flags
  features: {
    oauth: true,
    mfa: true,
    aiFeatures: true,
    analytics: getEnvVar('NEXT_PUBLIC_ENABLE_ANALYTICS', 'false') === 'true',
  },

  // Storage Keys
  storage: {
    token: 'token',
    userId: 'user_id',
    userEmail: 'user_email',
    user: 'user',
    theme: 'theme',
  },
};

// API Helper
export const getApiUrl = (path: string): string => {
  const baseUrl = config.api.baseUrl.replace(/\/$/, '');
  const cleanPath = path.replace(/^\//, '');
  return `${baseUrl}/${cleanPath}`;
};

// WebSocket Helper
export const getWsUrl = (): string => {
  return config.api.wsUrl;
};
