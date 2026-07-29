import { useContext } from 'react';
import { ZendbxContext } from '../../provider/ZendbxContext';
import type { CacheConfig } from '../../types';

/**
 * useConfig - Access cache configuration
 *
 * Returns the cache configuration from context.
 * Must be used within a ZendbxProvider.
 *
 * @returns CacheConfig
 * @throws Error if used outside ZendbxProvider
 *
 * @example
 * ```tsx
 * function MyComponent() {
 *   const config = useConfig();
 *   console.log('Stale time:', config.staleTime);
 *   console.log('Cache time:', config.cacheTime);
 * }
 * ```
 */
export function useConfig(): CacheConfig {
  const context = useContext(ZendbxContext);

  if (!context) {
    throw new Error(
      'useConfig must be used within a ZendbxProvider. ' +
        'Wrap your component tree with <ZendbxProvider client={client}>...</ZendbxProvider>'
    );
  }

  return context.config;
}
