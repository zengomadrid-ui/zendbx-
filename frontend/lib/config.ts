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

// Check if we're in production
// NOTE: Do NOT use NODE_ENV here — Next.js sets NODE_ENV='production' for any
// production build, including when running locally with `npm run build && npm start`.
// We rely exclusively on NEXT_PUBLIC_ENVIRONMENT which is explicitly set per deployment.
const isProduction = process.env.NEXT_PUBLIC_ENVIRONMENT === 'production';

export const config = {
  // API Configuration
  api: {
    // Use env var if set; otherwise fall back by environment.
    // IMPORTANT: The hardcoded production fallback MUST be the active Render backend.
    baseUrl: isProduction
      ? (process.env.NEXT_PUBLIC_API_URL || 'https://zendbx-2-zpp9.onrender.com')
      : getEnvVar('NEXT_PUBLIC_API_URL', 'http://localhost:8080'),
    wsUrl: isProduction
      ? (process.env.NEXT_PUBLIC_WS_URL || 'wss://zendbx-2-zpp9.onrender.com')
      : getEnvVar('NEXT_PUBLIC_WS_URL', 'http://localhost:8001'),
    timeout: 30000, // 30 seconds
  },

  // App Configuration
  app: {
    name: 'ZenDBX',
    description: 'Backend-as-a-Service with AI-powered database management',
    url: isProduction
      ? (process.env.NEXT_PUBLIC_APP_URL || 'https://devapp.zendbx.in')
      : getEnvVar('NEXT_PUBLIC_APP_URL', 'http://localhost:3000'),
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
  const fullUrl = `${baseUrl}/${cleanPath}`;
  // Debug: log the resolved URL so you can verify in the browser console
  if (typeof window !== 'undefined') {
    console.log('[ZenDBX] API URL:', fullUrl);
  }
  return fullUrl;
};

// WebSocket Helper
export const getWsUrl = (): string => {
  return config.api.wsUrl;
};
