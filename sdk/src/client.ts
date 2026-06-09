import { HttpClient } from './http';
import { AuthModule } from './auth';
import { TableBuilder } from './query-builder';
import { ProjectsModule } from './projects';
import { AIModule } from './ai';
import { DatabaseModule } from './database';
import { RealtimeModule } from './realtime';
import { StorageModule } from './storage';
import { BackupsModule } from './backups';
import { TeamModule } from './team';

export interface ZendbxClientOptions {
  /**
   * Base URL of your ZENDBX backend.
   * @example 'https://api.zendbx.in'
   */
  apiUrl: string;

  /** Your project's UUID (optional if using project-scoped URL) */
  projectId?: string;

  /**
   * The anon (public) API key for unauthenticated requests.
   * Found in Project Settings → API Keys.
   */
  anonKey: string;

  /**
   * WebSocket server URL for realtime features.
   * Defaults to the same host on port 8001 if not provided.
   */
  wsUrl?: string;
}

/**
 * ZENDBX JavaScript / TypeScript SDK
 *
 * @example
 * ```ts
 * import { createClient } from '@zendbx/sdk'
 *
 * const zendbx = createClient('https://api.zendbx.in', 'your-anon-key', {
 *   projectId: 'your-project-uuid',
 * })
 *
 * // Auth
 * const { data, error } = await zendbx.auth.signIn({ email, password })
 *
 * // CRUD
 * const { data } = await zendbx.from('posts').select('*').eq('published', true).limit(10).execute()
 *
 * // AI
 * const { data } = await zendbx.ai.generateSQL('show top 5 users by post count')
 * ```
 */
export class ZendbxClient {
  /** Authentication — sign up, sign in, sign out, sessions, password reset */
  readonly auth: AuthModule;

  /** Project management — CRUD + API key management */
  readonly projects: ProjectsModule;

  /** AI features — natural language to SQL, explain, auto-fix */
  readonly ai: AIModule;

  /** Database — raw SQL, schema management, RLS policies, saved queries */
  readonly db: DatabaseModule;

  /** Realtime — WebSocket subscriptions for table changes */
  readonly realtime: RealtimeModule;

  /** Object storage — buckets and file operations */
  readonly storage: StorageModule;

  /** Backup & restore */
  readonly backups: BackupsModule;

  /** Team collaboration */
  readonly team: TeamModule;

  /** @internal */
  readonly httpClient: HttpClient;
  private readonly _projectId: string;

  constructor(opts: ZendbxClientOptions) {
    this._projectId = opts.projectId ?? '';
    const wsUrl =
      opts.wsUrl ??
      opts.apiUrl.replace(/^http/, 'ws').replace(/:\d+$/, '') + ':8001';

    this.httpClient = new HttpClient(opts.apiUrl, opts.anonKey, this._projectId);

    this.auth     = new AuthModule(this.httpClient, this._projectId);
    this.projects = new ProjectsModule(this.httpClient);
    this.ai       = new AIModule(this.httpClient, this._projectId);
    this.db       = new DatabaseModule(this.httpClient, this._projectId);
    this.storage  = new StorageModule(this.httpClient);
    this.backups  = new BackupsModule(this.httpClient);
    this.team     = new TeamModule(this.httpClient, this._projectId);

    this.realtime = new RealtimeModule(
      this._projectId,
      wsUrl,
      () => this.httpClient.token,
      opts.anonKey
    );
  }

  /**
   * Start a chainable query against any table.
   *
   * @example
   * const { data } = await zendbx.from('users').select('*').eq('status', 'active').limit(10)
   * const { data } = await zendbx.from('users').insert({ name: 'John' })
   * const { data } = await zendbx.from('users').update({ name: 'Jane' }).eq('id', 1)
   * const { data } = await zendbx.from('users').delete().eq('id', 1)
   */
  from<Row extends Record<string, unknown> = Record<string, unknown>>(
    table: string
  ): TableBuilder<Row> {
    return new TableBuilder<Row>(this.httpClient, table, this._projectId);
  }
}

/**
 * Create a new ZENDBX client instance.
 *
 * Supports two calling conventions:
 *
 * @example
 * // 2-arg (recommended — project context embedded in key/URL)
 * const db = createClient(process.env.ZENDBX_URL!, process.env.ZENDBX_API_KEY!)
 *
 * // 3-arg (explicit project ID)
 * const db = createClient('https://api.zendbx.in', 'anon-key', { projectId: 'uuid' })
 *
 * // Options object
 * const db = createClient({ apiUrl: '...', anonKey: '...', projectId: '...' })
 */
export function createClient(
  urlOrOptions: string | ZendbxClientOptions,
  anonKey?: string,
  extra?: { projectId?: string; wsUrl?: string }
): ZendbxClient {
  if (typeof urlOrOptions === 'string') {
    if (!anonKey) throw new Error('createClient: anonKey is required');

    // Extract projectId from the URL if it contains /p/{uuid}/
    let projectId = extra?.projectId ?? '';
    if (!projectId) {
      const match = urlOrOptions.match(/\/p\/([0-9a-f-]{36})/i);
      if (match) projectId = match[1];
    }

    return new ZendbxClient({
      apiUrl: urlOrOptions,
      anonKey,
      projectId,
      wsUrl: extra?.wsUrl,
    });
  }
  return new ZendbxClient(urlOrOptions);
}
