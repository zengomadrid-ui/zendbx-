-- Migration 011: Create refresh_tokens table and add project-scoped token support
-- Enables refresh token functionality for Issue #6 fix

-- Create refresh_tokens table if it doesn't exist
CREATE TABLE IF NOT EXISTS auth.refresh_tokens (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID NOT NULL,
    token_hash TEXT NOT NULL UNIQUE,
    project_id UUID REFERENCES projects(id) ON DELETE CASCADE,
    parent_token_id UUID REFERENCES auth.refresh_tokens(id) ON DELETE CASCADE,
    revoked BOOLEAN DEFAULT FALSE,
    expires_at TIMESTAMPTZ NOT NULL,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Add indexes for efficient lookups
CREATE INDEX IF NOT EXISTS idx_refresh_tokens_user_id 
ON auth.refresh_tokens(user_id);

CREATE INDEX IF NOT EXISTS idx_refresh_tokens_project_id 
ON auth.refresh_tokens(project_id);

CREATE INDEX IF NOT EXISTS idx_refresh_tokens_token_hash 
ON auth.refresh_tokens(token_hash);

CREATE INDEX IF NOT EXISTS idx_refresh_tokens_hash_project 
ON auth.refresh_tokens(token_hash, project_id);

CREATE INDEX IF NOT EXISTS idx_refresh_tokens_expires_at 
ON auth.refresh_tokens(expires_at) WHERE NOT revoked;

-- Comment on table and columns
COMMENT ON TABLE auth.refresh_tokens IS 'Refresh tokens for session renewal with token rotation support';
COMMENT ON COLUMN auth.refresh_tokens.user_id IS 'User who owns this refresh token';
COMMENT ON COLUMN auth.refresh_tokens.token_hash IS 'SHA-256 hash of the refresh token';
COMMENT ON COLUMN auth.refresh_tokens.project_id IS 'Optional project ID for project-scoped tokens. NULL = platform token';
COMMENT ON COLUMN auth.refresh_tokens.parent_token_id IS 'Previous token in rotation chain for audit trail';
COMMENT ON COLUMN auth.refresh_tokens.revoked IS 'Whether token has been revoked (logout or rotation)';
COMMENT ON COLUMN auth.refresh_tokens.expires_at IS 'Expiration timestamp (typically 30 days)';
COMMENT ON COLUMN auth.refresh_tokens.updated_at IS 'Timestamp when token was last updated (e.g., revoked)';

