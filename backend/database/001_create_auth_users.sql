-- ============================================
-- ZendBX Phase 1 - Authentication Foundation
-- Migration: 001_create_auth_users.sql
-- Description: Creates auth schema and auth.users table
-- Idempotent: Safe to run multiple times
-- ============================================

-- Enable required extensions
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";
CREATE EXTENSION IF NOT EXISTS "pgcrypto";

-- ============================================
-- CREATE AUTH SCHEMA
-- ============================================
CREATE SCHEMA IF NOT EXISTS auth;

COMMENT ON SCHEMA auth IS 'Authentication and authorization schema for ZendBX';

-- ============================================
-- CREATE auth.users TABLE
-- ============================================
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
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

COMMENT ON TABLE auth.users IS 'Core user authentication table - Phase 1 foundation';
COMMENT ON COLUMN auth.users.id IS 'Unique user identifier (UUID)';
COMMENT ON COLUMN auth.users.email IS 'User email address (case-insensitive, unique)';
COMMENT ON COLUMN auth.users.username IS 'Optional username for display purposes';
COMMENT ON COLUMN auth.users.password_hash IS 'Bcrypt hashed password - NEVER expose in API responses';
COMMENT ON COLUMN auth.users.provider IS 'Authentication provider: email, google, github (default: email)';
COMMENT ON COLUMN auth.users.email_verified IS 'Whether email has been verified';
COMMENT ON COLUMN auth.users.is_active IS 'Whether user account is active (for soft disable)';
COMMENT ON COLUMN auth.users.avatar_url IS 'URL to user profile picture';
COMMENT ON COLUMN auth.users.metadata IS 'Flexible JSONB field for custom user data';
COMMENT ON COLUMN auth.users.last_login_at IS 'Timestamp of most recent successful login';
COMMENT ON COLUMN auth.users.created_at IS 'Account creation timestamp';
COMMENT ON COLUMN auth.users.updated_at IS 'Last update timestamp';

-- ============================================
-- CREATE UNIQUE CONSTRAINTS
-- ============================================

-- Email must be unique (case-insensitive)
-- Drop existing constraint if it exists (idempotency)
DO $$ 
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM pg_constraint 
        WHERE conname = 'auth_users_email_unique'
    ) THEN
        ALTER TABLE auth.users 
        ADD CONSTRAINT auth_users_email_unique 
        UNIQUE (email);
    END IF;
END $$;

-- Username must be unique when present (case-insensitive)
DO $$ 
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM pg_constraint 
        WHERE conname = 'auth_users_username_unique'
    ) THEN
        ALTER TABLE auth.users 
        ADD CONSTRAINT auth_users_username_unique 
        UNIQUE (username);
    END IF;
END $$;

-- ============================================
-- CREATE INDEXES FOR PERFORMANCE
-- ============================================

-- Index on email for fast login lookups (case-insensitive)
CREATE INDEX IF NOT EXISTS idx_auth_users_email_lower 
ON auth.users (LOWER(email));

-- Index on username for fast lookups
CREATE INDEX IF NOT EXISTS idx_auth_users_username_lower 
ON auth.users (LOWER(username)) 
WHERE username IS NOT NULL;

-- Index on provider for filtering by auth method
CREATE INDEX IF NOT EXISTS idx_auth_users_provider 
ON auth.users (provider);

-- Index on is_active for filtering active users
CREATE INDEX IF NOT EXISTS idx_auth_users_is_active 
ON auth.users (is_active);

-- Index on created_at for sorting/pagination
CREATE INDEX IF NOT EXISTS idx_auth_users_created_at 
ON auth.users (created_at DESC);

-- Composite index for provider + email (common query pattern)
CREATE INDEX IF NOT EXISTS idx_auth_users_provider_email 
ON auth.users (provider, LOWER(email));

-- ============================================
-- CREATE UPDATED_AT TRIGGER
-- ============================================

