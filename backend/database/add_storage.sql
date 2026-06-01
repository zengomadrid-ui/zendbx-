-- Storage System Migration
-- Run this against the main database

-- Add storage columns to projects table
ALTER TABLE projects ADD COLUMN IF NOT EXISTS storage_used BIGINT DEFAULT 0;
ALTER TABLE projects ADD COLUMN IF NOT EXISTS max_storage BIGINT DEFAULT 1073741824; -- 1 GB default

-- Storage Buckets Table
CREATE TABLE IF NOT EXISTS storage_buckets (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    project_id UUID NOT NULL REFERENCES projects(id) ON DELETE CASCADE,
    name VARCHAR(255) NOT NULL,
    slug VARCHAR(255) NOT NULL,
    description TEXT,
    is_public BOOLEAN DEFAULT FALSE,
    storage_used BIGINT DEFAULT 0,
    file_count INTEGER DEFAULT 0,
    created_by UUID,
    created_at TIMESTAMP DEFAULT NOW(),
    updated_at TIMESTAMP DEFAULT NOW(),
    deleted_at TIMESTAMP NULL,
    UNIQUE(project_id, slug)
);

-- Storage Objects Table
CREATE TABLE IF NOT EXISTS storage_objects (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    project_id UUID NOT NULL REFERENCES projects(id) ON DELETE CASCADE,
    bucket_id UUID NOT NULL REFERENCES storage_buckets(id) ON DELETE CASCADE,
    file_name TEXT,
    original_name TEXT,
    file_size BIGINT,
    mime_type TEXT,
    storage_key TEXT,
    version INTEGER DEFAULT 1,
    uploaded_by UUID,
    download_count BIGINT DEFAULT 0,
    last_downloaded_at TIMESTAMP NULL,
    created_at TIMESTAMP DEFAULT NOW(),
    updated_at TIMESTAMP DEFAULT NOW(),
    deleted_at TIMESTAMP NULL
);

-- Indexes
CREATE INDEX IF NOT EXISTS idx_storage_buckets_project_id ON storage_buckets(project_id);
CREATE INDEX IF NOT EXISTS idx_storage_buckets_deleted_at ON storage_buckets(deleted_at);
CREATE INDEX IF NOT EXISTS idx_storage_objects_bucket_id ON storage_objects(bucket_id);
CREATE INDEX IF NOT EXISTS idx_storage_objects_project_id ON storage_objects(project_id);
CREATE INDEX IF NOT EXISTS idx_storage_objects_deleted_at ON storage_objects(deleted_at);
CREATE INDEX IF NOT EXISTS idx_storage_objects_storage_key ON storage_objects(storage_key);

-- Auto-update updated_at trigger for buckets
CREATE OR REPLACE FUNCTION update_storage_bucket_updated_at()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = NOW();
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trigger_storage_buckets_updated_at ON storage_buckets;
CREATE TRIGGER trigger_storage_buckets_updated_at
    BEFORE UPDATE ON storage_buckets
    FOR EACH ROW EXECUTE FUNCTION update_storage_bucket_updated_at();

-- Auto-update updated_at trigger for objects
CREATE OR REPLACE FUNCTION update_storage_object_updated_at()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = NOW();
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trigger_storage_objects_updated_at ON storage_objects;
CREATE TRIGGER trigger_storage_objects_updated_at
    BEFORE UPDATE ON storage_objects
    FOR EACH ROW EXECUTE FUNCTION update_storage_object_updated_at();
