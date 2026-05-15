-- =====================================================
-- ZENDBX - Quota Override System
-- =====================================================
-- Admin controls for custom quotas and overrides
-- =====================================================

-- Enable UUID extension if not already enabled
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- =====================================================
-- Table: Quota Overrides
-- =====================================================
CREATE TABLE IF NOT EXISTS quota_overrides (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    
    -- Override Details
    resource_type VARCHAR(50) NOT NULL, -- api_requests, database_size, projects, team_members
    original_limit BIGINT NOT NULL,
    new_limit BIGINT NOT NULL,
    
    -- Metadata
    reason TEXT NOT NULL,
    created_by UUID NOT NULL REFERENCES users(id),
    expires_at TIMESTAMP WITH TIME ZONE,
    
    -- Timestamps
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- =====================================================
-- Indexes
-- =====================================================
CREATE INDEX IF NOT EXISTS idx_quota_overrides_user_id ON quota_overrides(user_id);
CREATE INDEX IF NOT EXISTS idx_quota_overrides_resource_type ON quota_overrides(resource_type);
CREATE INDEX IF NOT EXISTS idx_quota_overrides_expires_at ON quota_overrides(expires_at);

-- =====================================================
-- Function: Get Effective Quota Limit
-- =====================================================
CREATE OR REPLACE FUNCTION get_effective_quota_limit(
    p_user_id UUID,
    p_resource_type VARCHAR
)
RETURNS BIGINT
LANGUAGE plpgsql
AS $$
DECLARE
    v_plan_limit BIGINT;
    v_override_limit BIGINT;
BEGIN
    -- Get plan limit
    SELECT 
        CASE p_resource_type
            WHEN 'api_requests' THEN sp.api_requests_limit
            WHEN 'database_size' THEN sp.database_size_limit
            WHEN 'projects' THEN sp.projects_limit
            WHEN 'team_members' THEN sp.team_members_limit
            ELSE 0
        END INTO v_plan_limit
    FROM user_subscriptions us
    JOIN subscription_plans sp ON us.plan_id = sp.id
    WHERE us.user_id = p_user_id
    AND us.status = 'active'
    LIMIT 1;
    
    -- Check for active override
    SELECT new_limit INTO v_override_limit
    FROM quota_overrides
    WHERE user_id = p_user_id
    AND resource_type = p_resource_type
    AND (expires_at IS NULL OR expires_at > NOW())
    ORDER BY created_at DESC
    LIMIT 1;
    
    -- Return override if exists, otherwise plan limit
    RETURN COALESCE(v_override_limit, v_plan_limit, 0);
END;
$$;

-- =====================================================
-- Function: Clean Expired Overrides
-- =====================================================
CREATE OR REPLACE FUNCTION clean_expired_quota_overrides()
RETURNS INTEGER
LANGUAGE plpgsql
AS $$
DECLARE
    v_deleted_count INTEGER;
BEGIN
    DELETE FROM quota_overrides
    WHERE expires_at IS NOT NULL
    AND expires_at < NOW();
    
    GET DIAGNOSTICS v_deleted_count = ROW_COUNT;
    
    RETURN v_deleted_count;
END;
$$;

-- =====================================================
-- Trigger: Update timestamp on override changes
-- =====================================================
CREATE OR REPLACE FUNCTION update_quota_override_timestamp()
RETURNS TRIGGER
LANGUAGE plpgsql
AS $$
BEGIN
    NEW.updated_at = NOW();
    RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trigger_update_quota_override_timestamp ON quota_overrides;
CREATE TRIGGER trigger_update_quota_override_timestamp
    BEFORE UPDATE ON quota_overrides
    FOR EACH ROW
    EXECUTE FUNCTION update_quota_override_timestamp();

-- =====================================================
-- Success Message
-- =====================================================
DO $$
BEGIN
    RAISE NOTICE '✅ Quota override system installed successfully!';
    RAISE NOTICE '🔧 Admins can now create custom quota limits';
    RAISE NOTICE '⏰ Temporary overrides with expiration supported';
    RAISE NOTICE '📝 Full audit trail for all override actions';
END $$;
