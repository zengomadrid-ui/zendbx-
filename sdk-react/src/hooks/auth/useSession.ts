import { useState, useEffect, useCallback } from 'react';
import { useZendbx } from '../core/useZendbx';

/**
 * Session state interface
 */
export interface SessionState {
  session: string | null;
  loading: boolean;
  isValid: boolean;
  refresh: () => Promise<void>;
  clear: () => void;
}

/**
 * useSession - Session management hook
 *
 * Manages user session state with refresh and validation.
 *
 * @returns Session state and management functions
 *
 * @example
 * ```tsx
 * function SessionMonitor() {
 *   const { session, isValid, loading, refresh, clear } = useSession();
 *
 *   if (loading) return <div>Loading session...</div>;
 *
 *   return (
 *     <div>
 *       <p>Session: {session ? 'Active' : 'None'}</p>
 *       <p>Valid: {isValid ? 'Yes' : 'No'}</p>
 *       <button onClick={refresh}>Refresh Session</button>
 *       <button onClick={clear}>Clear Session</button>
 *     </div>
 *   );
 * }
 * ```
 */
export function useSession(): SessionState {
  const client = useZendbx();
  const [session, setSession] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);

  const fetchSession = useCallback(async () => {
    try {
      setLoading(true);
      const currentSession = client.auth.getSession();
      setSession(currentSession);
    } catch (error) {
      console.error('Failed to fetch session:', error);
      setSession(null);
    } finally {
      setLoading(false);
    }
  }, [client]);

  const refresh = useCallback(async () => {
    await fetchSession();
  }, [fetchSession]);

  const clear = useCallback(() => {
    setSession(null);
    // Optionally call sign out
    client.auth.signOut().catch(console.error);
  }, [client]);

  useEffect(() => {
    fetchSession();
  }, [fetchSession]);

  return {
    session,
    loading,
    isValid: !!session,
    refresh,
    clear,
  };
}
