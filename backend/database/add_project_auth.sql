-- Project-Level Authentication Tables
-- These tables store users, sessions, and logs for each project's OAuth implementation

-- ============================================
-- PROJECT USERS TABLE
-- Stores users who authenticated via this project's OAuth
-- ============================================
CREATE TABLE IF NOT EXISTS project_users (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    project_id UUID NOT NULL REFERENCES projects(id) ON DELETE CASCADE,
    email VARCHAR(255) NOT NULL,
    provider VARCHAR(50) NOT NULL, -- 'email', 'google', 'github', etc.
    provider_user_id VARCHAR(255), -- ID from OAuth provider
    full_name VARCHAR(255),
    avatar_url TEXT,
    metadata JSONB DEFAULT '{}', -- Additional user data
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    last_login_at TIMESTAMP WITH TIME ZONE,
    last_login_ip VARCHAR(45),
    is_active BOOLEAN DEFAULT TRUE,
    UNIQUE(project_id, email)
);

CREATE INDEX idx_project_users_project_id ON project_users(project_id);
CREATE INDEX idx_project_users_email ON project_users(email);
CREATE INDEX idx_project_users_provider ON project_users(provider);
CREATE INDEX idx_project_users_created_at ON project_users(created_at DESC);

-- ============================================
-- PROJECT SESSIONS TABLE
-- Stores active sessions for project users
-- ============================================
CREATE TABLE IF NOT EXISTS project_sessions (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    project_id UUID NOT NULL REFERENCES projects(id) ON DELETE CASCADE,
    project_user_id UUID NOT NULL REFERENCES project_users(id) ON DELETE CASCADE,
    user_email VARCHAR(255) NOT NULL,
    session_token VARCHAR(500) NOT NULL UNIQUE,
    device_name VARCHAR(255),
    device_type VARCHAR(50), -- 'desktop', 'mobile', 'tablet'
    browser VARCHAR(100),
    os VARCHAR(100),
    ip_address VARCHAR(45),
    location VARCHAR(255), -- Approximate location (city, country)
    user_agent TEXT,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    last_active_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    expires_at TIMESTAMP WITH TIME ZONE,
    is_active BOOLEAN DEFAULT TRUE
);

CREATE INDEX idx_project_sessions_project_id ON project_sessions(project_id);
CREATE INDEX idx_project_sessions_user_id ON project_sessions(project_user_id);
CREATE INDEX idx_project_sessions_token ON project_sessions(session_token);
CREATE INDEX idx_project_sessions_active ON project_sessions(is_active, last_active_at DESC);

-- ============================================
-- PROJECT AUTH LOGS TABLE
-- Tracks authentication events for the project
-- ============================================
CREATE TABLE IF NOT EXISTS project_auth_logs (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    project_id UUID NOT NULL REFERENCES projects(id) ON DELETE CASCADE,
    project_user_id UUID REFERENCES project_users(id) ON DELETE SET NULL,
    user_email VARCHAR(255),
    event_type VARCHAR(50) NOT NULL, -- 'login_success', 'login_failed', 'logout', 'signup', 'password_reset'
    provider VARCHAR(50), -- 'email', 'google', 'github', etc.
    ip_address VARCHAR(45),
    user_agent TEXT,
    metadata JSONB DEFAULT '{}', -- Additional event data
    success BOOLEAN DEFAULT TRUE,
    error_message TEXT,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

CREATE INDEX idx_project_auth_logs_project_id ON project_auth_logs(project_id);
CREATE INDEX idx_project_auth_logs_user_id ON project_auth_logs(project_user_id);
CREATE INDEX idx_project_auth_logs_event_type ON project_auth_logs(event_type);
CREATE INDEX idx_project_auth_logs_created_at ON project_auth_logs(created_at DESC);
CREATE INDEX idx_project_auth_logs_email ON project_auth_logs(user_email);

-- ============================================
-- PROJECT OAUTH PROVIDERS TABLE
-- Stores enabled OAuth providers for each project
-- ============================================
CREATE TABLE IF NOT EXISTS project_oauth_providers (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    project_id UUID NOT NULL REFERENCES projects(id) ON DELETE CASCADE,
    provider VARCHAR(50) NOT NULL, -- 'google', 'github', 'email', etc.
    is_enabled BOOLEAN DEFAULT TRUE,
    client_id VARCHAR(255),
    client_secret VARCHAR(500), -- Encrypted
    redirect_url TEXT,
    config JSONB DEFAULT '{}', -- Provider-specific configuration
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    UNIQUE(project_id, provider)
);

CREATE INDEX idx_project_oauth_providers_project_id ON project_oauth_providers(project_id);
CREATE INDEX idx_project_oauth_providers_enabled ON project_oauth_providers(is_enabled);

-- ============================================
-- COMMENTS
-- ============================================
COMMENT ON TABLE project_users IS 'Users who authenticated via project OAuth';
COMMENT ON TABLE project_sessions IS 'Active sessions for project users';
COMMENT ON TABLE project_auth_logs IS 'Authentication event logs for projects';
COMMENT ON TABLE project_oauth_providers IS 'OAuth provider configuration per project';
