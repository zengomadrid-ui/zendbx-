// ─── Core Response Shape ────────────────────────────────────────────────────

/**
 * Standard response envelope for all ZendBX SDK operations
 * @template T - Type of data returned on success
 */
export interface ZendbxResponse<T = unknown> {
  /** Data payload on success, null on error */
  data: T | null;
  /** Error details on failure, null on success */
  error: ZendbxError | null;
}

/**
 * Error object returned by the ZendBX API
 */
export interface ZendbxError {
  /** Human-readable error message */
  message: string;
  /** HTTP status code */
  status?: number;
  /** Additional error context */
  details?: unknown;
  /** Error code for programmatic handling */
  code?: string;
  /** Server-side hint for resolving the error */
  hint?: string;
}

// ─── Generic Database Types ─────────────────────────────────────────────────

/**
 * JSON-compatible primitive value types
 */
export type JsonPrimitive = string | number | boolean | null;

/**
 * Recursive JSON value type
 */
export type JsonValue =
  | JsonPrimitive
  | JsonValue[]
  | { [key: string]: JsonValue };

/**
 * Generic database row - a record with unknown columns
 * Use generics for type-safe operations:
 * 
 * @example
 * interface User extends DatabaseRow {
 *   id: string;
 *   email: string;
 *   created_at: string;
 * }
 * 
 * const { data } = await client.from<User>('users').select()
 */
export type DatabaseRow = Record<string, unknown>;

// ─── Auth Types ─────────────────────────────────────────────────────────────

/**
 * Authenticated user object
 */
export interface User {
  /** Unique user identifier */
  id: string;
  /** User's email address */
  email: string;
  /** Optional display name */
  name?: string;
  /** Username (if applicable) */
  username?: string;
  /** Authentication provider (e.g., 'email', 'google', 'github') */
  provider?: string;
  /** Email verification status */
  email_verified?: boolean;
  /** User role */
  role?: string;
  /** Account creation timestamp */
  created_at?: string;
  /** Last update timestamp */
  updated_at?: string;
  /** Additional user metadata */
  [key: string]: unknown;
}

/**
 * Session object containing access token and user info
 */
export interface Session {
  /** JWT access token for authenticated requests */
  access_token: string;
  /** Refresh token for obtaining new access tokens */
  refresh_token: string;
  /** Token type (always 'bearer') */
  token_type: 'bearer';
  /** Authenticated user */
  user: User;
  /** Token expiry duration in seconds */
  expires_in: number;
  /** Token expiration timestamp */
  expires_at?: number;
}

/**
 * Complete authentication state
 */
export interface AuthData {
  /** Current user, null if not authenticated */
  user: User | null;
  /** Current session, null if not authenticated */
  session: Session | null;
}

/**
 * Sign-up credentials
 */
export interface SignUpCredentials {
  /** User's email address */
  email: string;
  /** Password (minimum 6 characters) */
  password: string;
  /** Optional display name */
  name?: string;
  /** Additional metadata */
  metadata?: Record<string, unknown>;
}

/**
 * Sign-in credentials
 */
export interface SignInCredentials {
  /** User's email address */
  email: string;
  /** Password */
  password: string;
}

/**
 * Password reset request
 */
export interface PasswordResetRequest {
  /** Email address for password reset */
  email: string;
}

/**
 * Password reset confirmation
 */
export interface PasswordResetConfirm {
  /** Reset token from email */
  token: string;
  /** New password */
  password: string;
}

/**
 * Email verification request
 */
export interface EmailVerification {
  /** Verification token from email */
  token: string;
}

/**
 * User update payload
 */
export interface UserUpdatePayload {
  /** Updated email */
  email?: string;
  /** Updated password */
  password?: string;
  /** Updated name */
  name?: string;
  /** Updated username */
  username?: string;
  /** Additional metadata updates */
  metadata?: Record<string, unknown>;
}

