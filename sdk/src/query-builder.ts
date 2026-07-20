import type { HttpClient } from './http';
import type { ZendbxResponse } from './types';

// ─── Filter types ────────────────────────────────────────────────────────────

type FilterOp = 'eq' | 'neq' | 'gt' | 'gte' | 'lt' | 'lte' | 'like' | 'ilike' | 'in' | 'is' | 'not';

interface Filter {
  column: string;
  op: FilterOp;
  value: unknown;
  /** for .not() — stores the inner operator */
  notOp?: string;
}

interface OrderClause {
  column: string;
  ascending: boolean;
}

// ─── Response shape ───────────────────────────────────────────────────────────

export interface ZendbxQueryResponse<T> {
  data: T | null;
  error: { message: string; status?: number; details?: unknown } | null;
  status: number;
  count?: number | null;
}

// ─── SelectBuilder ────────────────────────────────────────────────────────────
// Returned by .from().select() — handles GET queries

export class SelectBuilder<Row extends Record<string, unknown> = Record<string, unknown>>
  implements PromiseLike<ZendbxQueryResponse<Row[]>>
{
  protected _select = '*';
  protected _filters: Filter[] = [];
  protected _order: OrderClause | null = null;
  protected _limit: number | null = null;
  protected _offset: number | null = null;
  protected _single = false;
  protected _maybeSingle = false;
  protected _count: 'exact' | 'planned' | 'estimated' | null = null;

  constructor(
    protected http: HttpClient,
    protected table: string,
    protected projectId: string
  ) {}

  protected get _basePath(): string {
    return `/p/${this.projectId}/v1/rest/${this.table}`;
  }

  // ─── Column selection ───────────────────────────────────────────────────────

  select(columns = '*', options?: { count?: 'exact' | 'planned' | 'estimated' }): this {
    this._select = columns;
    if (options?.count) this._count = options.count;
    return this;
  }

  // ─── Filters ────────────────────────────────────────────────────────────────

  /** Exact match: `.eq('status', 'active')` → `?status=eq.active` */
  eq(column: string, value: unknown): this {
    this._filters.push({ column, op: 'eq', value });
    return this;
  }

  /** Not equal: `.neq('status', 'deleted')` */
  neq(column: string, value: unknown): this {
    this._filters.push({ column, op: 'neq', value });
    return this;
  }

  /** Greater than: `.gt('age', 18)` */
  gt(column: string, value: unknown): this {
    this._filters.push({ column, op: 'gt', value });
    return this;
  }

  /** Greater than or equal: `.gte('score', 90)` */
  gte(column: string, value: unknown): this {
    this._filters.push({ column, op: 'gte', value });
    return this;
  }

  /** Less than: `.lt('price', 100)` */
  lt(column: string, value: unknown): this {
    this._filters.push({ column, op: 'lt', value });
    return this;
  }

  /** Less than or equal: `.lte('age', 65)` */
  lte(column: string, value: unknown): this {
    this._filters.push({ column, op: 'lte', value });
    return this;
  }

  /** SQL LIKE: `.like('name', '%John%')` */
  like(column: string, pattern: string): this {
    this._filters.push({ column, op: 'like', value: pattern });
    return this;
  }

  /** Case-insensitive LIKE: `.ilike('email', '%@gmail.com')` */
  ilike(column: string, pattern: string): this {
    this._filters.push({ column, op: 'ilike', value: pattern });
    return this;
  }

  /** IN array: `.in('status', ['active', 'pending'])` */
  in(column: string, values: unknown[]): this {
    this._filters.push({ column, op: 'in', value: values });
    return this;
  }

  /** IS null/bool: `.is('deleted_at', null)` */
  is(column: string, value: null | boolean): this {
    this._filters.push({ column, op: 'is', value });
    return this;
  }

  /** NOT filter: `.not('status', 'eq', 'deleted')` */
  not(column: string, op: string, value: unknown): this {
    this._filters.push({ column, op: 'not', value, notOp: op });
    return this;
  }

  /** OR filter: `.or('status.eq.active,status.eq.pending')` */
  or(conditions: string): this {
    // Pass as-is; backend receives ?or=(conditions)
    this._filters.push({ column: 'or', op: 'eq', value: `(${conditions})` });
    return this;
  }

  // ─── Ordering ───────────────────────────────────────────────────────────────

  /** `.order('created_at', { ascending: false })` */
  order(column: string, options: { ascending?: boolean } = {}): this {
    this._order = { column, ascending: options.ascending ?? true };
    return this;
  }

  // ─── Pagination ─────────────────────────────────────────────────────────────

  /** `.limit(20)` */
  limit(count: number): this {
    this._limit = count;
    return this;
  }

  /** `.range(0, 19)` — fetches rows 0–19 inclusive */
  range(from: number, to: number): this {
    this._offset = from;
    this._limit = to - from + 1;
    return this;
  }

  // ─── Helpers ─────────────────────────────────────────────────────────────────

  /** Return a single row object instead of an array. Errors if 0 or >1 rows. */
  single(): SingleBuilder<Row> {
    const b = new SingleBuilder<Row>(this.http, this.table, this.projectId);
    b._select = this._select;
    b._filters = [...this._filters];
    b._order = this._order;
    b._offset = this._offset;
    return b;
  }

  /** Like `.single()` but returns `null` instead of error when no row found. */
  maybeSingle(): MaybeSingleBuilder<Row> {
    const b = new MaybeSingleBuilder<Row>(this.http, this.table, this.projectId);
    b._select = this._select;
    b._filters = [...this._filters];
    b._order = this._order;
    b._offset = this._offset;
    return b;
  }

  // ─── PromiseLike — await without .execute() ──────────────────────────────────

  then<TResult1 = ZendbxQueryResponse<Row[]>, TResult2 = never>(
    onfulfilled?: ((value: ZendbxQueryResponse<Row[]>) => TResult1 | PromiseLike<TResult1>) | null,
    onrejected?: ((reason: unknown) => TResult2 | PromiseLike<TResult2>) | null
  ): Promise<TResult1 | TResult2> {
    return this._run().then(onfulfilled, onrejected);
  }

  catch<TResult = never>(
    onrejected: (reason: unknown) => TResult | PromiseLike<TResult>
  ): Promise<ZendbxQueryResponse<Row[]> | TResult> {
    return this._run().catch(onrejected);
  }

  finally(onfinally?: (() => void) | null): Promise<ZendbxQueryResponse<Row[]>> {
    return this._run().finally(onfinally);
  }

  // ─── Internal execution ──────────────────────────────────────────────────────

  protected async _run(): Promise<ZendbxQueryResponse<Row[]>> {
    const params = this._buildParams();
    const url = `${this._basePath}?${params}`;

    const headers: Record<string, string> = {};
    if (this._count) headers['Prefer'] = `count=${this._count}`;

    const raw = await this.http.request<Row[]>(url, { headers });

    return {
      data: raw.data ?? null,
      error: raw.error ?? null,
      status: raw.error?.status ?? 200,
      count: null,
    };
  }

  protected _buildParams(): string {
    const p = new URLSearchParams();
    p.set('select', this._select);

    for (const f of this._filters) {
      if (f.op === 'in' && Array.isArray(f.value)) {
        p.append(f.column, `in.(${(f.value as unknown[]).join(',')})`);
      } else if (f.op === 'not') {
        p.append(f.column, `not.${f.notOp}.${f.value}`);
      } else if (f.op === 'is') {
        p.append(f.column, `is.${f.value}`);
      } else if (f.column === 'or') {
        p.append('or', String(f.value));
      } else {
        p.append(f.column, `${f.op}.${f.value}`);
      }
    }

    if (this._order) {
      p.set('order', `${this._order.column}.${this._order.ascending ? 'asc' : 'desc'}`);
    }
    if (this._limit !== null) p.set('limit', String(this._limit));
    if (this._offset !== null) p.set('offset', String(this._offset));

    return p.toString();
  }

  protected _buildFilterParams(): string {
    const p = new URLSearchParams();
    for (const f of this._filters) {
      if (f.op === 'in' && Array.isArray(f.value)) {
        p.append(f.column, `in.(${(f.value as unknown[]).join(',')})`);
      } else if (f.op === 'not') {
        p.append(f.column, `not.${f.notOp}.${f.value}`);
      } else if (f.op === 'is') {
        p.append(f.column, `is.${f.value}`);
      } else if (f.column === 'or') {
        p.append('or', String(f.value));
      } else {
        p.append(f.column, `${f.op}.${f.value}`);
      }
    }
    return p.toString();
  }
}

