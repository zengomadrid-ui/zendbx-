-- Storage Architecture V3 - Required Indexes
-- Ensures optimal performance for bucket and object resolution

-- Index for bucket resolution by slug within project
-- Supports: WHERE project_id = ? AND slug = ?
CREATE INDEX IF NOT EXISTS idx_storage_buckets_project_slug
ON storage_buckets(project_id, slug)
WHERE deleted_at IS NULL;

-- Index for bucket resolution by UUID (already covered by primary key, but explicit for clarity)
-- Primary key on 'id' handles: WHERE id = ?

-- Index for object lookup by bucket
CREATE INDEX IF NOT EXISTS idx_storage_objects_bucket
ON storage_objects(bucket_id)
WHERE deleted_at IS NULL;

-- Index for object lookup by project
CREATE INDEX IF NOT EXISTS idx_storage_objects_project
ON storage_objects(project_id)
WHERE deleted_at IS NULL;

-- Index for object search queries (by bucket + name search)
CREATE INDEX IF NOT EXISTS idx_storage_objects_search
ON storage_objects(bucket_id, original_name, file_name)
WHERE deleted_at IS NULL;

-- Index for storage analytics queries (file size aggregation)
CREATE INDEX IF NOT EXISTS idx_storage_objects_size
ON storage_objects(project_id, file_size)
WHERE deleted_at IS NULL;

-- Index for recent uploads queries
CREATE INDEX IF NOT EXISTS idx_storage_objects_created
ON storage_objects(project_id, created_at DESC)
WHERE deleted_at IS NULL;

-- Index for download count queries
CREATE INDEX IF NOT EXISTS idx_storage_objects_downloads
ON storage_objects(project_id, download_count DESC)
WHERE deleted_at IS NULL;

-- Composite index for bucket stats
CREATE INDEX IF NOT EXISTS idx_storage_buckets_stats
ON storage_buckets(project_id, storage_used, file_count)
WHERE deleted_at IS NULL;

-- Verify indexes
SELECT
    schemaname,
    tablename,
    indexname,
    indexdef
FROM pg_indexes
WHERE tablename IN ('storage_buckets', 'storage_objects')
ORDER BY tablename, indexname;
