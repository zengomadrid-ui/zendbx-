-- ============================================
-- ZendBX Phase 2 - Project Auth Isolation
-- Migration: 002_project_auth_isolation.sql
-- Description: Creates project-specific auth tables for true multi-tenancy
-- Each project gets its own isolated authentication system
-- ============================================

-- This migration is designed to be run INSIDE each project schema
-- NOT in the main database

-- ============================================
-- CREATE AUTH SCHEMA (Project-Specific)
-- ============================================
CREATE SCHEMA IF NOT EXISTS auth;

COMMENT ON SCHEMA auth IS 'Project-specific authentication schema - isolated per project';

-- ============================================
-- CREATE auth.users TABLE (Project-Specific)
-- ============================================
CREATE TABLE IF NOT EXISTS auth.users (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    email TEXT NOT NULL,
    username TEXT,
    password_hash TEXT NOT NULL DEFAULT '',
    provider TEXT NOT NULL DEFAULT 'email',
    email_verified BOOLEAN DEFAULT FALSE,
    is_active BOOLEAN DEFAULT TRUE,
    avatar_url TEXT,
    metadata JSONB DEFAULT '{}'::jsonb,
    last_login_at TIMESTAMPTZ,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW(),
    -- Email uniqueness is PROJECT-SPECIFIC (same email can exist in different projects)
    CONSTRAINT auth_users_email_unique UNIQUE (email),
    CONSTRAINT auth_users_username_unique UNIQUE (username)
);

COMMENT ON TABLE auth.users IS 'Project-specific user authentication - isolated per project';
COMMENT ON COLUMN auth.users.email IS 'Email is unique WITHIN this project only (not globally)';

-- ============================================
-- CREATE auth.sessions TABLE (Project-Specific)
-- ============================================
CREATE TABLE IF NOT EXISTS auth.sessions (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
    token_hash TEXT NOT NULL UNIQUE,
    device_info JSONB DEFAULT '{}'::jsonb,
    ip_address INET,
    user_agent TEXT,
    expires_at TIMESTAMPTZ NOT NULL,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    last_accessed_at TIMESTAMPTZ DEFAULT NOW()
);

COMMENT ON TABLE auth.sessions IS 'Project-specific user sessions';

-- ============================================
-- CREATE auth.refresh_tokens TABLE (Project-Specific)
-- ============================================
CREATE TABLE IF NOT EXISTS auth.refresh_tokens (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
    token_hash TEXT NOT NULL UNIQUE,
    parent_token_id UUID REFERENCES auth.refresh_tokens(id) ON DELETE CASCADE,
    revoked BOOLEAN DEFAULT FALSE,
    expires_at TIMESTAMPTZ NOT NULL,
    created_at TIMESTAMPTZ DEFAULT NOW()
);

COMMENT ON TABLE auth.refresh_tokens IS 'Project-specific refresh tokens for token rotation';

-- ============================================
-- CREATE auth.identities TABLE (Project-Specific)
-- ============================================
CREATE TABLE IF NOT EXISTS auth.identities (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
    provider TEXT NOT NULL,
    provider_user_id TEXT NOT NULL,
    provider_email TEXT,
    provider_metadata JSONB DEFAULT '{}'::jsonb,
    last_sign_in_at TIMESTAMPTZ,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW(),
    -- A user can have one identity per provider (e.g., one Google, one GitHub)
    CONSTRAINT auth_identities_user_provider_unique UNIQUE (user_id, provider),
    -- A provider identity can only be linked to one user in this project
    CONSTRAINT auth_identities_provider_unique UNIQUE (provider, provider_user_id)
);

COMMENT ON TABLE auth.identities IS 'Project-specific OAuth/external identities linked to users';

-- ============================================
-- CREATE auth.password_reset_tokens TABLE (Project-Specific)
-- ============================================
CREATE TABLE IF NOT EXISTS auth.password_reset_tokens (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
    token_hash TEXT NOT NULL UNIQUE,
    used BOOLEAN DEFAULT FALSE,
    expires_at TIMESTAMPTZ NOT NULL,
    created_at TIMESTAMPTZ DEFAULT NOW()
);

