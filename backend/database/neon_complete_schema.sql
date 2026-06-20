-- ============================================================
-- ZendBX Complete Schema for Neon PostgreSQL
-- Generated: 2026-06-19  |  Fully idempotent (safe to re-run)
-- ============================================================

-- ============================================================
-- EXTENSIONS
-- ============================================================
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";
CREATE EXTENSION IF NOT EXISTS "pgcrypto";

-- pg_stat_statements may not be available on Neon free tier
DO $$ BEGIN
  CREATE EXTENSION IF NOT EXISTS "pg_stat_statements";
EXCEPTION WHEN OTHERS THEN
  RAISE NOTICE 'pg_stat_statements not available — skipping';
END $$;

-- ============================================================
-- SCHEMAS
-- ============================================================
CREATE SCHEMA IF NOT EXISTS auth;

-- ============================================================
-- HELPER FUNCTIONS
-- ============================================================
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER LANGUAGE plpgsql AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$;

CREATE OR REPLACE FUNCTION generate_project_db_name()
RETURNS TEXT LANGUAGE plpgsql AS $$
DECLARE db_name TEXT; exists BOOLEAN;
BEGIN
  LOOP
    db_name := 'proj_' || substr(md5(random()::text), 1, 8);
    SELECT EXISTS(SELECT 1 FROM projects WHERE database_name = db_name) INTO exists;
    IF NOT exists THEN RETURN db_name; END IF;
  END LOOP;
END;
$$;

CREATE OR REPLACE FUNCTION generate_project_slug(project_name TEXT, project_id UUID)
RETURNS TEXT LANGUAGE plpgsql AS $$
DECLARE
  base_slug TEXT; final_slug TEXT; counter INTEGER := 0; exists BOOLEAN;
BEGIN
  base_slug := lower(regexp_replace(project_name, '[^a-zA-Z0-9]+', '-', 'g'));
  base_slug := trim(both '-' from base_slug);
  final_slug := base_slug || '-' || substr(project_id::text, 1, 8);
  LOOP
    SELECT EXISTS(SELECT 1 FROM projects WHERE slug = final_slug AND id != project_id) INTO exists;
    IF NOT exists THEN RETURN final_slug; END IF;
    counter := counter + 1;
    final_slug := base_slug || '-' || substr(project_id::text, 1, 8) || '-' || counter;
  END LOOP;
END;
$$;

-- ============================================================
-- USERS
-- ============================================================
CREATE TABLE IF NOT EXISTS users (
  id               UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  email            VARCHAR(255) UNIQUE NOT NULL,
  password_hash    VARCHAR(255) NOT NULL DEFAULT '',
  full_name        VARCHAR(255),
  avatar_url       TEXT,
  is_active        BOOLEAN DEFAULT TRUE,
  is_verified      BOOLEAN DEFAULT FALSE,
  is_suspended     BOOLEAN DEFAULT FALSE,
  suspended_at     TIMESTAMPTZ,
  suspended_reason TEXT,
  plan             VARCHAR(50) DEFAULT 'free',
  role             VARCHAR(50) DEFAULT 'user',
  oauth_provider   VARCHAR(50),
  oauth_id         VARCHAR(255),
  last_login_at    TIMESTAMPTZ,
  last_login_ip    INET,
  last_selected_project_id UUID,
  created_at       TIMESTAMPTZ DEFAULT NOW(),
  updated_at       TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_users_email ON users(email);
CREATE INDEX IF NOT EXISTS idx_users_role  ON users(role);
CREATE INDEX IF NOT EXISTS idx_users_oauth ON users(oauth_provider, oauth_id);

DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_trigger WHERE tgname = 'update_users_updated_at') THEN
    CREATE TRIGGER update_users_updated_at
      BEFORE UPDATE ON users FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();
  END IF;
END $$;

-- ============================================================
-- PROJECTS
-- ============================================================
CREATE TABLE IF NOT EXISTS projects (
  id              UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id         UUID REFERENCES users(id) ON DELETE CASCADE,
  name            VARCHAR(255) NOT NULL,
  slug            VARCHAR(255) UNIQUE NOT NULL,
  description     TEXT,
  database_name   VARCHAR(255) UNIQUE NOT NULL,
  database_host   VARCHAR(255) DEFAULT 'localhost',
  database_port   INTEGER DEFAULT 5432,
  region          VARCHAR(50) DEFAULT 'us-east-1',
  status          VARCHAR(50) DEFAULT 'active',
  jwt_secret      TEXT,
  anon_key        TEXT,
  service_role_key TEXT,
  storage_used    BIGINT DEFAULT 0,
  max_storage     BIGINT DEFAULT 1073741824,
  created_at      TIMESTAMPTZ DEFAULT NOW(),
  updated_at      TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_projects_user_id      ON projects(user_id);
CREATE INDEX IF NOT EXISTS idx_projects_slug         ON projects(slug);
CREATE INDEX IF NOT EXISTS idx_projects_database_name ON projects(database_name);

DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_trigger WHERE tgname = 'update_projects_updated_at') THEN
    CREATE TRIGGER update_projects_updated_at
      BEFORE UPDATE ON projects FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();
  END IF;
END $$;

-- ============================================================
-- USER_TABLES  /  QUERY_HISTORY  /  SAVED_QUERIES
-- ============================================================
CREATE TABLE IF NOT EXISTS user_tables (
  id                UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  project_id        UUID REFERENCES projects(id) ON DELETE CASCADE,
  table_name        VARCHAR(255) NOT NULL,
  schema_definition JSONB NOT NULL,
  row_count         INTEGER DEFAULT 0,
  size_bytes        BIGINT DEFAULT 0,
  created_at        TIMESTAMPTZ DEFAULT NOW(),
  updated_at        TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(project_id, table_name)
);
CREATE INDEX IF NOT EXISTS idx_user_tables_project_id ON user_tables(project_id);
DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_trigger WHERE tgname = 'update_user_tables_updated_at') THEN
    CREATE TRIGGER update_user_tables_updated_at
      BEFORE UPDATE ON user_tables FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();
  END IF;
END $$;

CREATE TABLE IF NOT EXISTS query_history (
  id               UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id          UUID REFERENCES users(id) ON DELETE CASCADE,
  project_id       UUID REFERENCES projects(id) ON DELETE CASCADE,
  question         TEXT,
  sql_query        TEXT NOT NULL,
  status           VARCHAR(50) NOT NULL,
  execution_time_ms INTEGER,
  rows_returned    INTEGER,
  error_message    TEXT,
  created_at       TIMESTAMPTZ DEFAULT NOW()
);
CREATE INDEX IF NOT EXISTS idx_query_history_user_id    ON query_history(user_id);
CREATE INDEX IF NOT EXISTS idx_query_history_project_id ON query_history(project_id);
CREATE INDEX IF NOT EXISTS idx_query_history_created_at ON query_history(created_at);

