-- Migration 010: Create Data Visualizer Tables
-- Creates tables for storing dashboards and charts

-- Dashboard storage
CREATE TABLE IF NOT EXISTS visualizer_dashboards (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    project_id UUID NOT NULL REFERENCES projects(id) ON DELETE CASCADE,
    name VARCHAR(255) NOT NULL,
    description TEXT,
    created_by UUID NOT NULL REFERENCES users(id),
    created_at TIMESTAMP DEFAULT NOW(),
    updated_at TIMESTAMP DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_visualizer_dashboards_project ON visualizer_dashboards(project_id);
CREATE INDEX IF NOT EXISTS idx_visualizer_dashboards_created_by ON visualizer_dashboards(created_by);

-- Chart storage  
CREATE TABLE IF NOT EXISTS visualizer_charts (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    dashboard_id UUID REFERENCES visualizer_dashboards(id) ON DELETE CASCADE,
    project_id UUID NOT NULL REFERENCES projects(id) ON DELETE CASCADE,
    name VARCHAR(255) NOT NULL,
    chart_type VARCHAR(50) NOT NULL,
    configuration JSONB NOT NULL,
    position JSONB,
    created_at TIMESTAMP DEFAULT NOW(),
    updated_at TIMESTAMP DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_visualizer_charts_dashboard ON visualizer_charts(dashboard_id);
CREATE INDEX IF NOT EXISTS idx_visualizer_charts_project ON visualizer_charts(project_id);

-- Update trigger for dashboards
CREATE OR REPLACE FUNCTION update_visualizer_dashboards_updated_at()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = NOW();
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trigger_update_visualizer_dashboards_updated_at ON visualizer_dashboards;
CREATE TRIGGER trigger_update_visualizer_dashboards_updated_at
BEFORE UPDATE ON visualizer_dashboards
FOR EACH ROW
EXECUTE FUNCTION update_visualizer_dashboards_updated_at();

-- Update trigger for charts
CREATE OR REPLACE FUNCTION update_visualizer_charts_updated_at()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = NOW();
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trigger_update_visualizer_charts_updated_at ON visualizer_charts;
CREATE TRIGGER trigger_update_visualizer_charts_updated_at
BEFORE UPDATE ON visualizer_charts
FOR EACH ROW
EXECUTE FUNCTION update_visualizer_charts_updated_at();
