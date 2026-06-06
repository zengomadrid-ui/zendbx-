-- ============================================
-- SUPABASE COMPATIBILITY LAYER
-- add_supabase_compat.sql
--
-- Installs auth.uid() and auth.role() into any project schema.
-- The auth.users view is handled separately by the Python migration
-- script (_apply_compat.py) which detects column presence at runtime.
--
-- Usage (per project schema):
--   SET search_path TO "<project_schema_name>", public;
--   \i add_supabase_compat.sql
-- ============================================

CREATE SCHEMA IF NOT EXISTS auth;

-- ============================================
-- auth.uid()
-- Supabase-compatible: returns authenticated user UUID.
-- Reads from app.current_user_id session variable.
-- Usage in RLS: USING (auth.uid() = user_id)
-- ============================================
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
    WHEN invalid_text_representation THEN RETURN NULL;
    WHEN OTHERS THEN RETURN NULL;
END;
';

COMMENT ON FUNCTION auth.uid() IS
'Supabase-compatible: returns authenticated user UUID from app.current_user_id session variable.
Use in RLS policies: USING (auth.uid() = user_id)';


-- ============================================
-- auth.role()
-- Supabase-compatible: returns current session role.
-- Reads from app.current_role session variable.
-- Returns: anon | authenticated | service_role
-- ============================================
CREATE OR REPLACE FUNCTION auth.role()
RETURNS TEXT
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
AS '
BEGIN
    RETURN COALESCE(current_setting(''app.current_role'', true), ''anon'');
EXCEPTION
    WHEN OTHERS THEN RETURN ''anon'';
END;
';

COMMENT ON FUNCTION auth.role() IS
'Supabase-compatible: returns current session role from app.current_role session variable.
Values: anon | authenticated | service_role';


-- ============================================
-- Success
-- ============================================
SELECT 'auth.uid() and auth.role() installed' AS status;