CREATE TABLE IF NOT EXISTS saved_queries (
  id          UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id     UUID REFERENCES users(id) ON DELETE CASCADE,
  project_id  UUID REFERENCES projects(id) ON DELETE CASCADE,
  name        VARCHAR(255) NOT NULL,
  description TEXT,
  question    TEXT,
  sql_query   TEXT NOT NULL,
  tags        TEXT[],
  is_favorite BOOLEAN DEFAULT FALSE,
  run_count   INTEGER DEFAULT 0,
  created_at  TIMESTAMPTZ DEFAULT NOW(),
  updated_at  TIMESTAMPTZ DEFAULT NOW()
);
CREATE INDEX IF NOT EXISTS idx_saved_queries_user_id ON saved_queries(user_id);
DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_trigger WHERE tgname = 'update_saved_queries_updated_at') THEN
    CREATE TRIGGER update_saved_queries_updated_at
      BEFORE UPDATE ON saved_queries FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();
  END IF;
END $$;

-- ============================================================
-- API_KEYS
-- ============================================================
CREATE TABLE IF NOT EXISTS api_keys (
  id            UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id       UUID REFERENCES users(id) ON DELETE CASCADE,
  project_id    UUID REFERENCES projects(id) ON DELETE CASCADE,
  name          VARCHAR(255) NOT NULL,
  key_hash      VARCHAR(255) UNIQUE NOT NULL,
  key_prefix    VARCHAR(20) NOT NULL,
  encrypted_key TEXT,
  role          VARCHAR(50) NOT NULL,
  key_type      VARCHAR(50) DEFAULT 'custom',
  last_used_at  TIMESTAMPTZ,
  is_active     BOOLEAN DEFAULT TRUE,
  created_at    TIMESTAMPTZ DEFAULT NOW()
);
CREATE INDEX IF NOT EXISTS idx_api_keys_user_id         ON api_keys(user_id);
CREATE INDEX IF NOT EXISTS idx_api_keys_key_hash        ON api_keys(key_hash);
CREATE INDEX IF NOT EXISTS idx_api_keys_key_type        ON api_keys(key_type);
CREATE INDEX IF NOT EXISTS idx_api_keys_project_key_type ON api_keys(project_id, key_type);

-- ============================================================
-- FILE_UPLOADS  /  PROJECT_QUOTAS
-- ============================================================
CREATE TABLE IF NOT EXISTS file_uploads (
  id                UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id           UUID REFERENCES users(id) ON DELETE CASCADE,
  project_id        UUID REFERENCES projects(id) ON DELETE CASCADE,
  filename          VARCHAR(255) NOT NULL,
  original_filename VARCHAR(255) NOT NULL,
  file_size         BIGINT NOT NULL,
  mime_type         VARCHAR(100),
  storage_path      TEXT NOT NULL,
  status            VARCHAR(50) NOT NULL,
  table_name        VARCHAR(255),
  error_message     TEXT,
  created_at        TIMESTAMPTZ DEFAULT NOW()
);
CREATE INDEX IF NOT EXISTS idx_file_uploads_user_id ON file_uploads(user_id);

CREATE TABLE IF NOT EXISTS project_quotas (
  id                   UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  project_id           UUID REFERENCES projects(id) ON DELETE CASCADE UNIQUE,
  database_size_bytes  BIGINT DEFAULT 0,
  table_count          INTEGER DEFAULT 0,
  row_count            INTEGER DEFAULT 0,
  query_count_today    INTEGER DEFAULT 0,
  query_count_month    INTEGER DEFAULT 0,
  last_updated         TIMESTAMPTZ DEFAULT NOW()
);

-- ============================================================
-- PASSWORD_RESET_TOKENS
-- ============================================================
CREATE TABLE IF NOT EXISTS password_reset_tokens (
  id         UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id    UUID REFERENCES users(id) ON DELETE CASCADE,
  token      VARCHAR(255) UNIQUE NOT NULL,
  expires_at TIMESTAMPTZ NOT NULL,
  used       BOOLEAN DEFAULT FALSE,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- ============================================================
-- OAUTH_PROVIDERS  /  OAUTH_CONNECTIONS
-- ============================================================
CREATE TABLE IF NOT EXISTS oauth_providers (
  id                UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  name              VARCHAR(50) UNIQUE NOT NULL,
  client_id         TEXT,
  client_secret     TEXT,
  authorization_url TEXT,
  token_url         TEXT,
  user_info_url     TEXT,
  scope             TEXT,
  is_enabled        BOOLEAN DEFAULT FALSE,
  created_at        TIMESTAMPTZ DEFAULT NOW(),
  updated_at        TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS oauth_connections (
  id               UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id          UUID REFERENCES users(id) ON DELETE CASCADE,
  provider         VARCHAR(50),
  provider_user_id VARCHAR(255) NOT NULL,
  access_token     TEXT,
  refresh_token    TEXT,
  token_expires_at TIMESTAMPTZ,
  id_token         TEXT,
  scopes           TEXT,
  last_refresh_at  TIMESTAMPTZ,
  is_primary       BOOLEAN DEFAULT FALSE,
  profile_data     JSONB,
  created_at       TIMESTAMPTZ DEFAULT NOW(),
  updated_at       TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(provider, provider_user_id)
);
CREATE INDEX IF NOT EXISTS idx_oauth_connections_user_id   ON oauth_connections(user_id);
CREATE INDEX IF NOT EXISTS idx_oauth_connections_provider  ON oauth_connections(provider, provider_user_id);
CREATE INDEX IF NOT EXISTS idx_oauth_connections_expires   ON oauth_connections(token_expires_at) WHERE token_expires_at IS NOT NULL;

DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_trigger WHERE tgname = 'update_oauth_connections_updated_at') THEN
    CREATE TRIGGER update_oauth_connections_updated_at
      BEFORE UPDATE ON oauth_connections FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();
  END IF;
END $$;

-- ============================================================
-- LOGIN_ATTEMPTS  /  USER_SESSIONS  /  AUTH_SESSIONS
-- ============================================================
CREATE TABLE IF NOT EXISTS login_attempts (
  id             UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  email          VARCHAR(255) NOT NULL,
  ip_address     INET,
  user_agent     TEXT,
  success        BOOLEAN NOT NULL DEFAULT FALSE,
  failure_reason VARCHAR(255),
  error_message  TEXT,
  created_at     TIMESTAMPTZ DEFAULT NOW()
);
CREATE INDEX IF NOT EXISTS idx_login_attempts_email      ON login_attempts(email);
CREATE INDEX IF NOT EXISTS idx_login_attempts_ip         ON login_attempts(ip_address);
CREATE INDEX IF NOT EXISTS idx_login_attempts_created_at ON login_attempts(created_at);

CREATE TABLE IF NOT EXISTS user_sessions (
  id            UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id       UUID REFERENCES users(id) ON DELETE CASCADE,
  token_hash    VARCHAR(255) UNIQUE NOT NULL,
  ip_address    INET,
  user_agent    TEXT,
  expires_at    TIMESTAMPTZ NOT NULL,
  is_active     BOOLEAN DEFAULT TRUE,
  created_at    TIMESTAMPTZ DEFAULT NOW(),
  last_activity TIMESTAMPTZ DEFAULT NOW()
);
CREATE INDEX IF NOT EXISTS idx_user_sessions_user_id    ON user_sessions(user_id);
CREATE INDEX IF NOT EXISTS idx_user_sessions_token_hash ON user_sessions(token_hash);

CREATE TABLE IF NOT EXISTS auth_sessions (
  id           UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id      UUID REFERENCES users(id) ON DELETE CASCADE,
  session_token VARCHAR(255) UNIQUE NOT NULL,
  device_name  VARCHAR(255),
  device_type  VARCHAR(50),
  browser      VARCHAR(100),
  os           VARCHAR(100),
  ip_address   INET,
  location     VARCHAR(255),
  user_agent   TEXT,
  last_active  TIMESTAMPTZ DEFAULT NOW(),
  created_at   TIMESTAMPTZ DEFAULT NOW(),
  expires_at   TIMESTAMPTZ,
  is_active    BOOLEAN DEFAULT TRUE
);
CREATE INDEX IF NOT EXISTS idx_auth_sessions_user_id ON auth_sessions(user_id);
CREATE INDEX IF NOT EXISTS idx_auth_sessions_token   ON auth_sessions(session_token);
CREATE INDEX IF NOT EXISTS idx_auth_sessions_active  ON auth_sessions(is_active);

-- ============================================================
-- AUDIT_LOGS
-- ============================================================
CREATE TABLE IF NOT EXISTS audit_logs (
  id            UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id       UUID REFERENCES users(id) ON DELETE SET NULL,
  project_id    UUID REFERENCES projects(id) ON DELETE SET NULL,
  action        VARCHAR(100),
  event_type    VARCHAR(100),
  resource_type VARCHAR(100),
  resource_id   UUID,
  event_data    JSONB,
  details       JSONB,
  ip_address    INET,
  user_agent    TEXT,
  success       BOOLEAN DEFAULT TRUE,
  error_message TEXT,
  created_at    TIMESTAMPTZ DEFAULT NOW()
);
CREATE INDEX IF NOT EXISTS idx_audit_logs_user_id    ON audit_logs(user_id);
CREATE INDEX IF NOT EXISTS idx_audit_logs_project_id ON audit_logs(project_id);
CREATE INDEX IF NOT EXISTS idx_audit_logs_created_at ON audit_logs(created_at DESC);
CREATE INDEX IF NOT EXISTS idx_audit_logs_event_type ON audit_logs(event_type);
CREATE INDEX IF NOT EXISTS idx_audit_logs_success    ON audit_logs(success);

-- ============================================================
-- PROJECT_API_KEYS  /  PROJECT_MEMBERS
-- ============================================================
CREATE TABLE IF NOT EXISTS project_api_keys (
  id         UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  project_id UUID REFERENCES projects(id) ON DELETE CASCADE,
  name       VARCHAR(255) NOT NULL,
  key_type   VARCHAR(50) NOT NULL,
  key_value  TEXT NOT NULL,
  is_active  BOOLEAN DEFAULT TRUE,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);
DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_trigger WHERE tgname = 'update_project_api_keys_updated_at') THEN
    CREATE TRIGGER update_project_api_keys_updated_at
      BEFORE UPDATE ON project_api_keys FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();
  END IF;
