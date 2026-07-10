/**
 * ZendBX Query Builder v2 - Fluent API
 * Supabase-compatible filtering with deferred execution
 */

import { HttpClient } from './http';
import type { ZendbxResponse } from './types';

export interface QueryFilter {
  column: string;
  operator: string;
  value: any;
}

export interface QueryOptions {
  filters: QueryFilter[];
  orderBy?: { column: string; ascending?: boolean };
  limit?: number;
  offset?: number;
  range?: { from: number; to: number };
  single?: boolean;
  maybeSingle?: boolean;
}

/**
 * Query Builder - Fluent filtering API
 */
export class QueryBuilder<T = any> {
  private options: QueryOptions = { filters: [] };

  constructor(
    private http: HttpClient,
    private baseUrl: string,
  ) {}

  /**
   * Equal to (=)
   */
  eq(column: string, value: any): this {
    this.options.filters.push({ column, operator: 'eq', value });
    return this;
  }

  /**
   * Not equal to (!=)
   */
  neq(column: string, value: any): this {
    this.options.filters.push({ column, operator: 'neq', value });
    return this;
  }

  /**
   * Greater than (>)
   */
  gt(column: string, value: any): this {
    this.options.filters.push({ column, operator: 'gt', value });
    return this;
  }

  /**
   * Greater than or equal (>=)
   */
  gte(column: string, value: any): this {
    this.options.filters.push({ column, operator: 'gte', value });
    return this;
  }

  /**
   * Less than (<)
   */
  lt(column: string, value: any): this {
    this.options.filters.push({ column, operator: 'lt', value });
    return this;
  }

  /**
   * Less than or equal (<=)
   */
  lte(column: string, value: any): this {
    this.options.filters.push({ column, operator: 'lte', value });
    return this;
  }

  /**
   * LIKE (pattern matching)
   */
  like(column: string, pattern: string): this {
    this.options.filters.push({ column, operator: 'like', value: pattern });
    return this;
  }

  /**
   * ILIKE (case-insensitive pattern matching)
   */
  ilike(column: string, pattern: string): this {
    this.options.filters.push({ column, operator: 'ilike', value: pattern });
    return this;
  }

  /**
   * IN (value in list)
   */
  in(column: string, values: any[]): this {
    this.options.filters.push({ column, operator: 'in', value: values });
    return this;
  }

  /**
   * IS (null checks)
   */
  is(column: string, value: null | boolean): this {
    this.options.filters.push({ column, operator: 'is', value });
    return this;
  }

  /**
   * CONTAINS (array/JSON contains)
   */
  contains(column: string, value: any): this {
    this.options.filters.push({ column, operator: 'cs', value });
    return this;
  }

  /**
   * CONTAINED BY (array/JSON contained by)
   */
  containedBy(column: string, value: any): this {
    this.options.filters.push({ column, operator: 'cd', value });
    return this;
  }

  /**
   * Match multiple columns
   */
  match(conditions: Record<string, any>): this {
    for (const [column, value] of Object.entries(conditions)) {
      this.eq(column, value);
    }
    return this;
  }

  /**
   * OR filter (PostgREST syntax)
   */
  or(expression: string): this {
    this.options.filters.push({ column: 'or', operator: 'or', value: expression });
    return this;
  }

  /**
   * NOT filter
   */
  not(column: string, operator: string, value: any): this {
    this.options.filters.push({ column, operator: `not.${operator}`, value });
    return this;
  }

  /**
   * ORDER BY
   */
  order(column: string, options?: { ascending?: boolean; nullsFirst?: boolean }): this {
    this.options.orderBy = {
      column,
      ascending: options?.ascending ?? true,
    };
    return this;
  }

  /**
   * LIMIT
   */
  limit(count: number): this {
    this.options.limit = count;
    return this;
  }

  /**
   * OFFSET
   */
  offset(count: number): this {
    this.options.offset = count;
    return this;
  }

  /**
   * RANGE (pagination)
   */
  range(from: number, to: number): this {
    this.options.range = { from, to };
    return this;
  }

  /**
   * Expect single row
   */
  single(): this {
    this.options.single = true;
    return this;
  }

  /**
   * Maybe single row (null if not found)
   */
  maybeSingle(): this {
    this.options.maybeSingle = true;
    return this;
  }

  /**
   * Build query string from filters
   */
  private buildQueryString(additionalParams?: Record<string, string>): string {
    const params = new URLSearchParams(additionalParams);

    // Add filters
    for (const filter of this.options.filters) {
      if (filter.operator === 'or') {
        params.append('or', filter.value);
      } else if (filter.operator === 'in') {
        params.append(filter.column, `in.(${filter.value.join(',')})`);
      } else if (filter.operator === 'is') {
        params.append(filter.column, `is.${filter.value === null ? 'null' : filter.value}`);
      } else if (Array.isArray(filter.value)) {
        params.append(filter.column, `${filter.operator}.(${JSON.stringify(filter.value)})`);
      } else {
        params.append(filter.column, `${filter.operator}.${filter.value}`);
      }
    }

    // Add order
    if (this.options.orderBy) {
      const orderValue = this.options.orderBy.ascending
        ? this.options.orderBy.column
        : `${this.options.orderBy.column}.desc`;
      params.append('order', orderValue);
    }

    // Add limit
    if (this.options.limit) {
      params.append('limit', String(this.options.limit));
    }

    // Add offset
    if (this.options.offset) {
      params.append('offset', String(this.options.offset));
    }

    const queryString = params.toString();
    return queryString ? `?${queryString}` : '';
  }

  /**
   * Execute SELECT query
   */
  async select(columns: string = '*'): Promise<ZendbxResponse<T[]>> {
    const queryString = this.buildQueryString({ select: columns });
    const url = `${this.baseUrl}${queryString}`;
    
    const response = await this.http.get<T[]>(url);
    
    // Handle single/maybeSingle
    if (this.options.single || this.options.maybeSingle) {
      if (response.data && Array.isArray(response.data)) {
        if (response.data.length === 0) {
          if (this.options.single) {
            return {
              data: null,
              error: { message: 'No rows found', status: 404 },
            };
          }
          return { data: null, error: null };
        }
        if (response.data.length > 1 && this.options.single) {
          return {
            data: null,
            error: { message: 'Multiple rows returned for single()', status: 400 },
          };
        }
        return { data: response.data[0] as any, error: null };
      }
    }
    
    return response;
  }

  /**
   * Execute UPDATE query
   */
  async update(data: Partial<T>): Promise<ZendbxResponse<T>> {
    const queryString = this.buildQueryString();
    const url = `${this.baseUrl}${queryString}`;
    return this.http.patch<T>(url, data);
  }

  /**
   * Execute DELETE query
   */
  async delete(): Promise<ZendbxResponse<void>> {
    const queryString = this.buildQueryString();
    const url = `${this.baseUrl}${queryString}`;
    return this.http.delete<void>(url);
  }
}
