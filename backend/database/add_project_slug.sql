-- Migration: Add slug field to projects table
-- Run this on existing nexora_main database

\c nexora_main;

-- Add slug column
ALTER TABLE projects ADD COLUMN IF NOT EXISTS slug VARCHAR(255) UNIQUE;

-- Create index on slug
CREATE INDEX IF NOT EXISTS idx_projects_slug ON projects(slug);

-- Function to generate slug from project name
CREATE OR REPLACE FUNCTION generate_project_slug(project_name TEXT, project_id UUID)
RETURNS TEXT AS $$
DECLARE
    base_slug TEXT;
    final_slug TEXT;
    counter INTEGER := 0;
    exists BOOLEAN;
BEGIN
    -- Convert name to slug format: "My Todo App" -> "my-todo-app"
    base_slug := lower(regexp_replace(project_name, '[^a-zA-Z0-9]+', '-', 'g'));
    base_slug := trim(both '-' from base_slug);
    
    -- Add short UUID suffix for uniqueness: "my-todo-app-a18a05a0"
    final_slug := base_slug || '-' || substr(project_id::text, 1, 8);
    
    -- Ensure uniqueness
    LOOP
        SELECT EXISTS(SELECT 1 FROM projects WHERE slug = final_slug AND id != project_id) INTO exists;
        
        IF NOT exists THEN
            RETURN final_slug;
        END IF;
        
        -- If collision, add counter
        counter := counter + 1;
        final_slug := base_slug || '-' || substr(project_id::text, 1, 8) || '-' || counter;
    END LOOP;
END;
$$ LANGUAGE plpgsql;

-- Generate slugs for existing projects
UPDATE projects 
SET slug = generate_project_slug(name, id)
WHERE slug IS NULL;

-- Make slug NOT NULL after populating
ALTER TABLE projects ALTER COLUMN slug SET NOT NULL;

SELECT 'Project slug migration completed successfully!' as message;
SELECT COUNT(*) || ' projects updated with slugs' as result FROM projects WHERE slug IS NOT NULL;