COMMENT ON TABLE auth.password_reset_tokens IS 'Project-specific password reset tokens';

-- ============================================
-- CREATE INDEXES FOR PERFORMANCE
-- ============================================

-- auth.users indexes
CREATE INDEX IF NOT EXISTS idx_auth_users_email_lower ON auth.users (LOWER(email));
CREATE INDEX IF NOT EXISTS idx_auth_users_username_lower ON auth.users (LOWER(username)) WHERE username IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_auth_users_provider ON auth.users (provider);
CREATE INDEX IF NOT EXISTS idx_auth_users_is_active ON auth.users (is_active);
CREATE INDEX IF NOT EXISTS idx_auth_users_created_at ON auth.users (created_at DESC);

-- auth.sessions indexes
CREATE INDEX IF NOT EXISTS idx_auth_sessions_user_id ON auth.sessions (user_id);
CREATE INDEX IF NOT EXISTS idx_auth_sessions_expires_at ON auth.sessions (expires_at);
CREATE INDEX IF NOT EXISTS idx_auth_sessions_token_hash ON auth.sessions (token_hash);

-- auth.refresh_tokens indexes
CREATE INDEX IF NOT EXISTS idx_auth_refresh_tokens_user_id ON auth.refresh_tokens (user_id);
CREATE INDEX IF NOT EXISTS idx_auth_refresh_tokens_token_hash ON auth.refresh_tokens (token_hash);
CREATE INDEX IF NOT EXISTS idx_auth_refresh_tokens_expires_at ON auth.refresh_tokens (expires_at);
CREATE INDEX IF NOT EXISTS idx_auth_refresh_tokens_parent ON auth.refresh_tokens (parent_token_id);

-- auth.identities indexes
CREATE INDEX IF NOT EXISTS idx_auth_identities_user_id ON auth.identities (user_id);
CREATE INDEX IF NOT EXISTS idx_auth_identities_provider ON auth.identities (provider);
CREATE INDEX IF NOT EXISTS idx_auth_identities_provider_user_id ON auth.identities (provider, provider_user_id);

-- auth.password_reset_tokens indexes
CREATE INDEX IF NOT EXISTS idx_auth_password_reset_tokens_user_id ON auth.password_reset_tokens (user_id);
CREATE INDEX IF NOT EXISTS idx_auth_password_reset_tokens_token_hash ON auth.password_reset_tokens (token_hash);
CREATE INDEX IF NOT EXISTS idx_auth_password_reset_tokens_expires_at ON auth.password_reset_tokens (expires_at);

-- ============================================
-- CREATE TRIGGERS
-- ============================================

-- Trigger to auto-update updated_at on auth.users
CREATE OR REPLACE FUNCTION auth.update_users_updated_at()
RETURNS TRIGGER
LANGUAGE plpgsql
AS $$
BEGIN
    NEW.updated_at = NOW();
    RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trigger_auth_users_updated_at ON auth.users;
CREATE TRIGGER trigger_auth_users_updated_at
    BEFORE UPDATE ON auth.users
    FOR EACH ROW
    EXECUTE FUNCTION auth.update_users_updated_at();

-- Trigger to normalize email/username on insert/update
CREATE OR REPLACE FUNCTION auth.normalize_user_fields()
RETURNS TRIGGER
LANGUAGE plpgsql
AS $$
BEGIN
    IF NEW.email IS NOT NULL THEN
        NEW.email = LOWER(TRIM(NEW.email));
    END IF;
    IF NEW.username IS NOT NULL THEN
        NEW.username = TRIM(NEW.username);
    END IF;
    RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trigger_auth_users_normalize ON auth.users;
CREATE TRIGGER trigger_auth_users_normalize
    BEFORE INSERT OR UPDATE ON auth.users
    FOR EACH ROW
    EXECUTE FUNCTION auth.normalize_user_fields();

-- Trigger to update last_accessed_at on sessions
CREATE OR REPLACE FUNCTION auth.update_session_last_accessed()
RETURNS TRIGGER
LANGUAGE plpgsql
AS $$
BEGIN
    NEW.last_accessed_at = NOW();
    RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trigger_auth_sessions_update_accessed ON auth.sessions;
