-- Add query_truncated column to query_history table
-- This column tracks whether the SQL query was truncated due to length limits

DO $$ 
BEGIN
    -- Check if column exists before adding
    IF NOT EXISTS (
        SELECT 1 FROM information_schema.columns 
        WHERE table_name = 'query_history' 
        AND column_name = 'query_truncated'
    ) THEN
        ALTER TABLE query_history 
        ADD COLUMN query_truncated BOOLEAN DEFAULT FALSE;
        
        RAISE NOTICE 'Column query_truncated added to query_history table';
    ELSE
        RAISE NOTICE 'Column query_truncated already exists in query_history table';
    END IF;
END $$;

-- Update existing rows to have default value
UPDATE query_history 
SET query_truncated = FALSE 
WHERE query_truncated IS NULL;

-- Add comment for documentation
COMMENT ON COLUMN query_history.query_truncated IS 'Indicates if the SQL query was truncated for storage (queries > 50KB)';
