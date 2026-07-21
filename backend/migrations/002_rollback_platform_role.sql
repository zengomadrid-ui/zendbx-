-- ============================================
-- ROLLBACK: REMOVE PLATFORM ROLES
-- ============================================
-- 
-- Purpose: Rollback script for 002_create_platform_role.sql
-- Use only if you need to revert the platform role changes
-- WARNING: This will drop the zendbx_platform and zendbx_provisioner roles

-- ============================================
-- STEP 1: REVOKE ALL PRIVILEGES
-- ============================================

-- Revoke privileges from platform role
REVOKE ALL PRIVILEGES ON ALL TABLES IN SCHEMA public FROM zendbx_platform;
REVOKE ALL PRIVILEGES ON ALL SEQUENCES IN SCHEMA public FROM zendbx_platform;
REVOKE ALL PRIVILEGES ON SCHEMA public FROM zendbx_platform;

REVOKE ALL PRIVILEGES ON ALL TABLES IN SCHEMA auth FROM zendbx_platform;
REVOKE ALL PRIVILEGES ON ALL SEQUENCES IN SCHEMA auth FROM zendbx_platform;
REVOKE ALL PRIVILEGES ON SCHEMA auth FROM zendbx_platform;

-- Revoke privileges from provisioner role
REVOKE ALL PRIVILEGES ON ALL TABLES IN SCHEMA public FROM zendbx_provisioner;
REVOKE ALL PRIVILEGES ON ALL SEQUENCES IN SCHEMA public FROM zendbx_provisioner;
REVOKE ALL PRIVILEGES ON SCHEMA public FROM zendbx_provisioner;
REVOKE CREATE ON DATABASE zendbx_main FROM zendbx_provisioner;

-- ============================================
-- STEP 2: DROP ROLES
-- ============================================

-- Terminate active connections first
SELECT pg_terminate_backend(pid) 
FROM pg_stat_activity 
WHERE usename IN ('zendbx_platform', 'zendbx_provisioner') 
  AND pid <> pg_backend_pid();

-- Drop roles
DROP ROLE IF EXISTS zendbx_platform;
DROP ROLE IF EXISTS zendbx_provisioner;

-- ============================================
-- VERIFICATION
-- ============================================

DO $$
BEGIN
    IF NOT EXISTS (SELECT 1 FROM pg_roles WHERE rolname = 'zendbx_platform') THEN
        RAISE NOTICE '✅ Removed role: zendbx_platform';
    END IF;
    
    IF NOT EXISTS (SELECT 1 FROM pg_roles WHERE rolname = 'zendbx_provisioner') THEN
        RAISE NOTICE '✅ Removed role: zendbx_provisioner';
    END IF;
END $$;