// ─── SingleBuilder ────────────────────────────────────────────────────────────

export class SingleBuilder<Row extends Record<string, unknown> = Record<string, unknown>>
  implements PromiseLike<ZendbxQueryResponse<Row>>
{
  _select = '*';
  _filters: Filter[] = [];
  _order: OrderClause | null = null;
  _limit: number | null = 1;
  _offset: number | null = null;

  constructor(
    protected http: HttpClient,
    protected table: string,
    protected projectId: string
  ) {}

  protected get _basePath(): string {
    return `/p/${this.projectId}/v1/rest/${this.table}`;
  }

  then<TResult1 = ZendbxQueryResponse<Row>, TResult2 = never>(
    onfulfilled?: ((value: ZendbxQueryResponse<Row>) => TResult1 | PromiseLike<TResult1>) | null,
    onrejected?: ((reason: unknown) => TResult2 | PromiseLike<TResult2>) | null
  ): Promise<TResult1 | TResult2> {
    return this._runSingle().then(onfulfilled, onrejected);
  }

  catch<TResult = never>(
    onrejected: (reason: unknown) => TResult | PromiseLike<TResult>
  ): Promise<ZendbxQueryResponse<Row> | TResult> {
    return this._runSingle().catch(onrejected);
  }

  finally(onfinally?: (() => void) | null): Promise<ZendbxQueryResponse<Row>> {
    return this._runSingle().finally(onfinally);
  }

  private async _runSingle(): Promise<ZendbxQueryResponse<Row>> {
    const p = new URLSearchParams();
    p.set('select', this._select);
    for (const f of this._filters) {
      if (f.op === 'in' && Array.isArray(f.value)) p.append(f.column, `in.(${(f.value as unknown[]).join(',')})`);
      else if (f.op === 'not') p.append(f.column, `not.${f.notOp}.${f.value}`);
      else if (f.op === 'is') p.append(f.column, `is.${f.value}`);
      else if (f.column === 'or') p.append('or', String(f.value));
      else p.append(f.column, `${f.op}.${f.value}`);
    }
    if (this._order) p.set('order', `${this._order.column}.${this._order.ascending ? 'asc' : 'desc'}`);
    p.set('limit', '1');
    if (this._offset !== null) p.set('offset', String(this._offset));

    const raw = await this.http.request<Row[]>(`${this._basePath}?${p.toString()}`);
    if (raw.error) return { data: null, error: raw.error, status: raw.error.status ?? 500 };
    const rows = raw.data ?? [];
    if (rows.length === 0) return { data: null, error: { message: 'No rows found', status: 404 }, status: 404 };
    return { data: rows[0], error: null, status: 200 };
  }
}

