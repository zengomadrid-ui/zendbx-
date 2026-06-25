/*
================================================================================
COMPLETE CLEAN SLUG MIGRATION
================================================================================
This migration backfills clean slugs for existing projects while maintaining
backward compatibility via the legacy_slug column.

GOAL:
- For project "zendbx-commits-s-project-844ea26d":
  - slug = "zendbx-commits" (CLEAN)
  - legacy_slug = "zendbx-commits-s-project-844ea26d" (PRESERVED for old URLs)

- Both URLs will work:
  - /mcp/p/zendbx-commits (NEW - clean)
  - /mcp/p/zendbx-commits-s-project-844ea26d (OLD - backward compat)
*/

BEGIN;

-- ============================================================================
-- STEP 1: Verify legacy_slug column exists
-- ============================================================================
DO $$
BEGIN
    IF NOT EXISTS (
        SELECT FROM information_schema.columns 
        WHERE table_name = 'projects' AND column_name = 'legacy_slug'
    ) THEN
        RAISE NOTICE 'Creating legacy_slug column...';
        ALTER TABLE projects ADD COLUMN legacy_slug VARCHAR(255);
        CREATE INDEX IF NOT EXISTS idx_projects_legacy_slug ON projects(legacy_slug);
    ELSE
        RAISE NOTICE 'legacy_slug column already exists';
    END IF;
END $$;

-- ============================================================================
-- STEP 2: Preserve old slugs in legacy_slug (only if NULL)
-- ============================================================================
RAISE NOTICE 'Preserving old slugs in legacy_slug column...';

UPDATE projects
SET legacy_slug = slug
WHERE slug ~ '-s-project-[a-f0-9]{8}$'  -- Contains UUID fragment
  AND legacy_slug IS NULL;                -- Only if not already set

-- Show what was preserved
DO $$
DECLARE
    preserved_count INTEGER;
BEGIN
    SELECT COUNT(*) INTO preserved_count
    FROM projects
    WHERE legacy_slug IS NOT NULL;
    
    RAISE NOTICE 'Preserved % projects with legacy slugs', preserved_count;
END $$;

-- ============================================================================
-- STEP 3: Generate clean slugs by removing UUID suffix
-- ============================================================================
RAISE NOTICE 'Generating clean slugs...';

-- Remove "-s-project-{uuid}" pattern from slug column
UPDATE projects
SET slug = regexp_replace(slug, '-s-project-[a-f0-9]+$', '', 'g')
WHERE slug ~ '-s-project-[a-f0-9]{8}$'  -- Has UUID fragment
  AND legacy_slug IS NOT NULL;           -- Has been preserved

-- ============================================================================
-- STEP 4: Handle potential slug collisions with counter suffix
-- ============================================================================
RAISE NOTICE 'Checking for slug collisions...';

DO $$
DECLARE
    collision_record RECORD;
    new_slug VARCHAR(255);
    counter INTEGER;
BEGIN
    -- Find any duplicate slugs
    FOR collision_record IN
        SELECT slug, array_agg(id) as project_ids, count(*) as count
        FROM projects
        GROUP BY slug
        HAVING count(*) > 1
    LOOP
        RAISE NOTICE 'Collision detected for slug: % (% projects)', 
            collision_record.slug, collision_record.count;
        
        -- Add counter suffix to all but the first project
        counter := 2;
        FOR i IN 2..array_length(collision_record.project_ids, 1) LOOP
            new_slug := collision_record.slug || '-' || counter;
            
            -- Ensure this new slug is also unique
            WHILE EXISTS (SELECT 1 FROM projects WHERE slug = new_slug) LOOP
                counter := counter + 1;
                new_slug := collision_record.slug || '-' || counter;
            END LOOP;
            
            -- Update the colliding project
            UPDATE projects
            SET slug = new_slug
            WHERE id = collision_record.project_ids[i];
            
            RAISE NOTICE '  → Renamed project % to: %', 
                collision_record.project_ids[i], new_slug;
            
            counter := counter + 1;
        END LOOP;
    END LOOP;
END $$;

-- ============================================================================
-- STEP 5: Verify migration results
-- ============================================================================
RAISE NOTICE 'Verifying migration...';

DO $$
DECLARE
    total_count INTEGER;
    clean_count INTEGER;
    legacy_count INTEGER;
    remaining_legacy INTEGER;
BEGIN
    SELECT COUNT(*) INTO total_count FROM projects;
    
    SELECT COUNT(*) INTO clean_count 
    FROM projects 
    WHERE slug !~ '-s-project-[a-f0-9]{8}$';
    
    SELECT COUNT(*) INTO legacy_count 
    FROM projects 
    WHERE legacy_slug IS NOT NULL;
    
    SELECT COUNT(*) INTO remaining_legacy 
    FROM projects 
    WHERE slug ~ '-s-project-[a-f0-9]{8}$';
    
    RAISE NOTICE '';
    RAISE NOTICE '==============================================';
    RAISE NOTICE 'MIGRATION SUMMARY';
    RAISE NOTICE '==============================================';
    RAISE NOTICE 'Total projects:              %', total_count;
    RAISE NOTICE 'Projects with clean slugs:   %', clean_count;
    RAISE NOTICE 'Projects with legacy_slug:   %', legacy_count;
    RAISE NOTICE 'Projects still with UUID:    %', remaining_legacy;
    RAISE NOTICE '==============================================';
    
    IF remaining_legacy > 0 THEN
        RAISE WARNING '% projects still have UUID fragments in slug!', remaining_legacy;
    ELSE
        RAISE NOTICE '✅ All projects migrated successfully!';
    END IF;
END $$;

-- ============================================================================
-- STEP 6: Display sample projects
-- ============================================================================
RAISE NOTICE '';
RAISE NOTICE 'Sample migrated projects:';

DO $$
DECLARE
    proj RECORD;
    counter INTEGER := 0;
BEGIN
    FOR proj IN
        SELECT name, slug, legacy_slug
        FROM projects
        WHERE legacy_slug IS NOT NULL
        ORDER BY created_at DESC
        LIMIT 5
    LOOP
        counter := counter + 1;
        RAISE NOTICE '  %: % | slug: % | legacy: %', 
            counter, 
            left(proj.name, 25), 
            proj.slug,
            left(proj.legacy_slug, 40);
    END LOOP;
END $$;

COMMIT;

-- ============================================================================
-- FINAL VERIFICATION QUERIES (run separately to check)
-- ============================================================================

-- Check specific project
-- SELECT id, name, slug, legacy_slug 
-- FROM projects 
-- WHERE id = '844ea26d-246b-4b02-9bd6-16d2114a7543';

-- List all projects with their slug status
-- SELECT 
--     name,
--     slug,
--     legacy_slug,
--     CASE 
--         WHEN slug ~ '-s-project-[a-f0-9]{8}$' THEN 'LEGACY'
--         ELSE 'CLEAN'
--     END as status
-- FROM projects
-- ORDER BY created_at DESC;
