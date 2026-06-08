-- ============================================
-- Fix Database Name Integrity
-- Ensures database_name always matches the actual schema name
-- ============================================

-- Step 1: Add a CHECK constraint to prevent invalid database_name format
ALTER TABLE projects 
ADD CONSTRAINT check_database_name_format 
CHECK (database_name ~ '^(proj_[a-f0-9]{8}|[a-z][a-z0-9_]{2,62})$');

-- Step 2: Create a function to validate schema exists
CREATE OR REPLACE FUNCTION validate_project_schema()
RETURNS TRIGGER AS $$
BEGIN
    -- Check if schema exists for the database_name
    IF NOT EXISTS (
        SELECT 1 FROM information_schema.schemata 
        WHERE schema_name = NEW.database_name
    ) THEN
        RAISE EXCEPTION 'Schema % does not exist. Cannot create project with non-existent schema.', NEW.database_name;
    END IF;
    
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Step 3: Create trigger to validate on INSERT and UPDATE
DROP TRIGGER IF EXISTS trigger_validate_project_schema ON projects;
CREATE TRIGGER trigger_validate_project_schema
    BEFORE INSERT OR UPDATE OF database_name ON projects
    FOR EACH ROW
    EXECUTE FUNCTION validate_project_schema();

-- Step 4: Add index for performance
CREATE INDEX IF NOT EXISTS idx_projects_database_name ON projects(database_name);

-- Step 5: Verify all existing projects have valid schemas
DO $$
DECLARE
    proj RECORD;
    invalid_count INT := 0;
BEGIN
    FOR proj IN 
        SELECT p.id, p.name, p.database_name
        FROM projects p
        WHERE NOT EXISTS (
            SELECT 1 FROM information_schema.schemata s
            WHERE s.schema_name = p.database_name
        )
    LOOP
        RAISE WARNING 'Project % (%) has invalid database_name: %', 
            proj.name, proj.id, proj.database_name;
        invalid_count := invalid_count + 1;
    END LOOP;
    
    IF invalid_count > 0 THEN
        RAISE NOTICE '⚠️  Found % projects with invalid database_name. These need manual correction.', invalid_count;
    ELSE
        RAISE NOTICE '✅ All projects have valid database_name values.';
    END IF;
END $$;
