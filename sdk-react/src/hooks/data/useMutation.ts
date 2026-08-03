import { useState, useCallback, useRef } from 'react';
import { useZendbx } from '../core/useZendbx';
import { useConfig } from '../core/useConfig';
import type { MutationState, MutationOptions } from '../../types';

/**
 * useMutation - Generic mutation hook
 *
 * Executes database mutations with automatic error handling and callbacks.
 *
 * @param mutationFn - Function that performs the mutation
 * @param options - Mutation options
 * @returns Mutation state with mutate function
 *
 * @example
 * ```tsx
 * function CreatePost() {
 *   const { mutate: createPost, loading, error } = useMutation(
 *     (client, data) => client.from('posts').insert(data),
 *     {
 *       onSuccess: (data) => {
 *         console.log('Post created:', data);
 *       }
 *     }
 *   );
 *
 *   return (
 *     <button onClick={() => createPost({ title: 'Hello', content: 'World' })}>
 *       Create Post
 *     </button>
 *   );
 * }
 * ```
 */
export function useMutation<TData = unknown, TVariables = unknown>(
  mutationFn: (
    client: ReturnType<typeof useZendbx>,
    variables: TVariables
  ) => Promise<{ data: TData | null; error?: { message?: string } | null }>,
  options: MutationOptions<TData, TVariables> = {}
): MutationState<TData, TVariables> {
  const client = useZendbx();
  const config = useConfig();

  const {
    onSuccess,
    onError,
    onSettled,
    onMutate,
    retry = config.retry || 0,
    retryDelay = config.retryDelay || 1000,
  } = options;

  const [data, setData] = useState<TData | undefined>(undefined);
  const [error, setError] = useState<Error | null>(null);
  const [loading, setLoading] = useState(false);

  const retryCount = useRef<number>(0);
  const mounted = useRef(true);

  const executeMutation = useCallback(
    async (variables: TVariables, isRetry = false): Promise<TData | undefined> => {
      try {
        if (!isRetry) {
          setLoading(true);
          setError(null);
          retryCount.current = 0;

          // Call onMutate if provided
          if (onMutate) {
            await onMutate(variables);
          }
        }

        const result = await mutationFn(client, variables);

        if (!mounted.current) return undefined;

        if (result.error) {
          throw new Error(result.error?.message || 'Mutation failed');
        }

        const mutatedData = result.data as TData;
        setData(mutatedData);
        setError(null);

        if (onSuccess) {
          onSuccess(mutatedData, variables);
        }

        if (onSettled) {
          onSettled(mutatedData, null, variables);
        }

        return mutatedData;
      } catch (err) {
        if (!mounted.current) return undefined;

        const error = err instanceof Error ? err : new Error('Mutation failed');

        // Retry logic
        if (retry && retryCount.current < (typeof retry === 'number' ? retry : 0)) {
          retryCount.current++;
          return new Promise((resolve) => {
            setTimeout(() => {
              if (mounted.current) {
                resolve(executeMutation(variables, true));
              } else {
                resolve(undefined);
              }
            }, retryDelay);
          });
        }

        setError(error);

        if (onError) {
          onError(error, variables);
        }

        if (onSettled) {
          onSettled(undefined, error, variables);
        }

        return undefined;
      } finally {
        if (mounted.current && !isRetry) {
          setLoading(false);
        }
      }
    },
    [client, mutationFn, onMutate, onSuccess, onError, onSettled, retry, retryDelay]
  );

  const mutate = useCallback(
    async (variables: TVariables) => {
      return executeMutation(variables);
    },
    [executeMutation]
  );

  const mutateAsync = useCallback(
    async (variables: TVariables): Promise<TData> => {
      const result = await executeMutation(variables);
      if (!result) {
        throw error || new Error('Mutation failed');
      }
      return result;
    },
    [executeMutation, error]
  );

  const reset = useCallback(() => {
    setData(undefined);
    setError(null);
    setLoading(false);
    retryCount.current = 0;
  }, []);

  // Cleanup
  useState(() => {
    mounted.current = true;
    return () => {
      mounted.current = false;
    };
  });

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
