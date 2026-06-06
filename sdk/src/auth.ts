import type { HttpClient } from './http';
import type {
  ZendbxResponse,
  User,
  Session,
  AuthData,
  SignUpCredentials,
  SignInCredentials,
} from './types';

export class AuthModule {
  constructor(
    private http: HttpClient,
    private projectId: string
  ) {}

  /**
   * Sign up a new user in your project.
   *
   * @example
   * const { data, error } = await zendbx.auth.signUp({ email, password })
   */
  async signUp(credentials: SignUpCredentials): Promise<ZendbxResponse<AuthData>> {
    const { email, password, name } = credentials;

    const result = await this.http.request<{ access_token: string; user: User }>(
      `/v1/auth/${this.projectId}/signup`,
      {
        method: 'POST',
        body: { email, password, name: name ?? email.split('@')[0] },
      }
    );

    return this._toAuthData(result);
  }

  /**
   * Sign in with email and password.
   *
   * @example
   * const { data, error } = await zendbx.auth.signIn({ email, password })
   */
  async signIn(credentials: SignInCredentials): Promise<ZendbxResponse<AuthData>> {
    const result = await this.http.request<{ access_token: string; user: User }>(
      `/v1/auth/${this.projectId}/login`,
      { method: 'POST', body: credentials }
    );

    return this._toAuthData(result);
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

    if (result.error) return { data: { user: null }, error: result.error };
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
    return { data: null, error: null };
  }

  /**
   * Request a password reset email.
   */
  async resetPassword(email: string): Promise<ZendbxResponse<{ message: string }>> {
    return this.http.request('/api/auth/forgot-password', {
      method: 'POST',
      body: { email },
    });
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

  // ─── Private helpers ───────────────────────────────────────────────────────

  private _toAuthData(
    result: ZendbxResponse<{ access_token: string; user: User }>
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
