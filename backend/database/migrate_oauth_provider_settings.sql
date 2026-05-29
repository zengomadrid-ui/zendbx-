-- ============================================
-- Migration: Rebuild oauth_provider_settings for per-project OAuth URL Generator
-- Run this in your production database to fix the schema
-- ============================================

-- Step 1: Drop the old global table (no project_id)
DROP TABLE IF EXISTS oauth_provider_settings CASCADE;

-- Step 2: Recreate with correct per-project schema
CREATE TABLE oauth_provider_settings (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    project_id UUID NOT NULL REFERENCES projects(id) ON DELETE CASCADE,
    provider VARCHAR(50) NOT NULL CHECK (provider IN ('google', 'github')),
    client_id TEXT NOT NULL,
    client_secret_encrypted TEXT NOT NULL,
    enabled BOOLEAN DEFAULT true,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    UNIQUE(project_id, provider)
);

-- Step 3: Indexes
CREATE INDEX IF NOT EXISTS idx_oauth_provider_settings_project ON oauth_provider_settings(project_id);
CREATE INDEX IF NOT EXISTS idx_oauth_provider_settings_project_provider ON oauth_provider_settings(project_id, provider);

-- Step 4: Auto-update updated_at
CREATE OR REPLACE FUNCTION update_oauth_provider_updated_at()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = NOW();
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS oauth_provider_settings_updated_at ON oauth_provider_settings;
CREATE TRIGGER oauth_provider_settings_updated_at
    BEFORE UPDATE ON oauth_provider_settings
    FOR EACH ROW
    EXECUTE FUNCTION update_oauth_provider_updated_at();

-- Step 5: Ensure oauth_redirect_urls exists
CREATE TABLE IF NOT EXISTS oauth_redirect_urls (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    project_id UUID NOT NULL REFERENCES projects(id) ON DELETE CASCADE,
    redirect_url TEXT NOT NULL,
    active BOOLEAN DEFAULT true,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    UNIQUE(project_id, redirect_url)
);

CREATE INDEX IF NOT EXISTS idx_oauth_redirect_urls_project ON oauth_redirect_urls(project_id);

-- Step 6: Ensure oauth_state_sessions exists
CREATE TABLE IF NOT EXISTS oauth_state_sessions (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    state_token TEXT NOT NULL UNIQUE,
    project_id UUID NOT NULL REFERENCES projects(id) ON DELETE CASCADE,
    provider VARCHAR(50) NOT NULL,
    redirect_url TEXT,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    expires_at TIMESTAMP WITH TIME ZONE NOT NULL
);

CREATE INDEX IF NOT EXISTS idx_oauth_state_sessions_token ON oauth_state_sessions(state_token);
CREATE INDEX IF NOT EXISTS idx_oauth_state_sessions_expires ON oauth_state_sessions(expires_at);

COMMENT ON TABLE oauth_provider_settings IS 'Per-project OAuth provider credentials for URL generator system';
