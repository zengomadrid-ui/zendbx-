-- ZenDBX Project Slug Collision Analysis
-- Generates a report of all existing project slugs and identifies potential collisions
-- Run this BEFORE implementing any migration

\c nexora_main;

-- ============================================
-- Step 1: Create function to generate clean slugs (analysis only)
-- ============================================

CREATE OR REPLACE FUNCTION analyze_clean_slug_from_name(project_name TEXT)
RETURNS TEXT AS $$
DECLARE
    clean_slug TEXT;
BEGIN
    -- Convert name to clean slug format (same logic as proposed migration)
    clean_slug := lower(regexp_replace(project_name, '[^a-zA-Z0-9]+', '-', 'g'));
    clean_slug := trim(both '-' from clean_slug);
    
    -- Handle empty slugs
    IF clean_slug = '' THEN
        clean_slug := 'project';
    END IF;
    
    RETURN clean_slug;
END;
$$ LANGUAGE plpgsql;

-- ============================================
-- Step 2: Generate collision analysis report
-- ============================================

-- Create temporary table for analysis
CREATE TEMPORARY TABLE slug_analysis AS
SELECT 
    id as project_id,
    name as project_name,
    slug as current_slug,
    analyze_clean_slug_from_name(name) as proposed_new_slug,
    created_at
FROM projects 
ORDER BY created_at ASC;

-- ============================================
-- Step 3: All Projects Report
-- ============================================

\echo '=== ALL EXISTING PROJECTS ANALYSIS ==='
\echo 'Project ID | Project Name | Current Slug | Proposed New Slug'
\echo '-----------|--------------|--------------|------------------'

SELECT 
    LEFT(project_id::text, 8) as proj_id,
    CASE 
        WHEN LENGTH(project_name) > 25 THEN LEFT(project_name, 22) || '...'
        ELSE RPAD(project_name, 25)
    END as name,
    CASE 
        WHEN LENGTH(current_slug) > 35 THEN LEFT(current_slug, 32) || '...'
        ELSE RPAD(current_slug, 35) 
    END as curr_slug,
    proposed_new_slug as new_slug
FROM slug_analysis
ORDER BY created_at ASC;

-- ============================================
-- Step 4: Collision Groups Identification
-- ============================================

\echo ''
\echo '=== COLLISION GROUPS ANALYSIS ==='

-- Find collision groups
WITH collision_groups AS (
    SELECT 
        proposed_new_slug,
        COUNT(*) as collision_count,
        array_agg(project_name ORDER BY created_at) as project_names,
        array_agg(LEFT(project_id::text, 8) ORDER BY created_at) as project_ids,
        array_agg(current_slug ORDER BY created_at) as current_slugs
    FROM slug_analysis
    GROUP BY proposed_new_slug
    HAVING COUNT(*) > 1
)
SELECT 
    proposed_new_slug as "Clean Slug",
    collision_count as "Projects",
    project_names as "Project Names",
    project_ids as "Project IDs"
FROM collision_groups
ORDER BY collision_count DESC, proposed_new_slug;

-- ============================================
-- Step 5: Migration Impact Summary
-- ============================================

\echo ''
\echo '=== MIGRATION IMPACT SUMMARY ==='

WITH slug_stats AS (
    SELECT 
        proposed_new_slug,
        COUNT(*) as project_count,
        ROW_NUMBER() OVER (PARTITION BY proposed_new_slug ORDER BY created_at) as collision_rank
    FROM slug_analysis
    GROUP BY proposed_new_slug, project_id, created_at
),
final_slugs AS (
    SELECT 
        CASE 
            WHEN collision_rank = 1 THEN proposed_new_slug
            ELSE proposed_new_slug || '-' || collision_rank
        END as final_slug,
        collision_rank
    FROM slug_stats
)
SELECT 
    'Total Projects' as metric,
    COUNT(*)::text as count
FROM slug_analysis
UNION ALL
SELECT 
    'Unique Clean Slugs' as metric,
    COUNT(DISTINCT proposed_new_slug)::text as count
FROM slug_analysis
UNION ALL
SELECT 
    'Collision Groups' as metric,
    COUNT(*)::text as count
FROM (
    SELECT proposed_new_slug 
    FROM slug_analysis 
    GROUP BY proposed_new_slug 
    HAVING COUNT(*) > 1
) collisions
UNION ALL
SELECT 
    'Projects Getting Original Slug' as metric,
    COUNT(*)::text as count
