-- ============================================
-- AUTH AUDIT LOG TABLE
-- Tracks authentication events for security monitoring
-- ============================================

-- Create auth_audit_log table if not exists
CREATE TABLE IF NOT EXISTS auth_audit_log (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    event_type VARCHAR(50) NOT NULL,
    email VARCHAR(255),
    ip_address VARCHAR(45),
    user_agent TEXT,
    metadata JSONB DEFAULT '{}'::jsonb,
    created_at TIMESTAMP DEFAULT NOW(),
    
    -- Indexes for querying
    CONSTRAINT valid_event_type CHECK (event_type IN (
        'failed_login_attempt',
        'successful_login',
        'account_locked',
        'account_unlocked',
        'password_reset_requested',
        'password_reset_completed',
        'password_hash_migrated',
        'suspicious_activity'
    ))
);

-- Create indexes
CREATE INDEX IF NOT EXISTS idx_auth_audit_email ON auth_audit_log(email);
CREATE INDEX IF NOT EXISTS idx_auth_audit_event_type ON auth_audit_log(event_type);
CREATE INDEX IF NOT EXISTS idx_auth_audit_created_at ON auth_audit_log(created_at DESC);
CREATE INDEX IF NOT EXISTS idx_auth_audit_ip ON auth_audit_log(ip_address);

-- Create composite index for common queries
CREATE INDEX IF NOT EXISTS idx_auth_audit_email_created 
ON auth_audit_log(email, created_at DESC);

-- Add comment
COMMENT ON TABLE auth_audit_log IS 'Security audit log for authentication events';
COMMENT ON COLUMN auth_audit_log.event_type IS 'Type of authentication event';
COMMENT ON COLUMN auth_audit_log.metadata IS 'Additional event data (failure counts, lockout duration, etc.)';

-- Create function to automatically clean old audit logs (>90 days)
CREATE OR REPLACE FUNCTION clean_old_auth_audit_logs()
RETURNS INTEGER AS $$
DECLARE
    deleted_count INTEGER;
BEGIN
    DELETE FROM auth_audit_log
    WHERE created_at < NOW() - INTERVAL '90 days';
    
    GET DIAGNOSTICS deleted_count = ROW_COUNT;
    
    RETURN deleted_count;
END;
$$ LANGUAGE plpgsql;

-- Create maintenance job (if pg_cron is available)
-- This should be run periodically by a scheduler
COMMENT ON FUNCTION clean_old_auth_audit_logs IS 
'Removes audit logs older than 90 days. Should be run weekly via scheduler.';

-- Grant permissions
GRANT SELECT, INSERT ON auth_audit_log TO authenticated;
GRANT ALL ON auth_audit_log TO service_role;
