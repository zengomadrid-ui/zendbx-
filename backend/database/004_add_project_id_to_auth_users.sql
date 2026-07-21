-- ============================================
-- ZendBX Migration: Add project_id to auth.users
-- Migration: 004_add_project_id_to_auth_users.sql
-- Description: Make authentication project-aware by adding project_id column
-- Version: 1.0.0
-- Date: 2026-07-11
-- ============================================

-- This migration transforms the global auth.users table to be project-aware
-- Email uniqueness will be enforced per-project instead of globally

BEGIN;

-- ============================================
-- Step 1: Add project_id column (nullable initially for existing data)
-- ============================================
DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM information_schema.columns 
        WHERE table_schema = 'auth' 
        AND table_name = 'users' 
        AND column_name = 'project_id'
    ) THEN
        ALTER TABLE auth.users ADD COLUMN project_id UUID;
        RAISE NOTICE 'Added project_id column to auth.users';
    ELSE
        RAISE NOTICE 'project_id column already exists';
    END IF;
END $$;

-- ============================================
-- Step 2: Backfill project_id for existing users
-- ============================================
-- Strategy: Set project_id to NULL for now (will be handled by application logic)
-- Existing users will need to be manually mapped or will signup fresh per project

DO $$
DECLARE
    null_count INTEGER;
BEGIN
    SELECT COUNT(*) INTO null_count FROM auth.users WHERE project_id IS NULL;
    
    IF null_count > 0 THEN
        RAISE NOTICE 'Found % existing users without project_id', null_count;
        RAISE NOTICE 'These users will need to signup again per-project';
        RAISE NOTICE 'Or manually assign project_id using: UPDATE auth.users SET project_id = ? WHERE email = ?';
    END IF;
END $$;

-- ============================================
-- Step 3: Make project_id NOT NULL (after backfill)
-- ============================================
-- Commented out for now - enable after backfilling existing users
-- ALTER TABLE auth.users ALTER COLUMN project_id SET NOT NULL;

-- ============================================
-- Step 4: Drop old global email unique constraint
-- ============================================
DO $$
BEGIN
    IF EXISTS (
        SELECT 1 FROM pg_constraint 
        WHERE conname = 'auth_users_email_unique'
    ) THEN
        ALTER TABLE auth.users DROP CONSTRAINT auth_users_email_unique;
        RAISE NOTICE 'Dropped global email unique constraint';
    ELSE
        RAISE NOTICE 'Global email unique constraint does not exist';
    END IF;
END $$;

-- ============================================
-- Step 5: Create project-scoped unique constraint on (project_id, email)
-- ============================================
-- Using expression index for case-insensitive uniqueness
DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM pg_indexes 
        WHERE schemaname = 'auth' 
        AND tablename = 'users' 
        AND indexname = 'auth_users_project_email_unique_idx'
    ) THEN
        CREATE UNIQUE INDEX auth_users_project_email_unique_idx 
        ON auth.users (project_id, LOWER(email));
        RAISE NOTICE 'Created unique index on (project_id, LOWER(email))';
    ELSE
        RAISE NOTICE 'Unique index on (project_id, LOWER(email)) already exists';
    END IF;
END $$;

-- ============================================
-- Step 6: Create project-scoped unique constraint on (project_id, username)
-- ============================================
DO $$
BEGIN
    -- First drop old global username constraint if it exists
    IF EXISTS (
        SELECT 1 FROM pg_constraint 
        WHERE conname = 'auth_users_username_unique'
    ) THEN
        ALTER TABLE auth.users DROP CONSTRAINT auth_users_username_unique;
        RAISE NOTICE 'Dropped global username unique constraint';
    END IF;
    
    -- Create new project-scoped username constraint
    IF NOT EXISTS (
        SELECT 1 FROM pg_indexes 
        WHERE schemaname = 'auth' 
        AND tablename = 'users' 
        AND indexname = 'auth_users_project_username_unique_idx'
    ) THEN
        CREATE UNIQUE INDEX auth_users_project_username_unique_idx 
        ON auth.users (project_id, username) 
        WHERE username IS NOT NULL;
        RAISE NOTICE 'Created unique index on (project_id, username)';
    ELSE
        RAISE NOTICE 'Unique index on (project_id, username) already exists';
    END IF;
