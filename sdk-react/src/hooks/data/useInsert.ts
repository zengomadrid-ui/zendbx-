import { useMutation } from './useMutation';
import { useZendbx } from '../core/useZendbx';
import type { MutationState, MutationOptions } from '../../types';

/**
 * useInsert - Insert mutation hook
 *
 * Inserts new records into a database table.
 *
 * @param table - Table name
 * @param options - Mutation options
 * @returns Mutation state with insert function
 *
 * @example
 * ```tsx
 * function CreatePost() {
 *   const { mutate: insertPost, loading, error } = useInsert('posts', {
 *     onSuccess: (data) => {
 *       console.log('Post created:', data);
 *       navigate('/posts');
 *     }
 *   });
 *
 *   const handleSubmit = (e) => {
 *     e.preventDefault();
 *     insertPost({
 *       title: 'My Post',
 *       content: 'Post content',
 *       published: true
 *     });
 *   };
 *
 *   return (
 *     <form onSubmit={handleSubmit}>
 *       <button type="submit" disabled={loading}>
 *         {loading ? 'Creating...' : 'Create Post'}
 *       </button>
 *       {error && <div>Error: {error.message}</div>}
 *     </form>
 *   );
 * }
 * ```
 */
export function useInsert<TData = unknown, TVariables = unknown>(
  table: string,
  options?: MutationOptions<TData, TVariables>
): MutationState<TData, TVariables> {
  const client = useZendbx();

  return useMutation<TData, TVariables>(
    async (_, variables) => {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const result = await client.from(table).insert(variables as any);
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      return result as { data: TData | null; error: any };
    },
    options
  );
}