FROM final_slugs
WHERE collision_rank = 1
UNION ALL
SELECT 
    'Projects Getting -2 Suffix' as metric,
    COUNT(*)::text as count
FROM final_slugs
WHERE collision_rank = 2
UNION ALL
SELECT 
    'Projects Getting -3 Suffix' as metric,
    COUNT(*)::text as count
FROM final_slugs
WHERE collision_rank = 3
UNION ALL
SELECT 
    'Projects Getting -4+ Suffix' as metric,
    COUNT(*)::text as count
FROM final_slugs
WHERE collision_rank > 3;

-- ============================================
-- Step 6: Detailed Collision Report
-- ============================================

\echo ''
\echo '=== DETAILED COLLISION RESOLUTION ==='

WITH slug_collision_resolution AS (
    SELECT 
        project_id,
        project_name,
        current_slug,
        proposed_new_slug,
        ROW_NUMBER() OVER (PARTITION BY proposed_new_slug ORDER BY created_at) as collision_order,
        CASE 
            WHEN ROW_NUMBER() OVER (PARTITION BY proposed_new_slug ORDER BY created_at) = 1 
            THEN proposed_new_slug
            ELSE proposed_new_slug || '-' || ROW_NUMBER() OVER (PARTITION BY proposed_new_slug ORDER BY created_at)
        END as final_clean_slug
    FROM slug_analysis
)
SELECT 
    LEFT(project_id::text, 8) as proj_id,
    CASE 
        WHEN LENGTH(project_name) > 20 THEN LEFT(project_name, 17) || '...'
        ELSE RPAD(project_name, 20)
    END as name,
    CASE 
        WHEN LENGTH(current_slug) > 30 THEN LEFT(current_slug, 27) || '...'
        ELSE RPAD(current_slug, 30) 
    END as current,
    final_clean_slug as final_slug,
    CASE 
        WHEN collision_order = 1 THEN 'Original'
        ELSE 'Suffix -' || collision_order
    END as resolution
FROM slug_collision_resolution
WHERE proposed_new_slug IN (
    SELECT proposed_new_slug 
    FROM slug_analysis 
    GROUP BY proposed_new_slug 
    HAVING COUNT(*) > 1
)
ORDER BY proposed_new_slug, collision_order;

-- ============================================
-- Step 7: Sample Before/After Examples
-- ============================================

\echo ''
\echo '=== SAMPLE BEFORE/AFTER TRANSFORMATIONS ==='

WITH examples AS (
    SELECT 
        project_name,
        current_slug,
        proposed_new_slug,
        ROW_NUMBER() OVER (PARTITION BY proposed_new_slug ORDER BY created_at) as collision_order,
        CASE 
            WHEN ROW_NUMBER() OVER (PARTITION BY proposed_new_slug ORDER BY created_at) = 1 
            THEN proposed_new_slug
            ELSE proposed_new_slug || '-' || ROW_NUMBER() OVER (PARTITION BY proposed_new_slug ORDER BY created_at)
        END as final_clean_slug
    FROM slug_analysis
    LIMIT 10
)
SELECT 
    project_name as "Project Name",
    current_slug as "Before (Legacy)",
    final_clean_slug as "After (Clean)"
FROM examples;

-- ============================================
-- Step 8: Risk Assessment
-- ============================================

\echo ''
\echo '=== RISK ASSESSMENT ==='

WITH risk_analysis AS (
    SELECT 
        COUNT(*) as total_projects,
        COUNT(DISTINCT proposed_new_slug) as unique_clean_slugs,
        COUNT(*) - COUNT(DISTINCT proposed_new_slug) as total_collisions
    FROM slug_analysis
)
SELECT 
    CASE 
        WHEN total_collisions = 0 THEN 'LOW'
        WHEN total_collisions <= 5 THEN 'MEDIUM' 
        ELSE 'HIGH'
    END as collision_risk,
    total_projects as total_projects,
    unique_clean_slugs as unique_slugs,
    total_collisions as collisions,
    ROUND((total_collisions::numeric / total_projects::numeric) * 100, 2) as collision_rate_percent
FROM risk_analysis;

-- ============================================
-- Step 9: Clean up analysis function
-- ============================================

DROP FUNCTION IF EXISTS analyze_clean_slug_from_name(TEXT);

\echo ''
\echo '=== ANALYSIS COMPLETE ==='
\echo 'Review the collision groups and impact summary before proceeding with migration.'
\echo 'Pay special attention to projects that will receive numbered suffixes.'
\echo ''