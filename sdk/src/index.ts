// Main entry point — re-export everything public

// New routing architecture (v1.2.0+)
export { createClient, ZendbxClient } from './client';
export type { ClientConfig, SignUpData, SignInData, AuthResponse } from './client';
export { RouteBuilder, createRouteBuilder } from './routes';
export type { RouteConfig } from './routes';
export { QueryBuilder } from './query-builder-v2';
export type { QueryFilter as QueryFilterV2, QueryOptions } from './query-builder-v2';

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

// ─── Core Types ─────────────────────────────────────────────────────────────

export type {
  // Response wrappers
  ZendbxResponse,
  ZendbxError,
  
  // Generic database types
  JsonPrimitive,
  JsonValue,
  DatabaseRow,
  
  // Auth types
  User,
  Session,
  AuthData,
  SignUpCredentials,
  SignInCredentials,
  PasswordResetRequest,
  PasswordResetConfirm,
  EmailVerification,
  UserUpdatePayload,
  AuthChangeEvent,
  AuthCallback,
  AuthStateSubscription,
  
  // Query builder types
  FilterOperator,
  QueryFilter,
  OrderClause,
  OrderDirection,
  CountType,
  SelectOptions,
  InsertOptions,
  UpdateOptions,
  DeleteOptions,
  
  // Project types
  Project,
  ProjectKeys,
  CreateProjectInput,
  UpdateProjectInput,
  
  // API Key types
  ApiKey,
  
  // Query types
  QueryResult,
  SavedQuery,
  
  // AI types
  AISQLResult,
  AIExplainResult,
  AIFixResult,
  
  // Database schema types
  Column,
  TableSchema,
  RLSPolicy,
  
  // Backup types
  Backup,
  
  // Team types
  TeamMember,
  
  // Storage types
  StorageBucket,
  StorageObject,
  StorageUploadResult,
  StorageSignedUrl,
  StorageAnalytics,
  
  // Analytics types
  QueryAnalytics,
  
  // Billing types
  UsageQuota,
  
  // Realtime types
  RealtimeEvent,
  RealtimePayload,
  RealtimeCallback,
} from './types';
