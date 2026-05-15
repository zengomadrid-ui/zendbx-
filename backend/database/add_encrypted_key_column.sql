-- Add encrypted_key column to api_keys table
-- This column stores the full JWT token for anon and service_role keys

\c nexora_main;

-- Add encrypted_key column if it doesn't exist
ALTER TABLE api_keys ADD COLUMN IF NOT EXISTS encrypted_key TEXT;

-- Add comment
COMMENT ON COLUMN api_keys.encrypted_key IS 'Full JWT token for anon and service_role keys (only stored for these types)';

-- Success message
SELECT 'encrypted_key column added successfully!' as message;
