/**
 * Application Configuration
 * Centralized configuration for API endpoints and app settings
 *
 * NEXT_PUBLIC_* variables are inlined at build time by Next.js.
 * On Vercel, these come from the Vercel Dashboard env vars or vercel.json.
 * Locally they come from .env.local.
 *
 * We use a hardcoded production fallback so the app never falls back to
 * localhost in a deployed environment, even if the env var is missing.
 */

const PROD_API_URL = 'https://api.zendbx.in';
const PROD_WS_URL  = 'wss://api.zendbx.in';
const PROD_APP_URL = 'https://zendbx.in';

// Resolve API base URL:
//   - Use NEXT_PUBLIC_API_URL if explicitly set (covers both Vercel and local)
//   - Otherwise fall back to production URL (safe default for any deployed build)
//   - localhost is only used when explicitly set via .env.local
const resolvedApiUrl: string =
  (process.env.NEXT_PUBLIC_API_URL && process.env.NEXT_PUBLIC_API_URL.trim() !== '')
    ? process.env.NEXT_PUBLIC_API_URL
    : PROD_API_URL;

const resolvedWsUrl: string =
  (process.env.NEXT_PUBLIC_WS_URL && process.env.NEXT_PUBLIC_WS_URL.trim() !== '')
    ? process.env.NEXT_PUBLIC_WS_URL
    : PROD_WS_URL;

const resolvedAppUrl: string =
  (process.env.NEXT_PUBLIC_APP_URL && process.env.NEXT_PUBLIC_APP_URL.trim() !== '')
    ? process.env.NEXT_PUBLIC_APP_URL
    : PROD_APP_URL;

// isProduction: true when running on any deployed instance (not localhost)
// Used only for feature flags, not URL resolution.
export const isProduction =
  resolvedApiUrl.startsWith('https://') && !resolvedApiUrl.includes('localhost');

export const config = {
  api: {
    baseUrl: resolvedApiUrl,
    wsUrl:   resolvedWsUrl,
    timeout: 30000,
  },

  app: {
    name: 'ZenDBX',
    description: 'Backend-as-a-Service with AI-powered database management',
    url: resolvedAppUrl,
  },

  features: {
    oauth: true,
    mfa: true,
    aiFeatures: true,
    analytics: process.env.NEXT_PUBLIC_ENABLE_ANALYTICS === 'true',
  },

  storage: {
    token:     'token',
    userId:    'user_id',
    userEmail: 'user_email',
    user:      'user',
    theme:     'theme',
  },
};

// API URL builder
export const getApiUrl = (path: string): string => {
  const base = config.api.baseUrl.replace(/\/$/, '');
  const clean = path.replace(/^\//, '');
  const url = `${base}/${clean}`;
  if (typeof window !== 'undefined') {
    console.log('[ZenDBX] API URL:', url);
  }
  return url;
};

// Legacy helper kept for compatibility
export const getEnvVar = (key: string, fallback: string): string =>
  process.env[key] || fallback;

// WebSocket URL
export const getWsUrl = (): string => config.api.wsUrl;
