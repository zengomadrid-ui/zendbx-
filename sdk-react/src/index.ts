/**
 * @zendbx/react - Official React SDK for ZendBX
 * 
 * A lightweight React wrapper around @zendbx/sdk providing:
 * - React Hooks for all operations
 * - Built-in caching and state management
 * - TypeScript support with full type inference
 * - SSR compatibility
 * 
 * @example
 * ```tsx
 * import { createClient } from '@zendbx/sdk';
 * import { ZendbxProvider, useAuth, useQuery } from '@zendbx/react';
 * 
 * const client = createClient({
 *   apiUrl: 'https://api.zendbx.in',
 *   projectSlug: 'my-project',
 *   anonKey: 'your-anon-key'
 * });
 * 
 * function App() {
 *   return (
 *     <ZendbxProvider client={client}>
 *       <Dashboard />
 *     </ZendbxProvider>
 *   );
 * }
 * 
 * function Dashboard() {
 *   const { user, isAuthenticated } = useAuth();
 *   return <div>Welcome, {user?.email}</div>;
 * }
 * ```
 */

// ========================================
// Provider
// ========================================
export { ZendbxProvider } from './provider';
export type { ZendbxProviderProps, ZendbxContextValue } from './provider';

// ========================================
// Core Hooks
// ========================================
export { useZendbx, useConfig } from './hooks/core';

// ========================================
// Authentication Hooks
// ========================================
export {
  useAuth,
  useUser,
  useSignIn,
  useSignUp,
  useSignOut,
  useSession,
} from './hooks/auth';
export type { AuthState, SessionState } from './hooks/auth';

// ========================================
// Data Hooks
// ========================================
export {
  useQuery,
  useMutation,
  useInsert,
  useUpdate,
  useDelete,
} from './hooks/data';
export type { UpdateVariables, DeleteVariables } from './hooks/data';

// ========================================
// Realtime Hooks
// ========================================
export {
  useSubscription,
  useChannel,
} from './hooks/realtime';
export type { ChannelState, ChannelOptions } from './hooks/realtime';

// ========================================
// Storage Hooks
// ========================================
export {
  useUpload,
  useDownload,
  useFileList,
} from './hooks/storage';
export type {
  UploadState,
  DownloadState,
  DownloadOptions,
  FileMetadata,
  FileListOptions,
} from './hooks/storage';

// ========================================
// Cache Hooks
// ========================================
export {
  useQueryCache,
  useInvalidateQuery,
} from './hooks/cache';
export type { QueryCache } from './hooks/cache';

// ========================================
// Components
// ========================================
export {
  AuthGuard,
  GuestGuard,
} from './components';
export type { AuthGuardProps, GuestGuardProps } from './components';

// ========================================
// Types
// ========================================
export type {
  QueryState,
  MutationState,
  QueryOptions,
  MutationOptions,
  CacheConfig,
  QueryKey,
  QueryFunction,
  InfiniteQueryOptions,
  InfiniteQueryResult,
  InfiniteQueryState,
  SubscriptionOptions,
  SubscriptionPayload,
  SubscriptionState,
  UploadProgress,
  UploadOptions,
} from './types';

// Re-export SDK types for convenience
export type {
  ZendbxClient,
  ClientConfig,
  User,
  SignUpData,
  SignInData,
  AuthResponse,
  ZendbxResponse,
  ZendbxError,
} from './types';
