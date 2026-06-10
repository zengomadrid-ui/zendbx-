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
import { MissingConfigError, InvalidUrlError } from './errors';

export interface ZendbxClientOptions {
  /**
   * Base URL of your ZendBX backend.
   * @example 'https://api.zendbx.in'
   */
  apiUrl: string;

  /**
   * Your project UUID (from the ZendBX dashboard).
   * Used for auth, realtime, and legacy APIs.
   */
  projectId?: string;

  /**
   * Your project slug (human-readable identifier).
   * Used for Storage V3 and project-scoped REST APIs.
   * @example 'my-project'
   */
  projectSlug?: string;

  /**
   * The anon (public) API key.
   * Found in Project Settings → API Keys.
   */
  anonKey: string;

  /**
   * WebSocket server URL for realtime features.
   * Defaults to same host on port 8001.
   */
  wsUrl?: string;
}

/**
 * ZendBX JavaScript / TypeScript SDK
 *
 * @example
 * ```ts
 * import { createClient } from '@zendbx/sdk'
 *
 * const client = createClient({
 *   apiUrl: 'https://api.zendbx.in',
 *   anonKey: 'your-anon-key',
 *   projectSlug: 'my-project',
 * })
 *
 * // Auth
 * const { data } = await client.auth.signIn({ email, password })
 *
 * // Reactive auth state
 * client.auth.onAuthStateChange((event, session) => {
 *   console.log(event, session?.user)
 * })
 *
 * // CRUD (direct await — no .execute() needed)
 * const { data } = await client.from('users').select('*').eq('status', 'active').limit(10)
 *
 * // Storage
 * const { data } = await client.storage.bucket('resumes').upload(file)
 * ```
 */
export class ZendbxClient {
  /** Authentication — signUp, signIn, signOut, onAuthStateChange */
  readonly auth: AuthModule;

  /** Project management — CRUD + API keys */
  readonly projects: ProjectsModule;

  /** AI features — generateSQL, explainSQL, fixSQL */
  readonly ai: AIModule;

  /** Database — raw SQL, schema, RLS, saved queries */
  readonly db: DatabaseModule;

  /** Realtime — WebSocket subscriptions */
  readonly realtime: RealtimeModule;

  /** Object storage — bucket(slug).upload/download/delete/list */
  readonly storage: StorageModule;

  /** Backup & restore */
  readonly backups: BackupsModule;

  /** Team collaboration */
  readonly team: TeamModule;

  /** @internal */
  readonly httpClient: HttpClient;
  private readonly _projectId: string;

  constructor(opts: ZendbxClientOptions) {
    if (!opts.apiUrl) throw new MissingConfigError('apiUrl');
    if (!opts.anonKey) throw new MissingConfigError('anonKey');

    try {
      new URL(opts.apiUrl);
    } catch {
      throw new InvalidUrlError(opts.apiUrl);
    }

    if (!opts.projectId && !opts.projectSlug) {
      throw new MissingConfigError('projectId or projectSlug');
    }

    this._projectId = opts.projectId ?? opts.projectSlug ?? '';
    const projectSlug = opts.projectSlug ?? opts.projectId ?? '';

    const wsUrl =
      opts.wsUrl ??
      opts.apiUrl.replace(/^http/, 'ws').replace(/:\d+$/, '') + ':8001';

    this.httpClient = new HttpClient(opts.apiUrl, opts.anonKey, this._projectId);

    this.auth     = new AuthModule(this.httpClient, this._projectId);
    this.projects = new ProjectsModule(this.httpClient);
    this.ai       = new AIModule(this.httpClient, this._projectId);
    this.db       = new DatabaseModule(this.httpClient, this._projectId);
    this.storage  = new StorageModule(this.httpClient, projectSlug);
    this.backups  = new BackupsModule(this.httpClient);
    this.team     = new TeamModule(this.httpClient, this._projectId);

    this.realtime = new RealtimeModule(
      this._projectId,
      wsUrl,
      () => this.httpClient.token,
      opts.anonKey,
    );
  }

  /**
   * Start a chainable query against any table.
   * Directly awaitable — no `.execute()` needed.
   *
   * @example
   * const { data } = await client.from('users').select('*').eq('status', 'active').limit(10)
   * const { data } = await client.from('posts').insert({ title: 'Hello' })
   * const { data } = await client.from('users').update({ name: 'Jane' }).eq('id', 1)
   * const { data } = await client.from('users').delete().eq('id', 1)
   */
  from<Row extends Record<string, unknown> = Record<string, unknown>>(
    table: string,
  ): TableBuilder<Row> {
    return new TableBuilder<Row>(this.httpClient, table, this._projectId);
  }
}

/**
 * Create a ZendBX client instance.
 *
 * @example
 * // Options object (recommended)
 * const client = createClient({
 *   apiUrl: 'https://api.zendbx.in',
 *   anonKey: 'your-anon-key',
 *   projectSlug: 'my-project',
 * })
 *
 * // Positional args
 * const client = createClient('https://api.zendbx.in', 'anon-key', {
 *   projectSlug: 'my-project',
 * })
 */
export function createClient(
  urlOrOptions: string | ZendbxClientOptions,
  anonKey?: string,
  extra?: { projectId?: string; projectSlug?: string; wsUrl?: string },
): ZendbxClient {
  if (typeof urlOrOptions === 'string') {
    if (!anonKey) throw new MissingConfigError('anonKey');

    let projectSlug = extra?.projectSlug ?? '';
    const projectId = extra?.projectId ?? '';

    // Auto-extract slug from URL pattern /p/{slug}
    if (!projectSlug && !projectId) {
      const match = urlOrOptions.match(/\/p\/([^/?#]+)/i);
      if (match) projectSlug = match[1];
    }

    return new ZendbxClient({
      apiUrl: urlOrOptions,
      anonKey,
      projectId,
      projectSlug,
      wsUrl: extra?.wsUrl,
    });
  }

  return new ZendbxClient(urlOrOptions);
}
