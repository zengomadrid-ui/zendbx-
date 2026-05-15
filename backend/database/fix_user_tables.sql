-- Fix user_tables schema to match what the backend generator expects
-- This adds the missing columns if they don't exist

-- Check if schema_definition column exists, if not add it
DO $$ 
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM information_schema.columns 
        WHERE table_name = 'user_tables' 
        AND column_name = 'schema_definition'
    ) THEN
        ALTER TABLE user_tables ADD COLUMN schema_definition JSONB;
    END IF;
END $$;

-- Check if created_by column exists, if not add it
DO $$ 
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM information_schema.columns 
        WHERE table_name = 'user_tables' 
        AND column_name = 'created_by'
    ) THEN
        ALTER TABLE user_tables ADD COLUMN created_by UUID;
    END IF;
END $$;

-- Update existing rows to have empty schema_definition if null
UPDATE user_tables 
SET schema_definition = '{}'::jsonb 
WHERE schema_definition IS NULL;
