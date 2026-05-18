# ZenDBX CLI - Complete Command Reference

## Installation

### Install ZenDBX CLI

```bash
# Navigate to CLI directory
cd zendbx-cli

# Install in development mode
pip install -e .

# Or install from PyPI (when published)
pip install zendbx
```

### Verify Installation

```bash
zendbx --version
zendbx --help
```

---

## Core Commands

### 1. Initialize Configuration

```bash
# Initialize ZenDBX configuration
zendbx init

# Initialize with custom config file
zendbx init --config ~/.zendbx/custom-config.json

# Initialize with API URL
zendbx init --api-url https://api.zendbx.in
```

**Interactive prompts:**
- API URL (default: http://localhost:8000)
- API Key
- Default project ID

---

### 2. Connect to ZenDBX

```bash
# Connect to ZenDBX API
zendbx connect

# Connect with specific API key
zendbx connect --api-key YOUR_API_KEY

# Connect to production
zendbx connect --api-url https://api.zendbx.in --api-key YOUR_API_KEY
```

---

### 3. Check Status

```bash
# Check connection status
zendbx status

# Check detailed status with project info
zendbx status --verbose

# Check specific project status
zendbx status --project PROJECT_ID
```

---

## Database Management Commands

### 4. Database Dump (Backup)

```bash
# Dump current project database
zendbx db:dump

# Dump to specific file
zendbx db:dump --output backup.sql

# Dump with compression
zendbx db:dump --output backup.sql.gz --compress

# Dump specific project
zendbx db:dump --project PROJECT_ID --output project-backup.sql

# Dump with timestamp
zendbx db:dump --output "backup-$(date +%Y%m%d-%H%M%S).sql"
```

---

### 5. Database Restore

```bash
# Restore from backup file
zendbx db:restore backup.sql

# Restore compressed backup
zendbx db:restore backup.sql.gz

# Restore to specific project
zendbx db:restore backup.sql --project PROJECT_ID

# Restore with confirmation prompt
zendbx db:restore backup.sql --confirm

# Force restore (skip confirmation)
zendbx db:restore backup.sql --force
```

---

### 6. Database Analysis

```bash
# Analyze database schema
zendbx db:analyze

# Analyze with detailed output
zendbx db:analyze --verbose

# Analyze specific tables
zendbx db:analyze --tables users,projects,sessions

# Export analysis to JSON
zendbx db:analyze --output analysis.json

# Analyze and show recommendations
zendbx db:analyze --recommendations
```

---

### 7. SQL Auto-Fix

```bash
# Fix SQL syntax errors
zendbx db:fix "SELECT * FROM users WHERE id = 1"

# Fix SQL from file
zendbx db:fix --file query.sql

# Fix and save to file
zendbx db:fix --file query.sql --output fixed-query.sql

# Fix with AI suggestions
zendbx db:fix "SELCT * FORM users" --ai

# Interactive fix mode
zendbx db:fix --interactive
```

---

## Project Management Commands

### 8. List Projects

```bash
# List all projects
zendbx projects

# List with details
zendbx projects --verbose

# List in JSON format
zendbx projects --json
```

---

### 9. Create Project

```bash
# Create new project
zendbx project:create "My Project"

# Create with slug
zendbx project:create "My Project" --slug my-project

# Create with description
zendbx project:create "My Project" --description "Production database"
```

---

### 10. Switch Project

```bash
# Switch to different project
zendbx project:use PROJECT_ID

# Switch by project slug
zendbx project:use --slug my-project
```

---

### 11. Delete Project

```bash
# Delete project
zendbx project:delete PROJECT_ID

# Delete with confirmation
zendbx project:delete PROJECT_ID --confirm

# Force delete (skip confirmation)
zendbx project:delete PROJECT_ID --force
```

---

## Query Execution Commands

### 12. Execute SQL Query

```bash
# Execute SQL query
zendbx query "SELECT * FROM users LIMIT 10"

# Execute from file
zendbx query --file query.sql

# Execute and save results
zendbx query "SELECT * FROM users" --output results.json

# Execute with formatting
zendbx query "SELECT * FROM users" --format table

# Execute with CSV output
zendbx query "SELECT * FROM users" --format csv --output users.csv
```

---

## Authentication Commands

### 13. Login

```bash
# Login to ZenDBX
zendbx login

# Login with email
zendbx login --email user@example.com

# Login to production
zendbx login --api-url https://api.zendbx.in
```

---

### 14. Logout

```bash
# Logout from ZenDBX
zendbx logout

# Clear all credentials
zendbx logout --clear-all
```

---

### 15. Get API Keys

```bash
# List API keys
zendbx keys

# Create new API key
zendbx keys:create "Production Key"

# Revoke API key
zendbx keys:revoke KEY_ID
```

---

## Advanced Commands

### 16. Schema Management

```bash
# Export schema
zendbx schema:export

# Export to file
zendbx schema:export --output schema.sql

# Import schema
zendbx schema:import schema.sql

# Compare schemas
zendbx schema:diff --source PROJECT_ID_1 --target PROJECT_ID_2
```

---

### 17. Migration Commands

```bash
# Create migration
zendbx migrate:create "add_users_table"

# Run migrations
zendbx migrate:up

# Rollback migration
zendbx migrate:down

# Check migration status
zendbx migrate:status
```

---

### 18. Realtime Monitoring

```bash
# Monitor database changes
zendbx monitor

# Monitor specific tables
zendbx monitor --tables users,sessions

# Monitor with filters
zendbx monitor --events INSERT,UPDATE
```

---

## Configuration Commands

### 19. Config Management

```bash
# Show current config
zendbx config

# Set config value
zendbx config:set api_url https://api.zendbx.in

# Get config value
zendbx config:get api_url

# Reset config
zendbx config:reset

# Edit config file
zendbx config:edit
```

---

## Utility Commands

### 20. Generate Client Code

```bash
# Generate JavaScript client
zendbx generate:client --language javascript --output zendbx-client.js

# Generate Python client
zendbx generate:client --language python --output zendbx_client.py

# Generate TypeScript client
zendbx generate:client --language typescript --output zendbx-client.ts
```

---

### 21. Health Check

```bash
# Check API health
zendbx health

# Check with detailed diagnostics
zendbx health --verbose

# Check specific services
zendbx health --services api,database,websocket
```

---

### 22. Logs

```bash
# View logs
zendbx logs

# Follow logs in real-time
zendbx logs --follow

# Filter logs by level
zendbx logs --level error

# View last N lines
zendbx logs --tail 100
```

---

## Production Deployment Commands

### Complete Production Setup

```bash
# 1. Install CLI
pip install -e zendbx-cli

# 2. Initialize for production
zendbx init --api-url https://api.zendbx.in

# 3. Login
zendbx login --email admin@zendbx.in

# 4. Create production project
zendbx project:create "Production" --slug production

# 5. Backup existing data
zendbx db:dump --output prod-backup-$(date +%Y%m%d).sql.gz --compress

# 6. Analyze database
zendbx db:analyze --recommendations

# 7. Monitor status
zendbx status --verbose
```

---

## Quick Reference Table

| Command | Description | Example |
|---------|-------------|---------|
| `zendbx init` | Initialize configuration | `zendbx init` |
| `zendbx connect` | Connect to API | `zendbx connect --api-key KEY` |
| `zendbx status` | Check status | `zendbx status` |
| `zendbx db:dump` | Backup database | `zendbx db:dump --output backup.sql` |
| `zendbx db:restore` | Restore database | `zendbx db:restore backup.sql` |
| `zendbx db:analyze` | Analyze database | `zendbx db:analyze --verbose` |
| `zendbx db:fix` | Fix SQL errors | `zendbx db:fix "SELECT * FROM users"` |
| `zendbx query` | Execute SQL | `zendbx query "SELECT * FROM users"` |
| `zendbx projects` | List projects | `zendbx projects` |
| `zendbx login` | Login to ZenDBX | `zendbx login` |

---

## Environment Variables

```bash
# Set ZenDBX environment variables
export ZENDBX_API_URL=https://api.zendbx.in
export ZENDBX_API_KEY=your-api-key
export ZENDBX_PROJECT_ID=your-project-id

# Use in commands
zendbx status
```

---

## Configuration File Location

```bash
# Default config location
~/.zendbx/config.json

# View config file
cat ~/.zendbx/config.json

# Edit config file
nano ~/.zendbx/config.json
```

---

## Common Workflows

### Daily Backup Workflow

```bash
#!/bin/bash
# daily-backup.sh

DATE=$(date +%Y%m%d)
zendbx db:dump --output "backups/backup-$DATE.sql.gz" --compress
zendbx db:analyze --output "reports/analysis-$DATE.json"
echo "Backup completed: backup-$DATE.sql.gz"
```

### Database Migration Workflow

```bash
# 1. Backup current state
zendbx db:dump --output pre-migration-backup.sql

# 2. Run migration
zendbx migrate:up

# 3. Verify migration
zendbx db:analyze

# 4. If issues, rollback
zendbx db:restore pre-migration-backup.sql
```

### Production Deployment Workflow

```bash
# 1. Test locally
zendbx connect --api-url http://localhost:8000
zendbx db:analyze

# 2. Backup production
zendbx connect --api-url https://api.zendbx.in
zendbx db:dump --output prod-backup.sql.gz --compress

# 3. Deploy changes
zendbx schema:import new-schema.sql

# 4. Verify
zendbx status --verbose
zendbx health
```

---

## Troubleshooting Commands

```bash
# Check connection
zendbx health

# View detailed logs
zendbx logs --level debug --tail 100

# Reset configuration
zendbx config:reset

# Verify API key
zendbx config:get api_key

# Test query execution
zendbx query "SELECT 1" --verbose
```

---

## Windows-Specific Commands

```cmd
REM Install CLI
pip install -e zendbx-cli

REM Initialize
zendbx init

REM Backup with Windows path
zendbx db:dump --output C:\backups\backup.sql

REM View config
type %USERPROFILE%\.zendbx\config.json
```

---

## Help Commands

```bash
# General help
zendbx --help

# Command-specific help
zendbx db:dump --help
zendbx db:restore --help
zendbx db:analyze --help
zendbx db:fix --help

# Show version
zendbx --version

# Show all available commands
zendbx commands
```
