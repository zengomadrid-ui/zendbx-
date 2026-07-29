/**
 * Default configuration values
 */
export const DEFAULT_STALE_TIME = 0;
export const DEFAULT_CACHE_TIME = 5 * 60 * 1000; // 5 minutes
export const DEFAULT_RETRY_COUNT = 3;
export const DEFAULT_RETRY_DELAY = 1000;
export const DEFAULT_REFETCH_ON_MOUNT = true;
export const DEFAULT_REFETCH_ON_WINDOW_FOCUS = true;
export const DEFAULT_REFETCH_ON_RECONNECT = true;

/**
 * Cache events
 */
export const CACHE_EVENTS = {
  QUERY_ADDED: 'query:added',
  QUERY_UPDATED: 'query:updated',
  QUERY_REMOVED: 'query:removed',
  MUTATION_ADDED: 'mutation:added',
  MUTATION_UPDATED: 'mutation:updated',
  MUTATION_REMOVED: 'mutation:removed',
  CACHE_INVALIDATED: 'cache:invalidated',
  CACHE_CLEARED: 'cache:cleared',
} as const;

/**
 * Query status
 */
export const QUERY_STATUS = {
  IDLE: 'idle',
  LOADING: 'loading',
  SUCCESS: 'success',
  ERROR: 'error',
} as const;

/**
 * Mutation status
 */
export const MUTATION_STATUS = {
  IDLE: 'idle',
  LOADING: 'loading',
  SUCCESS: 'success',
  ERROR: 'error',
} as const;

/**
 * Subscription status
 */
export const SUBSCRIPTION_STATUS = {
  CONNECTING: 'connecting',
  CONNECTED: 'connected',
  DISCONNECTED: 'disconnected',
  ERROR: 'error',
} as const;
