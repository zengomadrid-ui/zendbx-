-- Rollback Migration 006: Drop OAuth Tables
-- Description: Removes all OAuth-related tables
-- Author: ZenDBX Team
-- Date: 2026-08-07

-- Drop tables in reverse order of creation (respecting foreign key constraints)

DROP TABLE IF EXISTS oauth_audit_logs CASCADE;
DROP TABLE IF EXISTS oauth_authorization_codes CASCADE;
DROP TABLE IF EXISTS oauth_state_sessions CASCADE;
DROP TABLE IF EXISTS oauth_redirect_urls CASCADE;
DROP TABLE IF EXISTS oauth_provider_settings CASCADE;

DO $$
BEGIN
    RAISE NOTICE '✅ Migration 006 Rollback: OAuth tables dropped successfully';
END $$;
