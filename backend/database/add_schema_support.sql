-- ============================================
-- PHASE 1: Add Schema Support Infrastructure
-- ============================================
-- This migration adds schema_name support to the projects table
-- without affecting existing projects.

-- Add schema_name column (nullable for backward compatibility)
ALTER TABLE projects 
ADD COLUMN IF NOT EXISTS schema_name VARCHAR(255);

-- Add index for schema lookups
CREATE INDEX IF NOT EXISTS idx_projects_schema_name ON projects(schema_name);

-- Add unique constraint to prevent schema name conflicts
ALTER TABLE projects 
ADD CONSTRAINT unique_schema_name UNIQUE (schema_name);

-- Function to generate project schema name
CREATE OR REPLACE FUNCTION generate_project_schema_name(p_project_id UUID)
RETURNS VARCHAR AS $$
BEGIN
    -- Format: proj_{first_8_chars_of_uuid}
    -- Example: proj_a1b2c3d4
    RETURN 'proj_' || SUBSTRING(REPLACE(p_project_id::TEXT, '-', ''), 1, 8);
END;
$$ LANGUAGE plpgsql IMMUTABLE;

-- Function to check if schema exists
CREATE OR REPLACE FUNCTION schema_exists(schema_name VARCHAR)
RETURNS BOOLEAN AS $$
DECLARE
    exists BOOLEAN;
BEGIN
    SELECT EXISTS(
        SELECT 1 
        FROM information_schema.schemata 
        WHERE schema_name = $1
    ) INTO exists;
    RETURN exists;
END;
$$ LANGUAGE plpgsql;

-- Backfill schema_name for existing projects (NULL indicates legacy/public schema projects)
-- We do NOT create schemas yet - just populate the column with what the name WOULD be
UPDATE projects 
SET schema_name = generate_project_schema_name(id)
WHERE schema_name IS NULL;

-- Make schema_name NOT NULL after backfill
ALTER TABLE projects 
ALTER COLUMN schema_name SET NOT NULL;

-- Add comment for documentation
COMMENT ON COLUMN projects.schema_name IS 'PostgreSQL schema name for this project (e.g., proj_a1b2c3d4). Each project has its own isolated schema.';

-- Success message
SELECT 'Schema support infrastructure added successfully!' as message;
SELECT 'Total projects: ' || COUNT(*) as project_count FROM projects;
SELECT 'Projects with schemas: ' || COUNT(*) as schema_count FROM projects WHERE schema_name IS NOT NULL;
