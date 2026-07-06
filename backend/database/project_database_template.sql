-- Project Database Template
-- This script is run when creating a new project database
-- Each user project gets its own database with this setup

-- Enable required extensions
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";
CREATE EXTENSION IF NOT EXISTS "pg_stat_statements";
CREATE EXTENSION IF NOT EXISTS "pgcrypto";

-- ============================================
-- HELPER FUNCTIONS
-- ============================================

-- Auto-update updated_at timestamp (using single-quoted string for compatibility)
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER
LANGUAGE plpgsql
AS '
BEGIN
    NEW.updated_at = NOW();
    RETURN NEW;
END;
';

-- ============================================
-- CREATE AUTH SCHEMA AND USERS TABLE (Phase 1)
-- ============================================
CREATE SCHEMA IF NOT EXISTS auth;

-- Create auth.users table (Phase 1 Foundation)
CREATE TABLE IF NOT EXISTS auth.users (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    email TEXT NOT NULL,
    username TEXT,
    password_hash TEXT NOT NULL,
    provider TEXT NOT NULL DEFAULT 'email',
    email_verified BOOLEAN DEFAULT FALSE,
    is_active BOOLEAN DEFAULT TRUE,
    avatar_url TEXT,
    metadata JSONB DEFAULT '{}'::jsonb,
    last_login_at TIMESTAMPTZ,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW(),
    CONSTRAINT auth_users_email_unique UNIQUE (email),
    CONSTRAINT auth_users_username_unique UNIQUE (username)
);

-- Indexes for auth.users
CREATE INDEX IF NOT EXISTS idx_auth_users_email_lower ON auth.users (LOWER(email));
CREATE INDEX IF NOT EXISTS idx_auth_users_username_lower ON auth.users (LOWER(username)) WHERE username IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_auth_users_provider ON auth.users (provider);
CREATE INDEX IF NOT EXISTS idx_auth_users_is_active ON auth.users (is_active);
CREATE INDEX IF NOT EXISTS idx_auth_users_created_at ON auth.users (created_at DESC);
CREATE INDEX IF NOT EXISTS idx_auth_users_provider_email ON auth.users (provider, LOWER(email));

-- Trigger to auto-update updated_at
CREATE OR REPLACE FUNCTION auth.update_users_updated_at()
RETURNS TRIGGER
LANGUAGE plpgsql
AS '
BEGIN
    NEW.updated_at = NOW();
    RETURN NEW;
END;
';

DROP TRIGGER IF EXISTS trigger_auth_users_updated_at ON auth.users;
CREATE TRIGGER trigger_auth_users_updated_at
    BEFORE UPDATE ON auth.users
    FOR EACH ROW
    EXECUTE FUNCTION auth.update_users_updated_at();

-- Trigger to normalize email/username
CREATE OR REPLACE FUNCTION auth.normalize_user_fields()
RETURNS TRIGGER
LANGUAGE plpgsql
AS '
BEGIN
    IF NEW.email IS NOT NULL THEN
        NEW.email = LOWER(TRIM(NEW.email));
    END IF;
    IF NEW.username IS NOT NULL THEN
        NEW.username = TRIM(NEW.username);
    END IF;
    RETURN NEW;
END;
';

DROP TRIGGER IF EXISTS trigger_auth_users_normalize ON auth.users;
CREATE TRIGGER trigger_auth_users_normalize
    BEFORE INSERT OR UPDATE ON auth.users
    FOR EACH ROW
    EXECUTE FUNCTION auth.normalize_user_fields();

-- ============================================
-- RLS HELPER FUNCTIONS (SQL Editor Compatible)
-- ============================================

-- Get current user ID from session variable
CREATE OR REPLACE FUNCTION auth.current_user_id()
RETURNS TEXT
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
AS '
BEGIN
    RETURN current_setting(''app.current_user_id'', true);
EXCEPTION
    WHEN OTHERS THEN
        RETURN NULL;
END;
';

COMMENT ON FUNCTION auth.current_user_id() IS 'Returns the current user ID from session variable set by RLS middleware';

-- Get current user role from session variable
CREATE OR REPLACE FUNCTION auth.current_role()
RETURNS TEXT
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
AS '
BEGIN
    RETURN COALESCE(current_setting(''app.current_role'', true), ''anon'');
EXCEPTION
    WHEN OTHERS THEN
        RETURN ''anon'';
END;
';

COMMENT ON FUNCTION auth.current_role() IS 'Returns the current user role (anon, authenticated, service_role) from session variable';

-- Check if current user is authenticated
CREATE OR REPLACE FUNCTION auth.is_authenticated()
RETURNS BOOLEAN
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
AS '
BEGIN
    RETURN auth.current_role() IN (''authenticated'', ''service_role'');
END;
';

COMMENT ON FUNCTION auth.is_authenticated() IS 'Returns true if user is authenticated (not anonymous)';

