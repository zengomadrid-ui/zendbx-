-- =====================================================
-- TEAM COLLABORATION & CHAT SYSTEM
-- =====================================================
-- Multi-user collaboration with real-time chat
-- Fully integrated with RLS and existing auth system
-- =====================================================

-- Create auth schema if it doesn't exist
CREATE SCHEMA IF NOT EXISTS auth;

-- ============================================
-- AUTH HELPER FUNCTIONS (if not exist)
-- ============================================

-- Get current user ID from session variable
CREATE OR REPLACE FUNCTION auth.current_user_id()
RETURNS TEXT AS $$
BEGIN
    RETURN current_setting('app.current_user_id', true);
END;
$$ LANGUAGE plpgsql STABLE;

-- Check if current user has service_role
CREATE OR REPLACE FUNCTION auth.is_service_role()
RETURNS BOOLEAN AS $$
BEGIN
    RETURN current_setting('app.current_role', true) = 'service_role';
END;
$$ LANGUAGE plpgsql STABLE;

-- ============================================
-- 1. PROJECT MEMBERS TABLE
-- ============================================

CREATE TABLE IF NOT EXISTS project_members (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    project_id UUID NOT NULL REFERENCES projects(id) ON DELETE CASCADE,
    user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    role VARCHAR(20) NOT NULL CHECK (role IN ('admin', 'editor', 'viewer')),
    invited_by UUID REFERENCES users(id),
    joined_at TIMESTAMPTZ DEFAULT NOW(),
    last_active_at TIMESTAMPTZ DEFAULT NOW(),
    UNIQUE(project_id, user_id)
);

-- Indexes for performance
CREATE INDEX IF NOT EXISTS idx_project_members_project_id ON project_members(project_id);
CREATE INDEX IF NOT EXISTS idx_project_members_user_id ON project_members(user_id);
CREATE INDEX IF NOT EXISTS idx_project_members_role ON project_members(role);

COMMENT ON TABLE project_members IS 'Team members for each project with role-based access';
COMMENT ON COLUMN project_members.role IS 'admin: full access, editor: can edit, viewer: read-only';

-- ============================================
-- 2. PROJECT MESSAGES TABLE (CHAT)
-- ============================================

CREATE TABLE IF NOT EXISTS project_messages (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    project_id UUID NOT NULL REFERENCES projects(id) ON DELETE CASCADE,
    user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    content TEXT NOT NULL,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW(),
    is_deleted BOOLEAN DEFAULT FALSE
);

-- Indexes for performance
CREATE INDEX IF NOT EXISTS idx_project_messages_project_id ON project_messages(project_id);
CREATE INDEX IF NOT EXISTS idx_project_messages_user_id ON project_messages(user_id);
CREATE INDEX IF NOT EXISTS idx_project_messages_created_at ON project_messages(created_at DESC);

COMMENT ON TABLE project_messages IS 'Real-time chat messages within projects';

-- ============================================
-- 3. RLS POLICIES FOR PROJECT_MEMBERS
-- ============================================

-- Enable RLS
ALTER TABLE project_members ENABLE ROW LEVEL SECURITY;

-- Policy: Users can view members of projects they belong to
CREATE POLICY "Users can view project members they belong to"
ON project_members
FOR SELECT
USING (
    auth.is_service_role() OR
    EXISTS (
        SELECT 1 FROM project_members pm
        WHERE pm.project_id = project_members.project_id
        AND pm.user_id::TEXT = auth.current_user_id()
    )
);

-- Policy: Only project admins can add members
CREATE POLICY "Only admins can add project members"
ON project_members
FOR INSERT
WITH CHECK (
    auth.is_service_role() OR
    EXISTS (
        SELECT 1 FROM project_members pm
        WHERE pm.project_id = project_members.project_id
        AND pm.user_id::TEXT = auth.current_user_id()
        AND pm.role = 'admin'
    )
);

-- Policy: Only project admins can update member roles
CREATE POLICY "Only admins can update member roles"
ON project_members
FOR UPDATE
USING (
    auth.is_service_role() OR
    EXISTS (
        SELECT 1 FROM project_members pm
        WHERE pm.project_id = project_members.project_id
        AND pm.user_id::TEXT = auth.current_user_id()
        AND pm.role = 'admin'
    )
);

-- Policy: Only project admins can remove members
CREATE POLICY "Only admins can remove members"
ON project_members
FOR DELETE
USING (
    auth.is_service_role() OR
    EXISTS (
        SELECT 1 FROM project_members pm
        WHERE pm.project_id = project_members.project_id
        AND pm.user_id::TEXT = auth.current_user_id()
        AND pm.role = 'admin'
    )
);

-- ============================================
-- 4. RLS POLICIES FOR PROJECT_MESSAGES
-- ============================================

