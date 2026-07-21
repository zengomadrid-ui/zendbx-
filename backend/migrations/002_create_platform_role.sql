-- ============================================
-- PHASE 2: CREATE TRUSTED PLATFORM ROLE
-- ============================================
-- 
-- Purpose: Create a separate trusted role for platform/auth operations
-- Security: This role has elevated privileges for internal operations
-- Status: STAGING ONLY - DO NOT RUN IN PRODUCTION YET
--
-- Prerequisites:
--   - Backup database before running
--   - Review current role privileges
--   - Verify no production traffic will be affected
--
-- Rollback: See 002_rollback_platform_role.sql

-- ============================================
-- STEP 1: AUDIT EXISTING PUBLIC PRIVILEGES
-- ============================================

-- Document current PUBLIC privileges for reference
-- (This is informational only - we will handle PUBLIC privileges carefully)

DO $$
BEGIN
    RAISE NOTICE '========================================';
    RAISE NOTICE 'AUDITING CURRENT PUBLIC PRIVILEGES';
    RAISE NOTICE '========================================';
    
    -- Check database privileges granted to PUBLIC
    RAISE NOTICE 'PUBLIC database privileges:';
    RAISE NOTICE '  Current database: %', current_database();
    
    -- Check public schema privileges granted to PUBLIC
    RAISE NOTICE 'PUBLIC schema privileges for "public" schema:';
    
    -- Check auth schema privileges granted to PUBLIC
    RAISE NOTICE 'PUBLIC schema privileges for "auth" schema:';
    
    RAISE NOTICE '========================================';
END $$;

-- ============================================
-- STEP 2: CREATE PLATFORM RUNTIME ROLE
-- ============================================

-- Create the trusted platform role for runtime operations
-- Note: We separate CREATEROLE privilege into a different role for security

DO $$
BEGIN
    -- Check if role already exists
    IF NOT EXISTS (SELECT 1 FROM pg_roles WHERE rolname = 'zendbx_platform') THEN
        -- Create platform role
        -- LOGIN: Yes (needs to connect)
        -- SUPERUSER: No (principle of least privilege)
        -- CREATEDB: No (not needed for runtime)
        -- CREATEROLE: No (separate provisioner role will handle this)
        -- INHERIT: Yes (standard)
        -- REPLICATION: No (not needed)
        
        CREATE ROLE zendbx_platform 
            LOGIN 
            NOSUPERUSER 
            NOCREATEDB 
            NOCREATEROLE 
            INHERIT 
            NOREPLICATION 
            CONNECTION LIMIT -1;
        
        RAISE NOTICE '✅ Created role: zendbx_platform';
    ELSE
        RAISE NOTICE '⚠️  Role already exists: zendbx_platform';
    END IF;
END $$;

-- Set a secure password (MUST BE CHANGED IN PRODUCTION)
-- In production, use: ALTER ROLE zendbx_platform PASSWORD '<strong-random-password>';
ALTER ROLE zendbx_platform PASSWORD 'STAGING_ONLY_CHANGE_IN_PRODUCTION';

COMMENT ON ROLE zendbx_platform IS 'Trusted platform role for auth and internal operations. Created: 2024. DO NOT USE FOR PROJECT-FACING DATABASE OPERATIONS.';

-- ============================================
-- STEP 3: GRANT PUBLIC SCHEMA PRIVILEGES
-- ============================================

-- Grant access to public schema (platform tables)
GRANT USAGE ON SCHEMA public TO zendbx_platform;

-- Grant full access to all existing tables in public schema
GRANT SELECT, INSERT, UPDATE, DELETE ON ALL TABLES IN SCHEMA public TO zendbx_platform;

-- Grant sequence privileges
GRANT USAGE, SELECT ON ALL SEQUENCES IN SCHEMA public TO zendbx_platform;

-- Set default privileges for future tables created in public schema
ALTER DEFAULT PRIVILEGES IN SCHEMA public 
    GRANT SELECT, INSERT, UPDATE, DELETE ON TABLES TO zendbx_platform;

ALTER DEFAULT PRIVILEGES IN SCHEMA public 
    GRANT USAGE, SELECT ON SEQUENCES TO zendbx_platform;

-- ============================================
-- STEP 4: GRANT AUTH SCHEMA PRIVILEGES
-- ============================================

-- Grant access to auth schema (authentication tables)
GRANT USAGE ON SCHEMA auth TO zendbx_platform;

-- Grant full access to all existing tables in auth schema
GRANT SELECT, INSERT, UPDATE, DELETE ON ALL TABLES IN SCHEMA auth TO zendbx_platform;

-- Grant sequence privileges
GRANT USAGE, SELECT ON ALL SEQUENCES IN SCHEMA auth TO zendbx_platform;

-- Set default privileges for future tables created in auth schema
ALTER DEFAULT PRIVILEGES IN SCHEMA auth 
    GRANT SELECT, INSERT, UPDATE, DELETE ON TABLES TO zendbx_platform;

ALTER DEFAULT PRIVILEGES IN SCHEMA auth 
    GRANT USAGE, SELECT ON SEQUENCES TO zendbx_platform;