END $$;

CREATE TABLE IF NOT EXISTS project_members (
  id           UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  project_id   UUID NOT NULL REFERENCES projects(id) ON DELETE CASCADE,
  user_id      UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  role         VARCHAR(20) NOT NULL CHECK (role IN ('admin', 'editor', 'viewer')),
  invited_by   UUID REFERENCES users(id),
  joined_at    TIMESTAMPTZ DEFAULT NOW(),
  last_active_at TIMESTAMPTZ DEFAULT NOW(),
  invited_at   TIMESTAMPTZ DEFAULT NOW(),
  accepted_at  TIMESTAMPTZ,
  status       VARCHAR(50) DEFAULT 'accepted',
  UNIQUE(project_id, user_id)
);
CREATE INDEX IF NOT EXISTS idx_project_members_project_id ON project_members(project_id);
CREATE INDEX IF NOT EXISTS idx_project_members_user_id    ON project_members(user_id);
CREATE INDEX IF NOT EXISTS idx_project_members_role       ON project_members(role);

-- ============================================================
-- PROJECT_MESSAGES
-- ============================================================
CREATE TABLE IF NOT EXISTS project_messages (
  id         UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  project_id UUID NOT NULL REFERENCES projects(id) ON DELETE CASCADE,
  user_id    UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  content    TEXT NOT NULL,
  is_deleted BOOLEAN DEFAULT FALSE,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);
CREATE INDEX IF NOT EXISTS idx_project_messages_project_id ON project_messages(project_id);
CREATE INDEX IF NOT EXISTS idx_project_messages_user_id    ON project_messages(user_id);
CREATE INDEX IF NOT EXISTS idx_project_messages_created_at ON project_messages(created_at DESC);
DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_trigger WHERE tgname = 'update_project_messages_updated_at') THEN
    CREATE TRIGGER update_project_messages_updated_at
      BEFORE UPDATE ON project_messages FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();
  END IF;
END $$;

-- ============================================================
-- SECURITY_SETTINGS  /  AUTH_POLICIES  /  OAUTH_APPS  /  AUTH_HOOKS
-- ============================================================
CREATE TABLE IF NOT EXISTS security_settings (
  id                      UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id                 UUID REFERENCES users(id) ON DELETE CASCADE UNIQUE,
  max_login_attempts      INT DEFAULT 5,
  lockout_duration        INT DEFAULT 900,
  attack_protection_enabled BOOLEAN DEFAULT TRUE,
  captcha_enabled         BOOLEAN DEFAULT FALSE,
  mfa_enabled             BOOLEAN DEFAULT FALSE,
  mfa_method              VARCHAR(20),
  mfa_secret              TEXT,
  backup_codes            TEXT[],
  created_at              TIMESTAMPTZ DEFAULT NOW(),
  updated_at              TIMESTAMPTZ DEFAULT NOW()
);
CREATE INDEX IF NOT EXISTS idx_security_settings_user_id ON security_settings(user_id);
DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_trigger WHERE tgname = 'update_security_settings_updated_at') THEN
    CREATE TRIGGER update_security_settings_updated_at
      BEFORE UPDATE ON security_settings FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();
  END IF;
END $$;

CREATE TABLE IF NOT EXISTS auth_policies (
  id            UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  project_id    UUID REFERENCES projects(id) ON DELETE CASCADE,
  name          VARCHAR(255) NOT NULL,
  description   TEXT,
  rules         JSONB NOT NULL,
  target_table  VARCHAR(255),
  target_action VARCHAR(50),
  is_active     BOOLEAN DEFAULT TRUE,
  created_by    UUID REFERENCES users(id) ON DELETE SET NULL,
  created_at    TIMESTAMPTZ DEFAULT NOW(),
  updated_at    TIMESTAMPTZ DEFAULT NOW()
);
CREATE INDEX IF NOT EXISTS idx_auth_policies_project_id ON auth_policies(project_id);
DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_trigger WHERE tgname = 'update_auth_policies_updated_at') THEN
    CREATE TRIGGER update_auth_policies_updated_at
      BEFORE UPDATE ON auth_policies FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();
  END IF;
