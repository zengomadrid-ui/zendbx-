-- ============================================
-- MIGRATION: Add legacy_slug Column to Projects Table
-- ============================================
-- Purpose: Support backward compatibility for old project slugs
-- Safe to run multiple times (uses IF NOT EXISTS)

-- Add legacy_slug column (nullable, can be populated later)
ALTER TABLE projects 
ADD COLUMN IF NOT EXISTS legacy_slug VARCHAR(255);

-- Create index for performance (legacy slug lookups)
CREATE INDEX IF NOT EXISTS idx_projects_legacy_slug 
ON projects(legacy_slug);

-- Add comment explaining the column's purpose
COMMENT ON COLUMN projects.legacy_slug IS 'Stores previous slug format for backward compatibility during slug migration';

-- Note: This migration ONLY adds the column structure
-- To populate legacy_slug with current slug values before updating slugs,
-- run generated_migration.sql separately

SELECT 
    CASE 
        WHEN COUNT(*) > 0 THEN '✅ legacy_slug column added successfully'
        ELSE '⚠️  Column may already exist'
    END as status,
    COUNT(*) as projects_count
FROM information_schema.columns
WHERE table_name = 'projects' 
  AND column_name = 'legacy_slug';
