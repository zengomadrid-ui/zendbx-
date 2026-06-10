import type { HttpClient } from './http';
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
    private projectId: string,
  ) {}

  // ─── Core Auth Methods ────────────────────────────────────────────────────

  /**
   * Sign up a new user.
   *
   * @example
   * const { data, error } = await client.auth.signUp({ email, password })
   */
  async signUp(credentials: SignUpCredentials): Promise<ZendbxResponse<AuthData>> {
    const { email, password, name } = credentials;

    const result = await this.http.request<{ access_token: string; user: User }>(
      `/v1/auth/${this.projectId}/signup`,
      {
        method: 'POST',
        body: { email, password, name: name ?? email.split('@')[0] },
      },
    );

    const auth = this._toAuthData(result);
    if (auth.data?.session) {
      this._emit('SIGNED_IN', auth.data.session);
    }
    return auth;
  }

  /**
   * Sign in with email and password.
   *
   * @example
   * const { data, error } = await client.auth.signIn({ email, password })
   */
  async signIn(credentials: SignInCredentials): Promise<ZendbxResponse<AuthData>> {
    const result = await this.http.request<{ access_token: string; user: User }>(
      `/v1/auth/${this.projectId}/login`,
      { method: 'POST', body: credentials },
    );

    const auth = this._toAuthData(result);
    if (auth.data?.session) {
      this._emit('SIGNED_IN', auth.data.session);
    }
    return auth;
  }

  /** Alias matching Supabase's signInWithPassword */
  async signInWithPassword(credentials: SignInCredentials): Promise<ZendbxResponse<AuthData>> {
    return this.signIn(credentials);
  }

  /**
   * Get the currently authenticated user.
   */
  async getUser(): Promise<ZendbxResponse<{ user: User | null }>> {
    if (!this.http.token) return { data: { user: null }, error: null };

    const result = await this.http.request<User>(`/v1/auth/${this.projectId}/user`);

    if (result.error) {
      // Token expired or invalid
      if (result.error.status === 401) {
        this.http.clearToken();
        this._emit('SIGNED_OUT', null);
      }
      return { data: { user: null }, error: result.error };
    }
    return { data: { user: result.data }, error: null };
  }

  /**
   * Get the current session (token + user).
   */
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

  /**
   * Sign out and clear the local session.
   */
  async signOut(): Promise<ZendbxResponse<null>> {
    this.http.clearToken();
    this._emit('SIGNED_OUT', null);
    return { data: null, error: null };
  }

  /**
   * Request a password reset email.
   */
  async resetPassword(email: string): Promise<ZendbxResponse<{ message: string }>> {
    const result = await this.http.request<{ message: string }>('/api/auth/forgot-password', {
      method: 'POST',
      body: { email },
    });
    if (!result.error) this._emit('PASSWORD_RECOVERY', null);
    return result;
  }

  /**
   * Confirm a password reset with the token received via email.
   */
  async updatePassword(token: string, newPassword: string): Promise<ZendbxResponse<{ message: string }>> {
    return this.http.request('/api/auth/reset-password', {
      method: 'POST',
      body: { token, password: newPassword },
    });
  }

  /**
   * Update the currently authenticated user's profile.
   */
  async updateUser(updates: { name?: string; email?: string }): Promise<ZendbxResponse<User>> {
    const result = await this.http.request<User>(`/v1/auth/${this.projectId}/user`, {
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

  // ─── Auth State Listener ──────────────────────────────────────────────────

  /**
   * Subscribe to authentication state changes.
   *
   * Events: SIGNED_IN | SIGNED_OUT | TOKEN_REFRESHED | USER_UPDATED | PASSWORD_RECOVERY
   *
   * @returns An object with an `unsubscribe()` method.
   *
   * @example
   * const { unsubscribe } = client.auth.onAuthStateChange((event, session) => {
   *   if (event === 'SIGNED_IN') console.log('User signed in:', session?.user)
   *   if (event === 'SIGNED_OUT') console.log('User signed out')
   * })
   *
   * // Later, stop listening:
   * unsubscribe()
   */
  onAuthStateChange(callback: AuthChangeCallback): AuthStateSubscription {
    this._listeners.add(callback);

    // Fire immediately with current state
    const currentSession = this.http.token
      ? this._buildLocalSession()
      : null;
    queueMicrotask(() => {
      callback(currentSession ? 'SIGNED_IN' : 'SIGNED_OUT', currentSession);
    });

    return {
      unsubscribe: () => {
        this._listeners.delete(callback);
      },
      data: {
        subscription: {
          unsubscribe: () => {
            this._listeners.delete(callback);
          },
        },
      },
    };
  }

  // ─── Private ──────────────────────────────────────────────────────────────

  private _emit(event: AuthChangeEvent, session: Session | null): void {
    for (const cb of this._listeners) {
      try {
        cb(event, session);
      } catch {
        // Never let a subscriber crash the SDK
      }
    }
  }

  private _buildLocalSession(): Session | null {
    if (!this.http.token) return null;
    // We don't have user data locally without an API call — return minimal session
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
