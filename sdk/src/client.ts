import { HttpClient } from './http';
import type { HttpClientOptions } from './http';
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
  /** Base URL of your ZendBX backend. @example 'https://api.zendbx.in' */
  apiUrl: string;
  /** Your project UUID — used for auth, realtime, and legacy APIs. */
  projectId?: string;
  /** Your project slug — used for Storage V3 and project-scoped REST APIs. */
  projectSlug?: string;
  /** The anon (public) API key. Found in Project Settings → API Keys. */
  anonKey: string;
  /** WebSocket server URL. Defaults to same host on port 8001. */
  wsUrl?: string;

  /**
   * Static access token injected at construction time.
   * Takes precedence over any stored token.
   * @example
   *   accessToken: localStorage.getItem('token') ?? undefined
   */
  accessToken?: string;

  /**
   * Async callback that returns the current user token on every request.
   * Takes precedence over stored token.
   * Use this for React state, server-side sessions, or custom auth systems.
   * @example
   *   getAccessToken: async () => myAuthStore.getToken()
   */
  getAccessToken?: () => string | null | Promise<string | null>;

  /**
   * localStorage key used to persist the SDK auth token.
   * Defaults to 'zendbx_token'. Pass null to disable storage entirely.
   */
  storageKey?: string | null;
}

export class ZendbxClient {
  /** Authentication — signUp, signIn, signOut, setAccessToken, onAuthStateChange */
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

    try { new URL(opts.apiUrl); } catch { throw new InvalidUrlError(opts.apiUrl); }

    if (!opts.projectId && !opts.projectSlug) {
      throw new MissingConfigError('projectId or projectSlug');
    }

    this._projectId = opts.projectId ?? opts.projectSlug ?? '';
    const projectSlug = opts.projectSlug ?? opts.projectId ?? '';

    const wsUrl =
      opts.wsUrl ??
      opts.apiUrl.replace(/^http/, 'ws').replace(/:\d+$/, '') + ':8001';

    const httpOpts: HttpClientOptions = {
      accessToken: opts.accessToken,
      getAccessToken: opts.getAccessToken,
      storageKey: opts.storageKey,
    };

    this.httpClient = new HttpClient(opts.apiUrl, opts.anonKey, this._projectId, httpOpts);

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
   * @example
   *   const { data } = await client.from('users').select('*').eq('status', 'active').limit(10)
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
 * const client = createClient({
 *   apiUrl: 'https://api.zendbx.in',
 *   anonKey: 'your-anon-key',
 *   projectSlug: 'my-project',
 *   // Inject token from your own auth system:
 *   getAccessToken: () => localStorage.getItem('token'),
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
