-- ============================================
-- OAuth Provider Settings Table
-- Store OAuth credentials in database for dynamic configuration
-- ============================================

-- Create oauth_provider_settings table
CREATE TABLE IF NOT EXISTS oauth_provider_settings (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    provider VARCHAR(50) UNIQUE NOT NULL,
    client_id TEXT NOT NULL,
    client_secret TEXT NOT NULL,
    is_enabled BOOLEAN DEFAULT false,
    redirect_uri TEXT,
    scopes TEXT,
    metadata JSONB DEFAULT '{}',
    created_at TIMESTAMP DEFAULT NOW(),
    updated_at TIMESTAMP DEFAULT NOW()
);

-- Create index on provider for fast lookups
CREATE INDEX IF NOT EXISTS idx_oauth_provider_settings_provider 
ON oauth_provider_settings(provider);

-- Create index on enabled providers
CREATE INDEX IF NOT EXISTS idx_oauth_provider_settings_enabled 
ON oauth_provider_settings(is_enabled) WHERE is_enabled = true;

-- Add updated_at trigger
CREATE OR REPLACE FUNCTION update_oauth_provider_settings_updated_at()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = NOW();
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS update_oauth_provider_settings_updated_at_trigger 
ON oauth_provider_settings;

CREATE TRIGGER update_oauth_provider_settings_updated_at_trigger
    BEFORE UPDATE ON oauth_provider_settings
    FOR EACH ROW
    EXECUTE FUNCTION update_oauth_provider_settings_updated_at();

-- Insert default providers (disabled by default)
INSERT INTO oauth_provider_settings (provider, client_id, client_secret, is_enabled, scopes)
VALUES 
    ('google', '', '', false, 'openid email profile'),
    ('github', '', '', false, 'user:email')
ON CONFLICT (provider) DO NOTHING;

-- Add comment
COMMENT ON TABLE oauth_provider_settings IS 'OAuth provider configuration stored in database for dynamic updates';