// ─── MaybeSingleBuilder ───────────────────────────────────────────────────────

export class MaybeSingleBuilder<Row extends Record<string, unknown> = Record<string, unknown>>
  implements PromiseLike<ZendbxQueryResponse<Row | null>>
{
  _select = '*';
  _filters: Filter[] = [];
  _order: OrderClause | null = null;
  _limit: number | null = 1;
  _offset: number | null = null;

  constructor(
    protected http: HttpClient,
    protected table: string,
    protected projectId: string
  ) {}

  protected get _basePath(): string {
    return `/p/${this.projectId}/v1/rest/${this.table}`;
  }

  then<TResult1 = ZendbxQueryResponse<Row | null>, TResult2 = never>(
    onfulfilled?: ((value: ZendbxQueryResponse<Row | null>) => TResult1 | PromiseLike<TResult1>) | null,
    onrejected?: ((reason: unknown) => TResult2 | PromiseLike<TResult2>) | null
  ): Promise<TResult1 | TResult2> {
    return this._runMaybe().then(onfulfilled, onrejected);
  }

  catch<TResult = never>(
    onrejected: (reason: unknown) => TResult | PromiseLike<TResult>
  ): Promise<ZendbxQueryResponse<Row | null> | TResult> {
    return this._runMaybe().catch(onrejected);
  }

  finally(onfinally?: (() => void) | null): Promise<ZendbxQueryResponse<Row | null>> {
    return this._runMaybe().finally(onfinally);
  }

  private async _runMaybe(): Promise<ZendbxQueryResponse<Row | null>> {
    const p = new URLSearchParams();
    p.set('select', this._select);
    for (const f of this._filters) {
      if (f.op === 'in' && Array.isArray(f.value)) p.append(f.column, `in.(${(f.value as unknown[]).join(',')})`);
      else if (f.op === 'not') p.append(f.column, `not.${f.notOp}.${f.value}`);
      else if (f.op === 'is') p.append(f.column, `is.${f.value}`);
      else if (f.column === 'or') p.append('or', String(f.value));
      else p.append(f.column, `${f.op}.${f.value}`);
    }
    if (this._order) p.set('order', `${this._order.column}.${this._order.ascending ? 'asc' : 'desc'}`);
    p.set('limit', '1');
    if (this._offset !== null) p.set('offset', String(this._offset));

    const raw = await this.http.request<Row[]>(`${this._basePath}?${p.toString()}`);
    if (raw.error) return { data: null, error: raw.error, status: raw.error.status ?? 500 };
    const rows = raw.data ?? [];
    return { data: rows[0] ?? null, error: null, status: 200 };
  }
}

