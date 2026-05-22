-- ============================================
-- PERMANENT FIX FOR PROJECT CREATION
-- Run this as the database owner/superuser
-- ============================================

-- 1. Grant CREATE privilege on database
-- Replace 'your_username' with your actual database user
GRANT CREATE ON DATABASE nexora_main TO your_username;

-- 2. Ensure required extensions are installed
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";
CREATE EXTENSION IF NOT EXISTS "pg_stat_statements";

-- 3. Grant usage on extensions (if needed)
GRANT USAGE ON SCHEMA public TO your_username;

-- 4. Allow user to create functions
GRANT CREATE ON SCHEMA public TO your_username;

-- 5. Verify permissions
SELECT 
    datname as database,
    has_database_privilege(current_user, datname, 'CREATE') as can_create_schema,
    has_database_privilege(current_user, datname, 'CONNECT') as can_connect
FROM pg_database 
WHERE datname = current_database();

-- 6. List installed extensions
SELECT extname, extversion 
FROM pg_extension 
ORDER BY extname;

-- ============================================
-- If you're on Render PostgreSQL:
-- ============================================
-- You may need to contact Render support to grant CREATE privilege
-- OR use their dashboard to run these commands
-- OR upgrade to a plan that allows schema creation

-- ============================================
-- Alternative: Use public schema instead
-- ============================================
-- If you cannot get CREATE privilege, modify the backend
-- to use tables with prefixes in the public schema instead
-- of separate schemas. This is less clean but works.
