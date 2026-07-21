-- ============================================
-- Migration: Add public.users View
-- ============================================
-- Creates public.users view backed by auth.users
-- Run this on existing project schemas to fix Table Editor
-- ============================================

-- Ensure auth schema exists
CREATE SCHEMA IF NOT EXISTS auth;

-- Create public.users view (idempotent - safe to run multiple times)
CREATE OR REPLACE VIEW public.users AS
SELECT
    id,
    email,
    username,
    provider,
    avatar_url,
    is_active,
    email_verified,
    metadata,
    created_at,
    updated_at,
    last_login_at
FROM auth.users;

COMMENT ON VIEW public.users IS 
'Application-facing user model. Backed by auth.users without exposing credentials. Password hash intentionally excluded for security.';

-- Success message
DO $$
BEGIN
    RAISE NOTICE '✅ public.users view created successfully';
    RAISE NOTICE '📋 Developers can now query: SELECT * FROM users;';
    RAISE NOTICE '🔒 password_hash remains hidden in auth.users';
END $$;
