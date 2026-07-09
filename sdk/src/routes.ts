/**
 * ZendBX Route Builder - Single source of truth for SDK routes
 * 
 * All SDK modules MUST use these builders.
 * Manual URL construction is forbidden.
 */

export interface RouteConfig {
  apiUrl: string;
  projectSlug: string;
}

/**
 * Authentication Routes
 */
export class AuthRoutes {
  constructor(private config: RouteConfig) {}

  signup(): string {
    return `${this.config.apiUrl}/p/${this.config.projectSlug}/v1/auth/signup`;
  }

  login(): string {
    return `${this.config.apiUrl}/p/${this.config.projectSlug}/v1/auth/login`;
  }

  user(): string {
    return `${this.config.apiUrl}/p/${this.config.projectSlug}/v1/auth/user`;
  }

  logout(): string {
    return `${this.config.apiUrl}/p/${this.config.projectSlug}/v1/auth/logout`;
  }

  refresh(): string {
    return `${this.config.apiUrl}/p/${this.config.projectSlug}/v1/auth/refresh`;
  }

  forgotPassword(): string {
    return `${this.config.apiUrl}/p/${this.config.projectSlug}/v1/auth/forgot-password`;
  }

  resetPassword(): string {
    return `${this.config.apiUrl}/p/${this.config.projectSlug}/v1/auth/reset-password`;
  }

  verifyEmail(): string {
    return `${this.config.apiUrl}/p/${this.config.projectSlug}/v1/auth/verify-email`;
  }
}

/**
 * REST API Routes
 */
export class RestRoutes {
  constructor(private config: RouteConfig) {}

  table(tableName: string): string {
    return `${this.config.apiUrl}/p/${this.config.projectSlug}/v1/rest/${tableName}`;
  }

  record(tableName: string, id: string): string {
    return `${this.config.apiUrl}/p/${this.config.projectSlug}/v1/rest/${tableName}/${id}`;
  }
}

/**
 * Storage Routes
 */
export class StorageRoutes {
  constructor(private config: RouteConfig) {}

  buckets(): string {
    return `${this.config.apiUrl}/p/${this.config.projectSlug}/v1/storage/buckets`;
  }

  bucket(bucketId: string): string {
    return `${this.config.apiUrl}/p/${this.config.projectSlug}/v1/storage/buckets/${bucketId}`;
  }

  files(bucketId: string): string {
    return `${this.config.apiUrl}/p/${this.config.projectSlug}/v1/storage/buckets/${bucketId}/files`;
  }

  upload(bucketId: string): string {
    return `${this.config.apiUrl}/p/${this.config.projectSlug}/v1/storage/buckets/${bucketId}/upload`;
  }

  file(bucketId: string, fileId: string): string {
    return `${this.config.apiUrl}/p/${this.config.projectSlug}/v1/storage/buckets/${bucketId}/files/${fileId}`;
  }

  download(bucketId: string, fileId: string): string {
    return this.file(bucketId, fileId);
  }
}

/**
 * Realtime Routes
 */
export class RealtimeRoutes {
  constructor(private config: RouteConfig) {}

  websocket(): string {
    const wsUrl = this.config.apiUrl.replace(/^http/, 'ws');
    return `${wsUrl}/p/${this.config.projectSlug}/v1/realtime`;
  }
}

/**
 * Functions Routes (Future)
 */
export class FunctionsRoutes {
  constructor(private config: RouteConfig) {}

  invoke(functionName: string): string {
    return `${this.config.apiUrl}/p/${this.config.projectSlug}/v1/functions/${functionName}`;
  }
}

/**
 * Central Route Builder
 * 
 * Usage:
 *   const routes = new RouteBuilder({ apiUrl, projectSlug });
 *   const signupUrl = routes.auth.signup();
 */
export class RouteBuilder {
  public readonly auth: AuthRoutes;
  public readonly rest: RestRoutes;
  public readonly storage: StorageRoutes;
  public readonly realtime: RealtimeRoutes;
  public readonly functions: FunctionsRoutes;

  constructor(config: RouteConfig) {
    // Validate configuration
    if (!config.apiUrl) {
      throw new Error('RouteBuilder: apiUrl is required');
    }
    if (!config.projectSlug) {
      throw new Error('RouteBuilder: projectSlug is required');
    }

    // Remove trailing slash from apiUrl
    const cleanApiUrl = config.apiUrl.replace(/\/+$/, '');
    const cleanConfig = { ...config, apiUrl: cleanApiUrl };

    // Initialize route groups
    this.auth = new AuthRoutes(cleanConfig);
    this.rest = new RestRoutes(cleanConfig);
    this.storage = new StorageRoutes(cleanConfig);
    this.realtime = new RealtimeRoutes(cleanConfig);
    this.functions = new FunctionsRoutes(cleanConfig);
  }

  /**
   * Get the base project URL
   */
  projectBase(): string {
    return `${this.auth['config'].apiUrl}/p/${this.auth['config'].projectSlug}`;
  }
}

/**
 * Create a route builder instance
 */
export function createRouteBuilder(config: RouteConfig): RouteBuilder {
  return new RouteBuilder(config);
}
