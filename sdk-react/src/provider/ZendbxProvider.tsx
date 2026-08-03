import React, { useMemo } from 'react';
import type { ZendbxClient } from '@zendbx/sdk';
import { ZendbxContext } from './ZendbxContext';
import {
  DEFAULT_STALE_TIME,
  DEFAULT_CACHE_TIME,
  DEFAULT_RETRY_COUNT,
  DEFAULT_RETRY_DELAY,
} from '../constants';

/**
 * ZendbxProvider props
 */
export interface ZendbxProviderProps {
  /**
   * ZendBX SDK client instance
   * Created via `createClient()` from @zendbx/sdk
   */
  client: ZendbxClient;

  /**
   * Time in milliseconds after which data is considered stale
   * @default 0 (immediately stale)
   */
  staleTime?: number;

  /**
   * Time in milliseconds after which inactive queries are garbage collected
   * @default 300000 (5 minutes)
   */
  cacheTime?: number;

  /**
   * Number of retry attempts for failed requests
   * @default 3
   */
  retry?: number;

  /**
   * Delay in milliseconds between retry attempts
   * @default 1000
   */
  retryDelay?: number;

  /**
   * Children components
   */
  children: React.ReactNode;
}

/**
 * ZendbxProvider - Main context provider for @zendbx/react
 *
 * Provides the SDK client and cache configuration to all child components.
 *
 * @example
 * ```tsx
 * import { createClient } from '@zendbx/sdk';
 * import { ZendbxProvider } from '@zendbx/react';
 *
 * const client = createClient({
 *   apiUrl: 'https://api.zendbx.in',
 *   projectSlug: 'my-project',
 *   anonKey: 'your-anon-key',
 * });
 *
 * function App() {
 *   return (
 *     <ZendbxProvider client={client} staleTime={60000}>
 *       <YourApp />
 *     </ZendbxProvider>
 *   );
 * }
 * ```
 */
export function ZendbxProvider({
  client,
  staleTime = DEFAULT_STALE_TIME,
  cacheTime = DEFAULT_CACHE_TIME,
  retry = DEFAULT_RETRY_COUNT,
  retryDelay = DEFAULT_RETRY_DELAY,
  children,
}: ZendbxProviderProps) {
  // Validate client
  if (!client) {
    throw new Error(
      'ZendbxProvider: client is required. Create a client using createClient() from @zendbx/sdk'
    );
  }

  // Memoize context value to prevent unnecessary re-renders
  const contextValue = useMemo(
    () => ({
      client,
      config: {
        staleTime,
        cacheTime,
        retry,
        retryDelay,
      },
    }),
    [client, staleTime, cacheTime, retry, retryDelay]
  );

  return <ZendbxContext.Provider value={contextValue}>{children}</ZendbxContext.Provider>;
}
