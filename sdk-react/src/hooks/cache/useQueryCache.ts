import { useCallback } from 'react';

/**
 * Cached query data
 */
interface CachedData {
  data: unknown;
  timestamp: number;
}

/**
 * Query cache interface
 */
export interface QueryCache {
  invalidate: (key?: string | string[]) => void;
  clear: () => void;
  setQueryData: (key: string, data: unknown) => void;
  getQueryData: (key: string) => unknown;
  removeQuery: (key: string) => void;
}

/**
 * Simple in-memory cache
 */
const queryCache = new Map<string, CachedData>();

/**
 * useQueryCache - Query cache management
 *
 * Provides utilities to manage query cache.
 *
 * @returns Query cache utilities
 *
 * @example
 * ```tsx
 * function PostManager() {
 *   const { invalidate, clear, setQueryData } = useQueryCache();
 *
 *   const handleCreatePost = async (post) => {
 *     // Create post...
 *     // Invalidate posts query to refetch
 *     invalidate('posts');
 *   };
 *
 *   const handleClearCache = () => {
 *     clear();
 *   };
 *
 *   return (
 *     <div>
 *       <button onClick={handleClearCache}>Clear Cache</button>
 *     </div>
 *   );
 * }
 * ```
 */
export function useQueryCache(): QueryCache {
  const invalidate = useCallback((key?: string | string[]) => {
    if (!key) {
      // Invalidate all queries
      queryCache.clear();
      return;
    }

    if (Array.isArray(key)) {
      // Invalidate multiple queries
      key.forEach((k) => queryCache.delete(k));
    } else {
      // Invalidate single query
      queryCache.delete(key);
    }
  }, []);

  const clear = useCallback(() => {
    queryCache.clear();
  }, []);

  const setQueryData = useCallback((key: string, data: unknown) => {
    queryCache.set(key, {
      data,
      timestamp: Date.now(),
    });
  }, []);

  const getQueryData = useCallback((key: string): unknown => {
    const cached = queryCache.get(key);
    return cached?.data;
  }, []);

  const removeQuery = useCallback((key: string) => {
    queryCache.delete(key);
  }, []);

  return {
    invalidate,
    clear,
    setQueryData,
    getQueryData,
    removeQuery,
  };
}
