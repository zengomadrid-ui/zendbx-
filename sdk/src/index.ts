// Main entry point — re-export everything public

// New routing architecture (v1.2.0+)
export { createClient, ZendbxClient } from './client';
export type { ClientConfig, SignUpData, SignInData, AuthResponse } from './client';
export type { User } from './types';
export { RouteBuilder, createRouteBuilder } from './routes';
export type { RouteConfig } from './routes';
export { QueryBuilder } from './query-builder-v2';
export type { QueryFilter, QueryOptions } from './query-builder-v2';

// Legacy exports - maintained for backward compatibility
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
