-- ============================================
-- Enhanced OAuth System - Supabase Style
-- ============================================

-- Add multiple client IDs support (web, iOS, Android)
ALTER TABLE oauth_provider_settings 
ADD COLUMN IF NOT EXISTS client_ids JSONB DEFAULT '{}',
ADD COLUMN IF NOT EXISTS skip_nonce_check BOOLEAN DEFAULT false,
ADD COLUMN IF NOT EXISTS additional_scopes TEXT,
ADD COLUMN IF NOT EXISTS authorize_url TEXT,
ADD COLUMN IF NOT EXISTS token_url TEXT,
ADD COLUMN IF NOT EXISTS userinfo_url TEXT;

COMMENT ON COLUMN oauth_provider_settings.client_ids IS 'Multiple client IDs for different platforms: {"web": "xxx", "ios": "yyy", "android": "zzz"}';
COMMENT ON COLUMN oauth_provider_settings.skip_nonce_check IS 'Skip nonce validation for mobile apps';

-- Enhance oauth_connections table with more fields
ALTER TABLE oauth_connections
ADD COLUMN IF NOT EXISTS refresh_token TEXT,
ADD COLUMN IF NOT EXISTS token_expires_at TIMESTAMP,
ADD COLUMN IF NOT EXISTS id_token TEXT,
ADD COLUMN IF NOT EXISTS scopes TEXT,
ADD COLUMN IF NOT EXISTS last_refresh_at TIMESTAMP;

-- Create index for token expiration checks
CREATE INDEX IF NOT EXISTS idx_oauth_connections_expires 
ON oauth_connections(token_expires_at) WHERE token_expires_at IS NOT NULL;

-- Add OAuth state tracking table for PKCE and state validation
CREATE TABLE IF NOT EXISTS oauth_states (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    state_token TEXT UNIQUE NOT NULL,
    code_verifier TEXT,
    code_challenge TEXT,
    provider TEXT NOT NULL,
    redirect_to TEXT,
    user_id UUID REFERENCES users(id) ON DELETE CASCADE,
    created_at TIMESTAMP DEFAULT NOW(),
    expires_at TIMESTAMP DEFAULT NOW() + INTERVAL '10 minutes',
    used BOOLEAN DEFAULT false
);

CREATE INDEX IF NOT EXISTS idx_oauth_states_token ON oauth_states(state_token);
CREATE INDEX IF NOT EXISTS idx_oauth_states_expires ON oauth_states(expires_at);

COMMENT ON TABLE oauth_states IS 'Temporary storage for OAuth state tokens and PKCE verifiers';

-- Cleanup function for expired states
CREATE OR REPLACE FUNCTION cleanup_expired_oauth_states()
RETURNS void AS $$
BEGIN
    DELETE FROM oauth_states WHERE expires_at < NOW();
END;
$$ LANGUAGE plpgsql;

-- Add account linking support
ALTER TABLE oauth_connections
ADD COLUMN IF NOT EXISTS is_primary BOOLEAN DEFAULT false;

COMMENT ON COLUMN oauth_connections.is_primary IS 'Primary OAuth provider for this user';

-- Create function to get user OAuth providers
CREATE OR REPLACE FUNCTION get_user_oauth_providers(p_user_id UUID)
RETURNS TABLE (
    provider TEXT,
    provider_user_id TEXT,
    is_primary BOOLEAN,
    connected_at TIMESTAMP
) AS $$
BEGIN
    RETURN QUERY
    SELECT 
        oc.provider,
        oc.provider_user_id,
        oc.is_primary,
        oc.created_at
    FROM oauth_connections oc
    WHERE oc.user_id = p_user_id
    ORDER BY oc.is_primary DESC, oc.created_at ASC;
END;
$$ LANGUAGE plpgsql;

-- Add OAuth audit log
CREATE TABLE IF NOT EXISTS oauth_audit_log (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    user_id UUID REFERENCES users(id) ON DELETE CASCADE,
    provider TEXT NOT NULL,
    action TEXT NOT NULL, -- 'login', 'link', 'unlink', 'refresh'
    success BOOLEAN NOT NULL,
    error_message TEXT,
    ip_address INET,
    user_agent TEXT,
    created_at TIMESTAMP DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_oauth_audit_user ON oauth_audit_log(user_id);
CREATE INDEX IF NOT EXISTS idx_oauth_audit_created ON oauth_audit_log(created_at);

COMMENT ON TABLE oauth_audit_log IS 'Audit trail for OAuth operations';

-- Update oauth_provider_settings with default URLs for common providers
UPDATE oauth_provider_settings 
SET 
    authorize_url = 'https://accounts.google.com/o/oauth2/v2/auth',
    token_url = 'https://oauth2.googleapis.com/token',
    userinfo_url = 'https://www.googleapis.com/oauth2/v3/userinfo'
WHERE provider = 'google';

UPDATE oauth_provider_settings 
SET 
    authorize_url = 'https://github.com/login/oauth/authorize',
    token_url = 'https://github.com/login/oauth/access_token',
    userinfo_url = 'https://api.github.com/user'
WHERE provider = 'github';

-- Grant permissions
GRANT SELECT ON oauth_provider_settings TO PUBLIC;
GRANT SELECT ON oauth_connections TO PUBLIC;
GRANT SELECT ON oauth_audit_log TO PUBLIC;

COMMENT ON TABLE oauth_provider_settings IS 'OAuth provider configuration with support for multiple client IDs and PKCE';
COMMENT ON TABLE oauth_connections IS 'User OAuth connections with token refresh support';

