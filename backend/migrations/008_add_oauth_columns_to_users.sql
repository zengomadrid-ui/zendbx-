-- Migration 008: Add OAuth columns to users table
-- Description: Adds oauth_provider, oauth_user_id, and oauth_id columns for OAuth authentication
-- Author: ZenDBX Team
-- Date: 2026-08-07

-- Add OAuth columns to users table
ALTER TABLE users 
ADD COLUMN IF NOT EXISTS oauth_provider TEXT,
ADD COLUMN IF NOT EXISTS oauth_user_id TEXT,
ADD COLUMN IF NOT EXISTS oauth_id TEXT;

-- Create index for faster OAuth lookups
CREATE INDEX IF NOT EXISTS idx_users_oauth_provider 
ON users(oauth_provider) WHERE oauth_provider IS NOT NULL;

CREATE INDEX IF NOT EXISTS idx_users_oauth_user_id 
ON users(oauth_user_id) WHERE oauth_user_id IS NOT NULL;

CREATE INDEX IF NOT EXISTS idx_users_oauth_id 
ON users(oauth_id) WHERE oauth_id IS NOT NULL;

-- Create unique constraint for OAuth provider + user_id combination
CREATE UNIQUE INDEX IF NOT EXISTS idx_users_oauth_unique
ON users(oauth_provider, oauth_user_id) 
WHERE oauth_provider IS NOT NULL AND oauth_user_id IS NOT NULL;

COMMENT ON COLUMN users.oauth_provider IS 
'OAuth provider name (google, github, etc.)';

COMMENT ON COLUMN users.oauth_user_id IS 
'User ID from OAuth provider';

COMMENT ON COLUMN users.oauth_id IS 
'OAuth connection ID for tracking linked accounts';
