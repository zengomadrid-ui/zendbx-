import React from 'react';
import { useAuth } from '../hooks/auth/useAuth';

/**
 * GuestGuard props
 */
export interface GuestGuardProps {
  /**
   * Children to render when NOT authenticated (guest)
   */
  children: React.ReactNode;

  /**
   * Component to render when authenticated
   */
  fallback?: React.ReactNode;

  /**
   * Component to render while loading
   */
  loading?: React.ReactNode;
}

/**
 * GuestGuard - Protect routes that should only be accessible to guests
 *
 * Renders children only when user is NOT authenticated.
 * Shows fallback when authenticated (e.g., redirect to dashboard).
 *
 * @example
 * ```tsx
 * function App() {
 *   return (
 *     <GuestGuard fallback={<Navigate to="/dashboard" />}>
 *       <LoginPage />
 *     </GuestGuard>
 *   );
 * }
 * ```
 */
export function GuestGuard({ children, fallback, loading }: GuestGuardProps) {
  const { isAuthenticated, loading: authLoading } = useAuth();

  // Show loading state
  if (authLoading) {
    return <>{loading || null}</>;
  }

  // Show fallback if authenticated
  if (isAuthenticated) {
    return <>{fallback || null}</>;
  }

  // Render children if not authenticated (guest)
  return <>{children}</>;
}
