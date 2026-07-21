-- ============================================
-- PHASE 3: CREATE PROJECT CREDENTIALS TABLE
-- ============================================
-- 
-- Purpose: Store encrypted database credentials for project-specific roles
-- Security: Credentials are encrypted at rest, accessible only by platform role
-- Status: STAGING ONLY

-- ============================================
-- CREATE TABLE FOR ENCRYPTED CREDENTIALS
-- ============================================

CREATE TABLE IF NOT EXISTS project_db_credentials (
    project_id UUID PRIMARY KEY REFERENCES projects(id) ON DELETE CASCADE,
    role_name VARCHAR(255) NOT NULL UNIQUE,
    encrypted_password TEXT NOT NULL,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Index for faster role name lookups
CREATE INDEX IF NOT EXISTS idx_project_db_credentials_role_name 
ON project_db_credentials(role_name);

-- ============================================
-- SECURITY: RESTRICT ACCESS TO PLATFORM ROLE
-- ============================================

-- Only zendbx_platform should be able to read credentials
-- Project roles must NEVER see this table

-- Revoke public access
REVOKE ALL ON project_db_credentials FROM PUBLIC;

-- Grant to platform role only
GRANT SELECT, INSERT, UPDATE, DELETE ON project_db_credentials TO zendbx_platform;

-- Add comment
COMMENT ON TABLE project_db_credentials IS 
'Encrypted database credentials for project-specific PostgreSQL roles. Access restricted to platform role only.';

-- ============================================
-- CREATE UPDATE TRIGGER
-- ============================================

CREATE OR REPLACE FUNCTION update_project_db_credentials_updated_at()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = NOW();
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER trigger_update_project_db_credentials_updated_at
BEFORE UPDATE ON project_db_credentials
FOR EACH ROW
EXECUTE FUNCTION update_project_db_credentials_updated_at();