// ─── InsertBuilder ────────────────────────────────────────────────────────────

export class InsertBuilder<Row extends Record<string, unknown> = Record<string, unknown>>
  implements PromiseLike<ZendbxQueryResponse<Row[]>>
{
  private _returning = false;
  private _returnColumns = '*';
  private _upsert = false;

  constructor(
    private http: HttpClient,
    private basePath: string,
    private body: Partial<Row> | Partial<Row>[],
    upsert = false
  ) {
    this._upsert = upsert;
  }

  /** Chain `.select()` to return inserted rows */
  select(columns = '*'): this {
    this._returning = true;
    this._returnColumns = columns;
    return this;
  }

  then<TResult1 = ZendbxQueryResponse<Row[]>, TResult2 = never>(
    onfulfilled?: ((value: ZendbxQueryResponse<Row[]>) => TResult1 | PromiseLike<TResult1>) | null,
    onrejected?: ((reason: unknown) => TResult2 | PromiseLike<TResult2>) | null
  ): Promise<TResult1 | TResult2> {
    return this._run().then(onfulfilled, onrejected);
  }

  catch<TResult = never>(
    onrejected: (reason: unknown) => TResult | PromiseLike<TResult>
  ): Promise<ZendbxQueryResponse<Row[]> | TResult> {
    return this._run().catch(onrejected);
  }

  finally(onfinally?: (() => void) | null): Promise<ZendbxQueryResponse<Row[]>> {
    return this._run().finally(onfinally);
  }

  private async _run(): Promise<ZendbxQueryResponse<Row[]>> {
    const headers: Record<string, string> = {};
    const preferParts: string[] = [];

    if (this._returning) preferParts.push('return=representation');
    if (this._upsert) preferParts.push('resolution=merge-duplicates');
    if (preferParts.length) headers['Prefer'] = preferParts.join(',');

    const raw = await this.http.request<Row | Row[]>(this.basePath, {
      method: 'POST',
      body: this.body,
      headers,
    });

    if (raw.error) return { data: null, error: raw.error, status: raw.error.status ?? 500 };

    if (!this._returning) return { data: [], error: null, status: 201 };

    const result = Array.isArray(raw.data) ? raw.data : [raw.data as Row];
    return { data: result, error: null, status: 201 };
  }
}

