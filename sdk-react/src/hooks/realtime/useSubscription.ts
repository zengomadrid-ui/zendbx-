import { useState, useEffect, useCallback, useRef } from 'react';
import { useZendbx } from '../core/useZendbx';
import type { SubscriptionOptions, SubscriptionPayload, SubscriptionState } from '../../types';

/**
 * useSubscription - Real-time database subscription
 *
 * Subscribes to real-time changes in a database table.
 * 
 * Note: This feature requires the SDK to expose the full RealtimeModule.
 * Current SDK only provides getWebSocketUrl(). This hook provides a placeholder
 * implementation and will be fully functional once the SDK is updated.
 *
 * @param table - Table name to subscribe to
 * @param options - Subscription options
 * @returns Subscription state
 *
 * @example
 * ```tsx
 * function PostList() {
 *   const [posts, setPosts] = useState([]);
 *   
 *   const { status, error } = useSubscription('posts', {
 *     event: '*',
 *     callback: (payload) => {
 *       if (payload.event === 'INSERT') {
 *         setPosts(prev => [...prev, payload.new]);
 *       } else if (payload.event === 'UPDATE') {
 *         setPosts(prev => prev.map(p => p.id === payload.new.id ? payload.new : p));
 *       } else if (payload.event === 'DELETE') {
 *         setPosts(prev => prev.filter(p => p.id !== payload.old.id));
 *       }
 *     }
 *   });
 *
 *   return (
 *     <div>
 *       <p>Status: {status}</p>
 *       {posts.map(post => <div key={post.id}>{post.title}</div>)}
 *     </div>
 *   );
 * }
 * ```
 */
export function useSubscription<TData = unknown>(
  table: string,
  options: SubscriptionOptions<TData> = {}
): SubscriptionState {
  const client = useZendbx();
  const { event = '*', callback, onError } = options;

  const [status, setStatus] = useState<SubscriptionState['status']>('connecting');
  const [error, setError] = useState<Error | null>(null);

  const subscriptionRef = useRef<unknown>(null);
  const mounted = useRef(true);

  const handlePayload = useCallback(
    (payload: SubscriptionPayload<TData>) => {
      if (callback) {
        callback(payload);
      }
    },
    [callback]
  );

  const handleError = useCallback(
    (err: Error) => {
      if (!mounted.current) return;
      setError(err);
      setStatus('error');
      if (onError) {
        onError(err);
      }
    },
    [onError]
  );

  useEffect(() => {
    mounted.current = true;

    const subscribe = () => {
      try {
        setStatus('connecting');
        setError(null);

        // Check if realtime module has 'from' method (will be available in future SDK versions)
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        const realtimeModule = client.realtime as any;
        
        if (typeof realtimeModule.from === 'function') {
          // Full realtime support available
          const subscription = realtimeModule
            .from(table)
            .on(event, (payload: unknown) => {
              if (mounted.current) {
                setStatus('connected');
                handlePayload(payload as SubscriptionPayload<TData>);
              }
            })
            .subscribe();

          subscriptionRef.current = subscription;

          if (mounted.current) {
            setStatus('connected');
          }
        } else {
          // Realtime not fully supported in current SDK version
          const err = new Error(
            'Realtime subscriptions require SDK update. Current SDK only provides websocket URL. ' +
            'Please update @zendbx/sdk to a version that includes full RealtimeModule support.'
          );
          handleError(err);
        }
      } catch (err) {
        const error = err instanceof Error ? err : new Error('Subscription failed');
        handleError(error);
      }
    };

    subscribe();

    return () => {
      mounted.current = false;
      if (subscriptionRef.current) {
        try {
          // Unsubscribe using SDK's unsubscribe method
          // eslint-disable-next-line @typescript-eslint/no-explicit-any
          (subscriptionRef.current as any).unsubscribe?.();
        } catch (err) {
          console.error('Failed to unsubscribe:', err);
        }
      }
      setStatus('disconnected');
    };
  }, [client, table, event, handlePayload, handleError]);

  return {
    status,
    error,
  };
}