-- Enable RLS
ALTER TABLE project_messages ENABLE ROW LEVEL SECURITY;

-- Policy: Users can view messages in projects they belong to
CREATE POLICY "Users can view messages in their projects"
ON project_messages
FOR SELECT
USING (
    auth.is_service_role() OR
    EXISTS (
        SELECT 1 FROM project_members pm
        WHERE pm.project_id = project_messages.project_id
        AND pm.user_id::TEXT = auth.current_user_id()
    )
);

-- Policy: Users can send messages in projects they belong to (not viewers)
CREATE POLICY "Members can send messages in their projects"
ON project_messages
FOR INSERT
WITH CHECK (
    auth.is_service_role() OR
    EXISTS (
        SELECT 1 FROM project_members pm
        WHERE pm.project_id = project_messages.project_id
        AND pm.user_id::TEXT = auth.current_user_id()
        AND pm.role IN ('admin', 'editor')
    )
);

-- Policy: Users can update their own messages
CREATE POLICY "Users can update their own messages"
ON project_messages
FOR UPDATE
USING (
    auth.is_service_role() OR
    user_id::TEXT = auth.current_user_id()
);

-- Policy: Users can delete their own messages
CREATE POLICY "Users can delete their own messages"
ON project_messages
FOR DELETE
USING (
    auth.is_service_role() OR
    user_id::TEXT = auth.current_user_id()
);

-- ============================================
-- 5. HELPER FUNCTIONS
-- ============================================

-- Function to check if user is project member
CREATE OR REPLACE FUNCTION is_project_member(p_project_id UUID, p_user_id UUID)
RETURNS BOOLEAN AS $$
BEGIN
    RETURN EXISTS (
        SELECT 1 FROM project_members
        WHERE project_id = p_project_id
        AND user_id = p_user_id
    );
END;
$$ LANGUAGE plpgsql STABLE SECURITY DEFINER;

-- Function to get user's role in project
CREATE OR REPLACE FUNCTION get_project_role(p_project_id UUID, p_user_id UUID)
RETURNS VARCHAR AS $$
DECLARE
    user_role VARCHAR;
BEGIN
    SELECT role INTO user_role
    FROM project_members
    WHERE project_id = p_project_id
    AND user_id = p_user_id;
    
    RETURN user_role;
END;
$$ LANGUAGE plpgsql STABLE SECURITY DEFINER;

-- Function to check if user is project admin
CREATE OR REPLACE FUNCTION is_project_admin(p_project_id UUID, p_user_id UUID)
RETURNS BOOLEAN AS $$
BEGIN
    RETURN EXISTS (
        SELECT 1 FROM project_members
        WHERE project_id = p_project_id
        AND user_id = p_user_id
        AND role = 'admin'
    );
END;
$$ LANGUAGE plpgsql STABLE SECURITY DEFINER;

-- ============================================
-- 6. TRIGGERS FOR REALTIME
-- ============================================

-- Add realtime triggers to project_members
SELECT add_realtime_trigger('public', 'project_members');

-- Add realtime triggers to project_messages
SELECT add_realtime_trigger('public', 'project_messages');

-- ============================================
-- 7. AUTOMATIC PROJECT OWNER AS ADMIN
-- ============================================

-- Trigger to automatically add project creator as admin
CREATE OR REPLACE FUNCTION add_project_creator_as_admin()
RETURNS TRIGGER AS $$
BEGIN
    INSERT INTO project_members (project_id, user_id, role, invited_by)
    VALUES (NEW.id, NEW.user_id, 'admin', NEW.user_id);
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER trigger_add_project_creator
AFTER INSERT ON projects
FOR EACH ROW
EXECUTE FUNCTION add_project_creator_as_admin();

-- ============================================
-- 8. UPDATE LAST ACTIVE TIMESTAMP
-- ============================================

CREATE OR REPLACE FUNCTION update_member_last_active()
RETURNS TRIGGER AS $$
BEGIN
    UPDATE project_members
    SET last_active_at = NOW()
    WHERE project_id = NEW.project_id
    AND user_id = NEW.user_id;
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER trigger_update_last_active
AFTER INSERT ON project_messages
FOR EACH ROW
EXECUTE FUNCTION update_member_last_active();

-- ============================================
-- SUCCESS MESSAGE
-- ============================================

DO $$
BEGIN
    RAISE NOTICE '✅ Team collaboration system installed successfully!';
    RAISE NOTICE '📊 Tables created: project_members, project_messages';
    RAISE NOTICE '🔒 RLS policies enabled for security';
    RAISE NOTICE '⚡ Realtime triggers enabled';
    RAISE NOTICE '👥 Project creators automatically become admins';
END $$;
