import type { HttpClient } from './http';
import type {
  ZendbxResponse,
  QueryResult,
  SavedQuery,
  TableSchema,
  Column,
  RLSPolicy,
} from './types';

export class DatabaseModule {
  constructor(
    private http: HttpClient,
    private projectId: string
  ) {}

  // ─── Raw SQL Execution ──────────────────────────────────────────────────────

  /**
   * Execute a raw SQL query against the project database.
   * Auto-fix is applied on errors when possible.
   *
   * @example
   * const { data } = await zendbx.db.query('SELECT * FROM users LIMIT 10')
   */
  async query(sql: string): Promise<ZendbxResponse<QueryResult>> {
    return this.http.request<QueryResult>(`/api/projects/${this.projectId}/query`, {
      method: 'POST',
      body: { sql },
    });
  }

  // ─── Query History & Saved Queries ──────────────────────────────────────────

  /** Get recent query history */
  async getHistory(): Promise<ZendbxResponse<QueryResult[]>> {
    return this.http.request<QueryResult[]>(
      `/api/projects/${this.projectId}/query/history`
    );
  }

  /** List saved queries */
  async listSaved(): Promise<ZendbxResponse<SavedQuery[]>> {
    return this.http.request<SavedQuery[]>(
      `/api/projects/${this.projectId}/query/saved`
    );
  }

  /** Save a query for later use */
  async saveQuery(
    name: string,
    sql: string,
    description?: string
  ): Promise<ZendbxResponse<SavedQuery>> {
    return this.http.request<SavedQuery>(
      `/api/projects/${this.projectId}/query/save`,
      { method: 'POST', body: { name, sql, description } }
    );
  }

  /** Run a previously saved query */
  async runSaved(savedQueryId: string): Promise<ZendbxResponse<QueryResult>> {
    return this.http.request<QueryResult>(
      `/api/projects/${this.projectId}/query/saved/${savedQueryId}/run`,
      { method: 'POST' }
    );
  }

  /** Delete a saved query */
  async deleteSaved(savedQueryId: string): Promise<ZendbxResponse<{ message: string }>> {
    return this.http.request<{ message: string }>(
      `/api/projects/${this.projectId}/query/saved/${savedQueryId}`,
      { method: 'DELETE' }
    );
  }

  // ─── Schema Management ──────────────────────────────────────────────────────

  /** Get the full schema for the project database */
  async getSchema(): Promise<ZendbxResponse<{ tables: TableSchema[] }>> {
    return this.http.request(`/api/projects/${this.projectId}/db/schema`);
  }

  /** List all tables */
  async listTables(): Promise<ZendbxResponse<TableSchema[]>> {
    return this.http.request<TableSchema[]>(
      `/api/projects/${this.projectId}/db/tables`
    );
  }

  /** Get details for a single table */
  async getTable(tableName: string): Promise<ZendbxResponse<TableSchema>> {
    return this.http.request<TableSchema>(
      `/api/projects/${this.projectId}/db/tables/${tableName}`
    );
  }

  /** Create a new table */
  async createTable(
    tableName: string,
    columns: Column[]
  ): Promise<ZendbxResponse<TableSchema>> {
    return this.http.request<TableSchema>(
      `/api/projects/${this.projectId}/db/tables`,
      { method: 'POST', body: { table_name: tableName, columns } }
    );
  }

  /** Drop a table */
  async dropTable(tableName: string): Promise<ZendbxResponse<{ message: string }>> {
    return this.http.request<{ message: string }>(
      `/api/projects/${this.projectId}/db/tables/${tableName}`,
      { method: 'DELETE' }
    );
  }

  /** Add a column to an existing table */
  async addColumn(
    tableName: string,
    column: Column
  ): Promise<ZendbxResponse<{ message: string }>> {
    return this.http.request<{ message: string }>(
      `/api/projects/${this.projectId}/db/tables/${tableName}/columns`,
      { method: 'POST', body: column }
    );
  }

  // ─── Row Level Security ─────────────────────────────────────────────────────

  /** List RLS policies */
  async listPolicies(): Promise<ZendbxResponse<RLSPolicy[]>> {
    return this.http.request<RLSPolicy[]>(
      `/api/projects/${this.projectId}/db/rls/policies`
    );
  }

  /** Create an RLS policy */
  async createPolicy(
    policy: Omit<RLSPolicy, 'id'>
  ): Promise<ZendbxResponse<RLSPolicy>> {
    return this.http.request<RLSPolicy>(
      `/api/projects/${this.projectId}/db/rls/policies`,
      { method: 'POST', body: policy }
    );
  }

  /** Delete an RLS policy */
  async deletePolicy(policyId: string): Promise<ZendbxResponse<{ message: string }>> {
    return this.http.request<{ message: string }>(
      `/api/projects/${this.projectId}/db/rls/policies/${policyId}`,
      { method: 'DELETE' }
    );
  }
}