// ─── UpdateBuilder ────────────────────────────────────────────────────────────

export class UpdateBuilder<Row extends Record<string, unknown> = Record<string, unknown>>
  implements PromiseLike<ZendbxQueryResponse<Row[]>>
{
  private _filters: Filter[] = [];
  private _returning = false;

  constructor(
    private http: HttpClient,
    private basePath: string,
    private body: Partial<Row>
  ) {}

  eq(column: string, value: unknown): this {
    this._filters.push({ column, op: 'eq', value });
    return this;
  }

  neq(column: string, value: unknown): this {
    this._filters.push({ column, op: 'neq', value });
    return this;
  }

  gt(column: string, value: unknown): this {
    this._filters.push({ column, op: 'gt', value });
    return this;
  }

  gte(column: string, value: unknown): this {
    this._filters.push({ column, op: 'gte', value });
    return this;
  }

  lt(column: string, value: unknown): this {
    this._filters.push({ column, op: 'lt', value });
    return this;
  }

  lte(column: string, value: unknown): this {
    this._filters.push({ column, op: 'lte', value });
    return this;
  }

  select(_columns = '*'): this {
    this._returning = true;
    return this;
  }

  then<TResult1 = ZendbxQueryResponse<Row[]>, TResult2 = never>(
    onfulfilled?: ((value: ZendbxQueryResponse<Row[]>) => TResult1 | PromiseLike<TResult1>) | null,
    onrejected?: ((reason: unknown) => TResult2 | PromiseLike<TResult2>) | null
  ): Promise<TResult1 | TResult2> {
    return this._run().then(onfulfilled, onrejected);
  }

  catch<TResult = never>(
    onrejected: (reason: unknown) => TResult | PromiseLike<TResult>
  ): Promise<ZendbxQueryResponse<Row[]> | TResult> {
    return this._run().catch(onrejected);
  }

  finally(onfinally?: (() => void) | null): Promise<ZendbxQueryResponse<Row[]>> {
    return this._run().finally(onfinally);
  }

  private async _run(): Promise<ZendbxQueryResponse<Row[]>> {
    const params = this._buildFilterParams();
    const url = params ? `${this.basePath}?${params}` : this.basePath;

    const headers: Record<string, string> = {};
    if (this._returning) headers['Prefer'] = 'return=representation';

    const raw = await this.http.request<Row | Row[]>(url, {
      method: 'PATCH',
      body: this.body,
      headers,
    });

    if (raw.error) return { data: null, error: raw.error, status: raw.error.status ?? 500 };

    if (!this._returning) return { data: [], error: null, status: 200 };

    const result = Array.isArray(raw.data) ? raw.data : [raw.data as Row];
    return { data: result, error: null, status: 200 };
  }

  private _buildFilterParams(): string {
    const p = new URLSearchParams();
    for (const f of this._filters) {
      if (f.op === 'in' && Array.isArray(f.value)) {
        p.append(f.column, `in.(${(f.value as unknown[]).join(',')})`);
      } else {
        p.append(f.column, `${f.op}.${f.value}`);
      }
    }
    return p.toString();
  }
}

// ─── DeleteBuilder ────────────────────────────────────────────────────────────

