import { useMutation } from './useMutation';
import { useZendbx } from '../core/useZendbx';
import type { MutationState, MutationOptions } from '../../types';

/**
 * Delete variables interface
 */
export interface DeleteVariables {
  /**
   * Filter conditions for deletion
   */
  match: Record<string, unknown>;
}

/**
 * useDelete - Delete mutation hook
 *
 * Deletes records from a database table.
 *
 * @param table - Table name
 * @param options - Mutation options
 * @returns Mutation state with delete function
 *
 * @example
 * ```tsx
 * function DeletePost({ postId }) {
 *   const { mutate: deletePost, loading, error } = useDelete('posts', {
 *     onSuccess: () => {
 *       console.log('Post deleted');
 *       navigate('/posts');
 *     }
 *   });
 *
 *   const handleDelete = () => {
 *     if (confirm('Are you sure?')) {
 *       deletePost({ match: { id: postId } });
 *     }
 *   };
 *
 *   return (
 *     <button onClick={handleDelete} disabled={loading}>
 *       {loading ? 'Deleting...' : 'Delete Post'}
 *     </button>
 *   );
 * }
 * ```
 */
export function useDelete<TData = unknown>(
  table: string,
  options?: MutationOptions<TData, DeleteVariables>
): MutationState<TData, DeleteVariables> {
  const client = useZendbx();

  return useMutation<TData, DeleteVariables>(
    async (_, variables) => {
      const { match } = variables;
      let query = client.from(table).delete();

      // Apply match conditions
      Object.entries(match).forEach(([key, value]) => {
        query = query.eq(key, value);
      });

      const result = await query;
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      return result as { data: TData | null; error: any };
    },
    options
  );
}
