/**
 * ZendBX SDK — Descriptive Error Classes
 * All SDK errors extend ZendbxError so they can be caught uniformly.
 */

export class ZendbxSDKError extends Error {
  readonly code: string;
  readonly status?: number;
  readonly details?: unknown;

  constructor(message: string, code: string, status?: number, details?: unknown) {
    super(message);
    this.name = 'ZendbxSDKError';
    this.code = code;
    this.status = status;
    this.details = details;
  }
}

export class MissingConfigError extends ZendbxSDKError {
  constructor(field: string) {
    super(
      `ZendBX SDK: '${field}' is required. Pass it via createClient({ ${field}: '...' }).`,
      'MISSING_CONFIG',
    );
    this.name = 'MissingConfigError';
  }
}

export class InvalidUrlError extends ZendbxSDKError {
  constructor(url: string) {
    super(
      `ZendBX SDK: Invalid API URL '${url}'. Must be a full URL, e.g. 'https://api.zendbx.in'.`,
      'INVALID_URL',
    );
    this.name = 'InvalidUrlError';
  }
}

export class AuthExpiredError extends ZendbxSDKError {
  constructor() {
    super(
      'ZendBX SDK: Authentication token has expired. Call client.auth.signIn() to get a new token.',
      'AUTH_EXPIRED',
      401,
    );
    this.name = 'AuthExpiredError';
  }
}

export class UploadPayloadError extends ZendbxSDKError {
  constructor() {
    super(
      'ZendBX SDK: Upload payload must be a File, Blob, ArrayBuffer, or Uint8Array.',
      'INVALID_UPLOAD_PAYLOAD',
      400,
    );
    this.name = 'UploadPayloadError';
  }
}

export class ProjectNotFoundError extends ZendbxSDKError {
  constructor(identifier: string) {
    super(
      `ZendBX SDK: Project '${identifier}' could not be resolved. Check your projectId or projectSlug.`,
      'PROJECT_NOT_FOUND',
      404,
    );
    this.name = 'ProjectNotFoundError';
  }
}

export class StorageProviderError extends ZendbxSDKError {
  constructor(detail: string) {
    super(
      `ZendBX SDK: Storage provider unavailable — ${detail}. Configure B2_KEY_ID and B2_APPLICATION_KEY on the server.`,
      'STORAGE_UNAVAILABLE',
      503,
    );
    this.name = 'StorageProviderError';
  }
}
