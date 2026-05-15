-- Backup & Restore System Schema
-- This creates the tables needed for backup and restore functionality

-- Backups table: stores metadata about each backup
CREATE TABLE IF NOT EXISTS backups (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    project_id UUID NOT NULL REFERENCES projects(id) ON DELETE CASCADE,
    backup_name VARCHAR(255) NOT NULL,
    backup_type VARCHAR(50) NOT NULL, -- 'manual', 'scheduled', 'auto'
    status VARCHAR(50) NOT NULL DEFAULT 'pending', -- 'pending', 'in_progress', 'completed', 'failed'
    file_path TEXT,
    file_size BIGINT, -- in bytes
    compressed BOOLEAN DEFAULT true,
    created_by UUID REFERENCES users(id),
    created_at TIMESTAMP DEFAULT NOW(),
    completed_at TIMESTAMP,
    error_message TEXT,
    metadata JSONB -- stores additional info like table count, row count, etc.
);

-- Indexes for performance
CREATE INDEX IF NOT EXISTS idx_backups_project ON backups(project_id);
CREATE INDEX IF NOT EXISTS idx_backups_created_at ON backups(created_at DESC);
CREATE INDEX IF NOT EXISTS idx_backups_status ON backups(status);

-- Backup schedules table: stores automated backup configurations
CREATE TABLE IF NOT EXISTS backup_schedules (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    project_id UUID NOT NULL REFERENCES projects(id) ON DELETE CASCADE,
    schedule_name VARCHAR(255) NOT NULL,
    frequency VARCHAR(50) NOT NULL, -- 'hourly', 'daily', 'weekly', 'monthly'
    time_of_day TIME, -- for daily/weekly/monthly
    day_of_week INTEGER, -- 0-6 for weekly (0=Sunday)
    day_of_month INTEGER, -- 1-31 for monthly
    retention_days INTEGER DEFAULT 30, -- auto-delete backups older than this
    enabled BOOLEAN DEFAULT true,
    last_run_at TIMESTAMP,
    next_run_at TIMESTAMP,
    created_at TIMESTAMP DEFAULT NOW(),
    updated_at TIMESTAMP DEFAULT NOW()
);

-- Indexes for schedules
CREATE INDEX IF NOT EXISTS idx_backup_schedules_project ON backup_schedules(project_id);
CREATE INDEX IF NOT EXISTS idx_backup_schedules_next_run ON backup_schedules(next_run_at) WHERE enabled = true;
CREATE INDEX IF NOT EXISTS idx_backup_schedules_enabled ON backup_schedules(enabled);

-- Function to update updated_at timestamp
CREATE OR REPLACE FUNCTION update_backup_schedule_timestamp()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = NOW();
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Trigger to auto-update updated_at
CREATE TRIGGER backup_schedules_updated_at
    BEFORE UPDATE ON backup_schedules
    FOR EACH ROW
    EXECUTE FUNCTION update_backup_schedule_timestamp();

-- Comments for documentation
COMMENT ON TABLE backups IS 'Stores metadata about database backups';
COMMENT ON TABLE backup_schedules IS 'Stores automated backup schedule configurations';
COMMENT ON COLUMN backups.backup_type IS 'Type of backup: manual (user-initiated), scheduled (automated), auto (system-triggered)';
COMMENT ON COLUMN backups.status IS 'Current status: pending, in_progress, completed, failed';
COMMENT ON COLUMN backups.metadata IS 'JSON object with backup details like table_count, row_count, database_size';
COMMENT ON COLUMN backup_schedules.frequency IS 'Backup frequency: hourly, daily, weekly, monthly';
COMMENT ON COLUMN backup_schedules.retention_days IS 'Number of days to keep backups before auto-deletion';
