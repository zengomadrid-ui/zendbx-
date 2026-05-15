-- Nexora AI Main Database Setup
-- This is the control plane database (like Supabase's main database)

-- Create main database
CREATE DATABASE nexora_main;

-- Connect to it
\c nexora_main;

-- Enable required extensions
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";
CREATE EXTENSION IF NOT EXISTS "pg_stat_statements";

-- ============================================
-- USERS TABLE
-- ============================================
CREATE TABLE users (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    email VARCHAR(255) UNIQUE NOT NULL,
    password_hash VARCHAR(255) NOT NULL,
    full_name VARCHAR(255),
    avatar_url TEXT,
    is_active BOOLEAN DEFAULT TRUE,
    is_verified BOOLEAN DEFAULT FALSE,
    plan VARCHAR(50) DEFAULT 'free', -- free, pro, enterprise
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- ============================================
-- PROJECTS TABLE (Each project = 1 database)
-- ============================================
CREATE TABLE projects (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    user_id UUID REFERENCES users(id) ON DELETE CASCADE,
    name VARCHAR(255) NOT NULL,
    slug VARCHAR(255) UNIQUE NOT NULL, -- e.g., todo-app-a18a05a0
    description TEXT,
    database_name VARCHAR(255) UNIQUE NOT NULL, -- e.g., proj_abc123
    database_host VARCHAR(255) DEFAULT 'localhost',
    database_port INTEGER DEFAULT 5432,
    region VARCHAR(50) DEFAULT 'us-east-1',
    status VARCHAR(50) DEFAULT 'active', -- active, paused, deleted
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- ============================================
-- USER_TABLES (Metadata about tables in project databases)
-- ============================================
CREATE TABLE user_tables (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    project_id UUID REFERENCES projects(id) ON DELETE CASCADE,
    table_name VARCHAR(255) NOT NULL,
    schema_definition JSONB NOT NULL,
    row_count INTEGER DEFAULT 0,
    size_bytes BIGINT DEFAULT 0,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW(),
    UNIQUE(project_id, table_name)
);

-- ============================================
-- QUERY_HISTORY
-- ============================================
CREATE TABLE query_history (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    user_id UUID REFERENCES users(id) ON DELETE CASCADE,
    project_id UUID REFERENCES projects(id) ON DELETE CASCADE,
    question TEXT, -- Natural language question (if AI used)
    sql_query TEXT NOT NULL,
    status VARCHAR(50) NOT NULL, -- success, failed
    execution_time_ms INTEGER,
    rows_returned INTEGER,
    error_message TEXT,
    created_at TIMESTAMPTZ DEFAULT NOW()
);

-- ============================================
-- SAVED_QUERIES
-- ============================================
CREATE TABLE saved_queries (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    user_id UUID REFERENCES users(id) ON DELETE CASCADE,
    project_id UUID REFERENCES projects(id) ON DELETE CASCADE,
    name VARCHAR(255) NOT NULL,
    description TEXT,
    question TEXT,
    sql_query TEXT NOT NULL,
    tags TEXT[],
    is_favorite BOOLEAN DEFAULT FALSE,
    run_count INTEGER DEFAULT 0,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- ============================================
-- API_KEYS
-- ============================================
CREATE TABLE api_keys (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    user_id UUID REFERENCES users(id) ON DELETE CASCADE,
    project_id UUID REFERENCES projects(id) ON DELETE CASCADE,
    name VARCHAR(255) NOT NULL,
    key_hash VARCHAR(255) UNIQUE NOT NULL,
    key_prefix VARCHAR(20) NOT NULL, -- For display: nex_abc...
    role VARCHAR(50) NOT NULL, -- read, admin
    last_used_at TIMESTAMPTZ,
    is_active BOOLEAN DEFAULT TRUE,
    created_at TIMESTAMPTZ DEFAULT NOW()
);

-- ============================================
-- FILE_UPLOADS
-- ============================================
CREATE TABLE file_uploads (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    user_id UUID REFERENCES users(id) ON DELETE CASCADE,
    project_id UUID REFERENCES projects(id) ON DELETE CASCADE,
    filename VARCHAR(255) NOT NULL,
    original_filename VARCHAR(255) NOT NULL,
    file_size BIGINT NOT NULL,
    mime_type VARCHAR(100),
    storage_path TEXT NOT NULL,
    status VARCHAR(50) NOT NULL, -- pending, processing, completed, failed
    table_name VARCHAR(255),
    error_message TEXT,
    created_at TIMESTAMPTZ DEFAULT NOW()
);

-- ============================================
-- PROJECT_QUOTAS (Track usage per project)
-- ============================================
CREATE TABLE project_quotas (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    project_id UUID REFERENCES projects(id) ON DELETE CASCADE UNIQUE,
    database_size_bytes BIGINT DEFAULT 0,
    table_count INTEGER DEFAULT 0,
    row_count INTEGER DEFAULT 0,
    query_count_today INTEGER DEFAULT 0,
    query_count_month INTEGER DEFAULT 0,
    last_updated TIMESTAMPTZ DEFAULT NOW()
);

-- ============================================
-- INDEXES
-- ============================================
CREATE INDEX idx_users_email ON users(email);
CREATE INDEX idx_projects_user_id ON projects(user_id);
CREATE INDEX idx_projects_slug ON projects(slug);
CREATE INDEX idx_projects_database_name ON projects(database_name);
CREATE INDEX idx_user_tables_project_id ON user_tables(project_id);
CREATE INDEX idx_query_history_user_id ON query_history(user_id);
CREATE INDEX idx_query_history_project_id ON query_history(project_id);
CREATE INDEX idx_query_history_created_at ON query_history(created_at);
CREATE INDEX idx_saved_queries_user_id ON saved_queries(user_id);
CREATE INDEX idx_api_keys_user_id ON api_keys(user_id);
CREATE INDEX idx_api_keys_key_hash ON api_keys(key_hash);
CREATE INDEX idx_file_uploads_user_id ON file_uploads(user_id);

-- ============================================
-- TRIGGERS
-- ============================================

-- Update updated_at timestamp
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = NOW();
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER update_users_updated_at 
    BEFORE UPDATE ON users
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_projects_updated_at 
    BEFORE UPDATE ON projects
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_user_tables_updated_at 
    BEFORE UPDATE ON user_tables
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_saved_queries_updated_at 
    BEFORE UPDATE ON saved_queries
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

-- ============================================
-- FUNCTIONS
-- ============================================

-- Function to generate unique project database name
CREATE OR REPLACE FUNCTION generate_project_db_name()
RETURNS TEXT AS $$
DECLARE
    db_name TEXT;
    exists BOOLEAN;
BEGIN
    LOOP
        -- Generate random name: proj_abc123
        db_name := 'proj_' || substr(md5(random()::text), 1, 8);
        
        -- Check if exists
        SELECT EXISTS(SELECT 1 FROM projects WHERE database_name = db_name) INTO exists;
        
        IF NOT exists THEN
            RETURN db_name;
        END IF;
    END LOOP;
END;
$$ LANGUAGE plpgsql;

-- Function to get project database size
CREATE OR REPLACE FUNCTION get_project_database_size(db_name TEXT)
RETURNS BIGINT AS $$
DECLARE
    size BIGINT;
BEGIN
    SELECT pg_database_size(db_name) INTO size;
    RETURN COALESCE(size, 0);
EXCEPTION
    WHEN OTHERS THEN
        RETURN 0;
END;
$$ LANGUAGE plpgsql;

-- ============================================
-- VIEWS
-- ============================================

-- View for project statistics
CREATE VIEW project_stats AS
SELECT 
    p.id,
    p.name,
    p.database_name,
    p.user_id,
    COUNT(DISTINCT ut.id) as table_count,
    COALESCE(SUM(ut.row_count), 0) as total_rows,
    COALESCE(SUM(ut.size_bytes), 0) as total_size_bytes,
    COUNT(DISTINCT qh.id) as query_count,
    p.created_at
FROM projects p
LEFT JOIN user_tables ut ON p.id = ut.project_id
LEFT JOIN query_history qh ON p.id = qh.project_id
GROUP BY p.id, p.name, p.database_name, p.user_id, p.created_at;

-- ============================================
-- SEED DATA (Optional - for testing)
-- ============================================

-- Create a test user
INSERT INTO users (email, password_hash, full_name, is_verified)
VALUES (
    'test@nexora.ai',
    '$2b$12$LQv3c1yqBWVHxkd0LHAkCOYz6TtxMQJqhN8/LewY5GyYzS.sLm4K2', -- password: test123
    'Test User',
    TRUE
);

-- Success message
SELECT 'Main database setup completed successfully!' as message;
SELECT 'Total tables created: ' || COUNT(*) as tables_count 
FROM information_schema.tables 
WHERE table_schema = 'public';
