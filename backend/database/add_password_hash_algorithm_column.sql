-- ============================================
-- PASSWORD HASH ALGORITHM TRACKING
-- Optional: Track which hashing algorithm is used
-- ============================================

-- Add metadata column to users table if not exists
-- This can store password hash algorithm info and other user metadata
DO $$ 
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM information_schema.columns 
        WHERE table_name = 'users' AND column_name = 'metadata'
    ) THEN
        ALTER TABLE users ADD COLUMN metadata JSONB DEFAULT '{}'::jsonb;
    END IF;
END $$;

-- Create index on metadata for performance
CREATE INDEX IF NOT EXISTS idx_users_metadata_gin ON users USING GIN (metadata);

-- Add comment
COMMENT ON COLUMN users.metadata IS 'User metadata including password hash algorithm, security flags, etc.';

-- Update auth_audit_log event types to include password migration
DO $$
BEGIN
    -- Remove existing constraint if it exists
    ALTER TABLE auth_audit_log DROP CONSTRAINT IF EXISTS valid_event_type;
    
    -- Add updated constraint
    ALTER TABLE auth_audit_log ADD CONSTRAINT valid_event_type 
    CHECK (event_type IN (
        'failed_login_attempt',
        'successful_login',
        'account_locked',
        'account_unlocked',
        'password_reset_requested',
        'password_reset_completed',
        'password_hash_migrated',
        'suspicious_activity'
    ));
END $$;

-- Create view for password security statistics
CREATE OR REPLACE VIEW password_security_stats AS
SELECT 
    COUNT(*) as total_users,
    COUNT(*) FILTER (WHERE password_hash LIKE '$2b$12$%') as secure_bcrypt_count,
    COUNT(*) FILTER (WHERE password_hash LIKE '$2b$%' AND password_hash NOT LIKE '$2b$12$%') as weak_bcrypt_count,
    COUNT(*) FILTER (WHERE password_hash LIKE '$1$%') as md5_count,
    COUNT(*) FILTER (WHERE password_hash LIKE '$5$%') as sha256_count,
    COUNT(*) FILTER (WHERE password_hash LIKE '$6$%') as sha512_count,
    COUNT(*) FILTER (WHERE password_hash NOT LIKE '$2%' AND password_hash NOT LIKE '$1$%' 
                      AND password_hash NOT LIKE '$5$%' AND password_hash NOT LIKE '$6$%') as unknown_count
FROM users
WHERE is_active = TRUE;

COMMENT ON VIEW password_security_stats IS 
'Real-time statistics on password hash security across all users';

-- Grant permissions
GRANT SELECT ON password_security_stats TO service_role;
