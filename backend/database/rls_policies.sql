-- Row Level Security (RLS) Policies
-- This script creates RLS helper functions and example policies

-- ============================================
-- RLS HELPER FUNCTIONS
-- ============================================

-- Get current user ID from session variable
CREATE OR REPLACE FUNCTION auth.current_user_id()
RETURNS TEXT AS $$
BEGIN
    RETURN current_setting('app.current_user_id', true);
END;
$$ LANGUAGE plpgsql STABLE;

COMMENT ON FUNCTION auth.current_user_id() IS 
'Returns the current user ID from session variable set by RLS middleware';


-- Get current user role from session variable
CREATE OR REPLACE FUNCTION auth.current_role()
RETURNS TEXT AS $$
BEGIN
    RETURN current_setting('app.current_role', true);
END;
$$ LANGUAGE plpgsql STABLE;

COMMENT ON FUNCTION auth.current_role() IS 
'Returns the current user role (anon, authenticated, service_role) from session variable';


-- Check if current user is authenticated
CREATE OR REPLACE FUNCTION auth.is_authenticated()
RETURNS BOOLEAN AS $$
BEGIN
    RETURN auth.current_role() IN ('authenticated', 'service_role');
END;
$$ LANGUAGE plpgsql STABLE;

COMMENT ON FUNCTION auth.is_authenticated() IS 
'Returns true if user is authenticated (not anonymous)';


-- Check if current user has service_role
CREATE OR REPLACE FUNCTION auth.is_service_role()
RETURNS BOOLEAN AS $$
BEGIN
    RETURN auth.current_role() = 'service_role';
END;
$$ LANGUAGE plpgsql STABLE;

COMMENT ON FUNCTION auth.is_service_role() IS 
'Returns true if user has service_role privileges (bypasses RLS)';


-- Check if current user owns a record
CREATE OR REPLACE FUNCTION auth.owns_record(record_user_id UUID)
RETURNS BOOLEAN AS $$
DECLARE
    current_uid TEXT;
BEGIN
    current_uid := auth.current_user_id();
    
    -- Service role can access everything
    IF auth.is_service_role() THEN
        RETURN true;
    END IF;
    
    -- Check if user owns the record
    RETURN current_uid IS NOT NULL AND current_uid::UUID = record_user_id;
END;
$$ LANGUAGE plpgsql STABLE;

COMMENT ON FUNCTION auth.owns_record(UUID) IS 
'Returns true if current user owns the record or has service_role';


-- ============================================
-- EXAMPLE RLS POLICIES
-- ============================================

-- Example: Enable RLS on a table
-- ALTER TABLE my_table ENABLE ROW LEVEL SECURITY;

-- Example: Policy for SELECT (users can read their own data)
-- CREATE POLICY "Users can read own data" ON my_table
--     FOR SELECT
--     USING (
--         auth.is_service_role() OR 
--         user_id::TEXT = auth.current_user_id()
--     );

-- Example: Policy for INSERT (authenticated users can insert)
-- CREATE POLICY "Authenticated users can insert" ON my_table
--     FOR INSERT
--     WITH CHECK (
--         auth.is_authenticated() AND
--         user_id::TEXT = auth.current_user_id()
--     );

-- Example: Policy for UPDATE (users can update their own data)
-- CREATE POLICY "Users can update own data" ON my_table
--     FOR UPDATE
--     USING (
--         auth.is_service_role() OR
--         user_id::TEXT = auth.current_user_id()
--     )
--     WITH CHECK (
--         user_id::TEXT = auth.current_user_id()
--     );

-- Example: Policy for DELETE (users can delete their own data)
-- CREATE POLICY "Users can delete own data" ON my_table
--     FOR DELETE
--     USING (
--         auth.is_service_role() OR
--         user_id::TEXT = auth.current_user_id()
--     );

-- Example: Public read policy (anyone can read)
-- CREATE POLICY "Public read access" ON my_table
--     FOR SELECT
--     USING (true);

-- Example: Admin-only policy
-- CREATE POLICY "Admin only" ON my_table
--     FOR ALL
--     USING (auth.is_service_role());


-- ============================================
-- APPLY RLS TO USERS TABLE (Example)
-- ============================================

-- Enable RLS on users table
ALTER TABLE IF EXISTS users ENABLE ROW LEVEL SECURITY;