END $$;

-- ============================================
-- Step 7: Create performance indexes
-- ============================================

-- Index on project_id for filtering by project
DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM pg_indexes 
        WHERE schemaname = 'auth' 
        AND tablename = 'users' 
        AND indexname = 'idx_auth_users_project_id'
    ) THEN
        CREATE INDEX idx_auth_users_project_id ON auth.users (project_id);
        RAISE NOTICE 'Created index on project_id';
    ELSE
        RAISE NOTICE 'Index on project_id already exists';
    END IF;
END $$;

-- Composite index on (project_id, email) for login queries
DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM pg_indexes 
        WHERE schemaname = 'auth' 
        AND tablename = 'users' 
        AND indexname = 'idx_auth_users_project_email_lower'
    ) THEN
        CREATE INDEX idx_auth_users_project_email_lower 
        ON auth.users (project_id, LOWER(email));
        RAISE NOTICE 'Created composite index on (project_id, LOWER(email))';
    ELSE
        RAISE NOTICE 'Composite index on (project_id, LOWER(email)) already exists';
    END IF;
END $$;

-- Composite index on (project_id, provider) for OAuth queries
DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM pg_indexes 
        WHERE schemaname = 'auth' 
        AND tablename = 'users' 
        AND indexname = 'idx_auth_users_project_provider'
    ) THEN
        CREATE INDEX idx_auth_users_project_provider ON auth.users (project_id, provider);
        RAISE NOTICE 'Created composite index on (project_id, provider)';
    ELSE
        RAISE NOTICE 'Composite index on (project_id, provider) already exists';
    END IF;
END $$;

-- ============================================
-- Step 8: Add comments
-- ============================================
COMMENT ON COLUMN auth.users.project_id IS 'Project UUID - makes authentication project-scoped. Same email can exist in different projects.';

-- ============================================
-- Success Message
-- ============================================
DO $$
DECLARE
    total_users INTEGER;
    users_with_project INTEGER;
    users_without_project INTEGER;
BEGIN
    SELECT COUNT(*) INTO total_users FROM auth.users;
    SELECT COUNT(*) INTO users_with_project FROM auth.users WHERE project_id IS NOT NULL;
    SELECT COUNT(*) INTO users_without_project FROM auth.users WHERE project_id IS NULL;
    
    RAISE NOTICE '';
    RAISE NOTICE '========================================';
    RAISE NOTICE 'Migration completed successfully!';
    RAISE NOTICE '========================================';
    RAISE NOTICE 'Total users: %', total_users;
    RAISE NOTICE 'Users with project_id: %', users_with_project;
    RAISE NOTICE 'Users without project_id: %', users_without_project;
    RAISE NOTICE '';
    
    IF users_without_project > 0 THEN
        RAISE NOTICE '⚠️  WARNING: % users do not have project_id assigned', users_without_project;
        RAISE NOTICE '   These users will need to signup again per-project';
        RAISE NOTICE '   Or manually assign project_id using:';
        RAISE NOTICE '   UPDATE auth.users SET project_id = ''<project_uuid>'' WHERE email = ''user@example.com'';';
        RAISE NOTICE '';
    END IF;
    
    RAISE NOTICE '✅ Email uniqueness is now project-scoped';
    RAISE NOTICE '✅ Same email can signup in different projects';
    RAISE NOTICE '';
END $$;

COMMIT;

-- ============================================
-- Rollback Instructions (if needed)
-- ============================================
-- To rollback this migration:
-- 
-- BEGIN;
-- DROP INDEX IF EXISTS auth.idx_auth_users_project_provider;
-- DROP INDEX IF EXISTS auth.idx_auth_users_project_email_lower;
-- DROP INDEX IF EXISTS auth.idx_auth_users_project_id;
-- DROP INDEX IF EXISTS auth.auth_users_project_username_unique_idx;
-- DROP INDEX IF EXISTS auth.auth_users_project_email_unique_idx;
-- ALTER TABLE auth.users ADD CONSTRAINT auth_users_email_unique UNIQUE (email);
-- ALTER TABLE auth.users ADD CONSTRAINT auth_users_username_unique UNIQUE (username);
-- ALTER TABLE auth.users DROP COLUMN project_id;
-- COMMIT;