END $$;

CREATE TABLE IF NOT EXISTS oauth_apps (
  id            UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id       UUID REFERENCES users(id) ON DELETE CASCADE,
  app_name      VARCHAR(255) NOT NULL,
  description   TEXT,
  client_id     VARCHAR(255) UNIQUE NOT NULL,
  client_secret VARCHAR(255) NOT NULL,
  redirect_uris TEXT[],
  scopes        TEXT[],
  logo_url      TEXT,
  is_active     BOOLEAN DEFAULT TRUE,
  created_at    TIMESTAMPTZ DEFAULT NOW(),
  updated_at    TIMESTAMPTZ DEFAULT NOW()
);
CREATE INDEX IF NOT EXISTS idx_oauth_apps_user_id   ON oauth_apps(user_id);
CREATE INDEX IF NOT EXISTS idx_oauth_apps_client_id ON oauth_apps(client_id);
DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_trigger WHERE tgname = 'update_oauth_apps_updated_at') THEN
    CREATE TRIGGER update_oauth_apps_updated_at
      BEFORE UPDATE ON oauth_apps FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();
  END IF;
END $$;

CREATE TABLE IF NOT EXISTS auth_hooks (
  id                UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id           UUID REFERENCES users(id) ON DELETE CASCADE,
  project_id        UUID REFERENCES projects(id) ON DELETE CASCADE,
  name              VARCHAR(255) NOT NULL,
  event_type        VARCHAR(50) NOT NULL,
  webhook_url       TEXT NOT NULL,
  secret_key        VARCHAR(255),
  is_active         BOOLEAN DEFAULT TRUE,
  last_triggered_at TIMESTAMPTZ,
  created_at        TIMESTAMPTZ DEFAULT NOW()
);
CREATE INDEX IF NOT EXISTS idx_auth_hooks_user_id    ON auth_hooks(user_id);
CREATE INDEX IF NOT EXISTS idx_auth_hooks_project_id ON auth_hooks(project_id);

-- ============================================================
-- RATE_LIMIT_LOGS
-- ============================================================
CREATE TABLE IF NOT EXISTS rate_limit_logs (
  id           UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  identifier   VARCHAR(255) NOT NULL,
  endpoint     VARCHAR(255) NOT NULL,
  attempts     INT DEFAULT 1,
  window_start TIMESTAMPTZ DEFAULT NOW(),
  created_at   TIMESTAMPTZ DEFAULT NOW()
);
CREATE INDEX IF NOT EXISTS idx_rate_limit_logs_identifier ON rate_limit_logs(identifier);
CREATE INDEX IF NOT EXISTS idx_rate_limit_logs_endpoint   ON rate_limit_logs(endpoint);
CREATE INDEX IF NOT EXISTS idx_rate_limit_logs_window     ON rate_limit_logs(window_start);

-- ============================================================
-- SUBSCRIPTION_PLANS  /  USER_SUBSCRIPTIONS
-- ============================================================
CREATE TABLE IF NOT EXISTS subscription_plans (
  id                   UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  name                 VARCHAR(50) NOT NULL UNIQUE,
  display_name         VARCHAR(100) NOT NULL,
  description          TEXT,
  price_monthly        DECIMAL(10,2) NOT NULL,
  price_yearly         DECIMAL(10,2),
  api_requests_limit   INTEGER NOT NULL,
  database_size_limit  BIGINT NOT NULL,
  projects_limit       INTEGER NOT NULL,
  team_members_limit   INTEGER NOT NULL,
  backup_frequency     VARCHAR(20) NOT NULL,
  features             JSONB DEFAULT '[]'::jsonb,
  is_active            BOOLEAN DEFAULT TRUE,
  sort_order           INTEGER DEFAULT 0,
  created_at           TIMESTAMPTZ DEFAULT NOW(),
  updated_at           TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS user_subscriptions (
  id                      UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id                 UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  plan_id                 UUID NOT NULL REFERENCES subscription_plans(id),
  status                  VARCHAR(20) DEFAULT 'active',
  current_period_start    TIMESTAMPTZ NOT NULL,
  current_period_end      TIMESTAMPTZ NOT NULL,
  stripe_subscription_id  VARCHAR(255),
  stripe_customer_id      VARCHAR(255),
  cancelled_at            TIMESTAMPTZ,
  cancel_at_period_end    BOOLEAN DEFAULT FALSE,
  billing_cycle           VARCHAR(20),
  created_at              TIMESTAMPTZ DEFAULT NOW(),
  updated_at              TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(user_id)
);
CREATE INDEX IF NOT EXISTS idx_user_subscriptions_user_id ON user_subscriptions(user_id);
CREATE INDEX IF NOT EXISTS idx_user_subscriptions_status  ON user_subscriptions(status);
CREATE INDEX IF NOT EXISTS idx_user_subscriptions_period  ON user_subscriptions(current_period_start, current_period_end);

-- ============================================================
-- USAGE_TRACKING  /  USAGE_LOGS  /  USAGE_RECORDS
-- ============================================================
CREATE TABLE IF NOT EXISTS usage_tracking (
  id                   UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id              UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  period_start         TIMESTAMPTZ NOT NULL,
  period_end           TIMESTAMPTZ NOT NULL,
  api_requests_count   INTEGER DEFAULT 0,
  database_size_bytes  BIGINT DEFAULT 0,
  projects_count       INTEGER DEFAULT 0,
  team_members_count   INTEGER DEFAULT 0,
  last_reset_at        TIMESTAMPTZ DEFAULT NOW(),
  created_at           TIMESTAMPTZ DEFAULT NOW(),
  updated_at           TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(user_id, period_start)
);
CREATE INDEX IF NOT EXISTS idx_usage_tracking_user_id ON usage_tracking(user_id);
CREATE INDEX IF NOT EXISTS idx_usage_tracking_period  ON usage_tracking(period_start, period_end);

CREATE TABLE IF NOT EXISTS usage_logs (
  id            UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id       UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  resource_type VARCHAR(50) NOT NULL,
  action        VARCHAR(50) NOT NULL,
  amount        INTEGER DEFAULT 1,
  endpoint      VARCHAR(255),
  project_id    UUID,
  metadata      JSONB DEFAULT '{}'::jsonb,
  created_at    TIMESTAMPTZ DEFAULT NOW()
);
CREATE INDEX IF NOT EXISTS idx_usage_logs_user_id       ON usage_logs(user_id);
CREATE INDEX IF NOT EXISTS idx_usage_logs_resource_type ON usage_logs(resource_type);
CREATE INDEX IF NOT EXISTS idx_usage_logs_created_at    ON usage_logs(created_at);

CREATE TABLE IF NOT EXISTS usage_records (
  id           UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id      UUID REFERENCES users(id) ON DELETE CASCADE,
  project_id   UUID REFERENCES projects(id) ON DELETE CASCADE,
  metric_type  VARCHAR(50) NOT NULL,
  metric_value BIGINT NOT NULL,
  recorded_at  TIMESTAMPTZ DEFAULT NOW(),
  period_start TIMESTAMPTZ NOT NULL,
  period_end   TIMESTAMPTZ NOT NULL
);
CREATE INDEX IF NOT EXISTS idx_usage_records_user_id    ON usage_records(user_id);
CREATE INDEX IF NOT EXISTS idx_usage_records_project_id ON usage_records(project_id);

-- ============================================================
-- QUOTA_OVERRIDES
-- ============================================================
CREATE TABLE IF NOT EXISTS quota_overrides (
  id             UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id        UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  project_id     UUID REFERENCES projects(id) ON DELETE CASCADE,
  quota_type     VARCHAR(100),
  resource_type  VARCHAR(50),
  original_limit BIGINT,
  new_limit      BIGINT,
  override_value BIGINT,
  reason         TEXT NOT NULL DEFAULT '',
  created_by     UUID REFERENCES users(id) ON DELETE SET NULL,
  expires_at     TIMESTAMPTZ,
  created_at     TIMESTAMPTZ DEFAULT NOW(),
  updated_at     TIMESTAMPTZ DEFAULT NOW()
);
CREATE INDEX IF NOT EXISTS idx_quota_overrides_user_id       ON quota_overrides(user_id);
CREATE INDEX IF NOT EXISTS idx_quota_overrides_resource_type ON quota_overrides(resource_type);
CREATE INDEX IF NOT EXISTS idx_quota_overrides_expires_at    ON quota_overrides(expires_at);

CREATE OR REPLACE FUNCTION update_quota_override_timestamp()
RETURNS TRIGGER LANGUAGE plpgsql AS $$
BEGIN NEW.updated_at = NOW(); RETURN NEW; END;
$$;
DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_trigger WHERE tgname = 'trigger_update_quota_override_timestamp') THEN
    CREATE TRIGGER trigger_update_quota_override_timestamp
      BEFORE UPDATE ON quota_overrides FOR EACH ROW EXECUTE FUNCTION update_quota_override_timestamp();
  END IF;
