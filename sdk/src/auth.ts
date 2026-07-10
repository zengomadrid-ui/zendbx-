import type { HttpClient } from './http';
import type { RouteBuilder } from './routes';
import type {
  ZendbxResponse,
  User,
  Session,
  AuthData,
  SignUpCredentials,
  SignInCredentials,
  AuthChangeEvent,
  AuthStateSubscription,
} from './types';

type AuthChangeCallback = (event: AuthChangeEvent, session: Session | null) => void;

export class AuthModule {
  private _listeners = new Set<AuthChangeCallback>();

  constructor(
    private http: HttpClient,
    private routes: RouteBuilder,
    /** @deprecated kept for backward compatibility */
    private projectId: string,
  ) {}

  // ── Explicit token management ────────────────────────────────────────────

  /**
   * Inject an access token directly — no sign-in required.
   * Use this when your app manages auth externally (e.g. dashboard SSO,
   * server-side rendering, or a custom auth provider).
   *
   * @example
   *   client.auth.setAccessToken(localStorage.getItem('token') ?? '')
   */
  setAccessToken(token: string): void {
    this.http.setToken(token);
    this._emit('SIGNED_IN', this._buildLocalSession());
  }

  /**
   * Return the currently active access token, or null if not authenticated.
   */
  getAccessToken(): string | null {
    return this.http.token;
  }

  /**
   * Clear the current access token without making a network request.
   */
  clearAccessToken(): void {
    this.http.clearToken();
    this._emit('SIGNED_OUT', null);
  }

  // ── Core auth methods ────────────────────────────────────────────────────

  /**
   * Sign up a new user.
   * @example
   *   const { data, error } = await client.auth.signUp({ email, password })
   */
  async signUp(credentials: SignUpCredentials): Promise<ZendbxResponse<AuthData>> {
    const { email, password, name } = credentials;
    const result = await this.http.request<{ access_token: string; user: User }>(
      this.routes.auth.signup(),
      {
        method: 'POST',
        body: { email, password, name: name ?? email.split('@')[0] },
        allowAnon: true,
      },
    );
    const auth = this._toAuthData(result);
    if (auth.data?.session) this._emit('SIGNED_IN', auth.data.session);
    return auth;
  }

  /**
   * Sign in with email and password.
   * @example
   *   const { data, error } = await client.auth.signIn({ email, password })
   */
  async signIn(credentials: SignInCredentials): Promise<ZendbxResponse<AuthData>> {
    const result = await this.http.request<{ access_token: string; user: User }>(
      this.routes.auth.login(),
      { method: 'POST', body: credentials, allowAnon: true },
    );
    const auth = this._toAuthData(result);
    if (auth.data?.session) this._emit('SIGNED_IN', auth.data.session);
    return auth;
  }

  /** Alias matching Supabase's signInWithPassword */
  async signInWithPassword(credentials: SignInCredentials): Promise<ZendbxResponse<AuthData>> {
    return this.signIn(credentials);
  }

  /** Get the currently authenticated user. */
  async getUser(): Promise<ZendbxResponse<{ user: User | null }>> {
    if (!this.http.token) return { data: { user: null }, error: null };

    const result = await this.http.request<User>(this.routes.auth.user());
    if (result.error) {
      if (result.error.status === 401) {
        this.http.clearToken();
        this._emit('SIGNED_OUT', null);
      }
      return { data: { user: null }, error: result.error };
    }
    return { data: { user: result.data }, error: null };
  }

  /** Get the current session (token + user). */
  async getSession(): Promise<ZendbxResponse<{ session: Session | null }>> {
    if (!this.http.token) return { data: { session: null }, error: null };

    const { data, error } = await this.getUser();
    if (error || !data?.user) {
      this.http.clearToken();
      return { data: { session: null }, error: error ?? null };
    }

    return {
      data: {
        session: {
          access_token: this.http.token!,
          token_type: 'bearer',
          user: data.user,
          expires_in: 604800,
        },
      },
      error: null,
    };
  }

  /** Sign out and clear the local session. */
  async signOut(): Promise<ZendbxResponse<null>> {
    this.http.clearToken();
    this._emit('SIGNED_OUT', null);
    return { data: null, error: null };
  }

  /** Request a password reset email. */
  async resetPassword(email: string): Promise<ZendbxResponse<{ message: string }>> {
    const result = await this.http.request<{ message: string }>('/api/auth/forgot-password', {
      method: 'POST',
      body: { email },
      allowAnon: true,
    });
    if (!result.error) this._emit('PASSWORD_RECOVERY', null);
    return result;
  }

  /** Confirm a password reset with the token received via email. */
  async updatePassword(token: string, newPassword: string): Promise<ZendbxResponse<{ message: string }>> {
    return this.http.request('/api/auth/reset-password', {
      method: 'POST',
      body: { token, password: newPassword },
      allowAnon: true,
    });
  }

  /** Update the currently authenticated user's profile. */
  async updateUser(updates: { name?: string; email?: string }): Promise<ZendbxResponse<User>> {
    const result = await this.http.request<User>(this.routes.auth.user(), {
      method: 'PATCH',
      body: updates,
    });
    if (result.data) {
      const session = this.http.token
        ? { access_token: this.http.token, token_type: 'bearer' as const, user: result.data, expires_in: 604800 }
        : null;
      this._emit('USER_UPDATED', session);
    }
    return result;
  }

  // ── Auth state listener ──────────────────────────────────────────────────

  /**
   * Subscribe to auth state changes.
   * Events: SIGNED_IN | SIGNED_OUT | TOKEN_REFRESHED | USER_UPDATED | PASSWORD_RECOVERY
   * @example
   *   const { unsubscribe } = client.auth.onAuthStateChange((event, session) => {
   *     console.log(event, session?.user)
   *   })
   */
  onAuthStateChange(callback: AuthChangeCallback): AuthStateSubscription {
    this._listeners.add(callback);
    const current = this.http.token ? this._buildLocalSession() : null;
    queueMicrotask(() => callback(current ? 'SIGNED_IN' : 'SIGNED_OUT', current));
    return {
      unsubscribe: () => this._listeners.delete(callback),
      data: { subscription: { unsubscribe: () => this._listeners.delete(callback) } },
    };
  }

  // ── Private ──────────────────────────────────────────────────────────────

  private _emit(event: AuthChangeEvent, session: Session | null): void {
    for (const cb of this._listeners) {
      try { cb(event, session); } catch { /* never crash */ }
    }
  }

  private _buildLocalSession(): Session | null {
    if (!this.http.token) return null;
    return {
      access_token: this.http.token,
      token_type: 'bearer',
      user: { id: '', email: '' },
      expires_in: 604800,
    };
  }

  private _toAuthData(
    result: ZendbxResponse<{ access_token: string; user: User }>,
  ): ZendbxResponse<AuthData> {
    if (result.error) return { data: null, error: result.error };
    const { access_token, user } = result.data!;
    if (access_token) this.http.setToken(access_token);
    return {
      data: {
        user,
        session: access_token
          ? { access_token, token_type: 'bearer', user, expires_in: 604800 }
          : null,
      },
      error: null,
    };
  }
}
