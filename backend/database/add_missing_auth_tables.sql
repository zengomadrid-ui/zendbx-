-- ============================================
-- Add Missing Auth Tables to Auth Schema
-- ============================================
-- This script adds the missing auth tables that should appear in the "auth" virtual schema
-- Run this in your project database to see all auth tables in the Table Editor

-- Make sure auth schema exists
CREATE SCHEMA IF NOT EXISTS auth;

-- ============================================
-- audit_logs - Track authentication events
-- ============================================
CREATE TABLE IF NOT EXISTS auth.audit_logs (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE,
    event_type TEXT NOT NULL,  -- login, logout, password_change, email_change, etc.
    ip_address INET,
    user_agent TEXT,
    metadata JSONB DEFAULT '{}'::jsonb,
    success BOOLEAN DEFAULT true,
    error_message TEXT,
    created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_auth_audit_logs_user_id ON auth.audit_logs(user_id);
CREATE INDEX IF NOT EXISTS idx_auth_audit_logs_event_type ON auth.audit_logs(event_type);
CREATE INDEX IF NOT EXISTS idx_auth_audit_logs_created_at ON auth.audit_logs(created_at DESC);

COMMENT ON TABLE auth.audit_logs IS 'Authentication and authorization audit trail';

-- ============================================
-- config - Authentication configuration
-- ============================================
CREATE TABLE IF NOT EXISTS auth.config (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    key TEXT UNIQUE NOT NULL,
    value JSONB NOT NULL,
    description TEXT,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_auth_config_key ON auth.config(key);

COMMENT ON TABLE auth.config IS 'Authentication system configuration settings';

-- Insert default config values
INSERT INTO auth.config (key, value, description) VALUES
    ('session_timeout', '"24 hours"'::jsonb, 'Default session timeout duration'),
    ('password_min_length', '8'::jsonb, 'Minimum password length'),
    ('max_login_attempts', '5'::jsonb, 'Maximum login attempts before lockout'),
    ('lockout_duration', '"30 minutes"'::jsonb, 'Account lockout duration'),
    ('require_email_verification', 'true'::jsonb, 'Require email verification for new users'),
    ('allow_signups', 'true'::jsonb, 'Allow new user registrations')
ON CONFLICT (key) DO NOTHING;

-- ============================================
-- providers_config - OAuth provider settings
-- ============================================
CREATE TABLE IF NOT EXISTS auth.providers_config (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    provider TEXT UNIQUE NOT NULL,  -- google, github, facebook, etc.
    enabled BOOLEAN DEFAULT false,
    client_id TEXT,
    client_secret TEXT,
    redirect_uri TEXT,
    scopes TEXT[],
    additional_config JSONB DEFAULT '{}'::jsonb,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_auth_providers_config_provider ON auth.providers_config(provider);
CREATE INDEX IF NOT EXISTS idx_auth_providers_config_enabled ON auth.providers_config(enabled);

COMMENT ON TABLE auth.providers_config IS 'OAuth provider configuration';

-- Insert default providers
INSERT INTO auth.providers_config (provider, enabled) VALUES
    ('google', false),
    ('github', false),
    ('facebook', false),
    ('twitter', false),
    ('microsoft', false)
ON CONFLICT (provider) DO NOTHING;

-- ============================================
-- roles - User roles and permissions
-- ============================================
CREATE TABLE IF NOT EXISTS auth.roles (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    name TEXT UNIQUE NOT NULL,
    description TEXT,
    permissions JSONB DEFAULT '[]'::jsonb,
    is_system_role BOOLEAN DEFAULT false,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_auth_roles_name ON auth.roles(name);

COMMENT ON TABLE auth.roles IS 'User roles for RBAC';

-- Insert default roles
INSERT INTO auth.roles (name, description, permissions, is_system_role) VALUES
    ('admin', 'Administrator with full access', '["*"]'::jsonb, true),
    ('user', 'Standard user with basic access', '["read", "write"]'::jsonb, true),
    ('viewer', 'Read-only access', '["read"]'::jsonb, true)
ON CONFLICT (name) DO NOTHING;

-- ============================================
-- user_roles - User-Role mapping
-- ============================================
CREATE TABLE IF NOT EXISTS auth.user_roles (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
    role_id UUID NOT NULL REFERENCES auth.roles(id) ON DELETE CASCADE,
    granted_at TIMESTAMPTZ DEFAULT NOW(),
    granted_by UUID REFERENCES auth.users(id),
    UNIQUE(user_id, role_id)
);

CREATE INDEX IF NOT EXISTS idx_auth_user_roles_user_id ON auth.user_roles(user_id);
CREATE INDEX IF NOT EXISTS idx_auth_user_roles_role_id ON auth.user_roles(role_id);

COMMENT ON TABLE auth.user_roles IS 'Mapping of users to roles';

-- ============================================
-- verification_tokens - Email verification
-- ============================================
CREATE TABLE IF NOT EXISTS auth.verification_tokens (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
    token_hash TEXT NOT NULL UNIQUE,
    token_type TEXT NOT NULL,  -- email_verification, phone_verification, etc.
    used BOOLEAN DEFAULT false,
    expires_at TIMESTAMPTZ NOT NULL,
    created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_auth_verification_tokens_user_id ON auth.verification_tokens(user_id);
CREATE INDEX IF NOT EXISTS idx_auth_verification_tokens_token_hash ON auth.verification_tokens(token_hash);
CREATE INDEX IF NOT EXISTS idx_auth_verification_tokens_expires_at ON auth.verification_tokens(expires_at);
CREATE INDEX IF NOT EXISTS idx_auth_verification_tokens_token_type ON auth.verification_tokens(token_type);

COMMENT ON TABLE auth.verification_tokens IS 'Email and phone verification tokens';

-- ============================================
-- Update triggers for timestamps
-- ============================================

-- Config updated_at trigger
CREATE OR REPLACE FUNCTION auth.update_config_updated_at()
RETURNS TRIGGER
LANGUAGE plpgsql
AS $$
BEGIN
    NEW.updated_at = NOW();
    RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trigger_auth_config_updated_at ON auth.config;
CREATE TRIGGER trigger_auth_config_updated_at
    BEFORE UPDATE ON auth.config
    FOR EACH ROW
    EXECUTE FUNCTION auth.update_config_updated_at();

-- Providers config updated_at trigger
CREATE OR REPLACE FUNCTION auth.update_providers_config_updated_at()
RETURNS TRIGGER
LANGUAGE plpgsql
AS $$
BEGIN
    NEW.updated_at = NOW();
    RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trigger_auth_providers_config_updated_at ON auth.providers_config;
CREATE TRIGGER trigger_auth_providers_config_updated_at
    BEFORE UPDATE ON auth.providers_config
    FOR EACH ROW
    EXECUTE FUNCTION auth.update_providers_config_updated_at();

-- Roles updated_at trigger
CREATE OR REPLACE FUNCTION auth.update_roles_updated_at()
RETURNS TRIGGER
LANGUAGE plpgsql
AS $$
BEGIN
    NEW.updated_at = NOW();
    RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trigger_auth_roles_updated_at ON auth.roles;
CREATE TRIGGER trigger_auth_roles_updated_at
    BEFORE UPDATE ON auth.roles
    FOR EACH ROW
    EXECUTE FUNCTION auth.update_roles_updated_at();

-- ============================================
-- Success message
-- ============================================
SELECT 'Missing auth tables created successfully!' as status;
SELECT COUNT(*) as total_auth_tables 
FROM information_schema.tables 
WHERE table_schema = 'auth' 
AND table_type = 'BASE TABLE';