// Auth state change events
export type AuthChangeEvent =
  | 'SIGNED_IN'
  | 'SIGNED_OUT'
  | 'TOKEN_REFRESHED'
  | 'USER_UPDATED'
  | 'PASSWORD_RECOVERY'
  | 'USER_DELETED';

/**
 * Auth state change callback function
 */
export type AuthCallback = (event: AuthChangeEvent, session: Session | null) => void;

export interface AuthStateSubscription {
  unsubscribe: () => void;
  data: {
    subscription: {
      unsubscribe: () => void;
    };
  };
}

// ─── Query Builder Types ─────────────────────────────────────────────────────

/**
 * PostgREST-compatible filter operators
 */
export type FilterOperator = 
  | 'eq'    // Equal to
  | 'neq'   // Not equal to
  | 'gt'    // Greater than
  | 'gte'   // Greater than or equal
  | 'lt'    // Less than
  | 'lte'   // Less than or equal
  | 'like'  // SQL LIKE pattern match
  | 'ilike' // Case-insensitive LIKE
  | 'in'    // Value in array
  | 'is'    // IS null/true/false
  | 'not'   // Negation
  | 'cs'    // Contains (array/JSON)
  | 'cd'    // Contained by (array/JSON)
  | 'ov'    // Overlap (array)
  | 'sl'    // Strictly left of (range)
  | 'sr'    // Strictly right of (range)
  | 'nxr'   // Does not extend right of (range)
  | 'nxl'   // Does not extend left of (range)
  | 'adj'   // Adjacent to (range)
  | 'fts'   // Full-text search (tsvector)
  | 'plfts' // Plain full-text search
  | 'phfts' // Phrase full-text search
  | 'wfts'; // Websearch full-text search

/**
 * Filter condition for query builder
 */
export interface QueryFilter {
  /** Column name */
  column: string;
  /** Filter operator */
  op: FilterOperator;
  /** Comparison value */
  value: unknown;
}

/**
 * Order direction
 */
export type OrderDirection = 'asc' | 'desc';

/**
 * Order clause for sorting
 */
export interface OrderClause {
  /** Column to order by */
  column: string;
  /** Sort direction (default: ascending) */
  ascending: boolean;
  /** NULLS FIRST or NULLS LAST */
  nullsFirst?: boolean;
}

/**
 * Count algorithm for COUNT header
 */
export type CountType = 'exact' | 'planned' | 'estimated';

/**
 * Select options
 */
export interface SelectOptions {
  /** Request row count with specified algorithm */
  count?: CountType;
  /** Return single object instead of array */
  single?: boolean;
  /** Return single object or null (no error on 0 rows) */
  maybeSingle?: boolean;
}

/**
 * Insert options
 */
export interface InsertOptions {
  /** Return inserted rows */
  returning?: boolean;
  /** Columns to return */
  select?: string;
  /** Upsert on conflict */
  onConflict?: string;
}

/**
 * Update options
 */
export interface UpdateOptions {
  /** Return updated rows */
  returning?: boolean;
  /** Columns to return */
  select?: string;
}

/**
 * Delete options
 */
export interface DeleteOptions {
  /** Return deleted rows */
  returning?: boolean;
}

// ─── Project Types ───────────────────────────────────────────────────────────

export interface Project {
  id: string;
  name: string;
  description?: string;
  slug?: string;
  user_id: string;
  created_at: string;
  updated_at?: string;
  [key: string]: unknown;
}

export interface ProjectKeys {
  anon_key: string;
  service_role_key: string;
}

export interface CreateProjectInput {
  name: string;
  description?: string;
}

export interface UpdateProjectInput {
  name?: string;
  description?: string;
}

// ─── API Key Types ────────────────────────────────────────────────────────────

export interface ApiKey {
  id: string;
  name: string;
  key_prefix: string;
  key_type: 'anon' | 'service_role' | 'custom';
  role: string;
  is_active: boolean;
  created_at: string;
}

