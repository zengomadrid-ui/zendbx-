import { useMutation } from './useMutation';
import { useZendbx } from '../core/useZendbx';
import type { MutationState, MutationOptions } from '../../types';

/**
 * Update variables interface
 */
export interface UpdateVariables<TData = unknown> {
  /**
   * Data to update
   */
  data: Partial<TData>;
  /**
   * Filter conditions
   */
  match: Record<string, unknown>;
}

/**
 * useUpdate - Update mutation hook
 *
 * Updates existing records in a database table.
 *
 * @param table - Table name
 * @param options - Mutation options
 * @returns Mutation state with update function
 *
 * @example
 * ```tsx
 * function EditPost({ postId }) {
 *   const { mutate: updatePost, loading, error } = useUpdate('posts', {
 *     onSuccess: (data) => {
 *       console.log('Post updated:', data);
 *     }
 *   });
 *
 *   const handleUpdate = () => {
 *     updatePost({
 *       data: { title: 'Updated Title', published: true },
 *       match: { id: postId }
 *     });
 *   };
 *
 *   return (
 *     <button onClick={handleUpdate} disabled={loading}>
 *       {loading ? 'Updating...' : 'Update Post'}
 *     </button>
 *   );
 * }
 * ```
 */
export function useUpdate<TData = unknown>(
  table: string,
  options?: MutationOptions<TData, UpdateVariables<TData>>
): MutationState<TData, UpdateVariables<TData>> {
  const client = useZendbx();

  return useMutation<TData, UpdateVariables<TData>>(
    async (_, variables) => {
      const { data, match } = variables;
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      let query = client.from(table).update(data as any);

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
