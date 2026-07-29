import { useState, useEffect, useCallback } from 'react';
import type { User } from '@zendbx/sdk';
import { useZendbx } from '../core/useZendbx';
import type { QueryState } from '../../types';

/**
 * useUser - Get current authenticated user with caching
 *
 * Fetches and caches the current user data.
 * Automatically refetches when needed.
 *
 * @returns Query state with user data
 *
 * @example
 * ```tsx
 * function ProfilePage() {
 *   const { data: user, loading, error, refetch } = useUser();
 *
 *   if (loading) return <div>Loading...</div>;
 *   if (error) return <div>Error: {error.message}</div>;
 *   if (!user) return <div>Not authenticated</div>;
 *
 *   return (
 *     <div>
 *       <h1>{user.email}</h1>
 *       <button onClick={refetch}>Refresh</button>
 *     </div>
 *   );
 * }
 * ```
 */
export function useUser(): QueryState<User | null> {
  const client = useZendbx();
  const [data, setData] = useState<User | null>(null);
  const [error, setError] = useState<Error | null>(null);
  const [loading, setLoading] = useState(true);
  const [isFetching, setIsFetching] = useState(false);

  const fetchUser = useCallback(async () => {
    try {
      setIsFetching(true);
      setError(null);

      const user = await client.auth.getUser();
      setData(user);
    } catch (err) {
      const error = err instanceof Error ? err : new Error('Failed to fetch user');
      setError(error);
      setData(null);
    } finally {
      setLoading(false);
      setIsFetching(false);
    }
  }, [client]);

  const refetch = useCallback(async () => {
    await fetchUser();
  }, [fetchUser]);

  useEffect(() => {
    fetchUser();
  }, [fetchUser]);

  return {
    data,
    error,
    loading,
    isSuccess: !loading && !error && data !== null,
    isError: !loading && error !== null,
    isLoading: loading,
    isFetching,
    refetch,
  };
}
