-- Make user admin for OAuth configuration
-- Replace 'your@email.com' with your actual email

-- First, check current role
SELECT email, role, created_at FROM users ORDER BY created_at DESC LIMIT 5;

-- Update your user to admin (REPLACE EMAIL BELOW!)
UPDATE users SET role = 'admin' WHERE email = 'your@email.com';

-- Verify the change
SELECT email, role FROM users WHERE email = 'your@email.com';

-- If you want to make ALL users admin (for testing):
-- UPDATE users SET role = 'admin';

-- Check all users
SELECT email, role FROM users;
