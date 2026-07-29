import { useState, useCallback } from 'react';
import type { SignInData, AuthResponse } from '@zendbx/sdk';
import { useZendbx } from '../core/useZendbx';
import type { MutationState, MutationOptions } from '../../types';

/**
 * useSignIn - Sign in mutation hook
 *
 * Provides a mutation function to sign in users.
 * Automatically stores the auth token in the SDK client.
 *
 * @param options - Mutation options with callbacks
 * @returns Mutation state with signIn function
 *
 * @example
 * ```tsx
 * function LoginForm() {
 *   const { mutate: signIn, loading, error } = useSignIn({
 *     onSuccess: (data) => {
 *       console.log('Signed in:', data.user);
 *       navigate('/dashboard');
 *     },
 *     onError: (error) => {
 *       console.error('Sign in failed:', error);
 *     }
 *   });
 *
 *   const handleSubmit = (e) => {
 *     e.preventDefault();
 *     signIn({ email: 'user@example.com', password: 'password' });
 *   };
 *
 *   return (
 *     <form onSubmit={handleSubmit}>
 *       <button type="submit" disabled={loading}>
 *         {loading ? 'Signing in...' : 'Sign In'}
 *       </button>
 *       {error && <div>Error: {error.message}</div>}
 *     </form>
 *   );
 * }
 * ```
 */
export function useSignIn(
  options?: MutationOptions<AuthResponse, SignInData>
): MutationState<AuthResponse, SignInData> {
  const client = useZendbx();
  const [data, setData] = useState<AuthResponse | undefined>(undefined);
  const [error, setError] = useState<Error | null>(null);
  const [loading, setLoading] = useState(false);

  const mutate = useCallback(
    async (variables: SignInData) => {
      try {
        setLoading(true);
        setError(null);

        // Call onMutate if provided
        if (options?.onMutate) {
          await options.onMutate(variables);
        }

        // Execute sign in via SDK
        const result = await client.auth.signIn(variables);
        
        setData(result);

        // Call onSuccess if provided
        if (options?.onSuccess) {
          options.onSuccess(result, variables);
        }

        // Call onSettled
        if (options?.onSettled) {
          options.onSettled(result, null, variables);
        }

        return result;
      } catch (err) {
        const error = err instanceof Error ? err : new Error('Sign in failed');
        setError(error);

        // Call onError if provided
        if (options?.onError) {
          options.onError(error, variables);
        }

        // Call onSettled
        if (options?.onSettled) {
          options.onSettled(undefined, error, variables);
        }

        return undefined;
      } finally {
        setLoading(false);
      }
    },
    [client, options]
  );

  const mutateAsync = useCallback(
    async (variables: SignInData): Promise<AuthResponse> => {
      const result = await mutate(variables);
      if (!result) {
        throw error || new Error('Sign in failed');
      }
      return result;
    },
    [mutate, error]
  );

  const reset = useCallback(() => {
    setData(undefined);
    setError(null);
    setLoading(false);
  }, []);

  return {
    data,
    error,
    loading,
    isSuccess: !loading && !error && data !== undefined,
    isError: !loading && error !== null,
    isLoading: loading,
    mutate,
    mutateAsync,
    reset,
  };
}