END $$;

-- ============================================================
-- BACKUPS  /  BACKUP_SCHEDULES  /  BACKUP_HISTORY
-- ============================================================
CREATE TABLE IF NOT EXISTS backups (
  id            UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  project_id    UUID NOT NULL REFERENCES projects(id) ON DELETE CASCADE,
  backup_name   VARCHAR(255) NOT NULL,
  backup_type   VARCHAR(50) NOT NULL,
  status        VARCHAR(50) NOT NULL DEFAULT 'pending',
  file_path     TEXT,
  file_size     BIGINT,
  compressed    BOOLEAN DEFAULT TRUE,
  created_by    UUID REFERENCES users(id),
  created_at    TIMESTAMP DEFAULT NOW(),
  completed_at  TIMESTAMP,
  error_message TEXT,
  metadata      JSONB
);
CREATE INDEX IF NOT EXISTS idx_backups_project    ON backups(project_id);
CREATE INDEX IF NOT EXISTS idx_backups_created_at ON backups(created_at DESC);
CREATE INDEX IF NOT EXISTS idx_backups_status     ON backups(status);

CREATE TABLE IF NOT EXISTS backup_schedules (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  project_id      UUID NOT NULL REFERENCES projects(id) ON DELETE CASCADE,
  schedule_name   VARCHAR(255),
  schedule_type   VARCHAR(50),
  frequency       VARCHAR(50),
  schedule_time   TIME,
  time_of_day     TIME,
  schedule_day    INTEGER,
  day_of_week     INTEGER,
  day_of_month    INTEGER,
  is_enabled      BOOLEAN DEFAULT TRUE,
  enabled         BOOLEAN DEFAULT TRUE,
  retention_days  INTEGER DEFAULT 30,
  last_run_at     TIMESTAMPTZ,
  next_run_at     TIMESTAMPTZ,
  created_at      TIMESTAMP DEFAULT NOW(),
  updated_at      TIMESTAMP DEFAULT NOW()
);
CREATE INDEX IF NOT EXISTS idx_backup_schedules_project  ON backup_schedules(project_id);
CREATE INDEX IF NOT EXISTS idx_backup_schedules_next_run ON backup_schedules(next_run_at) WHERE enabled = TRUE;

CREATE OR REPLACE FUNCTION update_backup_schedule_timestamp()
RETURNS TRIGGER LANGUAGE plpgsql AS $$
BEGIN NEW.updated_at = NOW(); RETURN NEW; END;
$$;
DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_trigger WHERE tgname = 'backup_schedules_updated_at') THEN
    CREATE TRIGGER backup_schedules_updated_at
      BEFORE UPDATE ON backup_schedules FOR EACH ROW EXECUTE FUNCTION update_backup_schedule_timestamp();
  END IF;
END $$;

CREATE TABLE IF NOT EXISTS backup_history (
  id              UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  project_id      UUID REFERENCES projects(id) ON DELETE CASCADE,
  schedule_id     UUID REFERENCES backup_schedules(id) ON DELETE SET NULL,
  backup_type     VARCHAR(50) NOT NULL,
  file_path       TEXT NOT NULL,
  file_size_bytes BIGINT,
  status          VARCHAR(50) NOT NULL,
  error_message   TEXT,
  started_at      TIMESTAMPTZ NOT NULL,
  completed_at    TIMESTAMPTZ,
  expires_at      TIMESTAMPTZ,
  created_at      TIMESTAMPTZ DEFAULT NOW()
);
CREATE INDEX IF NOT EXISTS idx_backup_history_project_id ON backup_history(project_id);

-- ============================================================
-- STORAGE_BUCKETS  /  STORAGE_OBJECTS
-- ============================================================
CREATE TABLE IF NOT EXISTS storage_buckets (
  id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  project_id  UUID NOT NULL REFERENCES projects(id) ON DELETE CASCADE,
  name        VARCHAR(255) NOT NULL,
  slug        VARCHAR(255) NOT NULL,
  description TEXT,
  is_public   BOOLEAN DEFAULT FALSE,
  storage_used BIGINT DEFAULT 0,
  file_count  INTEGER DEFAULT 0,
  created_by  UUID,
  created_at  TIMESTAMP DEFAULT NOW(),
  updated_at  TIMESTAMP DEFAULT NOW(),
  deleted_at  TIMESTAMP NULL,
  UNIQUE(project_id, slug)
);
CREATE INDEX IF NOT EXISTS idx_storage_buckets_project_id   ON storage_buckets(project_id);
CREATE INDEX IF NOT EXISTS idx_storage_buckets_deleted_at   ON storage_buckets(deleted_at);
CREATE INDEX IF NOT EXISTS idx_storage_buckets_project_slug ON storage_buckets(project_id, slug) WHERE deleted_at IS NULL;
CREATE INDEX IF NOT EXISTS idx_storage_buckets_stats        ON storage_buckets(project_id, storage_used, file_count) WHERE deleted_at IS NULL;

