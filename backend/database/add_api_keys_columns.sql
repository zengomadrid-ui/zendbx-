-- Migration: Add missing columns to api_keys table
-- Adds: encrypted_key, key_type
-- Safe to run multiple times (uses IF NOT EXISTS logic)

-- Add encrypted_key column if it doesn't exist
DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM information_schema.columns 
        WHERE table_name = 'api_keys' 
        AND column_name = 'encrypted_key'
    ) THEN
        ALTER TABLE api_keys ADD COLUMN encrypted_key TEXT;
        RAISE NOTICE 'Added encrypted_key column to api_keys table';
    ELSE
        RAISE NOTICE 'encrypted_key column already exists in api_keys table';
    END IF;
END $$;

-- Add key_type column if it doesn't exist
DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM information_schema.columns 
        WHERE table_name = 'api_keys' 
        AND column_name = 'key_type'
    ) THEN
        ALTER TABLE api_keys ADD COLUMN key_type VARCHAR(50);
        RAISE NOTICE 'Added key_type column to api_keys table';
    ELSE
        RAISE NOTICE 'key_type column already exists in api_keys table';
    END IF;
END $$;

-- Create index on key_type for faster queries
CREATE INDEX IF NOT EXISTS idx_api_keys_key_type ON api_keys(key_type);
CREATE INDEX IF NOT EXISTS idx_api_keys_project_key_type ON api_keys(project_id, key_type);

-- Success message
DO $$
BEGIN
    RAISE NOTICE '✅ Migration completed successfully';
    RAISE NOTICE 'api_keys table now has encrypted_key and key_type columns';
END $$;
