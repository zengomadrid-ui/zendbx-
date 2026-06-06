// ─── Core Response Shape ────────────────────────────────────────────────────

export interface ZendbxResponse<T = unknown> {
  data: T | null;
  error: ZendbxError | null;
}

export interface ZendbxError {
  message: string;
  status?: number;
  details?: unknown;
}

// ─── Auth Types ─────────────────────────────────────────────────────────────

export interface User {
  id: string;
  email: string;
  name?: string;
  role?: string;
  created_at?: string;
  [key: string]: unknown;
}

export interface Session {
  access_token: string;
  token_type: 'bearer';
  user: User;
  expires_in: number;
}

export interface AuthData {
  user: User | null;
  session: Session | null;
}

export interface SignUpCredentials {
  email: string;
  password: string;
  name?: string;
}

export interface SignInCredentials {
  email: string;
  password: string;
}

// ─── Query Builder Types ─────────────────────────────────────────────────────

export type FilterOperator = 'eq' | 'neq' | 'gt' | 'gte' | 'lt' | 'lte' | 'like' | 'ilike' | 'in' | 'is';

export interface QueryFilter {
  column: string;
  op: FilterOperator;
  value: unknown;
}

export interface OrderClause {
  column: string;
  ascending: boolean;
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
  public: boolean;
  created_at: string;
}

export interface StorageObject {
  id: string;
  name: string;
  bucket_id: string;
  size?: number;
  content_type?: string;
  created_at: string;
  url?: string;
}

// ─── Analytics Types ──────────────────────────────────────────────────────────

export interface QueryAnalytics {
  total_queries: number;
  avg_execution_time_ms: number;
  slow_queries: number;
  error_rate: number;
}

export interface StorageAnalytics {
  total_size_bytes: number;
  bucket_count: number;
  object_count: number;
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
