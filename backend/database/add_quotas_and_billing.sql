-- =====================================================
-- ZENDBX - Usage Quotas & Billing System
-- =====================================================
-- This migration adds subscription plans, usage tracking,
-- and quota enforcement for SaaS monetization
-- =====================================================

-- Enable UUID extension if not already enabled
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- =====================================================
-- Table 1: Subscription Plans
-- =====================================================
CREATE TABLE IF NOT EXISTS subscription_plans (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    name VARCHAR(50) NOT NULL UNIQUE,
    display_name VARCHAR(100) NOT NULL,
    description TEXT,
    price_monthly DECIMAL(10,2) NOT NULL,
    price_yearly DECIMAL(10,2),
    
    -- Quota Limits
    api_requests_limit INTEGER NOT NULL,
    database_size_limit BIGINT NOT NULL, -- in bytes
    projects_limit INTEGER NOT NULL,
    team_members_limit INTEGER NOT NULL,
    backup_frequency VARCHAR(20) NOT NULL, -- hourly, daily, weekly, manual
    
    -- Features
    features JSONB DEFAULT '[]'::jsonb,
    
    -- Metadata
    is_active BOOLEAN DEFAULT true,
    sort_order INTEGER DEFAULT 0,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- =====================================================
-- Table 2: User Subscriptions
-- =====================================================
CREATE TABLE IF NOT EXISTS user_subscriptions (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    plan_id UUID NOT NULL REFERENCES subscription_plans(id),
    
    -- Subscription Status
    status VARCHAR(20) DEFAULT 'active', -- active, cancelled, expired, past_due
    
    -- Billing Period
    current_period_start TIMESTAMP WITH TIME ZONE NOT NULL,
    current_period_end TIMESTAMP WITH TIME ZONE NOT NULL,
    
    -- Payment Info (for future Stripe integration)
    stripe_subscription_id VARCHAR(255),
    stripe_customer_id VARCHAR(255),
    
    -- Metadata
    cancelled_at TIMESTAMP WITH TIME ZONE,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    
    UNIQUE(user_id)
);

-- =====================================================
-- Table 3: Usage Tracking
-- =====================================================
CREATE TABLE IF NOT EXISTS usage_tracking (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    
    -- Tracking Period
    period_start TIMESTAMP WITH TIME ZONE NOT NULL,
    period_end TIMESTAMP WITH TIME ZONE NOT NULL,
    
    -- Usage Counters
    api_requests_count INTEGER DEFAULT 0,
    database_size_bytes BIGINT DEFAULT 0,
    projects_count INTEGER DEFAULT 0,
    team_members_count INTEGER DEFAULT 0,
    
    -- Reset Tracking
    last_reset_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    
    -- Metadata
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    
    UNIQUE(user_id, period_start)
);

-- =====================================================
-- Table 4: Usage Logs
-- =====================================================
CREATE TABLE IF NOT EXISTS usage_logs (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    
    -- Resource Info
    resource_type VARCHAR(50) NOT NULL, -- api_request, database, project, team_member
    action VARCHAR(50) NOT NULL, -- increment, decrement, check, reset
    amount INTEGER DEFAULT 1,
    
    -- Context
    endpoint VARCHAR(255),
    project_id UUID,
    metadata JSONB DEFAULT '{}'::jsonb,
    
    -- Timestamp
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- =====================================================
-- Indexes for Performance
-- =====================================================

-- User Subscriptions
CREATE INDEX IF NOT EXISTS idx_user_subscriptions_user_id ON user_subscriptions(user_id);
CREATE INDEX IF NOT EXISTS idx_user_subscriptions_status ON user_subscriptions(status);
CREATE INDEX IF NOT EXISTS idx_user_subscriptions_period ON user_subscriptions(current_period_start, current_period_end);

-- Usage Tracking
CREATE INDEX IF NOT EXISTS idx_usage_tracking_user_id ON usage_tracking(user_id);
CREATE INDEX IF NOT EXISTS idx_usage_tracking_period ON usage_tracking(period_start, period_end);
CREATE INDEX IF NOT EXISTS idx_usage_tracking_user_period ON usage_tracking(user_id, period_start);

-- Usage Logs
CREATE INDEX IF NOT EXISTS idx_usage_logs_user_id ON usage_logs(user_id);
CREATE INDEX IF NOT EXISTS idx_usage_logs_resource_type ON usage_logs(resource_type);
CREATE INDEX IF NOT EXISTS idx_usage_logs_created_at ON usage_logs(created_at);
CREATE INDEX IF NOT EXISTS idx_usage_logs_user_resource ON usage_logs(user_id, resource_type, created_at);

-- =====================================================
-- Insert Default Subscription Plans
-- =====================================================

-- Free Plan
INSERT INTO subscription_plans (
    name, display_name, description, price_monthly, price_yearly,
    api_requests_limit, database_size_limit, projects_limit, 
    team_members_limit, backup_frequency, features, sort_order
) VALUES (
    'free',
    'Free Plan',
    'Perfect for getting started with Zendbx',
    0.00,
    0.00,
    10000, -- 10k API requests/month
    524288000, -- 500 MB in bytes
    1, -- 1 project
    1, -- 1 team member
    'manual', -- Manual backups only
    '["Basic SQL Editor", "Manual Backups", "Community Support", "1 Project"]'::jsonb,
    1
) ON CONFLICT (name) DO NOTHING;

-- Pro Plan
INSERT INTO subscription_plans (
    name, display_name, description, price_monthly, price_yearly,
    api_requests_limit, database_size_limit, projects_limit, 
    team_members_limit, backup_frequency, features, sort_order
) VALUES (
    'pro',
    'Pro Plan',
    'For professional developers and small teams',
    29.00,
    290.00, -- ~17% discount for yearly
    100000, -- 100k API requests/month
    10737418240, -- 10 GB in bytes
    10, -- 10 projects
    5, -- 5 team members
    'daily', -- Daily automated backups
    '["Everything in Free", "10 Projects", "5 Team Members", "Daily Backups", "AI-Powered SQL", "Priority Support", "Advanced Analytics"]'::jsonb,
    2
) ON CONFLICT (name) DO NOTHING;

-- Business Plan
INSERT INTO subscription_plans (
    name, display_name, description, price_monthly, price_yearly,
    api_requests_limit, database_size_limit, projects_limit, 
    team_members_limit, backup_frequency, features, sort_order
) VALUES (
    'business',
    'Business Plan',
    'For growing businesses and large teams',
    99.00,
    990.00, -- ~17% discount for yearly
    1000000, -- 1M API requests/month
    107374182400, -- 100 GB in bytes
    999, -- Unlimited projects (soft limit)
    999, -- Unlimited team members (soft limit)
    'hourly', -- Hourly automated backups
    '["Everything in Pro", "Unlimited Projects", "Unlimited Team Members", "Hourly Backups", "Custom Integrations", "Dedicated Support", "SLA Guarantee", "Advanced Security"]'::jsonb,
    3
) ON CONFLICT (name) DO NOTHING;

-- =====================================================
-- Function: Get Current Month Period
-- =====================================================
CREATE OR REPLACE FUNCTION get_current_month_period()
RETURNS TABLE(period_start TIMESTAMP WITH TIME ZONE, period_end TIMESTAMP WITH TIME ZONE)
LANGUAGE plpgsql
AS $$
BEGIN
    RETURN QUERY
    SELECT 
        date_trunc('month', NOW())::TIMESTAMP WITH TIME ZONE,
        (date_trunc('month', NOW()) + INTERVAL '1 month')::TIMESTAMP WITH TIME ZONE;
END;
$$;

-- =====================================================
-- Function: Initialize Usage Tracking for User
-- =====================================================
CREATE OR REPLACE FUNCTION initialize_usage_tracking(p_user_id UUID)
RETURNS UUID
LANGUAGE plpgsql
AS $$
DECLARE
    v_period_start TIMESTAMP WITH TIME ZONE;
    v_period_end TIMESTAMP WITH TIME ZONE;
    v_usage_id UUID;
BEGIN
    -- Get current month period
    SELECT * INTO v_period_start, v_period_end FROM get_current_month_period();
    
    -- Insert or get existing usage tracking
    INSERT INTO usage_tracking (
        user_id, period_start, period_end,
        api_requests_count, database_size_bytes, 
        projects_count, team_members_count
    ) VALUES (
        p_user_id, v_period_start, v_period_end,
        0, 0, 0, 0
    )
    ON CONFLICT (user_id, period_start) 
    DO UPDATE SET updated_at = NOW()
    RETURNING id INTO v_usage_id;
    
    RETURN v_usage_id;
END;
$$;

-- =====================================================
-- Function: Assign Free Plan to New Users
-- =====================================================
CREATE OR REPLACE FUNCTION assign_free_plan_to_new_user()
RETURNS TRIGGER
LANGUAGE plpgsql
AS $$
DECLARE
    v_free_plan_id UUID;
    v_period_start TIMESTAMP WITH TIME ZONE;
    v_period_end TIMESTAMP WITH TIME ZONE;
BEGIN
    -- Get free plan ID
    SELECT id INTO v_free_plan_id 
    FROM subscription_plans 
    WHERE name = 'free' 
    LIMIT 1;
    
    -- Get current month period
    SELECT * INTO v_period_start, v_period_end FROM get_current_month_period();
    
    -- Assign free plan to new user
    INSERT INTO user_subscriptions (
        user_id, plan_id, status,
        current_period_start, current_period_end
    ) VALUES (
        NEW.id, v_free_plan_id, 'active',
        v_period_start, v_period_end
    );
    
    -- Initialize usage tracking
    PERFORM initialize_usage_tracking(NEW.id);
    
    RETURN NEW;
END;
$$;

-- =====================================================
-- Trigger: Auto-assign Free Plan to New Users
-- =====================================================
DROP TRIGGER IF EXISTS trigger_assign_free_plan ON users;
CREATE TRIGGER trigger_assign_free_plan
    AFTER INSERT ON users
    FOR EACH ROW
    EXECUTE FUNCTION assign_free_plan_to_new_user();

-- =====================================================
-- Migrate Existing Users to Free Plan
-- =====================================================
DO $$
DECLARE
    v_free_plan_id UUID;
    v_period_start TIMESTAMP WITH TIME ZONE;
    v_period_end TIMESTAMP WITH TIME ZONE;
    v_user RECORD;
BEGIN
    -- Get free plan ID
    SELECT id INTO v_free_plan_id 
    FROM subscription_plans 
    WHERE name = 'free' 
    LIMIT 1;
    
    -- Get current month period
    SELECT * INTO v_period_start, v_period_end FROM get_current_month_period();
    
    -- Assign free plan to all existing users without a subscription
    FOR v_user IN 
        SELECT id FROM users 
        WHERE id NOT IN (SELECT user_id FROM user_subscriptions)
    LOOP
        -- Assign free plan
        INSERT INTO user_subscriptions (
            user_id, plan_id, status,
            current_period_start, current_period_end
        ) VALUES (
            v_user.id, v_free_plan_id, 'active',
            v_period_start, v_period_end
        ) ON CONFLICT (user_id) DO NOTHING;
        
        -- Initialize usage tracking
        PERFORM initialize_usage_tracking(v_user.id);
    END LOOP;
END $$;

-- =====================================================
-- Success Message
-- =====================================================
DO $$
BEGIN
    RAISE NOTICE '✅ Quotas and Billing system installed successfully!';
    RAISE NOTICE '📊 3 subscription plans created: Free, Pro, Business';
    RAISE NOTICE '👥 All existing users assigned to Free plan';
    RAISE NOTICE '📈 Usage tracking initialized for all users';
END $$;