export class DeleteBuilder<Row extends Record<string, unknown> = Record<string, unknown>>
  implements PromiseLike<ZendbxQueryResponse<null>>
{
  private _filters: Filter[] = [];

  constructor(
    private http: HttpClient,
    private basePath: string
  ) {}

  eq(column: string, value: unknown): this {
    this._filters.push({ column, op: 'eq', value });
    return this;
  }

  neq(column: string, value: unknown): this {
    this._filters.push({ column, op: 'neq', value });
    return this;
  }

  gt(column: string, value: unknown): this {
    this._filters.push({ column, op: 'gt', value });
    return this;
  }

  gte(column: string, value: unknown): this {
    this._filters.push({ column, op: 'gte', value });
    return this;
  }

  lt(column: string, value: unknown): this {
    this._filters.push({ column, op: 'lt', value });
    return this;
  }

  lte(column: string, value: unknown): this {
    this._filters.push({ column, op: 'lte', value });
    return this;
  }

  in(column: string, values: unknown[]): this {
    this._filters.push({ column, op: 'in', value: values });
    return this;
  }

  then<TResult1 = ZendbxQueryResponse<null>, TResult2 = never>(
    onfulfilled?: ((value: ZendbxQueryResponse<null>) => TResult1 | PromiseLike<TResult1>) | null,
    onrejected?: ((reason: unknown) => TResult2 | PromiseLike<TResult2>) | null
  ): Promise<TResult1 | TResult2> {
    return this._run().then(onfulfilled, onrejected);
  }

  catch<TResult = never>(
    onrejected: (reason: unknown) => TResult | PromiseLike<TResult>
  ): Promise<ZendbxQueryResponse<null> | TResult> {
    return this._run().catch(onrejected);
  }

  finally(onfinally?: (() => void) | null): Promise<ZendbxQueryResponse<null>> {
    return this._run().finally(onfinally);
  }

  private async _run(): Promise<ZendbxQueryResponse<null>> {
    const params = this._buildFilterParams();
    const url = params ? `${this.basePath}?${params}` : this.basePath;

    const raw = await this.http.request<null>(url, { method: 'DELETE' });

    if (raw.error) return { data: null, error: raw.error, status: raw.error.status ?? 500 };
    return { data: null, error: null, status: 200 };
  }

  private _buildFilterParams(): string {
    const p = new URLSearchParams();
    for (const f of this._filters) {
      if (f.op === 'in' && Array.isArray(f.value)) {
        p.append(f.column, `in.(${(f.value as unknown[]).join(',')})`);
      } else {
        p.append(f.column, `${f.op}.${f.value}`);
      }
    }
    return p.toString();
  }
}

// ─── TableBuilder — entry point from .from() ─────────────────────────────────

/**
 * Entry point for all table operations. Returned by `zendbx.from('table')`.
 *
 * @example
 * const { data } = await zendbx.from('users').select('*').eq('status', 'active').limit(10)
 * const { data } = await zendbx.from('users').insert({ name: 'John' })
 * const { data } = await zendbx.from('users').update({ name: 'Jane' }).eq('id', 1)
 * const { data } = await zendbx.from('users').delete().eq('id', 1)
 */
export class TableBuilder<Row extends Record<string, unknown> = Record<string, unknown>> {
  constructor(
    private http: HttpClient,
    private table: string,
    private projectId: string
  ) {}

  private get _basePath(): string {
    return `/p/${this.projectId}/v1/rest/${this.table}`;
  }

  // ─── SELECT ──────────────────────────────────────────────────────────────────

  select(columns = '*', options?: { count?: 'exact' | 'planned' | 'estimated' }): SelectBuilder<Row> {
    const b = new SelectBuilder<Row>(this.http, this.table, this.projectId);
    return b.select(columns, options);
  }

  // ─── INSERT ──────────────────────────────────────────────────────────────────

  insert(data: Partial<Row> | Partial<Row>[]): InsertBuilder<Row> {
    return new InsertBuilder<Row>(this.http, this._basePath, data, false);
  }

  // ─── UPSERT ──────────────────────────────────────────────────────────────────

  upsert(data: Partial<Row> | Partial<Row>[]): InsertBuilder<Row> {
    return new InsertBuilder<Row>(this.http, this._basePath, data, true);
  }

  // ─── UPDATE ──────────────────────────────────────────────────────────────────

  update(data: Partial<Row>): UpdateBuilder<Row> {
    return new UpdateBuilder<Row>(this.http, this._basePath, data);
  }

  // ─── DELETE ──────────────────────────────────────────────────────────────────

  delete(): DeleteBuilder<Row> {
    return new DeleteBuilder<Row>(this.http, this._basePath);
  }
}
