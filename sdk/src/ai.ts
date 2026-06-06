import type { HttpClient } from './http';
import type {
  ZendbxResponse,
  AISQLResult,
  AIExplainResult,
  AIFixResult,
} from './types';

export class AIModule {
  constructor(
    private http: HttpClient,
    private projectId: string
  ) {}

  /**
   * Convert a natural-language question into SQL.
   *
   * @example
   * const { data } = await zendbx.ai.generateSQL('show all active users created this month')
   * console.log(data?.sql) // SELECT * FROM users WHERE ...
   */
  async generateSQL(question: string): Promise<ZendbxResponse<AISQLResult>> {
    return this.http.request<AISQLResult>(`/api/ai/${this.projectId}/query`, {
      method: 'POST',
      body: { question },
    });
  }

  /**
   * Explain what a SQL query does in plain English.
   */
  async explainSQL(sql: string): Promise<ZendbxResponse<AIExplainResult>> {
    return this.http.request<AIExplainResult>(`/api/ai/${this.projectId}/explain`, {
      method: 'POST',
      body: { sql },
    });
  }

  /**
   * Explain a SQL error and suggest a fix.
   */
  async explainError(
    sql: string,
    error: string
  ): Promise<ZendbxResponse<AIExplainResult & { suggestion?: string }>> {
    return this.http.request(`/api/ai/${this.projectId}/explain-error`, {
      method: 'POST',
      body: { sql, error },
    });
  }

  /**
   * Auto-fix a broken SQL query.
   */
  async fixSQL(sql: string, error?: string): Promise<ZendbxResponse<AIFixResult>> {
    return this.http.request<AIFixResult>(`/api/ai/${this.projectId}/auto-fix`, {
      method: 'POST',
      body: { sql, error },
    });
  }

  /**
   * Get AI-generated insights about your tables and data.
   */
  async getInsights(): Promise<ZendbxResponse<{ insights: string[] }>> {
    return this.http.request(`/api/ai/${this.projectId}/insights`);
  }
}
