-- ============================================
-- FIX DEPLOYMENT ISSUES
-- Run this on the NEW backend database (zendbx-2-zpp9)
-- ============================================

-- 1. Add missing key_type column to api_keys table
DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM information_schema.columns 
        WHERE table_name = 'api_keys' 
        AND column_name = 'key_type'
    ) THEN
        ALTER TABLE api_keys ADD COLUMN key_type VARCHAR(50);
        RAISE NOTICE '✅ Added key_type column to api_keys table';
    ELSE
        RAISE NOTICE 'ℹ️  key_type column already exists';
    END IF;
END $$;

-- 2. Add encrypted_key column if missing
DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM information_schema.columns 
        WHERE table_name = 'api_keys' 
        AND column_name = 'encrypted_key'
    ) THEN
        ALTER TABLE api_keys ADD COLUMN encrypted_key TEXT;
        RAISE NOTICE '✅ Added encrypted_key column to api_keys table';
    ELSE
        RAISE NOTICE 'ℹ️  encrypted_key column already exists';
    END IF;
END $$;

-- 3. Create indexes for better performance
CREATE INDEX IF NOT EXISTS idx_api_keys_key_type ON api_keys(key_type);
CREATE INDEX IF NOT EXISTS idx_api_keys_project_key_type ON api_keys(project_id, key_type);

-- 4. Update existing rows to set default key_type if NULL
UPDATE api_keys 
SET key_type = CASE 
    WHEN role = 'anon' THEN 'anon'
    WHEN role = 'service_role' THEN 'service_role'
    ELSE 'custom'
END
WHERE key_type IS NULL;

-- 5. Verify the fix
DO $$
DECLARE
    col_count INTEGER;
BEGIN
    SELECT COUNT(*) INTO col_count
    FROM information_schema.columns 
    WHERE table_name = 'api_keys' 
    AND column_name IN ('key_type', 'encrypted_key');
    
    IF col_count = 2 THEN
        RAISE NOTICE '✅ SUCCESS: api_keys table has all required columns';
    ELSE
        RAISE EXCEPTION '❌ FAILED: api_keys table is missing columns';
    END IF;
END $$;

-- Show current api_keys table structure
SELECT 
    column_name,
    data_type,
    is_nullable,
    column_default
FROM information_schema.columns
WHERE table_name = 'api_keys'
ORDER BY ordinal_position;
