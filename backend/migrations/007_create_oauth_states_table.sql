-- Migration 007: Create oauth_states table
-- Description: Creates oauth_states table for platform OAuth (devapp login)
-- Author: ZenDBX Team
-- Date: 2026-08-07

-- OAuth States Table (for platform-level OAuth)
-- Used by oauth_service.py for devapp.zendbx.in login
CREATE TABLE IF NOT EXISTS oauth_states (
    state_token TEXT PRIMARY KEY,
    provider TEXT NOT NULL CHECK (provider IN ('google', 'github')),
    code_verifier TEXT,
    redirect_to TEXT,
    user_id UUID,
    used BOOLEAN DEFAULT false,
    expires_at TIMESTAMPTZ NOT NULL DEFAULT (NOW() + INTERVAL '10 minutes'),
    created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_oauth_states_expires_at 
ON oauth_states(expires_at);

CREATE INDEX IF NOT EXISTS idx_oauth_states_used 
ON oauth_states(used) WHERE used = false;

COMMENT ON TABLE oauth_states IS 
'OAuth state tokens for platform-level authentication (devapp.zendbx.in login)';

-- Cleanup function for expired states
CREATE OR REPLACE FUNCTION cleanup_expired_oauth_states()
RETURNS void AS $$
BEGIN
    DELETE FROM oauth_states WHERE expires_at < NOW();
END;
$$ LANGUAGE plpgsql;

COMMENT ON FUNCTION cleanup_expired_oauth_states IS 
'Removes expired OAuth state tokens (older than 10 minutes)';
