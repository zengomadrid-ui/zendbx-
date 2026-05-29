-- OAuth URL Generator System Migration
-- This migration adds tables for OAuth provider configuration and redirect URL management

-- Create oauth_provider_settings table
CREATE TABLE IF NOT EXISTS oauth_provider_settings (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    project_id UUID NOT NULL,
    provider VARCHAR(50) NOT NULL CHECK (provider IN ('google', 'github')),
    client_id TEXT NOT NULL,
    client_secret_encrypted TEXT NOT NULL,
    enabled BOOLEAN DEFAULT true,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    UNIQUE(project_id, provider)
);

-- Add foreign key only if projects table exists
DO $$
BEGIN
    IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name = 'projects') THEN
        ALTER TABLE oauth_provider_settings 
        ADD CONSTRAINT fk_oauth_provider_project 
        FOREIGN KEY (project_id) REFERENCES projects(id) ON DELETE CASCADE;
    END IF;
END $$;

-- Create oauth_redirect_urls table
CREATE TABLE IF NOT EXISTS oauth_redirect_urls (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    project_id UUID NOT NULL,
    redirect_url TEXT NOT NULL,
    active BOOLEAN DEFAULT true,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    UNIQUE(project_id, redirect_url)
);

-- Add foreign key only if projects table exists
DO $$
BEGIN
    IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name = 'projects') THEN
        ALTER TABLE oauth_redirect_urls 
        ADD CONSTRAINT fk_oauth_redirect_project 
        FOREIGN KEY (project_id) REFERENCES projects(id) ON DELETE CASCADE;
    END IF;
END $$;

-- Create oauth_state_sessions table for CSRF protection
CREATE TABLE IF NOT EXISTS oauth_state_sessions (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    state_token TEXT NOT NULL UNIQUE,
    project_id UUID NOT NULL,
    provider VARCHAR(50) NOT NULL,
    redirect_url TEXT,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    expires_at TIMESTAMP WITH TIME ZONE NOT NULL
);

-- Add foreign key only if projects table exists
DO $$
BEGIN
    IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name = 'projects') THEN
        ALTER TABLE oauth_state_sessions 
        ADD CONSTRAINT fk_oauth_state_project 
        FOREIGN KEY (project_id) REFERENCES projects(id) ON DELETE CASCADE;
    END IF;
END $$;

-- Create oauth_audit_logs table
CREATE TABLE IF NOT EXISTS oauth_audit_logs (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    project_id UUID,
    provider VARCHAR(50),
    action VARCHAR(100) NOT NULL,
    user_id UUID,
    ip_address INET,
    user_agent TEXT,
    success BOOLEAN DEFAULT true,
    error_message TEXT,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Add foreign key only if projects table exists
DO $$
BEGIN
    IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name = 'projects') THEN
        ALTER TABLE oauth_audit_logs 
        ADD CONSTRAINT fk_oauth_audit_project 
        FOREIGN KEY (project_id) REFERENCES projects(id) ON DELETE CASCADE;
    END IF;
END $$;

-- Create indexes for performance
CREATE INDEX IF NOT EXISTS idx_oauth_provider_settings_project ON oauth_provider_settings(project_id);
CREATE INDEX IF NOT EXISTS idx_oauth_redirect_urls_project ON oauth_redirect_urls(project_id);
CREATE INDEX IF NOT EXISTS idx_oauth_state_sessions_token ON oauth_state_sessions(state_token);
CREATE INDEX IF NOT EXISTS idx_oauth_state_sessions_expires ON oauth_state_sessions(expires_at);
CREATE INDEX IF NOT EXISTS idx_oauth_audit_logs_project ON oauth_audit_logs(project_id);
CREATE INDEX IF NOT EXISTS idx_oauth_audit_logs_created ON oauth_audit_logs(created_at);

-- Create function to update updated_at timestamp
CREATE OR REPLACE FUNCTION update_oauth_provider_updated_at()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = NOW();
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Create trigger for oauth_provider_settings
CREATE TRIGGER oauth_provider_settings_updated_at
    BEFORE UPDATE ON oauth_provider_settings
    FOR EACH ROW
    EXECUTE FUNCTION update_oauth_provider_updated_at();

-- Create function to clean up expired state sessions
CREATE OR REPLACE FUNCTION cleanup_expired_oauth_sessions()
RETURNS void AS $$
BEGIN
    DELETE FROM oauth_state_sessions WHERE expires_at < NOW();
END;
$$ LANGUAGE plpgsql;

-- Grant permissions (adjust as needed for your setup)
-- GRANT SELECT, INSERT, UPDATE, DELETE ON oauth_provider_settings TO your_app_user;
-- GRANT SELECT, INSERT, UPDATE, DELETE ON oauth_redirect_urls TO your_app_user;
-- GRANT SELECT, INSERT, UPDATE, DELETE ON oauth_state_sessions TO your_app_user;
-- GRANT SELECT, INSERT ON oauth_audit_logs TO your_app_user;

COMMENT ON TABLE oauth_provider_settings IS 'Stores OAuth provider credentials for each project';
COMMENT ON TABLE oauth_redirect_urls IS 'Whitelist of allowed redirect URLs for OAuth callbacks';
COMMENT ON TABLE oauth_state_sessions IS 'Temporary storage for OAuth state tokens (CSRF protection)';
COMMENT ON TABLE oauth_audit_logs IS 'Audit trail for OAuth operations';
