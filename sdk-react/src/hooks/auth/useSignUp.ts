import { useState, useCallback } from 'react';
import type { SignUpData, AuthResponse } from '@zendbx/sdk';
import { useZendbx } from '../core/useZendbx';
import type { MutationState, MutationOptions } from '../../types';

/**
 * useSignUp - Sign up mutation hook
 *
 * Provides a mutation function to register new users.
 * Automatically stores the auth token in the SDK client.
 *
 * @param options - Mutation options with callbacks
 * @returns Mutation state with signUp function
 *
 * @example
 * ```tsx
 * function SignUpForm() {
 *   const { mutate: signUp, loading, error } = useSignUp({
 *     onSuccess: (data) => {
 *       console.log('Account created:', data.user);
 *       navigate('/onboarding');
 *     }
 *   });
 *
 *   const handleSubmit = (e) => {
 *     e.preventDefault();
 *     signUp({
 *       email: 'user@example.com',
 *       password: 'securepassword',
 *       name: 'John Doe'
 *     });
 *   };
 *
 *   return (
 *     <form onSubmit={handleSubmit}>
 *       <button type="submit" disabled={loading}>
 *         {loading ? 'Creating account...' : 'Sign Up'}
 *       </button>
 *       {error && <div>Error: {error.message}</div>}
 *     </form>
 *   );
 * }
 * ```
 */
export function useSignUp(
  options?: MutationOptions<AuthResponse, SignUpData>
): MutationState<AuthResponse, SignUpData> {
  const client = useZendbx();
  const [data, setData] = useState<AuthResponse | undefined>(undefined);
  const [error, setError] = useState<Error | null>(null);
  const [loading, setLoading] = useState(false);

  const mutate = useCallback(
    async (variables: SignUpData) => {
      try {
        setLoading(true);
        setError(null);

        // Call onMutate if provided
        if (options?.onMutate) {
          await options.onMutate(variables);
        }

        // Execute sign up via SDK
        const result = await client.auth.signUp(variables);
        
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
        const error = err instanceof Error ? err : new Error('Sign up failed');
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
    async (variables: SignUpData): Promise<AuthResponse> => {
      const result = await mutate(variables);
      if (!result) {
        throw error || new Error('Sign up failed');
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
