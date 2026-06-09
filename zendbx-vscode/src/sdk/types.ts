export type AuthMode = 'jwt' | 'api-key';

export interface HttpClientConfig {
  baseUrl: string;
  authMode: AuthMode;
  authValue: string;
  timeout?: number;
}

export interface ApiResponse<T = unknown> {
  data?: T;
  error?: string;
  message?: string;
}

export interface LoginRequest {
  email: string;
  password: string;
}

export interface LoginResponse {
  access_token: string;
  token_type: string;
  user: User;
}

export interface User {
  id: string;
  email: string;
  name?: string;
  created_at: string;
}

export interface Project {
  id: string;
  name: string;
  slug: string;
  description?: string;
  database_url: string;
  created_at: string;
  updated_at: string;
  owner_id: string;
}

export interface ProjectKeysResponse {
  project_id: string;
  keys: {
    anon: {
      id: string;
      name: string;
      key_prefix: string;
      full_key: string;
      role: string;
      is_active: boolean;
      created_at: string;
    };
    service_role: {
      id: string;
      name: string;
      key_prefix: string;
      full_key: string;
      role: string;
      is_active: boolean;
      created_at: string;
    };
  };
}

export interface ProjectKeys {
  anon_key: string;
  service_role_key: string;
}

export interface CreateProjectRequest {
  name: string;
  description?: string;
}

export interface DatabaseTable {
  table_name: string;
  table_schema: string;
  table_type: string;
}

export interface QueryResult {
  columns: string[];
  rows: Record<string, unknown>[];
  row_count: number;
  execution_time_ms: number;
  logs?: Array<{
    statement: string;
    status: string;
    message: string;
    rows_affected: number;
    execution_time_ms: number;
  }>;
  auto_fixed?: boolean;
  original_sql?: string;
  fixed_sql?: string;
}

export interface QueryExecuteRequest {
  sql: string;
  question?: string;
  enable_autofix?: boolean;
}

export interface StorageBucket {
  id: string;
  name: string;
  public: boolean;
  created_at: string;
  updated_at: string;
}

export interface StorageFile {
  name: string;
  id: string;
  updated_at: string;
  created_at: string;
  last_accessed_at: string;
  metadata: Record<string, unknown>;
}