CREATE TRIGGER trigger_auth_sessions_update_accessed
    BEFORE UPDATE ON auth.sessions
    FOR EACH ROW
    EXECUTE FUNCTION auth.update_session_last_accessed();

-- ============================================
-- CREATE public.users VIEW (Application-Facing)
-- ============================================
CREATE OR REPLACE VIEW public.users AS
SELECT
    id,
    email,
    username,
    provider,
    avatar_url,
    is_active,
    email_verified,
    metadata,
    created_at,
    updated_at,
    last_login_at
FROM auth.users;

COMMENT ON VIEW public.users IS 
'Application-facing user model. Maps to auth.users without exposing password_hash or other sensitive fields.';

-- ============================================
-- HELPER FUNCTIONS FOR SESSION MANAGEMENT
-- ============================================

-- Function to clean up expired sessions
CREATE OR REPLACE FUNCTION auth.cleanup_expired_sessions()
RETURNS INTEGER
LANGUAGE plpgsql
AS $$
DECLARE
    deleted_count INTEGER;
BEGIN
    DELETE FROM auth.sessions WHERE expires_at < NOW();
    GET DIAGNOSTICS deleted_count = ROW_COUNT;
    RETURN deleted_count;
END;
$$;

COMMENT ON FUNCTION auth.cleanup_expired_sessions() IS 'Remove all expired sessions from this project';

-- Function to clean up expired refresh tokens
CREATE OR REPLACE FUNCTION auth.cleanup_expired_refresh_tokens()
RETURNS INTEGER
LANGUAGE plpgsql
AS $$
DECLARE
    deleted_count INTEGER;
BEGIN
    DELETE FROM auth.refresh_tokens WHERE expires_at < NOW();
    GET DIAGNOSTICS deleted_count = ROW_COUNT;
    RETURN deleted_count;
END;
$$;

COMMENT ON FUNCTION auth.cleanup_expired_refresh_tokens() IS 'Remove all expired refresh tokens from this project';

-- Function to clean up expired password reset tokens
CREATE OR REPLACE FUNCTION auth.cleanup_expired_password_reset_tokens()
RETURNS INTEGER
LANGUAGE plpgsql
AS $$
DECLARE
    deleted_count INTEGER;
BEGIN
    DELETE FROM auth.password_reset_tokens WHERE expires_at < NOW();
    GET DIAGNOSTICS deleted_count = ROW_COUNT;
    RETURN deleted_count;
END;
$$;

COMMENT ON FUNCTION auth.cleanup_expired_password_reset_tokens() IS 'Remove all expired password reset tokens from this project';

-- ============================================
-- SUCCESS MESSAGE
-- ============================================

DO $$
BEGIN
    RAISE NOTICE '✅ Project auth isolation migration completed successfully';
    RAISE NOTICE '   - Created project-specific auth schema';
    RAISE NOTICE '   - Created auth.users table (project-isolated)';
    RAISE NOTICE '   - Created auth.sessions table';
    RAISE NOTICE '   - Created auth.refresh_tokens table';
    RAISE NOTICE '   - Created auth.identities table (OAuth)';
    RAISE NOTICE '   - Created auth.password_reset_tokens table';
    RAISE NOTICE '   - Created all necessary indexes';
    RAISE NOTICE '   - Created triggers for data integrity';
    RAISE NOTICE '   - Created public.users view';
    RAISE NOTICE '';
    RAISE NOTICE '🔒 Authentication is now fully isolated to this project';
    RAISE NOTICE '📧 Email uniqueness is enforced within this project only';
    RAISE NOTICE '';
    RAISE NOTICE '📊 Current row counts:';
    RAISE NOTICE '   - auth.users: %', (SELECT COUNT(*) FROM auth.users);
    RAISE NOTICE '   - auth.sessions: %', (SELECT COUNT(*) FROM auth.sessions);
    RAISE NOTICE '   - auth.refresh_tokens: %', (SELECT COUNT(*) FROM auth.refresh_tokens);
    RAISE NOTICE '   - auth.identities: %', (SELECT COUNT(*) FROM auth.identities);
END $$;
