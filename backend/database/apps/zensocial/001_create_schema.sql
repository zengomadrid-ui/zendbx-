-- ============================================
-- ZenSocial Application Schema
-- ============================================
-- Official schema for ZenSocial AI-powered social media campaign management
-- This migration should be applied to project schemas, not the main database
-- 
-- Usage:
--   Apply to specific project: psql -d proj_xxxxxxxx -f 001_create_schema.sql
--   Or use the migration helper script
--
-- Created: 2026-07-08
-- ============================================

-- ============================================
-- TABLE: websites
-- ============================================
-- Stores website/brand information for campaigns
CREATE TABLE IF NOT EXISTS websites (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID NOT NULL,
    name TEXT NOT NULL,
    url TEXT,
    description TEXT,
    logo_url TEXT,
    industry TEXT,
    target_audience TEXT,
    brand_voice TEXT,
    metadata JSONB DEFAULT '{}'::jsonb,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_websites_user_id ON websites(user_id);
CREATE INDEX IF NOT EXISTS idx_websites_created_at ON websites(created_at DESC);

COMMENT ON TABLE websites IS 'ZenSocial: Website/brand profiles for social media campaigns';

-- ============================================
-- TABLE: campaigns  
-- ============================================
-- Main campaigns table with all required fields
CREATE TABLE IF NOT EXISTS campaigns (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID NOT NULL,
    website_id UUID REFERENCES websites(id) ON DELETE CASCADE,
    
    -- Basic info
    name TEXT NOT NULL,
    goal TEXT,
    duration_days INTEGER DEFAULT 30,
    
    -- Target configuration
    platforms JSONB DEFAULT '[]'::jsonb,
    target_audience TEXT,
    tone TEXT,
    content_themes JSONB DEFAULT '[]'::jsonb,
    
    -- AI configuration
    ai_prompt TEXT,
    
    -- Status and metrics
    status TEXT DEFAULT 'draft',
    total_posts INTEGER DEFAULT 0,
    approved_posts INTEGER DEFAULT 0,
    published_posts INTEGER DEFAULT 0,
    
    -- Schedule
    start_date DATE,
    end_date DATE,
    
    -- Timestamps
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW(),
    
    -- Constraints
    CONSTRAINT campaigns_status_check CHECK (status IN ('draft', 'active', 'paused', 'completed', 'archived'))
);

CREATE INDEX IF NOT EXISTS idx_campaigns_user_id ON campaigns(user_id);
CREATE INDEX IF NOT EXISTS idx_campaigns_website_id ON campaigns(website_id);
CREATE INDEX IF NOT EXISTS idx_campaigns_status ON campaigns(status);
CREATE INDEX IF NOT EXISTS idx_campaigns_dates ON campaigns(start_date, end_date);
CREATE INDEX IF NOT EXISTS idx_campaigns_created_at ON campaigns(created_at DESC);

-- GIN indexes for JSONB columns
CREATE INDEX IF NOT EXISTS idx_campaigns_platforms ON campaigns USING GIN(platforms);
CREATE INDEX IF NOT EXISTS idx_campaigns_content_themes ON campaigns USING GIN(content_themes);

COMMENT ON TABLE campaigns IS 'ZenSocial: Social media campaigns with AI-powered content generation';
COMMENT ON COLUMN campaigns.platforms IS 'Array of target platforms: ["linkedin", "twitter", "facebook", etc.]';
COMMENT ON COLUMN campaigns.content_themes IS 'Array of content themes/topics for AI generation';
COMMENT ON COLUMN campaigns.goal IS 'Campaign objective (e.g., "increase brand awareness", "drive traffic")';

-- ============================================
-- TABLE: posts
-- ============================================
-- Generated posts for campaigns
CREATE TABLE IF NOT EXISTS posts (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    campaign_id UUID NOT NULL REFERENCES campaigns(id) ON DELETE CASCADE,
    user_id UUID NOT NULL,
    
    -- Content
    platform TEXT NOT NULL,
    content TEXT NOT NULL,
    media_urls JSONB DEFAULT '[]'::jsonb,
    hashtags JSONB DEFAULT '[]'::jsonb,
    
    -- AI metadata
    ai_generated BOOLEAN DEFAULT TRUE,
    generation_prompt TEXT,
    
    -- Status
    status TEXT DEFAULT 'draft',
    approved_at TIMESTAMPTZ,
    published_at TIMESTAMPTZ,
    
    -- Scheduling
    scheduled_for TIMESTAMPTZ,
    
    -- Engagement metrics (updated after publishing)
    likes_count INTEGER DEFAULT 0,
    comments_count INTEGER DEFAULT 0,
    shares_count INTEGER DEFAULT 0,
    impressions_count INTEGER DEFAULT 0,
    
    -- Timestamps
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW(),
    
    CONSTRAINT posts_status_check CHECK (status IN ('draft', 'approved', 'scheduled', 'published', 'failed'))
);

CREATE INDEX IF NOT EXISTS idx_posts_campaign_id ON posts(campaign_id);
CREATE INDEX IF NOT EXISTS idx_posts_user_id ON posts(user_id);
CREATE INDEX IF NOT EXISTS idx_posts_platform ON posts(platform);
CREATE INDEX IF NOT EXISTS idx_posts_status ON posts(status);
CREATE INDEX IF NOT EXISTS idx_posts_scheduled_for ON posts(scheduled_for) WHERE status = 'scheduled';
CREATE INDEX IF NOT EXISTS idx_posts_published_at ON posts(published_at DESC) WHERE status = 'published';

COMMENT ON TABLE posts IS 'ZenSocial: AI-generated social media posts for campaigns';

-- ============================================
-- TABLE: assets
-- ============================================
-- Media assets (images, videos) for posts
CREATE TABLE IF NOT EXISTS assets (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID NOT NULL,
    campaign_id UUID REFERENCES campaigns(id) ON DELETE CASCADE,
    
    -- File info
    filename TEXT NOT NULL,
    url TEXT NOT NULL,
    type TEXT NOT NULL,
    size_bytes INTEGER,
    mime_type TEXT,
    
    -- Dimensions (for images/videos)
    width INTEGER,
    height INTEGER,
    duration_seconds INTEGER,
    
    -- AI metadata
    ai_generated BOOLEAN DEFAULT FALSE,
    generation_prompt TEXT,
    
    -- Metadata
    tags JSONB DEFAULT '[]'::jsonb,
    metadata JSONB DEFAULT '{}'::jsonb,
    
    -- Timestamps
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW(),
    
    CONSTRAINT assets_type_check CHECK (type IN ('image', 'video', 'gif', 'document'))
);

CREATE INDEX IF NOT EXISTS idx_assets_user_id ON assets(user_id);
CREATE INDEX IF NOT EXISTS idx_assets_campaign_id ON assets(campaign_id);
CREATE INDEX IF NOT EXISTS idx_assets_type ON assets(type);
CREATE INDEX IF NOT EXISTS idx_assets_created_at ON assets(created_at DESC);

COMMENT ON TABLE assets IS 'ZenSocial: Media assets and files for social media posts';

-- ============================================
-- TABLE: analytics
-- ============================================
-- Track campaign and post performance
CREATE TABLE IF NOT EXISTS analytics (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    campaign_id UUID REFERENCES campaigns(id) ON DELETE CASCADE,
    post_id UUID REFERENCES posts(id) ON DELETE CASCADE,
    
    -- Metrics
    date DATE NOT NULL,
    platform TEXT,
    
    impressions INTEGER DEFAULT 0,
    clicks INTEGER DEFAULT 0,
    likes INTEGER DEFAULT 0,
    comments INTEGER DEFAULT 0,
    shares INTEGER DEFAULT 0,
    saves INTEGER DEFAULT 0,
    
    -- Engagement rate
    engagement_rate NUMERIC(5,2),
    
    -- Metadata
    raw_data JSONB DEFAULT '{}'::jsonb,
    
    created_at TIMESTAMPTZ DEFAULT NOW(),
    
    CONSTRAINT analytics_campaign_or_post CHECK (
        (campaign_id IS NOT NULL AND post_id IS NULL) OR 
        (campaign_id IS NULL AND post_id IS NOT NULL)
    )
);

CREATE INDEX IF NOT EXISTS idx_analytics_campaign_id ON analytics(campaign_id, date DESC);
CREATE INDEX IF NOT EXISTS idx_analytics_post_id ON analytics(post_id, date DESC);
CREATE INDEX IF NOT EXISTS idx_analytics_platform ON analytics(platform);

COMMENT ON TABLE analytics IS 'ZenSocial: Performance analytics for campaigns and posts';

-- ============================================
-- TRIGGERS
-- ============================================

-- Auto-update updated_at on campaigns
CREATE OR REPLACE FUNCTION update_campaigns_updated_at()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = NOW();
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trigger_campaigns_updated_at ON campaigns;
CREATE TRIGGER trigger_campaigns_updated_at
    BEFORE UPDATE ON campaigns
    FOR EACH ROW
    EXECUTE FUNCTION update_campaigns_updated_at();

-- Auto-update updated_at on posts
CREATE OR REPLACE FUNCTION update_posts_updated_at()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = NOW();
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trigger_posts_updated_at ON posts;
CREATE TRIGGER trigger_posts_updated_at
    BEFORE UPDATE ON posts
    FOR EACH ROW
    EXECUTE FUNCTION update_posts_updated_at();

-- Auto-update campaign post counts
CREATE OR REPLACE FUNCTION update_campaign_post_counts()
RETURNS TRIGGER AS $$
BEGIN
    IF TG_OP = 'INSERT' THEN
        UPDATE campaigns SET
            total_posts = total_posts + 1,
            approved_posts = approved_posts + (CASE WHEN NEW.status IN ('approved', 'scheduled', 'published') THEN 1 ELSE 0 END),
            published_posts = published_posts + (CASE WHEN NEW.status = 'published' THEN 1 ELSE 0 END)
        WHERE id = NEW.campaign_id;
    ELSIF TG_OP = 'UPDATE' THEN
        -- Recalculate counts when status changes
        IF OLD.status != NEW.status THEN
            UPDATE campaigns SET
                approved_posts = (
                    SELECT COUNT(*) FROM posts 
                    WHERE campaign_id = NEW.campaign_id 
                    AND status IN ('approved', 'scheduled', 'published')
                ),
                published_posts = (
                    SELECT COUNT(*) FROM posts 
                    WHERE campaign_id = NEW.campaign_id 
                    AND status = 'published'
                )
            WHERE id = NEW.campaign_id;
        END IF;
    ELSIF TG_OP = 'DELETE' THEN
        UPDATE campaigns SET
            total_posts = total_posts - 1,
            approved_posts = approved_posts - (CASE WHEN OLD.status IN ('approved', 'scheduled', 'published') THEN 1 ELSE 0 END),
            published_posts = published_posts - (CASE WHEN OLD.status = 'published' THEN 1 ELSE 0 END)
        WHERE id = OLD.campaign_id;
    END IF;
    
    IF TG_OP = 'DELETE' THEN
        RETURN OLD;
    ELSE
        RETURN NEW;
    END IF;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trigger_update_campaign_counts ON posts;
CREATE TRIGGER trigger_update_campaign_counts
    AFTER INSERT OR UPDATE OR DELETE ON posts
    FOR EACH ROW
    EXECUTE FUNCTION update_campaign_post_counts();

-- ============================================
-- SUCCESS MESSAGE
-- ============================================
DO $$
BEGIN
    RAISE NOTICE '✅ ZenSocial schema created successfully';
    RAISE NOTICE '   Tables: websites, campaigns, posts, assets, analytics';
    RAISE NOTICE '   Triggers: auto-update timestamps and campaign metrics';
    RAISE NOTICE '   Indexes: optimized for JSONB queries and common lookups';
END $$;
