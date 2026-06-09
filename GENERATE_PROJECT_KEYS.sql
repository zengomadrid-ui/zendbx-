-- Generate API Keys for Project
-- Run this in your Render PostgreSQL console

-- First, check if keys already exist
SELECT 
    p.id as project_id,
    p.name as project_name,
    p.slug,
    COUNT(k.id) as key_count,
    array_agg(k.key_type) as existing_key_types
FROM projects p
LEFT JOIN api_keys k ON k.project_id = p.id AND k.is_active = true
WHERE p.id = '718af5ef-8ffb-49ba-b54a-26cc37755d2c'
GROUP BY p.id, p.name, p.slug;

-- If no keys exist, generate them
-- Replace 'YOUR_USER_ID' with your actual user_id from the users table

DO $$
DECLARE
    v_project_id UUID := '718af5ef-8ffb-49ba-b54a-26cc37755d2c';
    v_user_id UUID;
    v_anon_key TEXT;
    v_service_key TEXT;
    v_anon_hash TEXT;
    v_service_hash TEXT;
    v_key_count INTEGER;
BEGIN
    -- Get the user_id for this project
    SELECT user_id INTO v_user_id FROM projects WHERE id = v_project_id;
    
    IF v_user_id IS NULL THEN
        RAISE EXCEPTION 'Project not found';
    END IF;
    
    -- Check if keys already exist
    SELECT COUNT(*) INTO v_key_count 
    FROM api_keys 
    WHERE project_id = v_project_id 
    AND key_type IN ('anon', 'service_role')
    AND is_active = true;
    
    IF v_key_count > 0 THEN
        RAISE NOTICE 'Keys already exist for this project';
    ELSE
        -- Generate anon key
        v_anon_key := 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.' || encode(gen_random_bytes(32), 'base64');
        v_anon_hash := encode(digest(v_anon_key, 'sha256'), 'hex');
        
        -- Generate service_role key
        v_service_key := 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.' || encode(gen_random_bytes(32), 'base64');
        v_service_hash := encode(digest(v_service_key, 'sha256'), 'hex');
        
        -- Insert anon key
        INSERT INTO api_keys (user_id, project_id, name, key_hash, key_prefix, encrypted_key, role, key_type, is_active)
        VALUES (
            v_user_id, 
            v_project_id, 
            'anon (public)', 
            v_anon_hash, 
            substring(v_anon_key, 1, 20) || '...', 
            v_anon_key, 
            'read', 
            'anon', 
            TRUE
        );
        
        -- Insert service_role key
        INSERT INTO api_keys (user_id, project_id, name, key_hash, key_prefix, encrypted_key, role, key_type, is_active)
        VALUES (
            v_user_id, 
            v_project_id, 
            'service_role (secret)', 
            v_service_hash, 
            substring(v_service_key, 1, 20) || '...', 
            v_service_key, 
            'admin', 
            'service_role', 
            TRUE
        );
        
        RAISE NOTICE 'Keys generated successfully!';
        RAISE NOTICE 'ANON_KEY: %', v_anon_key;
        RAISE NOTICE 'SERVICE_ROLE_KEY: %', v_service_key;
    END IF;
END $$;

-- Verify keys were created
SELECT 
    k.key_type,
    k.name,
    k.key_prefix,
    k.encrypted_key as full_key,
    k.is_active,
    k.created_at
FROM api_keys k
WHERE k.project_id = '718af5ef-8ffb-49ba-b54a-26cc37755d2c'
AND k.is_active = true
ORDER BY k.key_type;
