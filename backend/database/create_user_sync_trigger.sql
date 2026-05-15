-- Sync project_users to main users table automatically
-- This makes authenticated users visible in the Table Editor

-- Create trigger function to sync project_users to users table
CREATE OR REPLACE FUNCTION sync_project_user_to_users()
RETURNS TRIGGER AS $$
BEGIN
    -- Insert or update user in users table
    INSERT INTO users (id, email, full_name, oauth_provider, created_at, last_login_at, is_active, is_verified)
    VALUES (
        NEW.id,
        NEW.email,
        COALESCE(NEW.full_name, split_part(NEW.email, '@', 1)),
        NEW.provider,
        NEW.created_at,
        NEW.last_login_at,
        NEW.is_active,
        TRUE
    )
    ON CONFLICT (id) DO UPDATE SET
        email = EXCLUDED.email,
        full_name = COALESCE(EXCLUDED.full_name, users.full_name),
        oauth_provider = EXCLUDED.oauth_provider,
        last_login_at = EXCLUDED.last_login_at,
        is_active = EXCLUDED.is_active,
        updated_at = NOW();
    
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Create trigger on project_users table
DROP TRIGGER IF EXISTS trigger_sync_user ON project_users;
CREATE TRIGGER trigger_sync_user
    AFTER INSERT OR UPDATE ON project_users
    FOR EACH ROW
    EXECUTE FUNCTION sync_project_user_to_users();

-- Backfill existing users
INSERT INTO users (id, email, full_name, oauth_provider, created_at, last_login_at, is_active, is_verified)
SELECT 
    id,
    email,
    COALESCE(full_name, split_part(email, '@', 1)) as full_name,
    provider,
    created_at,
    last_login_at,
    is_active,
    TRUE
FROM project_users
ON CONFLICT (id) DO NOTHING;

-- Success message
DO $$
BEGIN
    RAISE NOTICE '✅ User sync trigger created successfully!';
    RAISE NOTICE '📋 Users table is now synced with project_users';
    RAISE NOTICE '👀 Check Table Editor to see users';
END $$;