// ─── Query Types ─────────────────────────────────────────────────────────────

export interface QueryResult {
  rows: Record<string, unknown>[];
  rowCount: number;
  executionTime?: number;
}

export interface SavedQuery {
  id: string;
  name: string;
  description?: string;
  sql: string;
  project_id: string;
  created_at: string;
}

// ─── AI Types ────────────────────────────────────────────────────────────────

export interface AISQLResult {
  sql: string;
  explanation?: string;
  confidence?: number;
}

export interface AIExplainResult {
  explanation: string;
  tables_used?: string[];
  operations?: string[];
}

export interface AIFixResult {
  original_sql: string;
  fixed_sql: string;
  fixes_applied: string[];
}

// ─── Database Schema Types ────────────────────────────────────────────────────

export interface Column {
  name: string;
  type: string;
  nullable?: boolean;
  default?: string;
  primary_key?: boolean;
}

export interface TableSchema {
  name: string;
  columns: Column[];
  row_count?: number;
}

export interface RLSPolicy {
  id: string;
  table_name: string;
  name: string;
  command: 'SELECT' | 'INSERT' | 'UPDATE' | 'DELETE' | 'ALL';
  using_expression?: string;
  with_check_expression?: string;
  is_permissive?: boolean;
}

// ─── Backup Types ─────────────────────────────────────────────────────────────

export interface Backup {
  id: string;
  project_id: string;
  filename: string;
  size_bytes?: number;
  created_at: string;
  status: 'pending' | 'completed' | 'failed';
}

// ─── Team Types ───────────────────────────────────────────────────────────────

export interface TeamMember {
  id: string;
  user_id: string;
  email: string;
  name?: string;
  role: 'owner' | 'admin' | 'member' | 'viewer';
  joined_at: string;
}

// ─── Storage Types ────────────────────────────────────────────────────────────

export interface StorageBucket {
  id: string;
  name: string;
  slug: string;
  description?: string;
  is_public: boolean;
  storage_used: number;
  file_count: number;
  created_at: string;
  updated_at?: string;
}

export interface StorageObject {
  id: string;
  file_name: string;
  original_name: string;
  file_size: number;
  mime_type: string;
  storage_key: string;
  download_count?: number;
  last_downloaded_at?: string;
  created_at: string;
  updated_at?: string;
}

export interface StorageUploadResult {
  id: string;
  file_name: string;
  original_name: string;
  file_size: number;
  mime_type: string;
  storage_key: string;
}

export interface StorageSignedUrl {
  url: string;
  expires_in: number;
  expiry: string;
}

export interface StorageAnalytics {
  storage_used: number;
  max_storage: number;
  storage_used_percent: number;
  file_count: number;
  bucket_count: number;
  download_count: number;
  largest_files: StorageObject[];
  recent_uploads: StorageObject[];
  storage_growth: Array<{
    day: string;
    uploads: number;
    bytes_added: number;
  }>;
}

// ─── Analytics Types ──────────────────────────────────────────────────────────

export interface QueryAnalytics {
  total_queries: number;
  avg_execution_time_ms: number;
  slow_queries: number;
  error_rate: number;
}

// ─── Billing Types ────────────────────────────────────────────────────────────

export interface UsageQuota {
  storage_bytes: number;
  storage_limit: number;
  api_calls: number;
  api_calls_limit: number;
  projects: number;
  projects_limit: number;
}

// ─── Realtime Types ───────────────────────────────────────────────────────────

export type RealtimeEvent = 'INSERT' | 'UPDATE' | 'DELETE' | '*';

export interface RealtimePayload<T = Record<string, unknown>> {
  event: RealtimeEvent;
  table: string;
  schema: string;
  new: T | null;
  old: T | null;
}

export type RealtimeCallback<T = Record<string, unknown>> = (payload: RealtimePayload<T>) => void;
