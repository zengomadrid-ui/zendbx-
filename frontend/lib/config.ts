/**
 * Application Configuration
 * Centralized configuration for API endpoints and app settings
 */

export const config = {
  // API Configuration
  api: {
    baseUrl: process.env.NEXT_PUBLIC_API_URL || 'http://localhost:8000',
    timeout: 30000, // 30 seconds
  },

  // App Configuration
  app: {
    name: 'Zendbx',
    description: 'Backend-as-a-Service with AI-powered database management',
    url: process.env.NEXT_PUBLIC_APP_URL || 'http://localhost:3000',
  },

  // Feature Flags
  features: {
    oauth: true,
    mfa: true,
    aiFeatures: true,
    analytics: process.env.NEXT_PUBLIC_ENABLE_ANALYTICS === 'true',
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