-- Policy: Users can read their own profile
CREATE POLICY IF NOT EXISTS "Users can read own profile" ON users
    FOR SELECT
    USING (
        auth.is_service_role() OR 
        id::TEXT = auth.current_user_id()
    );

-- Policy: Users can update their own profile
CREATE POLICY IF NOT EXISTS "Users can update own profile" ON users
    FOR UPDATE
    USING (
        auth.is_service_role() OR
        id::TEXT = auth.current_user_id()
    )
    WITH CHECK (
        id::TEXT = auth.current_user_id()
    );

-- Policy: Authenticated users can insert (signup)
CREATE POLICY IF NOT EXISTS "Authenticated users can signup" ON users
    FOR INSERT
    WITH CHECK (
        auth.is_authenticated() OR
        auth.is_service_role()
    );

-- Policy: Service role can delete
CREATE POLICY IF NOT EXISTS "Service role can delete users" ON users
    FOR DELETE
    USING (auth.is_service_role());


-- ============================================
-- UTILITY FUNCTIONS FOR RLS MANAGEMENT
-- ============================================

-- Function to enable RLS on a table
CREATE OR REPLACE FUNCTION auth.enable_rls(table_name TEXT)
RETURNS VOID AS $$
BEGIN
    EXECUTE format('ALTER TABLE %I ENABLE ROW LEVEL SECURITY', table_name);
    RAISE NOTICE 'RLS enabled on table: %', table_name;
END;
$$ LANGUAGE plpgsql;

COMMENT ON FUNCTION auth.enable_rls(TEXT) IS 
'Enable RLS on a table';


-- Function to disable RLS on a table
CREATE OR REPLACE FUNCTION auth.disable_rls(table_name TEXT)
RETURNS VOID AS $$
BEGIN
    EXECUTE format('ALTER TABLE %I DISABLE ROW LEVEL SECURITY', table_name);
    RAISE NOTICE 'RLS disabled on table: %', table_name;
END;
$$ LANGUAGE plpgsql;

COMMENT ON FUNCTION auth.disable_rls(TEXT) IS 
'Disable RLS on a table';


-- Function to check if RLS is enabled on a table
CREATE OR REPLACE FUNCTION auth.is_rls_enabled(table_name TEXT)
RETURNS BOOLEAN AS $$
DECLARE
    is_enabled BOOLEAN;
BEGIN
    SELECT relrowsecurity INTO is_enabled
    FROM pg_class
    WHERE relname = table_name;
    
    RETURN COALESCE(is_enabled, false);
END;
$$ LANGUAGE plpgsql;

COMMENT ON FUNCTION auth.is_rls_enabled(TEXT) IS 
'Check if RLS is enabled on a table';


-- Function to list all RLS policies on a table
CREATE OR REPLACE FUNCTION auth.list_policies(table_name TEXT)
RETURNS TABLE(
    policy_name TEXT,
    command TEXT,
    permissive TEXT,
    roles TEXT[],
    qual TEXT,
    with_check TEXT
) AS $$
BEGIN
    RETURN QUERY
    SELECT 
        pol.polname::TEXT,
        CASE pol.polcmd
            WHEN 'r' THEN 'SELECT'
            WHEN 'a' THEN 'INSERT'
            WHEN 'w' THEN 'UPDATE'
            WHEN 'd' THEN 'DELETE'
            WHEN '*' THEN 'ALL'
        END::TEXT,
        CASE pol.polpermissive
            WHEN true THEN 'PERMISSIVE'
            ELSE 'RESTRICTIVE'
        END::TEXT,
        ARRAY(
            SELECT rolname::TEXT
            FROM pg_roles
            WHERE oid = ANY(pol.polroles)
        ),
        pg_get_expr(pol.polqual, pol.polrelid)::TEXT,
        pg_get_expr(pol.polwithcheck, pol.polrelid)::TEXT
    FROM pg_policy pol
    JOIN pg_class cls ON pol.polrelid = cls.oid
    WHERE cls.relname = table_name;
END;
$$ LANGUAGE plpgsql;

COMMENT ON FUNCTION auth.list_policies(TEXT) IS 
'List all RLS policies on a table';


-- ============================================
-- SUCCESS MESSAGE
-- ============================================
SELECT 'RLS helper functions and policies created successfully!' as message;
SELECT 'Use auth.enable_rls(''table_name'') to enable RLS on your tables' as next_step;
