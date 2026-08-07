-- Migration 006: Create OAuth Tables
-- Description: Creates all required OAuth-related tables for Google/GitHub authentication
-- Author: ZenDBX Team
-- Date: 2026-08-07

-- ============================================================================
-- 1. OAuth Provider Settings Table
-- ============================================================================
-- Stores OAuth provider configuration per project (Google, GitHub, etc.)
CREATE TABLE IF NOT EXISTS oauth_provider_settings (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    project_id UUID NOT NULL REFERENCES projects(id) ON DELETE CASCADE,
    provider TEXT NOT NULL CHECK (provider IN ('google', 'github')),
    client_id TEXT NOT NULL,
    client_secret_encrypted TEXT NOT NULL,
    enabled BOOLEAN DEFAULT true,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW(),
    UNIQUE(project_id, provider)
);

CREATE INDEX IF NOT EXISTS idx_oauth_provider_settings_project_id 
ON oauth_provider_settings(project_id);

CREATE INDEX IF NOT EXISTS idx_oauth_provider_settings_provider 
ON oauth_provider_settings(provider);

COMMENT ON TABLE oauth_provider_settings IS 
'OAuth provider configuration per project. Client secrets are encrypted using OAUTH_ENCRYPTION_KEY.';

-- ============================================================================
-- 2. OAuth Redirect URLs Table
-- ============================================================================
-- Whitelisted redirect URLs for OAuth callbacks per project
CREATE TABLE IF NOT EXISTS oauth_redirect_urls (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    project_id UUID NOT NULL REFERENCES projects(id) ON DELETE CASCADE,
    redirect_url TEXT NOT NULL,
    active BOOLEAN DEFAULT true,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    UNIQUE(project_id, redirect_url)
);

CREATE INDEX IF NOT EXISTS idx_oauth_redirect_urls_project_id 
ON oauth_redirect_urls(project_id);

CREATE INDEX IF NOT EXISTS idx_oauth_redirect_urls_active 
ON oauth_redirect_urls(active) WHERE active = true;

COMMENT ON TABLE oauth_redirect_urls IS 
'Whitelisted redirect URLs for OAuth callbacks. Only active URLs are allowed.';

-- ============================================================================
-- 3. OAuth State Sessions Table
-- ============================================================================
-- Temporary state tokens for CSRF protection during OAuth flow
CREATE TABLE IF NOT EXISTS oauth_state_sessions (
    state_token TEXT PRIMARY KEY,
    project_id UUID NOT NULL REFERENCES projects(id) ON DELETE CASCADE,
    provider TEXT NOT NULL,
    redirect_url TEXT,
    expires_at TIMESTAMPTZ NOT NULL,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    -- External OAuth client fields (RFC 6749)
    external_client_id TEXT,
    external_redirect_uri TEXT,
    external_state TEXT
);

CREATE INDEX IF NOT EXISTS idx_oauth_state_sessions_expires_at 
ON oauth_state_sessions(expires_at);

CREATE INDEX IF NOT EXISTS idx_oauth_state_sessions_project_id 
ON oauth_state_sessions(project_id);

COMMENT ON TABLE oauth_state_sessions IS 
'Temporary OAuth state sessions for CSRF protection. Expires after 10 minutes.';

-- ============================================================================
-- 4. OAuth Authorization Codes Table
-- ============================================================================
-- One-time authorization codes for external OAuth clients (RFC 6749)
CREATE TABLE IF NOT EXISTS oauth_authorization_codes (
    code TEXT PRIMARY KEY,
    project_id UUID NOT NULL REFERENCES projects(id) ON DELETE CASCADE,
    provider TEXT NOT NULL,
    user_id TEXT NOT NULL,
    email TEXT NOT NULL,
    client_id TEXT NOT NULL,
    redirect_uri TEXT NOT NULL,
    expires_at TIMESTAMPTZ NOT NULL,
    used BOOLEAN DEFAULT false,
    created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_oauth_authorization_codes_expires_at 
ON oauth_authorization_codes(expires_at);

CREATE INDEX IF NOT EXISTS idx_oauth_authorization_codes_used 
ON oauth_authorization_codes(used) WHERE used = false;

COMMENT ON TABLE oauth_authorization_codes IS 
'One-time authorization codes for external OAuth clients. Valid for 10 minutes.';

-- ============================================================================
-- 5. OAuth Audit Logs Table
-- ============================================================================
-- Audit trail for OAuth authentication attempts and successes
CREATE TABLE IF NOT EXISTS oauth_audit_logs (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    project_id UUID REFERENCES projects(id) ON DELETE SET NULL,
    provider TEXT NOT NULL,
    action TEXT NOT NULL CHECK (action IN ('oauth_initiated', 'oauth_success', 'oauth_failed')),
    user_id TEXT,
    ip_address INET,
    user_agent TEXT,
    success BOOLEAN DEFAULT true,
    error_message TEXT,
    created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_oauth_audit_logs_project_id 
ON oauth_audit_logs(project_id);

CREATE INDEX IF NOT EXISTS idx_oauth_audit_logs_created_at 
ON oauth_audit_logs(created_at DESC);

CREATE INDEX IF NOT EXISTS idx_oauth_audit_logs_action 
ON oauth_audit_logs(action);

COMMENT ON TABLE oauth_audit_logs IS 
'Audit trail for OAuth authentication attempts. Used for security monitoring and debugging.';

-- ============================================================================
-- Migration Complete
-- ============================================================================

DO $$
BEGIN
    RAISE NOTICE '✅ Migration 006: OAuth tables created successfully';
END $$;
