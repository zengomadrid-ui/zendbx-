import { useContext } from 'react';
import type { ZendbxClient } from '@zendbx/sdk';
import { ZendbxContext } from '../../provider/ZendbxContext';

/**
 * useZendbx - Access the ZendBX SDK client
 *
 * Returns the ZendBX client instance from context.
 * Must be used within a ZendbxProvider.
 *
 * @returns ZendbxClient instance
 * @throws Error if used outside ZendbxProvider
 *
 * @example
 * ```tsx
 * function MyComponent() {
 *   const client = useZendbx();
 *
 *   const handleFetch = async () => {
 *     const { data, error } = await client
 *       .from('posts')
 *       .select('*')
 *       .eq('published', true);
 *   };
 *
 *   return <button onClick={handleFetch}>Fetch Posts</button>;
 * }
 * ```
 */
export function useZendbx(): ZendbxClient {
  const context = useContext(ZendbxContext);

  if (!context) {
    throw new Error(
      'useZendbx must be used within a ZendbxProvider. ' +
        'Wrap your component tree with <ZendbxProvider client={client}>...</ZendbxProvider>'
    );
  }

  return context.client;
}
