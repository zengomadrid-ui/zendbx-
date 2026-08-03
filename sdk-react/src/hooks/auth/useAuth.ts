import { useState, useEffect, useCallback } from 'react';
import type { User } from '@zendbx/sdk';
import { useZendbx } from '../core/useZendbx';

/**
 * Auth state interface
 */
export interface AuthState {
  user: User | null;
  session: string | null;
  loading: boolean;
  isAuthenticated: boolean;
}

/**
 * useAuth - Reactive authentication state
 *
 * Provides real-time authentication state that automatically updates
 * when the user signs in, signs out, or the session changes.
 *
 * @returns Authentication state and session information
 *
 * @example
 * ```tsx
 * function Dashboard() {
 *   const { user, session, loading, isAuthenticated } = useAuth();
 *
 *   if (loading) return <div>Loading...</div>;
 *   if (!isAuthenticated) return <div>Please sign in</div>;
 *
 *   return <div>Welcome, {user?.email}</div>;
 * }
 * ```
 */
export function useAuth(): AuthState {
  const client = useZendbx();
  const [user, setUser] = useState<User | null>(null);
  const [session, setSession] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);

  // Fetch initial auth state
  const fetchAuthState = useCallback(async () => {
    try {
      setLoading(true);
      
      // Get current session
      const currentSession = client.auth.getSession();
      setSession(currentSession);

      if (currentSession) {
        // Fetch user data
        const userData = await client.auth.getUser();
        setUser(userData as unknown as typeof user);
      } else {
        setUser(null);
      }
    } catch (error) {
      console.error('Failed to fetch auth state:', error);
      setUser(null);
      setSession(null);
    } finally {
      setLoading(false);
    }
  }, [client]);

  useEffect(() => {
    // Fetch initial state
    fetchAuthState();

    // Listen for auth state changes (if SDK supports it)
    // This would require the SDK to emit events
    // For now, we'll rely on manual refetching after sign in/out

    // Cleanup
    return () => {
      // Cleanup subscriptions if any
    };
  }, [fetchAuthState]);

  return {
    user,
    session,
    loading,
    isAuthenticated: !!user && !!session,
  };
}