CREATE OR REPLACE FUNCTION update_storage_bucket_updated_at()
RETURNS TRIGGER LANGUAGE plpgsql AS $$
BEGIN NEW.updated_at = NOW(); RETURN NEW; END;
$$;
DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_trigger WHERE tgname = 'trigger_storage_buckets_updated_at') THEN
    CREATE TRIGGER trigger_storage_buckets_updated_at
      BEFORE UPDATE ON storage_buckets FOR EACH ROW EXECUTE FUNCTION update_storage_bucket_updated_at();
  END IF;
END $$;

CREATE TABLE IF NOT EXISTS storage_objects (
  id                 UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  project_id         UUID NOT NULL REFERENCES projects(id) ON DELETE CASCADE,
  bucket_id          UUID NOT NULL REFERENCES storage_buckets(id) ON DELETE CASCADE,
  file_name          TEXT,
  original_name      TEXT,
  file_size          BIGINT,
  mime_type          TEXT,
  storage_key        TEXT,
  version            INTEGER DEFAULT 1,
  uploaded_by        UUID,
  download_count     BIGINT DEFAULT 0,
  last_downloaded_at TIMESTAMP NULL,
  created_at         TIMESTAMP DEFAULT NOW(),
  updated_at         TIMESTAMP DEFAULT NOW(),
  deleted_at         TIMESTAMP NULL
);
CREATE INDEX IF NOT EXISTS idx_storage_objects_bucket_id  ON storage_objects(bucket_id);
CREATE INDEX IF NOT EXISTS idx_storage_objects_project_id ON storage_objects(project_id);
CREATE INDEX IF NOT EXISTS idx_storage_objects_deleted_at ON storage_objects(deleted_at);
CREATE INDEX IF NOT EXISTS idx_storage_objects_storage_key ON storage_objects(storage_key);
CREATE INDEX IF NOT EXISTS idx_storage_objects_bucket      ON storage_objects(bucket_id) WHERE deleted_at IS NULL;
CREATE INDEX IF NOT EXISTS idx_storage_objects_project     ON storage_objects(project_id) WHERE deleted_at IS NULL;
CREATE INDEX IF NOT EXISTS idx_storage_objects_search      ON storage_objects(bucket_id, original_name, file_name) WHERE deleted_at IS NULL;
CREATE INDEX IF NOT EXISTS idx_storage_objects_size        ON storage_objects(project_id, file_size) WHERE deleted_at IS NULL;
CREATE INDEX IF NOT EXISTS idx_storage_objects_created     ON storage_objects(project_id, created_at DESC) WHERE deleted_at IS NULL;
CREATE INDEX IF NOT EXISTS idx_storage_objects_downloads   ON storage_objects(project_id, download_count DESC) WHERE deleted_at IS NULL;

CREATE OR REPLACE FUNCTION update_storage_object_updated_at()
RETURNS TRIGGER LANGUAGE plpgsql AS $$
BEGIN NEW.updated_at = NOW(); RETURN NEW; END;
$$;
DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_trigger WHERE tgname = 'trigger_storage_objects_updated_at') THEN
    CREATE TRIGGER trigger_storage_objects_updated_at
      BEFORE UPDATE ON storage_objects FOR EACH ROW EXECUTE FUNCTION update_storage_object_updated_at();
  END IF;
END $$;

-- ============================================================
-- OAUTH URL GENERATOR TABLES
-- oauth_provider_settings / oauth_redirect_urls / oauth_state_sessions / oauth_states
-- ============================================================
CREATE TABLE IF NOT EXISTS oauth_provider_settings (
  id                      UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  project_id              UUID NOT NULL REFERENCES projects(id) ON DELETE CASCADE,
  provider                VARCHAR(50) NOT NULL CHECK (provider IN ('google', 'github')),
  client_id               TEXT NOT NULL DEFAULT '',
  client_secret_encrypted TEXT NOT NULL DEFAULT '',
  enabled                 BOOLEAN DEFAULT TRUE,
  client_ids              JSONB DEFAULT '{}',
  skip_nonce_check        BOOLEAN DEFAULT FALSE,
  additional_scopes       TEXT,
  authorize_url           TEXT,
  token_url               TEXT,
  userinfo_url            TEXT,
  created_at              TIMESTAMPTZ DEFAULT NOW(),
  updated_at              TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(project_id, provider)
);
CREATE INDEX IF NOT EXISTS idx_oauth_provider_settings_project          ON oauth_provider_settings(project_id);
CREATE INDEX IF NOT EXISTS idx_oauth_provider_settings_project_provider ON oauth_provider_settings(project_id, provider);

CREATE OR REPLACE FUNCTION update_oauth_provider_updated_at()
RETURNS TRIGGER LANGUAGE plpgsql AS $$
BEGIN NEW.updated_at = NOW(); RETURN NEW; END;
$$;
DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_trigger WHERE tgname = 'oauth_provider_settings_updated_at') THEN
    CREATE TRIGGER oauth_provider_settings_updated_at
      BEFORE UPDATE ON oauth_provider_settings FOR EACH ROW EXECUTE FUNCTION update_oauth_provider_updated_at();
  END IF;
END $$;

CREATE TABLE IF NOT EXISTS oauth_redirect_urls (
  id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  project_id  UUID NOT NULL REFERENCES projects(id) ON DELETE CASCADE,
  redirect_url TEXT NOT NULL,
  active      BOOLEAN DEFAULT TRUE,
  created_at  TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(project_id, redirect_url)
);
CREATE INDEX IF NOT EXISTS idx_oauth_redirect_urls_project ON oauth_redirect_urls(project_id);

CREATE TABLE IF NOT EXISTS oauth_state_sessions (
  id           UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  state_token  TEXT NOT NULL UNIQUE,
  project_id   UUID NOT NULL REFERENCES projects(id) ON DELETE CASCADE,
  provider     VARCHAR(50) NOT NULL,
  redirect_url TEXT,
  created_at   TIMESTAMPTZ DEFAULT NOW(),
  expires_at   TIMESTAMPTZ NOT NULL
);
CREATE INDEX IF NOT EXISTS idx_oauth_state_sessions_token   ON oauth_state_sessions(state_token);
CREATE INDEX IF NOT EXISTS idx_oauth_state_sessions_expires ON oauth_state_sessions(expires_at);

CREATE TABLE IF NOT EXISTS oauth_states (
  id              UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  state_token     TEXT UNIQUE NOT NULL,
  code_verifier   TEXT,
  code_challenge  TEXT,
  provider        TEXT NOT NULL,
  redirect_to     TEXT,
  user_id         UUID REFERENCES users(id) ON DELETE CASCADE,
  created_at      TIMESTAMP DEFAULT NOW(),
  expires_at      TIMESTAMP DEFAULT NOW() + INTERVAL '10 minutes',
  used            BOOLEAN DEFAULT FALSE
);
CREATE INDEX IF NOT EXISTS idx_oauth_states_token   ON oauth_states(state_token);
CREATE INDEX IF NOT EXISTS idx_oauth_states_expires ON oauth_states(expires_at);

