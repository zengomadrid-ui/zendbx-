import { useState, useEffect, useRef } from 'react';
import { useZendbx } from '../core/useZendbx';

/**
 * Channel state interface
 */
export interface ChannelState {
  status: 'connecting' | 'connected' | 'disconnected' | 'error';
  error: Error | null;
  isConnected: boolean;
}

/**
 * Channel options
 */
export interface ChannelOptions {
  onMessage?: (event: string, payload: unknown) => void;
  onError?: (error: Error) => void;
  onConnect?: () => void;
  onDisconnect?: () => void;
}

/**
 * useChannel - Real-time channel management
 *
 * Manages real-time channels for bidirectional communication.
 * Note: This is a placeholder implementation. The SDK's realtime module
 * currently only provides websocket URL. Full channel support requires
 * websocket implementation.
 *
 * @param channelName - Channel name to connect to
 * @param options - Channel options
 * @returns Channel state
 *
 * @example
 * ```tsx
 * function ChatRoom({ roomId }) {
 *   const { status, isConnected } = useChannel(`room:${roomId}`, {
 *     onMessage: (event, payload) => {
 *       if (event === 'message') {
 *         console.log('New message:', payload);
 *       }
 *     },
 *     onConnect: () => console.log('Connected'),
 *     onDisconnect: () => console.log('Disconnected')
 *   });
 *
 *   return (
 *     <div>
 *       <p>Status: {status}</p>
 *       <p>Connected: {isConnected ? 'Yes' : 'No'}</p>
 *     </div>
 *   );
 * }
 * ```
 */
export function useChannel(
  channelName: string,
  options: ChannelOptions = {}
): ChannelState {
  const client = useZendbx();
  const { onError, onConnect, onDisconnect } = options;

  const [status, setStatus] = useState<ChannelState['status']>('connecting');
  const [error, setError] = useState<Error | null>(null);

  const mounted = useRef(true);

  useEffect(() => {
    mounted.current = true;

    const connect = () => {
      try {
        setStatus('connecting');
        setError(null);

        // Get websocket URL from SDK
        const wsUrl = client.realtime.getWebSocketUrl();

        // For now, just log that we have the URL
        // Full WebSocket implementation would go here
        console.log('[useChannel] WebSocket URL:', wsUrl, 'Channel:', channelName);

        // Simulate connection (would be real WebSocket in production)
        if (mounted.current) {
          setStatus('connected');
          if (onConnect) {
            onConnect();
          }
        }
      } catch (err) {
        if (!mounted.current) return;
        const error = err instanceof Error ? err : new Error('Channel connection failed');
        setError(error);
        setStatus('error');
        if (onError) {
          onError(error);
        }
      }
    };

    connect();

    return () => {
      mounted.current = false;
      setStatus('disconnected');
      if (onDisconnect) {
        onDisconnect();
      }
    };
  }, [client, channelName, onError, onConnect, onDisconnect]);

  return {
    status,
    error,
    isConnected: status === 'connected',
  };
}
