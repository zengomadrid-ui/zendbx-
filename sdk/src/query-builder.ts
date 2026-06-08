import type { HttpClient } from './http';
import type { ZendbxResponse, FilterOperator, QueryFilter, OrderClause } from './types';

/**
 * Chainable query builder — mirrors the Supabase JS client API.
 *
 * @example
 * const { data, error } = await zendbx
 *   .from('posts')
 *   .select('id, title, body')
 *   .eq('published', true)
 *   .order('created_at', { ascending: false })
 *   .limit(20)
 *   .execute()
 */
export class QueryBuilder<Row extends Record<string, unknown> = Record<string, unknown>> {
  private _select = '*';
  private _filters: QueryFilter[] = [];
  private _order: OrderClause | null = null;
  private _limit: number | null = null;
  private _offset: number | null = null;

  constructor(
    private http: HttpClient,
    private table: string
  ) {}

  // ─── Column selection ───────────────────────────────────────────────────────

  select(columns: string): this {
    this._select = columns;
    return this;
  }

  // ─── Filters ────────────────────────────────────────────────────────────────

  eq(column: string, value: unknown): this {
    return this._addFilter(column, 'eq', value);
  }

  neq(column: string, value: unknown): this {
    return this._addFilter(column, 'neq', value);
  }

  gt(column: string, value: unknown): this {
    return this._addFilter(column, 'gt', value);
  }

  gte(column: string, value: unknown): this {
    return this._addFilter(column, 'gte', value);
  }

  lt(column: string, value: unknown): this {
    return this._addFilter(column, 'lt', value);
  }

  lte(column: string, value: unknown): this {
    return this._addFilter(column, 'lte', value);
  }

  /** SQL LIKE — use % as wildcard, e.g. `.like('name', 'John%')` */
  like(column: string, pattern: string): this {
    return this._addFilter(column, 'like', pattern);
  }

  /** Case-insensitive LIKE */
  ilike(column: string, pattern: string): this {
    return this._addFilter(column, 'ilike', pattern);
  }

  /** SQL IN — pass an array of values */
  in(column: string, values: unknown[]): this {
    return this._addFilter(column, 'in', values);
  }

  /** IS NULL / IS TRUE / IS FALSE */
  is(column: string, value: null | boolean): this {
    return this._addFilter(column, 'is', value);
  }

  // ─── Sorting / Pagination ───────────────────────────────────────────────────

  order(column: string, options: { ascending?: boolean } = {}): this {
    this._order = { column, ascending: options.ascending ?? true };
    return this;
  }

  limit(count: number): this {
    this._limit = count;
    return this;
  }

  /** Select rows from `from` to `to` (inclusive, 0-indexed) */
  range(from: number, to: number): this {
    this._offset = from;
    this._limit = to - from + 1;
    return this;
  }

  // ─── Execution ──────────────────────────────────────────────────────────────

  /** Execute a SELECT query */
  async execute(): Promise<ZendbxResponse<Row[]>> {
    const params = this._buildParams();
    return this.http.request<Row[]>(`/rest/v1/${this.table}?${params}`);
  }

  /** Insert one or more rows — returns a MutationBuilder so you can chain .select() */
  insert(data: Partial<Row> | Partial<Row>[]): MutationBuilder<Row> {
    return new MutationBuilder<Row>(this.http, this.table, 'POST', data);
  }

  /** Update rows matching the applied filters — returns a MutationBuilder so you can chain .select() */
  update(data: Partial<Row>): MutationBuilder<Row> {
    const params = this._buildFilterParams();
    return new MutationBuilder<Row>(this.http, this.table, 'PATCH', data, params);
  }

  /** Upsert rows (insert or update on conflict) */
  upsert(data: Partial<Row> | Partial<Row>[]): MutationBuilder<Row> {
    return new MutationBuilder<Row>(this.http, this.table, 'POST', data, '', true);
  }

