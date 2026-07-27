-- Migration 004: Create Backup System Tables
-- Creates tables for backups and backup schedules

-- Backups table: stores metadata about database backups
CREATE TABLE IF NOT EXISTS backups (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    project_id UUID NOT NULL REFERENCES projects(id) ON DELETE CASCADE,
    backup_name TEXT NOT NULL,
    backup_type TEXT NOT NULL DEFAULT 'manual',
    status TEXT NOT NULL DEFAULT 'pending',
    file_path TEXT,
    file_size BIGINT,
    compressed BOOLEAN DEFAULT true,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    completed_at TIMESTAMPTZ,
    error_message TEXT,
    metadata JSONB,
    created_by UUID REFERENCES users(id) ON DELETE SET NULL
);

CREATE INDEX IF NOT EXISTS idx_backups_project ON backups(project_id);
CREATE INDEX IF NOT EXISTS idx_backups_status ON backups(status);
CREATE INDEX IF NOT EXISTS idx_backups_created_at ON backups(created_at DESC);

-- Backup schedules table: stores automated backup configurations
CREATE TABLE IF NOT EXISTS backup_schedules (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    project_id UUID NOT NULL REFERENCES projects(id) ON DELETE CASCADE,
    frequency TEXT NOT NULL,
    retention_days INTEGER NOT NULL DEFAULT 30,
    enabled BOOLEAN DEFAULT true,
    next_run_at TIMESTAMPTZ,
    last_run_at TIMESTAMPTZ,
    last_backup_status TEXT,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW(),
    UNIQUE(project_id)
);

CREATE INDEX IF NOT EXISTS idx_backup_schedules_project ON backup_schedules(project_id);
CREATE INDEX IF NOT EXISTS idx_backup_schedules_next_run ON backup_schedules(next_run_at) WHERE enabled = true;
CREATE INDEX IF NOT EXISTS idx_backup_schedules_enabled ON backup_schedules(enabled);

-- Comments for documentation
COMMENT ON TABLE backups IS 'Stores metadata about database backups';
COMMENT ON TABLE backup_schedules IS 'Stores automated backup schedule configurations';
COMMENT ON COLUMN backups.backup_type IS 'Type of backup: manual, scheduled, auto';
COMMENT ON COLUMN backups.status IS 'Current status: pending, in_progress, completed, failed';
COMMENT ON COLUMN backups.metadata IS 'JSON object with backup details like table_count, row_count, database_size';
COMMENT ON COLUMN backup_schedules.frequency IS 'Backup frequency: hourly, daily, weekly, monthly';
COMMENT ON COLUMN backup_schedules.retention_days IS 'Number of days to keep backups before auto-deletion';
