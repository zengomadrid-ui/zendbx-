-- Fix existing API keys to populate encrypted_key column
-- This script regenerates full JWTs for existing anon and service_role keys

\c nexora_main;

-- Function to regenerate keys for existing projects
CREATE OR REPLACE FUNCTION regenerate_project_keys()
RETURNS void AS $$
DECLARE
    key_record RECORD;
    v_new_key TEXT;
    v_new_hash TEXT;
    v_new_prefix TEXT;
BEGIN
    -- Loop through all anon and service_role keys that don't have encrypted_key
    FOR key_record IN 
        SELECT id, key_type, project_id, user_id, name, role, is_active
        FROM api_keys
        WHERE key_type IN ('anon', 'service_role')
        AND (encrypted_key IS NULL OR encrypted_key = '')
    LOOP
        -- Generate new full JWT
        v_new_key := 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.' || encode(gen_random_bytes(32), 'base64');
        v_new_hash := encode(digest(v_new_key, 'sha256'), 'hex');
        v_new_prefix := substring(v_new_key, 1, 20) || '...';
        
        -- Update the key with full JWT
        UPDATE api_keys
        SET 
            encrypted_key = v_new_key,
            key_hash = v_new_hash,
            key_prefix = v_new_prefix
        WHERE id = key_record.id;
        
        RAISE NOTICE 'Regenerated % key for project %', key_record.key_type, key_record.project_id;
    END LOOP;
END;
$$ LANGUAGE plpgsql;

-- Execute the function
SELECT regenerate_project_keys();

-- Drop the temporary function
DROP FUNCTION regenerate_project_keys();

-- Success message
SELECT 'API keys regenerated with full JWTs in encrypted_key column!' as message;
SELECT COUNT(*) as "Keys with encrypted_key" FROM api_keys WHERE encrypted_key IS NOT NULL;
