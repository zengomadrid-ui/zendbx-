-- Add RBAC (Role-Based Access Control) to AURIX
-- This migration adds role column and sets up admin user

-- Add role column to users table
ALTER TABLE users ADD COLUMN IF NOT EXISTS role VARCHAR(50) DEFAULT 'user';

-- Create index for faster role queries
CREATE INDEX IF NOT EXISTS idx_users_role ON users(role);

-- Set admin role for the main admin user
UPDATE users SET role = 'admin' WHERE email = 'pawansrikumar@simplita.ai';

-- Add comment for documentation
COMMENT ON COLUMN users.role IS 'User role: admin, user, or custom roles';

-- Verify the changes
DO $$
BEGIN
    RAISE NOTICE 'RBAC Migration Complete!';
    RAISE NOTICE 'Admin user: pawansrikumar@simplita.ai';
END $$;