-- Check if current user has service_role
CREATE OR REPLACE FUNCTION auth.is_service_role()
RETURNS BOOLEAN
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
AS '
BEGIN
    RETURN auth.current_role() = ''service_role'';
END;
';

COMMENT ON FUNCTION auth.is_service_role() IS 'Returns true if user has service_role privileges (bypasses RLS)';

-- ============================================
-- SUPABASE COMPATIBILITY FUNCTIONS
-- ============================================

-- auth.uid() — Supabase-compatible alias for auth.current_user_id()
-- Usage in RLS: USING (auth.uid() = user_id)
CREATE OR REPLACE FUNCTION auth.uid()
RETURNS UUID
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
AS '
DECLARE
    uid_text TEXT;
BEGIN
    uid_text := current_setting(''app.current_user_id'', true);
    IF uid_text IS NULL OR uid_text = '''' THEN
        RETURN NULL;
    END IF;
    RETURN uid_text::UUID;
EXCEPTION
    WHEN invalid_text_representation THEN
        RETURN NULL;
    WHEN OTHERS THEN
        RETURN NULL;
END;
';

COMMENT ON FUNCTION auth.uid() IS
'Supabase-compatible: returns authenticated user UUID from session context.
Use in RLS policies: USING (auth.uid() = user_id)';

-- auth.role() — Supabase-compatible alias for auth.current_role()
-- Usage in RLS: USING (auth.role() = 'authenticated')
CREATE OR REPLACE FUNCTION auth.role()
RETURNS TEXT
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
AS '
BEGIN
    RETURN COALESCE(current_setting(''app.current_role'', true), ''anon'');
EXCEPTION
    WHEN OTHERS THEN
        RETURN ''anon'';
END;
';

COMMENT ON FUNCTION auth.role() IS
'Supabase-compatible: returns current session role.
Values: anon | authenticated | service_role | owner | admin | developer | viewer';

-- Check if current user owns a record
CREATE OR REPLACE FUNCTION auth.owns_record(record_user_id UUID)
RETURNS BOOLEAN
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
AS '
DECLARE
    current_uid TEXT;
BEGIN
    IF auth.is_service_role() THEN
        RETURN true;
    END IF;
    
    current_uid := auth.current_user_id();
    RETURN current_uid IS NOT NULL AND current_uid::UUID = record_user_id;
EXCEPTION
    WHEN OTHERS THEN
        RETURN false;
END;
';

COMMENT ON FUNCTION auth.owns_record(UUID) IS 'Returns true if current user owns the record or has service_role';

-- ============================================
-- RLS UTILITY FUNCTIONS
-- ============================================

-- Function to enable RLS on a table
CREATE OR REPLACE FUNCTION auth.enable_rls(table_name TEXT)
RETURNS VOID
LANGUAGE plpgsql
AS '
BEGIN
    EXECUTE format(''ALTER TABLE %I ENABLE ROW LEVEL SECURITY'', table_name);
    RAISE NOTICE ''RLS enabled on table: %'', table_name;
END;
';

COMMENT ON FUNCTION auth.enable_rls(TEXT) IS 'Enable RLS on a table';

-- Function to disable RLS on a table
CREATE OR REPLACE FUNCTION auth.disable_rls(table_name TEXT)
RETURNS VOID
LANGUAGE plpgsql
AS '
BEGIN
    EXECUTE format(''ALTER TABLE %I DISABLE ROW LEVEL SECURITY'', table_name);
    RAISE NOTICE ''RLS disabled on table: %'', table_name;
END;
';

COMMENT ON FUNCTION auth.disable_rls(TEXT) IS 'Disable RLS on a table';

-- Function to check if RLS is enabled on a table
CREATE OR REPLACE FUNCTION auth.is_rls_enabled(table_name TEXT)
RETURNS BOOLEAN
LANGUAGE plpgsql
AS '
DECLARE
    is_enabled BOOLEAN;
BEGIN
    SELECT relrowsecurity INTO is_enabled
    FROM pg_class
    WHERE relname = table_name;
    
    RETURN COALESCE(is_enabled, false);
END;
';

COMMENT ON FUNCTION auth.is_rls_enabled(TEXT) IS 'Check if RLS is enabled on a table';

-- ============================================
-- auth.users COMPATIBILITY VIEW
-- Backed by the users table once it is created.
-- Deferred: created after users table exists (see auto_table.py / migration).
-- The view is installed by add_supabase_compat.sql after users table creation.
-- ============================================

-- ============================================
-- METADATA TABLE (Track tables in this database)
-- ============================================
CREATE TABLE _nexora_metadata (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    table_name VARCHAR(255) UNIQUE NOT NULL,
    created_by VARCHAR(255),
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- ============================================
-- READY FOR USER TABLES
-- ============================================
-- Users will create their own tables here
-- Examples:
--   - customers
--   - orders
--   - products
--   - sales
--   etc.

-- RLS helper functions are available:
--   - auth.current_user_id() - Get current user ID
--   - auth.current_role() - Get current role
--   - auth.is_authenticated() - Check if authenticated
--   - auth.is_service_role() - Check if service role
--   - auth.owns_record(uuid) - Check if user owns record
--   - auth.enable_rls('table_name') - Enable RLS on table
--   - auth.is_rls_enabled('table_name') - Check RLS status

-- Success message
SELECT 'Project database initialized successfully!' as message;
SELECT 'RLS helper functions are ready in auth schema' as rls_status;
SELECT 'Database is ready for user tables' as status;

-- ============================================
-- REALTIME TRIGGER SYSTEM
-- ============================================

-- Create the notification function for realtime
CREATE OR REPLACE FUNCTION notify_database_change()
RETURNS TRIGGER
LANGUAGE plpgsql
AS '
DECLARE
    payload JSON;
    channel_name TEXT;
BEGIN
    channel_name := ''db_changes'';
    
    IF (TG_OP = ''DELETE'') THEN
        payload := json_build_object(
            ''table'', TG_TABLE_NAME,
            ''schema'', TG_TABLE_SCHEMA,
            ''operation'', TG_OP,
            ''old'', row_to_json(OLD),
            ''new'', NULL,
            ''timestamp'', NOW()
        );
    ELSIF (TG_OP = ''INSERT'') THEN
        payload := json_build_object(
            ''table'', TG_TABLE_NAME,
            ''schema'', TG_TABLE_SCHEMA,
            ''operation'', TG_OP,
            ''old'', NULL,
            ''new'', row_to_json(NEW),
            ''timestamp'', NOW()
        );
    ELSIF (TG_OP = ''UPDATE'') THEN
        payload := json_build_object(
            ''table'', TG_TABLE_NAME,
            ''schema'', TG_TABLE_SCHEMA,
            ''operation'', TG_OP,
            ''old'', row_to_json(OLD),
            ''new'', row_to_json(NEW),
            ''timestamp'', NOW()
        );
    END IF;
    
    PERFORM pg_notify(channel_name, payload::text);
    
    IF (TG_OP = ''DELETE'') THEN
        RETURN OLD;
    ELSE
        RETURN NEW;
    END IF;
END;
';

COMMENT ON FUNCTION notify_database_change() IS 'Trigger function that sends database change notifications via pg_notify';

-- Helper function to add realtime trigger to any table
CREATE OR REPLACE FUNCTION add_realtime_trigger(
    target_schema TEXT,
    target_table TEXT
)
RETURNS TEXT
LANGUAGE plpgsql
AS '
DECLARE
    trigger_name TEXT;
BEGIN
    trigger_name := target_table || ''_realtime_trigger'';
    
    EXECUTE format(
        ''DROP TRIGGER IF EXISTS %I ON %I.%I'',
        trigger_name,
        target_schema,
        target_table
    );
    
    EXECUTE format(
        ''CREATE TRIGGER %I
        AFTER INSERT OR UPDATE OR DELETE ON %I.%I
        FOR EACH ROW
        EXECUTE FUNCTION notify_database_change()'',
        trigger_name,
        target_schema,
        target_table
    );
    
    RETURN format(''Realtime trigger added to %s.%s'', target_schema, target_table);
END;
';

COMMENT ON FUNCTION add_realtime_trigger(TEXT, TEXT) IS 'Add realtime trigger to a table for automatic change notifications';

-- Helper function to remove realtime trigger from a table
CREATE OR REPLACE FUNCTION remove_realtime_trigger(
    target_schema TEXT,
    target_table TEXT
)
RETURNS TEXT
LANGUAGE plpgsql
AS '
DECLARE
    trigger_name TEXT;
BEGIN
    trigger_name := target_table || ''_realtime_trigger'';
    
    EXECUTE format(
        ''DROP TRIGGER IF EXISTS %I ON %I.%I'',
        trigger_name,
        target_schema,
        target_table
    );
    
    RETURN format(''Realtime trigger removed from %s.%s'', target_schema, target_table);
END;
';

COMMENT ON FUNCTION remove_realtime_trigger(TEXT, TEXT) IS 'Remove realtime trigger from a table';

-- Helper function to list all tables with realtime triggers
CREATE OR REPLACE FUNCTION list_realtime_triggers()
RETURNS TABLE(
    schema_name TEXT,
    table_name TEXT,
    trigger_name TEXT
)
LANGUAGE plpgsql
AS '
BEGIN
    RETURN QUERY
    SELECT 
        n.nspname::TEXT as schema_name,
        c.relname::TEXT as table_name,
        t.tgname::TEXT as trigger_name
    FROM pg_trigger t
    JOIN pg_class c ON t.tgrelid = c.oid
    JOIN pg_namespace n ON c.relnamespace = n.oid
    WHERE t.tgname LIKE ''%_realtime_trigger''
    AND NOT t.tgisinternal
    ORDER BY n.nspname, c.relname;
END;
';

COMMENT ON FUNCTION list_realtime_triggers() IS 'List all tables with realtime triggers enabled';

SELECT 'Realtime trigger system installed' as realtime_status;
