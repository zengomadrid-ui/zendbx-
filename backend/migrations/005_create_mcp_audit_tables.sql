-- Migration 005: Create MCP Audit Tables
-- Creates tables for logging MCP requests, tool executions, and errors

-- MCP Audit Logs Table
-- Tracks all MCP requests with performance metrics
CREATE TABLE IF NOT EXISTS mcp_audit_logs (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    project_id UUID NOT NULL REFERENCES projects(id) ON DELETE CASCADE,
    user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    endpoint TEXT NOT NULL,
    method VARCHAR(10) NOT NULL,
    status_code INTEGER NOT NULL,
    execution_time_ms INTEGER NOT NULL,
    tool_name TEXT,
    error TEXT,
    metadata JSONB DEFAULT '{}',
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Indexes for efficient querying
CREATE INDEX IF NOT EXISTS idx_mcp_audit_logs_project_id ON mcp_audit_logs(project_id);
CREATE INDEX IF NOT EXISTS idx_mcp_audit_logs_user_id ON mcp_audit_logs(user_id);
CREATE INDEX IF NOT EXISTS idx_mcp_audit_logs_created_at ON mcp_audit_logs(created_at DESC);
CREATE INDEX IF NOT EXISTS idx_mcp_audit_logs_tool_name ON mcp_audit_logs(tool_name) WHERE tool_name IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_mcp_audit_logs_status_code ON mcp_audit_logs(status_code);

-- MCP Tool Executions Table
-- Detailed tracking of tool executions
CREATE TABLE IF NOT EXISTS mcp_tool_executions (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    project_id UUID NOT NULL REFERENCES projects(id) ON DELETE CASCADE,
    user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    tool_name TEXT NOT NULL,
    parameters JSONB DEFAULT '{}',
    success BOOLEAN NOT NULL,
    execution_time_ms INTEGER NOT NULL,
    error TEXT,
    result_size INTEGER,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Indexes for tool executions
CREATE INDEX IF NOT EXISTS idx_mcp_tool_executions_project_id ON mcp_tool_executions(project_id);
CREATE INDEX IF NOT EXISTS idx_mcp_tool_executions_user_id ON mcp_tool_executions(user_id);
CREATE INDEX IF NOT EXISTS idx_mcp_tool_executions_tool_name ON mcp_tool_executions(tool_name);
CREATE INDEX IF NOT EXISTS idx_mcp_tool_executions_created_at ON mcp_tool_executions(created_at DESC);
CREATE INDEX IF NOT EXISTS idx_mcp_tool_executions_success ON mcp_tool_executions(success);

-- MCP Errors Table
-- Centralized error logging for MCP operations
CREATE TABLE IF NOT EXISTS mcp_errors (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    project_id UUID REFERENCES projects(id) ON DELETE CASCADE,
    user_id UUID REFERENCES users(id) ON DELETE CASCADE,
    error_type TEXT NOT NULL,
    error_message TEXT NOT NULL,
    stack_trace TEXT,
    metadata JSONB DEFAULT '{}',
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Indexes for error tracking
CREATE INDEX IF NOT EXISTS idx_mcp_errors_project_id ON mcp_errors(project_id) WHERE project_id IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_mcp_errors_user_id ON mcp_errors(user_id) WHERE user_id IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_mcp_errors_error_type ON mcp_errors(error_type);
CREATE INDEX IF NOT EXISTS idx_mcp_errors_created_at ON mcp_errors(created_at DESC);

-- Add comments for documentation
COMMENT ON TABLE mcp_audit_logs IS 'Audit log for all MCP requests with performance metrics';
COMMENT ON TABLE mcp_tool_executions IS 'Detailed tracking of MCP tool executions';
COMMENT ON TABLE mcp_errors IS 'Centralized error logging for MCP operations';

COMMENT ON COLUMN mcp_audit_logs.execution_time_ms IS 'Request execution time in milliseconds';
COMMENT ON COLUMN mcp_audit_logs.tool_name IS 'Name of the tool executed (if applicable)';
COMMENT ON COLUMN mcp_audit_logs.metadata IS 'Additional request metadata as JSON';

COMMENT ON COLUMN mcp_tool_executions.parameters IS 'Tool execution parameters as JSON';
COMMENT ON COLUMN mcp_tool_executions.result_size IS 'Size of execution result in bytes';

COMMENT ON COLUMN mcp_errors.error_type IS 'Error category or type';
COMMENT ON COLUMN mcp_errors.stack_trace IS 'Full error stack trace for debugging';