  /** Delete rows matching the applied filters */
  async delete(): Promise<ZendbxResponse<null>> {
    const params = this._buildFilterParams();
    return this.http.request<null>(`/rest/v1/${this.table}?${params}`, {
      method: 'DELETE',
    });
  }

  // ─── Private helpers ────────────────────────────────────────────────────────

  private _addFilter(column: string, op: FilterOperator, value: unknown): this {
    this._filters.push({ column, op, value });
    return this;
  }

  private _buildParams(): string {
    const p = new URLSearchParams();
    p.append('select', this._select);
    this._appendFilters(p);
    if (this._order) {
      p.append('order', `${this._order.column}.${this._order.ascending ? 'asc' : 'desc'}`);
    }
    if (this._limit !== null) p.append('limit', String(this._limit));
    if (this._offset !== null) p.append('offset', String(this._offset));
    return p.toString();
  }

  private _buildFilterParams(): string {
    const p = new URLSearchParams();
    this._appendFilters(p);
    return p.toString();
  }

  private _appendFilters(p: URLSearchParams): void {
    for (const f of this._filters) {
      const serialized = Array.isArray(f.value)
        ? `in.(${(f.value as unknown[]).join(',')})`
        : `${f.op}.${f.value}`;
      p.append(f.column, serialized);
    }
  }
}

/**
 * Chainable builder for mutation operations (insert, update, upsert).
 * Allows `.select()` to be called after a mutation, matching Supabase's API.
 *
 * @example
 * const { data, error } = await zendbx.from('profiles').insert({ id, name }).select()
 * const { data, error } = await zendbx.from('posts').update({ title }).eq('id', 1).select('id, title')
 */
export class MutationBuilder<Row extends Record<string, unknown> = Record<string, unknown>> {
  private _selectColumns = '*';
  private _shouldSelect = false;
  private _single = false;

  constructor(
    private http: HttpClient,
    private table: string,
    private method: 'POST' | 'PATCH',
    private body: Partial<Row> | Partial<Row>[],
    private filterParams = '',
    private isUpsert = false
  ) {}

  /** Chain .select() after mutation to return the inserted/updated rows */
  select(columns = '*'): this {
    this._selectColumns = columns;
    this._shouldSelect = true;
    return this;
  }

  /** Return a single object instead of an array */
  single(): this {
    this._single = true;
    return this;
  }

  /** Execute the mutation */
  then<TResult1 = ZendbxResponse<Row[]>, TResult2 = never>(
    onfulfilled: (value: ZendbxResponse<Row[]>) => TResult1 | PromiseLike<TResult1>,
    onrejected?: ((reason: unknown) => TResult2 | PromiseLike<TResult2>) | null
  ): Promise<TResult1 | TResult2> {
    return this._execute().then(onfulfilled, onrejected);
  }

  catch<TResult = never>(
    onrejected: (reason: unknown) => TResult | PromiseLike<TResult>
  ): Promise<ZendbxResponse<Row[]> | TResult> {
    return this._execute().catch(onrejected);
  }

  finally(onfinally?: (() => void) | null): Promise<ZendbxResponse<Row[]>> {
    return this._execute().finally(onfinally);
  }

  private async _execute(): Promise<ZendbxResponse<Row[]>> {
    const url = this.filterParams
      ? `/rest/v1/${this.table}?${this.filterParams}`
      : `/rest/v1/${this.table}`;

    const headers: Record<string, string> = {};

    // PostgREST-style: request representation back
    if (this._shouldSelect) {
      headers['Prefer'] = 'return=representation';
    }

    if (this.isUpsert) {
      headers['Prefer'] = (headers['Prefer'] ? headers['Prefer'] + ',' : '') + 'resolution=merge-duplicates';
    }

    const result = await this.http.request<Row[]>(url, {
      method: this.method,
      body: this.body,
      headers,
    });

    // If select wasn't chained, return empty data array on success
    if (!this._shouldSelect && !result.error) {
      return { data: [], error: null };
    }

    return result;
  }
}
