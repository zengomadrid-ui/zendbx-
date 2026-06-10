// Main entry point — re-export everything public

export { createClient, ZendbxClient } from './client';
export type { ZendbxClientOptions } from './client';

export { AuthModule } from './auth';
export { TableBuilder, SelectBuilder, InsertBuilder, UpdateBuilder, DeleteBuilder } from './query-builder';
export type { ZendbxQueryResponse } from './query-builder';
export { ProjectsModule } from './projects';
export { AIModule } from './ai';
export { DatabaseModule } from './database';
export { RealtimeModule, RealtimeSubscription } from './realtime';
export { StorageModule, StorageBucketRef } from './storage';
export { BackupsModule } from './backups';
export { TeamModule } from './team';
export { HttpClient } from './http';

// Error classes
export {
  ZendbxSDKError,
  MissingConfigError,
  InvalidUrlError,
  AuthExpiredError,
  UploadPayloadError,
  ProjectNotFoundError,
  StorageProviderError,
} from './errors';

export type {
  ZendbxResponse,
  ZendbxError,
  User,
  Session,
  AuthData,
  SignUpCredentials,
  SignInCredentials,
  AuthChangeEvent,
  AuthStateSubscription,
  Project,
  ProjectKeys,
  CreateProjectInput,
  UpdateProjectInput,
  ApiKey,
  QueryResult,
  SavedQuery,
  TableSchema,
  Column,
  RLSPolicy,
  Backup,
  TeamMember,
  StorageBucket,
  StorageObject,
  StorageUploadResult,
  StorageSignedUrl,
  StorageAnalytics,
  AISQLResult,
  AIExplainResult,
  AIFixResult,
  RealtimeEvent,
  RealtimeCallback,
  RealtimePayload,
  QueryAnalytics,
  UsageQuota,
} from './types';
