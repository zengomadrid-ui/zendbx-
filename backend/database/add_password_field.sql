-- Add password field to project_users table
ALTER TABLE project_users ADD COLUMN IF NOT EXISTS encrypted_password TEXT;

-- Add index for faster email lookups
CREATE INDEX IF NOT EXISTS idx_project_users_email_lookup 
ON project_users(project_id, email) 
WHERE is_active = TRUE;
