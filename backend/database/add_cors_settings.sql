-- ============================================
-- Add CORS Settings to Projects Table
-- ============================================
-- This migration adds CORS configuration to the projects table,
-- allowing per-project origin whitelisting.

-- Add CORS settings columns to projects table
ALTER TABLE projects
ADD COLUMN IF NOT EXISTS allowed_origins TEXT[] DEFAULT NULL,
ADD COLUMN IF NOT EXISTS cors_max_age INTEGER DEFAULT 3600,
ADD COLUMN IF NOT EXISTS cors_allow_credentials BOOLEAN DEFAULT TRUE;

-- Add comment to explain the columns
COMMENT ON COLUMN projects.allowed_origins IS 'Array of allowed CORS origins for this project. NULL means use default platform origins.';
COMMENT ON COLUMN projects.cors_max_age IS 'CORS preflight cache duration in seconds';
COMMENT ON COLUMN projects.cors_allow_credentials IS 'Whether to allow credentials in CORS requests';

-- Create index for faster lookups when checking project CORS settings
CREATE INDEX IF NOT EXISTS idx_projects_cors_settings 
ON projects(id) 
WHERE allowed_origins IS NOT NULL;

-- Example: Set custom origins for a specific project (optional)
-- UPDATE projects 
-- SET allowed_origins = ARRAY['https://myapp.com', 'https://www.myapp.com']
-- WHERE slug = 'my-project-slug';

COMMIT;
