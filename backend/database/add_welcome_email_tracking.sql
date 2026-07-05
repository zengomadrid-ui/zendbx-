-- ============================================
-- Add Welcome Email Tracking to Users Table
-- ============================================

-- Connect to main database
\c nexora_main;

-- Add welcome_email_sent column to track welcome email status
ALTER TABLE users
ADD COLUMN IF NOT EXISTS welcome_email_sent BOOLEAN DEFAULT FALSE,
ADD COLUMN IF NOT EXISTS welcome_email_sent_at TIMESTAMPTZ;

-- Add index for filtering users who haven't received welcome email
CREATE INDEX IF NOT EXISTS idx_users_welcome_email_sent 
ON users(welcome_email_sent) 
WHERE welcome_email_sent = FALSE;

-- Add comment for documentation
COMMENT ON COLUMN users.welcome_email_sent IS 'Tracks if welcome email has been sent to the user';
COMMENT ON COLUMN users.welcome_email_sent_at IS 'Timestamp when welcome email was sent';

-- Success message
SELECT 'Welcome email tracking columns added successfully!' as message;
