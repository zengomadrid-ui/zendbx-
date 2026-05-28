-- ============================================
-- Add OAuth columns to users table
-- ============================================

-- Add oauth_provider column (google, github, etc.)
ALTER TABLE users 
ADD COLUMN IF NOT EXISTS oauth_provider VARCHAR(50);

-- Add oauth_id column (provider's user ID)
ALTER TABLE users 
ADD COLUMN IF NOT EXISTS oauth_id VARCHAR(255);

-- Create index for OAuth lookups
CREATE INDEX IF NOT EXISTS idx_users_oauth 
ON users(oauth_provider, oauth_id) 
WHERE oauth_provider IS NOT NULL;

-- Add comment
COMMENT ON COLUMN users.oauth_provider IS 'OAuth provider used for signup (google, github, etc.)';
COMMENT ON COLUMN users.oauth_id IS 'User ID from the OAuth provider';
