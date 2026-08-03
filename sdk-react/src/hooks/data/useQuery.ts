import { useState, useEffect, useCallback, useRef } from 'react';
import { useZendbx } from '../core/useZendbx';
import { useConfig } from '../core/useConfig';
import type { QueryState, QueryOptions } from '../../types';

/**
 * useQuery - Generic query hook with caching
 *
 * Fetches data from the database with automatic caching, refetching, and error handling.
 *
 * @param queryFn - Function that returns a query builder
 * @param options - Query options
 * @returns Query state with data, loading, and error
 *
 * @example
 * ```tsx
 * function PostList() {
 *   const { data, loading, error, refetch } = useQuery(
 *     (client) => client.from('posts').select('*').eq('published', true),
 *     { 
 *       enabled: true,
 *       refetchOnMount: true 
 *     }
 *   );
 *
 *   if (loading) return <div>Loading...</div>;
 *   if (error) return <div>Error: {error.message}</div>;
 *
 *   return (
 *     <div>
 *       {data?.map((post) => <div key={post.id}>{post.title}</div>)}
 *       <button onClick={refetch}>Refresh</button>
 *     </div>
 *   );
 * }
 * ```
 */
export function useQuery<TData = unknown>(
  queryFn: (client: ReturnType<typeof useZendbx>) => Promise<{ data: TData | null; error?: { message?: string } | null }>,
  options: QueryOptions<TData> = {}
): QueryState<TData> {
  const client = useZendbx();
  const config = useConfig();

  const {
    enabled = true,
    staleTime = config.staleTime,
    refetchOnMount = true,
    refetchOnWindowFocus = false,
    refetchOnReconnect = false,
    retry = config.retry || 3,
    retryDelay = config.retryDelay || 1000,
    onSuccess,
    onError,
    onSettled,
  } = options;

  const [data, setData] = useState<TData | undefined>(undefined);
  const [error, setError] = useState<Error | null>(null);
  const [loading, setLoading] = useState(enabled);
  const [isFetching, setIsFetching] = useState(false);

  const lastFetchTime = useRef<number>(0);
  const retryCount = useRef<number>(0);
  const mounted = useRef(true);

  const isStale = useCallback(() => {
    if (staleTime === undefined || staleTime === 0) return true;
    return Date.now() - lastFetchTime.current > staleTime;
  }, [staleTime]);

  const fetchData = useCallback(
    async (isRetry = false) => {
      if (!enabled) return;

      try {
        setIsFetching(true);
        if (!isRetry) {
          setError(null);
        }

        const result = await queryFn(client);

        if (!mounted.current) return;

        if (result.error) {
          throw new Error(result.error?.message || 'Query failed');
        }

        const fetchedData = result.data as TData;
        setData(fetchedData);
        setError(null);
        lastFetchTime.current = Date.now();
        retryCount.current = 0;

        if (onSuccess) {
          onSuccess(fetchedData);
        }

        if (onSettled) {
          onSettled(fetchedData, null);
        }
      } catch (err) {
        if (!mounted.current) return;

        const error = err instanceof Error ? err : new Error('Query failed');

        // Retry logic
        if (retry && retryCount.current < (typeof retry === 'number' ? retry : 3)) {
          retryCount.current++;
          setTimeout(() => {
            if (mounted.current) {
              fetchData(true);
            }
          }, retryDelay);
          return;
        }

        setError(error);
        setData(undefined);

        if (onError) {
          onError(error);
        }

        if (onSettled) {
          onSettled(undefined, error);
        }
      } finally {
        if (mounted.current) {
          setLoading(false);
          setIsFetching(false);
        }
      }
    },
    [client, enabled, queryFn, retry, retryDelay, onSuccess, onError, onSettled]
  );

  const refetch = useCallback(async () => {
    retryCount.current = 0;
    await fetchData();
  }, [fetchData]);

  // Initial fetch
  useEffect(() => {
    if (enabled && refetchOnMount) {
      fetchData();
    } else if (enabled) {
      setLoading(false);
    }
  }, [enabled, refetchOnMount, fetchData]);

  // Refetch on window focus
  useEffect(() => {
    if (!refetchOnWindowFocus || !enabled) return;

    const handleFocus = () => {
      if (isStale()) {
        fetchData();
      }
    };

    window.addEventListener('focus', handleFocus);
    return () => window.removeEventListener('focus', handleFocus);
  }, [refetchOnWindowFocus, enabled, isStale, fetchData]);

  // Refetch on reconnect
  useEffect(() => {
    if (!refetchOnReconnect || !enabled) return;

    const handleOnline = () => {
      if (isStale()) {
        fetchData();
      }
    };

    window.addEventListener('online', handleOnline);
    return () => window.removeEventListener('online', handleOnline);
  }, [refetchOnReconnect, enabled, isStale, fetchData]);

  // Cleanup
  useEffect(() => {
    mounted.current = true;
    return () => {
      mounted.current = false;
    };
  }, []);

  return {
    data,
    error,
    loading,
    isSuccess: !loading && !error && data !== undefined,
    isError: !loading && error !== null,
    isLoading: loading,
    isFetching,
    refetch,
  };
}
