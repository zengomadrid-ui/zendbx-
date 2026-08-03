import { useCallback } from 'react';
import { useQueryCache } from './useQueryCache';

/**
 * useInvalidateQuery - Invalidate queries
 *
 * Provides a function to invalidate cached queries.
 *
 * @returns Invalidate function
 *
 * @example
 * ```tsx
 * function PostCreator() {
 *   const invalidate = useInvalidateQuery();
 *   const { mutate: createPost } = useInsert('posts', {
 *     onSuccess: () => {
 *       // Invalidate posts query to trigger refetch
 *       invalidate('posts');
 *     }
 *   });
 *
 *   return <button onClick={() => createPost({ title: 'New Post' })}>Create</button>;
 * }
 * ```
 */
export function useInvalidateQuery() {
  const { invalidate } = useQueryCache();

  const invalidateQuery = useCallback(
    (key?: string | string[]) => {
      invalidate(key);
    },
    [invalidate]
  );

  return invalidateQuery;
}
