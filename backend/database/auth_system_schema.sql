-- ============================================
-- AUTHENTICATION SYSTEM DATABASE SCHEMA
-- ============================================

-- Sessions table
CREATE TABLE IF NOT EXISTS auth_sessions (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID REFERENCES users(id) ON DELETE CASCADE,
    session_token VARCHAR(255) UNIQUE NOT NULL,
    device_name VARCHAR(255),
    device_type VARCHAR(50),
    browser VARCHAR(100),
    os VARCHAR(100),
    ip_address INET,
    location VARCHAR(255),
    user_agent TEXT,
    last_active TIMESTAMPTZ DEFAULT NOW(),
    created_at TIMESTAMPTZ DEFAULT NOW(),
    expires_at TIMESTAMPTZ,
    is_active BOOLEAN DEFAULT TRUE
);

CREATE INDEX idx_auth_sessions_user_id ON auth_sessions(user_id);
CREATE INDEX idx_auth_sessions_token ON auth_sessions(session_token);
CREATE INDEX idx_auth_sessions_active ON auth_sessions(is_active);

-- Security settings
CREATE TABLE IF NOT EXISTS security_settings (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID REFERENCES users(id) ON DELETE CASCADE UNIQUE,
    max_login_attempts INT DEFAULT 5,
    lockout_duration INT DEFAULT 900,
    attack_protection_enabled BOOLEAN DEFAULT TRUE,
    captcha_enabled BOOLEAN DEFAULT FALSE,
    mfa_enabled BOOLEAN DEFAULT FALSE,
    mfa_method VARCHAR(20),
    mfa_secret TEXT,
    backup_codes TEXT[],
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX idx_security_settings_user_id ON security_settings(user_id);

-- Policies (Visual Policy Builder)
CREATE TABLE IF NOT EXISTS auth_policies (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    project_id UUID REFERENCES projects(id) ON DELETE CASCADE,
    name VARCHAR(255) NOT NULL,
    description TEXT,
    rules JSONB NOT NULL,
    target_table VARCHAR(255),
    target_action VARCHAR(50),
    is_active BOOLEAN DEFAULT TRUE,
    created_by UUID REFERENCES users(id) ON DELETE SET NULL,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX idx_auth_policies_project_id ON auth_policies(project_id);
CREATE INDEX idx_auth_policies_active ON auth_policies(is_active);

-- OAuth Apps
CREATE TABLE IF NOT EXISTS oauth_apps (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID REFERENCES users(id) ON DELETE CASCADE,
    app_name VARCHAR(255) NOT NULL,
    description TEXT,
    client_id VARCHAR(255) UNIQUE NOT NULL,
    client_secret VARCHAR(255) NOT NULL,
    redirect_uris TEXT[],
    scopes TEXT[],
    logo_url TEXT,
    is_active BOOLEAN DEFAULT TRUE,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX idx_oauth_apps_user_id ON oauth_apps(user_id);
CREATE INDEX idx_oauth_apps_client_id ON oauth_apps(client_id);

-- Auth Hooks
CREATE TABLE IF NOT EXISTS auth_hooks (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID REFERENCES users(id) ON DELETE CASCADE,
    project_id UUID REFERENCES projects(id) ON DELETE CASCADE,
    name VARCHAR(255) NOT NULL,
    event_type VARCHAR(50) NOT NULL,
    webhook_url TEXT NOT NULL,
    secret_key VARCHAR(255),
    is_active BOOLEAN DEFAULT TRUE,
    last_triggered_at TIMESTAMPTZ,
    created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX idx_auth_hooks_user_id ON auth_hooks(user_id);
CREATE INDEX idx_auth_hooks_project_id ON auth_hooks(project_id);
CREATE INDEX idx_auth_hooks_event_type ON auth_hooks(event_type);

-- Audit Logs
CREATE TABLE IF NOT EXISTS audit_logs (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID REFERENCES users(id) ON DELETE SET NULL,
    event_type VARCHAR(100) NOT NULL,
    event_data JSONB,
    ip_address INET,
    user_agent TEXT,
    success BOOLEAN DEFAULT TRUE,
    error_message TEXT,
    created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX idx_audit_logs_user_id ON audit_logs(user_id);
CREATE INDEX idx_audit_logs_event_type ON audit_logs(event_type);
CREATE INDEX idx_audit_logs_created_at ON audit_logs(created_at DESC);
CREATE INDEX idx_audit_logs_success ON audit_logs(success);

-- Rate limiting logs
CREATE TABLE IF NOT EXISTS rate_limit_logs (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    identifier VARCHAR(255) NOT NULL,
    endpoint VARCHAR(255) NOT NULL,
    attempts INT DEFAULT 1,
    window_start TIMESTAMPTZ DEFAULT NOW(),
    created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX idx_rate_limit_logs_identifier ON rate_limit_logs(identifier);
CREATE INDEX idx_rate_limit_logs_endpoint ON rate_limit_logs(endpoint);
CREATE INDEX idx_rate_limit_logs_window ON rate_limit_logs(window_start);

-- Login attempts tracking
CREATE TABLE IF NOT EXISTS login_attempts (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    email VARCHAR(255) NOT NULL,
    ip_address INET,
    success BOOLEAN DEFAULT FALSE,
    error_message TEXT,
    created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX idx_login_attempts_email ON login_attempts(email);
CREATE INDEX idx_login_attempts_ip ON login_attempts(ip_address);
CREATE INDEX idx_login_attempts_created_at ON login_attempts(created_at DESC);

-- Add columns to existing users table if they don't exist
DO $$ 
BEGIN
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='users' AND column_name='is_suspended') THEN
        ALTER TABLE users ADD COLUMN is_suspended BOOLEAN DEFAULT FALSE;
    END IF;
    
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='users' AND column_name='suspended_at') THEN
        ALTER TABLE users ADD COLUMN suspended_at TIMESTAMPTZ;
    END IF;
    
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='users' AND column_name='suspended_reason') THEN
        ALTER TABLE users ADD COLUMN suspended_reason TEXT;
    END IF;
    
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='users' AND column_name='last_login_at') THEN
        ALTER TABLE users ADD COLUMN last_login_at TIMESTAMPTZ;
    END IF;
    
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='users' AND column_name='last_login_ip') THEN
        ALTER TABLE users ADD COLUMN last_login_ip INET;
    END IF;
END $$;

-- Function to update updated_at timestamp
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = NOW();
    RETURN NEW;
END;
$$ language 'plpgsql';

-- Triggers for updated_at
DROP TRIGGER IF EXISTS update_security_settings_updated_at ON security_settings;
CREATE TRIGGER update_security_settings_updated_at
    BEFORE UPDATE ON security_settings
    FOR EACH ROW
    EXECUTE FUNCTION update_updated_at_column();

DROP TRIGGER IF EXISTS update_auth_policies_updated_at ON auth_policies;
CREATE TRIGGER update_auth_policies_updated_at
    BEFORE UPDATE ON auth_policies
    FOR EACH ROW
    EXECUTE FUNCTION update_updated_at_column();

DROP TRIGGER IF EXISTS update_oauth_apps_updated_at ON oauth_apps;
CREATE TRIGGER update_oauth_apps_updated_at
    BEFORE UPDATE ON oauth_apps
    FOR EACH ROW
    EXECUTE FUNCTION update_updated_at_column();

-- Insert default security settings for existing users
INSERT INTO security_settings (user_id)
SELECT id FROM users
WHERE id NOT IN (SELECT user_id FROM security_settings)
ON CONFLICT (user_id) DO NOTHING;

COMMENT ON TABLE auth_sessions IS 'Stores active user sessions with device and location information';
COMMENT ON TABLE security_settings IS 'User-specific security configuration including MFA and rate limiting';
COMMENT ON TABLE auth_policies IS 'Visual policy rules for access control';
COMMENT ON TABLE oauth_apps IS 'User-created OAuth applications';
COMMENT ON TABLE auth_hooks IS 'Webhook triggers for authentication events';
COMMENT ON TABLE audit_logs IS 'Comprehensive audit trail of all authentication events';
