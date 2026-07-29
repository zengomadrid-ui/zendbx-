import React from 'react';
import { useAuth } from '../hooks/auth/useAuth';

/**
 * AuthGuard props
 */
export interface AuthGuardProps {
  /**
   * Children to render when authenticated
   */
  children: React.ReactNode;

  /**
   * Component to render when not authenticated
   */
  fallback?: React.ReactNode;

  /**
   * Component to render while loading
   */
  loading?: React.ReactNode;
}

/**
 * AuthGuard - Protect routes that require authentication
 *
 * Renders children only when user is authenticated.
 * Shows fallback when not authenticated, and loading state while checking.
 *
 * @example
 * ```tsx
 * function App() {
 *   return (
 *     <AuthGuard
 *       fallback={<Navigate to="/login" />}
 *       loading={<div>Loading...</div>}
 *     >
 *       <Dashboard />
 *     </AuthGuard>
 *   );
 * }
 * ```
 */
export function AuthGuard({ children, fallback, loading }: AuthGuardProps) {
  const { isAuthenticated, loading: authLoading } = useAuth();

  // Show loading state
  if (authLoading) {
    return <>{loading || null}</>;
  }

  // Show fallback if not authenticated
  if (!isAuthenticated) {
    return <>{fallback || null}</>;
  }

  // Render children if authenticated
  return <>{children}</>;
}