-- ============================================
-- STEP 5: CREATE PROVISIONER ROLE (ELEVATED)
-- ============================================

-- Create a separate role for project provisioning operations
-- This role has elevated privileges but is NOT used for runtime operations

DO $$
BEGIN
    IF NOT EXISTS (SELECT 1 FROM pg_roles WHERE rolname = 'zendbx_provisioner') THEN
        -- Create provisioner role
        -- CREATEROLE: Yes (needs to create project roles)
        -- CREATEDB: No (we use schemas, not separate databases)
        -- LOGIN: Yes (backend needs to connect as this role for provisioning)
        
        CREATE ROLE zendbx_provisioner 
            LOGIN 
            NOSUPERUSER 
            NOCREATEDB 
            CREATEROLE 
            INHERIT 
            NOREPLICATION 
            CONNECTION LIMIT 5;  -- Limit connections for provisioning role
        
        RAISE NOTICE '✅ Created role: zendbx_provisioner';
    ELSE
        RAISE NOTICE '⚠️  Role already exists: zendbx_provisioner';
    END IF;
END $$;

-- Set password for provisioner role
ALTER ROLE zendbx_provisioner PASSWORD 'STAGING_ONLY_CHANGE_IN_PRODUCTION';

COMMENT ON ROLE zendbx_provisioner IS 'Elevated role for project provisioning. CREATEROLE privilege. Use only for project creation/deletion. Created: 2024.';

-- Grant provisioner same schema access as platform role
GRANT USAGE ON SCHEMA public TO zendbx_provisioner;
GRANT SELECT, INSERT, UPDATE, DELETE ON ALL TABLES IN SCHEMA public TO zendbx_provisioner;
GRANT USAGE, SELECT ON ALL SEQUENCES IN SCHEMA public TO zendbx_provisioner;

-- Provisioner needs to create schemas
GRANT CREATE ON DATABASE zendbx_main TO zendbx_provisioner;

-- ============================================
-- STEP 6: VERIFY ROLE CONFIGURATION
-- ============================================

DO $$
DECLARE
    platform_config RECORD;
    provisioner_config RECORD;
BEGIN
    RAISE NOTICE '========================================';
    RAISE NOTICE 'ROLE CONFIGURATION VERIFICATION';
    RAISE NOTICE '========================================';
    
    -- Verify platform role
    SELECT 
        rolname,
        rolsuper,
        rolinherit,
        rolcreaterole,
        rolcreatedb,
        rolcanlogin,
        rolreplication,
        rolconnlimit
    INTO platform_config
    FROM pg_roles 
    WHERE rolname = 'zendbx_platform';
    
    RAISE NOTICE 'Platform Role: zendbx_platform';
    RAISE NOTICE '  SUPERUSER: %', platform_config.rolsuper;
    RAISE NOTICE '  INHERIT: %', platform_config.rolinherit;
    RAISE NOTICE '  CREATEROLE: %', platform_config.rolcreaterole;
    RAISE NOTICE '  CREATEDB: %', platform_config.rolcreatedb;
    RAISE NOTICE '  LOGIN: %', platform_config.rolcanlogin;
    RAISE NOTICE '  REPLICATION: %', platform_config.rolreplication;
    RAISE NOTICE '  CONNECTION LIMIT: %', platform_config.rolconnlimit;
    
    -- Verify provisioner role
    SELECT 
        rolname,
        rolsuper,
        rolinherit,
        rolcreaterole,
        rolcreatedb,
        rolcanlogin,
        rolreplication,
        rolconnlimit
    INTO provisioner_config
    FROM pg_roles 
    WHERE rolname = 'zendbx_provisioner';
    
    RAISE NOTICE '';
    RAISE NOTICE 'Provisioner Role: zendbx_provisioner';
    RAISE NOTICE '  SUPERUSER: %', provisioner_config.rolsuper;
    RAISE NOTICE '  INHERIT: %', provisioner_config.rolinherit;
    RAISE NOTICE '  CREATEROLE: %', provisioner_config.rolcreaterole;
    RAISE NOTICE '  CREATEDB: %', provisioner_config.rolcreatedb;
    RAISE NOTICE '  LOGIN: %', provisioner_config.rolcanlogin;
    RAISE NOTICE '  REPLICATION: %', provisioner_config.rolreplication;
    RAISE NOTICE '  CONNECTION LIMIT: %', provisioner_config.rolconnlimit;
    
    RAISE NOTICE '========================================';
    RAISE NOTICE '✅ Platform role configuration complete';
    RAISE NOTICE '========================================';
END $$;

-- ============================================
-- STEP 7: DOCUMENT SECURITY NOTES
-- ============================================

-- Security notes for operators:
-- 1. zendbx_platform: Runtime operations, auth tables, NO CREATEROLE
-- 2. zendbx_provisioner: Project provisioning, HAS CREATEROLE, limited connections
-- 3. Passwords are placeholders - MUST be changed before production
-- 4. Project roles will be created by zendbx_provisioner
-- 5. Project roles will have NO access to public or auth schemas

-- Next steps:
-- 1. Update backend configuration with new connection strings
-- 2. Implement project role provisioning (Phase 3)
-- 3. Test platform operations with new role
-- 4. Verify role separation works as expected
