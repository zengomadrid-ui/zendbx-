-- Rollback Migration 005: Drop MCP Audit Tables
-- Removes all MCP audit logging tables

-- Drop tables in reverse order (respecting foreign key constraints)
DROP TABLE IF EXISTS mcp_errors CASCADE;
DROP TABLE IF EXISTS mcp_tool_executions CASCADE;
DROP TABLE IF EXISTS mcp_audit_logs CASCADE;
