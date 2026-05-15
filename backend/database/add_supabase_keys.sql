-- Add Supabase-style API Keys
-- This migration adds anon and service_role key types

\c nexora_main;

-- Update API keys table to support key types
ALTER TABLE api_keys ADD COLUMN IF NOT EXISTS key_type VARCHAR(50) DEFAULT 'custom';
-- key_type: 'anon', 'service_role', 'custom'

-- Add comment
COMMENT ON COLUMN api_keys.key_type IS 'Type of API key: anon (public), service_role (private), custom (user-created)';

-- Update existing keys to be 'custom' type
UPDATE api_keys SET key_type = 'custom' WHERE key_type IS NULL;

-- Create function to auto-generate project keys
CREATE OR REPLACE FUNCTION create_project_default_keys(p_project_id UUID, p_user_id UUID)
RETURNS TABLE(anon_key TEXT, service_role_key TEXT) AS $$
DECLARE
    v_anon_key TEXT;
    v_anon_hash TEXT;
    v_anon_prefix TEXT;
    v_service_key TEXT;
    v_service_hash TEXT;
    v_service_prefix TEXT;
BEGIN
    -- Generate anon key (public key)
    v_anon_key := 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.' || encode(gen_random_bytes(32), 'base64');
    v_anon_hash := encode(digest(v_anon_key, 'sha256'), 'hex');
    v_anon_prefix := substring(v_anon_key, 1, 20) || '...';
    
    -- Generate service_role key (private key)
    v_service_key := 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.' || encode(gen_random_bytes(32), 'base64');
    v_service_hash := encode(digest(v_service_key, 'sha256'), 'hex');
    v_service_prefix := substring(v_service_key, 1, 20) || '...';
    
    -- Insert anon key
    INSERT INTO api_keys (user_id, project_id, name, key_hash, key_prefix, role, key_type, is_active)
    VALUES (p_user_id, p_project_id, 'anon (public)', v_anon_hash, v_anon_prefix, 'read', 'anon', TRUE);
    
    -- Insert service_role key
    INSERT INTO api_keys (user_id, project_id, name, key_hash, key_prefix, role, key_type, is_active)
    VALUES (p_user_id, p_project_id, 'service_role (secret)', v_service_hash, v_service_prefix, 'admin', 'service_role', TRUE);
    
    -- Return the keys (only time they'll be shown)
    RETURN QUERY SELECT v_anon_key, v_service_key;
END;
$$ LANGUAGE plpgsql;

-- Success message
SELECT 'Supabase-style API keys migration completed!' as message;
