/**
 * Core types for @zendbx/react
 * Re-exports types from @zendbx/sdk and adds React-specific types
 */

// Re-export all SDK types
export type {
  ZendbxClient,
  ClientConfig,
  User,
  SignUpData,
  SignInData,
  AuthResponse,
  ZendbxResponse,
  ZendbxError,
} from '@zendbx/sdk';

/**
 * Query state
 */
export interface QueryState<TData = unknown> {
  data: TData | undefined;
  error: Error | null;
  loading: boolean;
  isSuccess: boolean;
  isError: boolean;
  isLoading: boolean;
  isFetching: boolean;
  refetch: () => Promise<void>;
}

/**
 * Mutation state
 */
export interface MutationState<TData = unknown, TVariables = unknown> {
  data: TData | undefined;
  error: Error | null;
  loading: boolean;
  isSuccess: boolean;
  isError: boolean;
  isLoading: boolean;
  mutate: (variables: TVariables) => Promise<TData | undefined>;
  mutateAsync: (variables: TVariables) => Promise<TData>;
  reset: () => void;
}

/**
 * Query options
 */
export interface QueryOptions<TData = unknown> {
  enabled?: boolean;
  staleTime?: number;
  cacheTime?: number;
  refetchOnMount?: boolean;
  refetchOnWindowFocus?: boolean;
  refetchOnReconnect?: boolean;
  retry?: number | boolean;
  retryDelay?: number;
  suspense?: boolean;
  onSuccess?: (data: TData) => void;
  onError?: (error: Error) => void;
  onSettled?: (data: TData | undefined, error: Error | null) => void;
}

/**
 * Mutation options
 */
export interface MutationOptions<TData = unknown, TVariables = unknown> {
  onSuccess?: (data: TData, variables: TVariables) => void;
  onError?: (error: Error, variables: TVariables) => void;
  onSettled?: (data: TData | undefined, error: Error | null, variables: TVariables) => void;
  onMutate?: (variables: TVariables) => Promise<unknown> | unknown;
  retry?: number | boolean;
  retryDelay?: number;
}

/**
 * Cache configuration
 */
export interface CacheConfig {
  staleTime?: number;
  cacheTime?: number;
  retry?: number;
  retryDelay?: number;
}

/**
 * Query key type
 */
export type QueryKey = readonly unknown[];

/**
 * Query function type
 */
export type QueryFunction<TData = unknown> = () => Promise<TData>;

/**
 * Infinite query options
 */
export interface InfiniteQueryOptions<TData = unknown, TPageParam = unknown>
  extends Omit<QueryOptions<TData>, 'onSuccess' | 'onError' | 'onSettled'> {
  getNextPageParam?: (lastPage: TData, allPages: TData[]) => TPageParam | undefined;
  getPreviousPageParam?: (firstPage: TData, allPages: TData[]) => TPageParam | undefined;
  onSuccess?: (data: InfiniteQueryResult<TData>) => void;
  onError?: (error: Error) => void;
}

/**
 * Infinite query result
 */
export interface InfiniteQueryResult<TData = unknown> {
  pages: TData[];
  pageParams: unknown[];
}

/**
 * Infinite query state
 */
export interface InfiniteQueryState<TData = unknown> extends Omit<QueryState<InfiniteQueryResult<TData>>, 'refetch'> {
  fetchNextPage: () => Promise<void>;
  fetchPreviousPage: () => Promise<void>;
  hasNextPage: boolean;
  hasPreviousPage: boolean;
  isFetchingNextPage: boolean;
  isFetchingPreviousPage: boolean;
  refetch: () => Promise<void>;
}

/**
 * Subscription options
 */
export interface SubscriptionOptions<TData = unknown> {
  event?: 'INSERT' | 'UPDATE' | 'DELETE' | '*';
  callback?: (payload: SubscriptionPayload<TData>) => void;
  onError?: (error: Error) => void;
}

/**
 * Subscription payload
 */
export interface SubscriptionPayload<TData = unknown> {
  event: 'INSERT' | 'UPDATE' | 'DELETE';
  new: TData | null;
  old: TData | null;
  table: string;
}

/**
 * Subscription state
 */
export interface SubscriptionState {
  status: 'connecting' | 'connected' | 'disconnected' | 'error';
  error: Error | null;
}

/**
 * Upload progress
 */
export interface UploadProgress {
  loaded: number;
  total: number;
  percentage: number;
}

/**
 * Upload options
 */
export interface UploadOptions {
  onProgress?: (progress: UploadProgress) => void;
  onSuccess?: (data: unknown) => void;
  onError?: (error: Error) => void;
}
