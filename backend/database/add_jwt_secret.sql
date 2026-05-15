-- Add jwt_secret column to projects table
-- This stores the JWT secret used to sign API keys for each project

\c zendbx_main;

-- Add jwt_secret column
ALTER TABLE projects 
ADD COLUMN IF NOT EXISTS jwt_secret VARCHAR(128);

-- Add comment
COMMENT ON COLUMN projects.jwt_secret IS 'JWT secret used to sign API keys for this project';

-- Verify
SELECT column_name, data_type, character_maximum_length 
FROM information_schema.columns 
WHERE table_name = 'projects' AND column_name = 'jwt_secret';