-- Function to automatically update updated_at timestamp
CREATE OR REPLACE FUNCTION auth.update_updated_at_column()
RETURNS TRIGGER
LANGUAGE plpgsql
AS $$
BEGIN
    NEW.updated_at = NOW();
    RETURN NEW;
END;
$$;

COMMENT ON FUNCTION auth.update_updated_at_column() IS 'Automatically updates updated_at timestamp on row modification';

-- Trigger to call the function
DROP TRIGGER IF EXISTS trigger_auth_users_updated_at ON auth.users;
CREATE TRIGGER trigger_auth_users_updated_at
    BEFORE UPDATE ON auth.users
    FOR EACH ROW
    EXECUTE FUNCTION auth.update_updated_at_column();

-- ============================================
-- CREATE HELPER FUNCTIONS
-- ============================================

-- Function to normalize email (lowercase, trim)
CREATE OR REPLACE FUNCTION auth.normalize_email(email_input TEXT)
RETURNS TEXT
LANGUAGE plpgsql
IMMUTABLE
AS $$
BEGIN
    RETURN LOWER(TRIM(email_input));
END;
$$;

COMMENT ON FUNCTION auth.normalize_email(TEXT) IS 'Normalizes email to lowercase and trims whitespace';

-- Function to validate email format (basic check)
CREATE OR REPLACE FUNCTION auth.is_valid_email(email_input TEXT)
RETURNS BOOLEAN
LANGUAGE plpgsql
IMMUTABLE
AS $$
BEGIN
    RETURN email_input ~* '^[A-Za-z0-9._%+-]+@[A-Za-z0-9.-]+\.[A-Za-z]{2,}$';
END;
$$;

COMMENT ON FUNCTION auth.is_valid_email(TEXT) IS 'Basic email format validation';

-- ============================================
-- CREATE TRIGGER TO NORMALIZE EMAIL ON INSERT/UPDATE
-- ============================================

CREATE OR REPLACE FUNCTION auth.trigger_normalize_email()
RETURNS TRIGGER
LANGUAGE plpgsql
AS $$
BEGIN
    -- Normalize email to lowercase and trim
    IF NEW.email IS NOT NULL THEN
        NEW.email = auth.normalize_email(NEW.email);
    END IF;
    
    -- Normalize username to trim whitespace
    IF NEW.username IS NOT NULL THEN
        NEW.username = TRIM(NEW.username);
    END IF;
    
    RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trigger_auth_users_normalize_email ON auth.users;
CREATE TRIGGER trigger_auth_users_normalize_email
    BEFORE INSERT OR UPDATE ON auth.users
    FOR EACH ROW
    EXECUTE FUNCTION auth.trigger_normalize_email();

-- ============================================
-- GRANT PERMISSIONS (for application role)
-- ============================================

-- Note: Adjust role names based on your setup
-- These grants ensure the application can read/write auth.users
DO $$
BEGIN
    -- Grant schema usage
    IF EXISTS (SELECT 1 FROM pg_roles WHERE rolname = 'zendbx_app') THEN
        GRANT USAGE ON SCHEMA auth TO zendbx_app;
        GRANT SELECT, INSERT, UPDATE, DELETE ON auth.users TO zendbx_app;
    END IF;
END $$;

-- ============================================
-- SUCCESS MESSAGE
-- ============================================

DO $$
BEGIN
    RAISE NOTICE '✅ Migration 001_create_auth_users.sql completed successfully';
    RAISE NOTICE '   - Created auth schema';
    RAISE NOTICE '   - Created auth.users table with all columns';
    RAISE NOTICE '   - Created unique constraints on email and username';
    RAISE NOTICE '   - Created 6 indexes for performance';
    RAISE NOTICE '   - Created updated_at trigger';
    RAISE NOTICE '   - Created email normalization trigger';
    RAISE NOTICE '   - Created helper functions';
    RAISE NOTICE '';
    RAISE NOTICE '📊 Current row count in auth.users: %', (SELECT COUNT(*) FROM auth.users);
END $$;
