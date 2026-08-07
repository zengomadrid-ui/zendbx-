-- Migration 009: Create oauth_connections table
-- Description: Tracks OAuth provider connections for each user
-- Author: ZenDBX Team
-- Date: 2026-08-07

-- Drop existing table if it exists (to ensure clean schema)
DROP TABLE IF EXISTS oauth_connections CASCADE;

-- OAuth Connections Table
-- Tracks which OAuth providers users have connected
CREATE TABLE oauth_connections (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    provider TEXT NOT NULL CHECK (provider IN ('google', 'github')),
    provider_user_id TEXT NOT NULL,
    access_token TEXT,
    refresh_token TEXT,
    profile_data JSONB,
    is_primary BOOLEAN DEFAULT false,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW(),
    UNIQUE(user_id, provider),
    UNIQUE(provider, provider_user_id)
);

CREATE INDEX idx_oauth_connections_user_id 
ON oauth_connections(user_id);

CREATE INDEX idx_oauth_connections_provider 
ON oauth_connections(provider);

CREATE INDEX idx_oauth_connections_provider_user_id 
ON oauth_connections(provider, provider_user_id);

COMMENT ON TABLE oauth_connections IS 
'Tracks OAuth provider connections for each user (google, github, etc.)';

COMMENT ON COLUMN oauth_connections.is_primary IS 
'Whether this is the primary authentication method for the user';
