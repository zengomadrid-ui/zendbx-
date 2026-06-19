-- ─────────────────────────────────────────────────────────────────────────────
-- OAuth Authorization Code Flow Support (RFC 6749)
-- Run once against the main database.
-- ─────────────────────────────────────────────────────────────────────────────

-- 1. Add external client columns to oauth_state_sessions
--    These store the original client context so the callback can issue
--    a proper authorization code redirect instead of a token redirect.
ALTER TABLE oauth_state_sessions
    ADD COLUMN IF NOT EXISTS external_client_id   TEXT,
    ADD COLUMN IF NOT EXISTS external_redirect_uri TEXT,
    ADD COLUMN IF NOT EXISTS external_state        TEXT;

COMMENT ON COLUMN oauth_state_sessions.external_client_id
    IS 'OAuth client_id from the external app that initiated the login';
COMMENT ON COLUMN oauth_state_sessions.external_redirect_uri
    IS 'The redirect_uri the external client registered';
COMMENT ON COLUMN oauth_state_sessions.external_state
    IS 'The state value the external client passed in the authorization request';

-- 2. Create one-time authorization codes table
CREATE TABLE IF NOT EXISTS oauth_authorization_codes (
    code            TEXT        PRIMARY KEY,
    project_id      UUID        NOT NULL REFERENCES projects(id) ON DELETE CASCADE,
    provider        TEXT        NOT NULL,
    user_id         TEXT        NOT NULL,
    email           TEXT        NOT NULL,
    client_id       TEXT        NOT NULL,
    redirect_uri    TEXT        NOT NULL,
    expires_at      TIMESTAMPTZ NOT NULL DEFAULT (NOW() + INTERVAL '10 minutes'),
    used            BOOLEAN     NOT NULL DEFAULT false,
    created_at      TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Index for fast lookup and cleanup
CREATE INDEX IF NOT EXISTS idx_oauth_auth_codes_expires
    ON oauth_authorization_codes(expires_at);

CREATE INDEX IF NOT EXISTS idx_oauth_auth_codes_client
    ON oauth_authorization_codes(client_id);

-- Auto-clean expired / used codes (optional — run periodically)
-- DELETE FROM oauth_authorization_codes WHERE expires_at < NOW() OR used = true;