-- OAuth audit tables
CREATE TABLE IF NOT EXISTS oauth_audit_logs (
  id           UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  project_id   UUID REFERENCES projects(id) ON DELETE CASCADE,
  user_id      UUID REFERENCES users(id) ON DELETE CASCADE,
  provider     TEXT,
  action       TEXT,
  success      BOOLEAN DEFAULT TRUE,
  error_message TEXT,
  ip_address   INET,
  user_agent   TEXT,
  created_at   TIMESTAMPTZ DEFAULT NOW()
);
CREATE INDEX IF NOT EXISTS idx_oauth_audit_logs_project  ON oauth_audit_logs(project_id);
CREATE INDEX IF NOT EXISTS idx_oauth_audit_logs_created  ON oauth_audit_logs(created_at);

CREATE TABLE IF NOT EXISTS oauth_audit_log (
  id            UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id       UUID REFERENCES users(id) ON DELETE CASCADE,
  provider      TEXT NOT NULL,
  action        TEXT NOT NULL,
  success       BOOLEAN NOT NULL,
  error_message TEXT,
  ip_address    INET,
  user_agent    TEXT,
  created_at    TIMESTAMP DEFAULT NOW()
);
CREATE INDEX IF NOT EXISTS idx_oauth_audit_user    ON oauth_audit_log(user_id);
CREATE INDEX IF NOT EXISTS idx_oauth_audit_created ON oauth_audit_log(created_at);

-- ============================================================
-- PROJECT AUTH TABLES
-- project_users / project_sessions / project_auth_logs / project_oauth_providers
-- ============================================================
CREATE TABLE IF NOT EXISTS project_users (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  project_id      UUID NOT NULL REFERENCES projects(id) ON DELETE CASCADE,
  email           VARCHAR(255) NOT NULL,
  provider        VARCHAR(50) NOT NULL DEFAULT 'email',
  provider_user_id VARCHAR(255),
  full_name       VARCHAR(255),
  avatar_url      TEXT,
  metadata        JSONB DEFAULT '{}',
  created_at      TIMESTAMPTZ DEFAULT NOW(),
  last_login_at   TIMESTAMPTZ,
  last_login_ip   VARCHAR(45),
  is_active       BOOLEAN DEFAULT TRUE,
  UNIQUE(project_id, email)
);
CREATE INDEX IF NOT EXISTS idx_project_users_project_id ON project_users(project_id);
CREATE INDEX IF NOT EXISTS idx_project_users_email      ON project_users(email);
CREATE INDEX IF NOT EXISTS idx_project_users_provider   ON project_users(provider);
CREATE INDEX IF NOT EXISTS idx_project_users_created_at ON project_users(created_at DESC);

CREATE TABLE IF NOT EXISTS project_sessions (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  project_id      UUID NOT NULL REFERENCES projects(id) ON DELETE CASCADE,
  project_user_id UUID NOT NULL REFERENCES project_users(id) ON DELETE CASCADE,
  user_email      VARCHAR(255) NOT NULL,
  session_token   VARCHAR(500) NOT NULL UNIQUE,
  device_name     VARCHAR(255),
  device_type     VARCHAR(50),
  browser         VARCHAR(100),
  os              VARCHAR(100),
  ip_address      VARCHAR(45),
  location        VARCHAR(255),
  user_agent      TEXT,
  created_at      TIMESTAMPTZ DEFAULT NOW(),
  last_active_at  TIMESTAMPTZ DEFAULT NOW(),
  expires_at      TIMESTAMPTZ,
  is_active       BOOLEAN DEFAULT TRUE
);
CREATE INDEX IF NOT EXISTS idx_project_sessions_project_id ON project_sessions(project_id);
CREATE INDEX IF NOT EXISTS idx_project_sessions_user_id    ON project_sessions(project_user_id);
CREATE INDEX IF NOT EXISTS idx_project_sessions_token      ON project_sessions(session_token);
CREATE INDEX IF NOT EXISTS idx_project_sessions_active     ON project_sessions(is_active, last_active_at DESC);

CREATE TABLE IF NOT EXISTS project_auth_logs (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  project_id      UUID NOT NULL REFERENCES projects(id) ON DELETE CASCADE,
  project_user_id UUID REFERENCES project_users(id) ON DELETE SET NULL,
  user_email      VARCHAR(255),
  event_type      VARCHAR(50) NOT NULL,
  provider        VARCHAR(50),
  ip_address      VARCHAR(45),
  user_agent      TEXT,
  metadata        JSONB DEFAULT '{}',
  success         BOOLEAN DEFAULT TRUE,
  error_message   TEXT,
  created_at      TIMESTAMPTZ DEFAULT NOW()
);
CREATE INDEX IF NOT EXISTS idx_project_auth_logs_project_id ON project_auth_logs(project_id);
CREATE INDEX IF NOT EXISTS idx_project_auth_logs_user_id    ON project_auth_logs(project_user_id);
CREATE INDEX IF NOT EXISTS idx_project_auth_logs_event_type ON project_auth_logs(event_type);
CREATE INDEX IF NOT EXISTS idx_project_auth_logs_created_at ON project_auth_logs(created_at DESC);
CREATE INDEX IF NOT EXISTS idx_project_auth_logs_email      ON project_auth_logs(user_email);

CREATE TABLE IF NOT EXISTS project_oauth_providers (
  id           UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  project_id   UUID NOT NULL REFERENCES projects(id) ON DELETE CASCADE,
  provider     VARCHAR(50) NOT NULL,
  is_enabled   BOOLEAN DEFAULT TRUE,
  client_id    VARCHAR(255),
  client_secret VARCHAR(500),
  redirect_url TEXT,
  config       JSONB DEFAULT '{}',
  created_at   TIMESTAMPTZ DEFAULT NOW(),
  updated_at   TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(project_id, provider)
);
CREATE INDEX IF NOT EXISTS idx_project_oauth_providers_project_id ON project_oauth_providers(project_id);

-- ============================================================
-- REALTIME FUNCTIONS
-- ============================================================
CREATE OR REPLACE FUNCTION notify_database_change()
RETURNS TRIGGER LANGUAGE plpgsql AS $$
DECLARE payload JSON; channel_name TEXT;
BEGIN
  channel_name := 'db_changes';
  IF TG_OP = 'DELETE' THEN
    payload := json_build_object('table',TG_TABLE_NAME,'schema',TG_TABLE_SCHEMA,
      'operation',TG_OP,'old',row_to_json(OLD),'new',NULL,'timestamp',NOW());
  ELSIF TG_OP = 'INSERT' THEN
    payload := json_build_object('table',TG_TABLE_NAME,'schema',TG_TABLE_SCHEMA,
      'operation',TG_OP,'old',NULL,'new',row_to_json(NEW),'timestamp',NOW());
  ELSIF TG_OP = 'UPDATE' THEN
    payload := json_build_object('table',TG_TABLE_NAME,'schema',TG_TABLE_SCHEMA,
      'operation',TG_OP,'old',row_to_json(OLD),'new',row_to_json(NEW),'timestamp',NOW());
  END IF;
  PERFORM pg_notify(channel_name, payload::text);
  IF TG_OP = 'DELETE' THEN RETURN OLD; ELSE RETURN NEW; END IF;
