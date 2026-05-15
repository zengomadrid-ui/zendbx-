-- ============================================
-- Add last_selected_project_id to users table
-- This stores the user's last selected project for better UX
-- ============================================

-- Add column if it doesn't exist
DO $$ 
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM information_schema.columns 
        WHERE table_name = 'users' 
        AND column_name = 'last_selected_project_id'
    ) THEN
        ALTER TABLE users 
        ADD COLUMN last_selected_project_id UUID REFERENCES projects(id) ON DELETE SET NULL;
        
        RAISE NOTICE 'Added last_selected_project_id column to users table';
    ELSE
        RAISE NOTICE 'last_selected_project_id column already exists';
    END IF;
END $$;

-- Create index for faster lookups
CREATE INDEX IF NOT EXISTS idx_users_last_selected_project 
ON users(last_selected_project_id);
