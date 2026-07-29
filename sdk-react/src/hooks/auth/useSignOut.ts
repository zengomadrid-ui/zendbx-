import { useState, useCallback } from 'react';
import { useZendbx } from '../core/useZendbx';
import type { MutationState, MutationOptions } from '../../types';

/**
 * useSignOut - Sign out mutation hook
 *
 * Provides a mutation function to sign out the current user.
 * Automatically clears the auth token from the SDK client.
 *
 * @param options - Mutation options with callbacks
 * @returns Mutation state with signOut function
 *
 * @example
 * ```tsx
 * function Header() {
 *   const { mutate: signOut, loading } = useSignOut({
 *     onSuccess: () => {
 *       console.log('Signed out successfully');
 *       navigate('/login');
 *     }
 *   });
 *
 *   return (
 *     <button onClick={() => signOut()} disabled={loading}>
 *       {loading ? 'Signing out...' : 'Sign Out'}
 *     </button>
 *   );
 * }
 * ```
 */
export function useSignOut(
  options?: MutationOptions<void, void>
): Omit<MutationState<void, void>, 'mutate' | 'mutateAsync'> & {
  mutate: () => Promise<void>;
  mutateAsync: () => Promise<void>;
} {
  const client = useZendbx();
  const [data, setData] = useState<void | undefined>(undefined);
  const [error, setError] = useState<Error | null>(null);
  const [loading, setLoading] = useState(false);

  const mutate = useCallback(async () => {
    try {
      setLoading(true);
      setError(null);

      // Call onMutate if provided
      if (options?.onMutate) {
        await options.onMutate(undefined as void);
      }

      // Execute sign out via SDK
      await client.auth.signOut();
      
      setData(undefined);

      // Call onSuccess if provided
      if (options?.onSuccess) {
        options.onSuccess(undefined as void, undefined as void);
      }

      // Call onSettled
      if (options?.onSettled) {
        options.onSettled(undefined, null, undefined as void);
      }
    } catch (err) {
      const error = err instanceof Error ? err : new Error('Sign out failed');
      setError(error);

      // Call onError if provided
      if (options?.onError) {
        options.onError(error, undefined as void);
      }

      // Call onSettled
      if (options?.onSettled) {
        options.onSettled(undefined, error, undefined as void);
      }
    } finally {
      setLoading(false);
    }
  }, [client, options]);

  const mutateAsync = useCallback(async (): Promise<void> => {
    await mutate();
    if (error) {
      throw error;
    }
  }, [mutate, error]);

  const reset = useCallback(() => {
    setData(undefined);
    setError(null);
    setLoading(false);
  }, []);

  return {
    data,
    error,
    loading,
    isSuccess: !loading && !error,
    isError: !loading && error !== null,
    isLoading: loading,
    mutate,
    mutateAsync,
    reset,
  };
}