END;
$$;

CREATE OR REPLACE FUNCTION add_realtime_trigger(target_schema TEXT, target_table TEXT)
RETURNS TEXT LANGUAGE plpgsql AS $$
DECLARE trigger_name TEXT;
BEGIN
  trigger_name := target_table || '_realtime_trigger';
  EXECUTE format('DROP TRIGGER IF EXISTS %I ON %I.%I', trigger_name, target_schema, target_table);
  EXECUTE format(
    'CREATE TRIGGER %I AFTER INSERT OR UPDATE OR DELETE ON %I.%I FOR EACH ROW EXECUTE FUNCTION notify_database_change()',
    trigger_name, target_schema, target_table);
  RETURN format('Realtime trigger added to %s.%s', target_schema, target_table);
END;
$$;

CREATE OR REPLACE FUNCTION remove_realtime_trigger(target_schema TEXT, target_table TEXT)
RETURNS TEXT LANGUAGE plpgsql AS $$
DECLARE trigger_name TEXT;
BEGIN
  trigger_name := target_table || '_realtime_trigger';
  EXECUTE format('DROP TRIGGER IF EXISTS %I ON %I.%I', trigger_name, target_schema, target_table);
  RETURN format('Realtime trigger removed from %s.%s', target_schema, target_table);
END;
$$;

CREATE OR REPLACE FUNCTION list_realtime_triggers()
RETURNS TABLE(schema_name TEXT, table_name TEXT, trigger_name TEXT) LANGUAGE plpgsql AS $$
BEGIN
  RETURN QUERY
  SELECT n.nspname::TEXT, c.relname::TEXT, t.tgname::TEXT
  FROM pg_trigger t
  JOIN pg_class c ON t.tgrelid = c.oid
  JOIN pg_namespace n ON c.relnamespace = n.oid
  WHERE t.tgname LIKE '%_realtime_trigger' AND NOT t.tgisinternal
  ORDER BY n.nspname, c.relname;
END;
$$;

-- ============================================================
-- AUTH SCHEMA FUNCTIONS (RLS helpers — Supabase-compatible)
-- ============================================================
CREATE OR REPLACE FUNCTION auth.current_user_id()
RETURNS TEXT LANGUAGE plpgsql STABLE SECURITY DEFINER AS $$
BEGIN
  RETURN current_setting('app.current_user_id', true);
EXCEPTION WHEN OTHERS THEN RETURN NULL;
END;
$$;

CREATE OR REPLACE FUNCTION auth.current_role()
RETURNS TEXT LANGUAGE plpgsql STABLE SECURITY DEFINER AS $$
BEGIN
  RETURN COALESCE(current_setting('app.current_role', true), 'anon');
EXCEPTION WHEN OTHERS THEN RETURN 'anon';
END;
$$;

CREATE OR REPLACE FUNCTION auth.is_authenticated()
RETURNS BOOLEAN LANGUAGE plpgsql STABLE SECURITY DEFINER AS $$
BEGIN
  RETURN auth.current_role() IN ('authenticated', 'service_role');
END;
$$;

CREATE OR REPLACE FUNCTION auth.is_service_role()
RETURNS BOOLEAN LANGUAGE plpgsql STABLE SECURITY DEFINER AS $$
BEGIN
  RETURN auth.current_role() = 'service_role';
END;
$$;

CREATE OR REPLACE FUNCTION auth.uid()
RETURNS UUID LANGUAGE plpgsql STABLE SECURITY DEFINER AS $$
DECLARE uid_text TEXT;
BEGIN
  uid_text := current_setting('app.current_user_id', true);
  IF uid_text IS NULL OR uid_text = '' THEN RETURN NULL; END IF;
  RETURN uid_text::UUID;
EXCEPTION WHEN OTHERS THEN RETURN NULL;
END;
$$;

CREATE OR REPLACE FUNCTION auth.role()
RETURNS TEXT LANGUAGE plpgsql STABLE SECURITY DEFINER AS $$
BEGIN
  RETURN COALESCE(current_setting('app.current_role', true), 'anon');
EXCEPTION WHEN OTHERS THEN RETURN 'anon';
END;
$$;

CREATE OR REPLACE FUNCTION auth.owns_record(record_user_id UUID)
RETURNS BOOLEAN LANGUAGE plpgsql STABLE SECURITY DEFINER AS $$
DECLARE current_uid TEXT;
BEGIN
  IF auth.is_service_role() THEN RETURN TRUE; END IF;
  current_uid := auth.current_user_id();
  RETURN current_uid IS NOT NULL AND current_uid::UUID = record_user_id;
EXCEPTION WHEN OTHERS THEN RETURN FALSE;
END;
$$;

CREATE OR REPLACE FUNCTION auth.enable_rls(table_name TEXT)
RETURNS VOID LANGUAGE plpgsql AS $$
BEGIN
  EXECUTE format('ALTER TABLE %I ENABLE ROW LEVEL SECURITY', table_name);
END;
$$;

CREATE OR REPLACE FUNCTION auth.disable_rls(table_name TEXT)
RETURNS VOID LANGUAGE plpgsql AS $$
BEGIN
  EXECUTE format('ALTER TABLE %I DISABLE ROW LEVEL SECURITY', table_name);
END;
$$;

CREATE OR REPLACE FUNCTION auth.is_rls_enabled(table_name TEXT)
RETURNS BOOLEAN LANGUAGE plpgsql AS $$
DECLARE is_enabled BOOLEAN;
BEGIN
  SELECT relrowsecurity INTO is_enabled FROM pg_class WHERE relname = table_name;
  RETURN COALESCE(is_enabled, FALSE);
END;
$$;

CREATE OR REPLACE FUNCTION auth.list_policies(table_name TEXT)
RETURNS TABLE(policy_name TEXT, command TEXT, permissive TEXT, roles TEXT[], qual TEXT, with_check TEXT)
LANGUAGE plpgsql AS $$
BEGIN
  RETURN QUERY
  SELECT pol.polname::TEXT,
    CASE pol.polcmd WHEN 'r' THEN 'SELECT' WHEN 'a' THEN 'INSERT'
      WHEN 'w' THEN 'UPDATE' WHEN 'd' THEN 'DELETE' WHEN '*' THEN 'ALL' END::TEXT,
    CASE WHEN pol.polpermissive THEN 'PERMISSIVE' ELSE 'RESTRICTIVE' END::TEXT,
    ARRAY(SELECT rolname::TEXT FROM pg_roles WHERE oid = ANY(pol.polroles)),
    pg_get_expr(pol.polqual, pol.polrelid)::TEXT,
    pg_get_expr(pol.polwithcheck, pol.polrelid)::TEXT
  FROM pg_policy pol JOIN pg_class cls ON pol.polrelid = cls.oid
  WHERE cls.relname = table_name;
END;
$$;
