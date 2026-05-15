# ZenDBX CLI

> **Query fails → ZenDBX fixes it**

AI-powered PostgreSQL CLI for developers. Built for production workflows with a focus on SQL quality, database health, and developer productivity.

[![Python 3.9+](https://img.shields.io/badge/python-3.9+-blue.svg)](https://www.python.org/downloads/)
[![License: MIT](https://img.shields.io/badge/License-MIT-yellow.svg)](https://opensource.org/licenses/MIT)

## 🚀 Features

### 🔧 SQL Auto-Fix (Signature Feature)
Automatically detects and fixes common SQL errors:
- **Keyword typos**: `FORM` → `FROM`, `SLECT` → `SELECT`
- **Operator mistakes**: `==` → `=`, `!=` → `<>`
- **Quote issues**: Double quotes → single quotes for strings
- **Missing commas**: In CREATE TABLE and column lists
- **Schema errors**: Wrong table/column names with fuzzy matching

### 📊 Database Analysis
Comprehensive health checks:
- Table statistics and sizes
- Slow query detection
- Missing index suggestions
- Dead tuple analysis
- Cache hit ratio monitoring

### 💾 Backup & Restore
Production-grade backup management:
- Compressed backups with gzip
- Schema-only or data-only dumps
- Easy restore with safety confirmations
- Automatic timestamp naming

### ⚡ Developer Experience
- Beautiful terminal output with Rich
- Interactive and auto modes
- Comprehensive error messages
- Fast async operations
- Zero-config setup

## 📦 Installation

### From PyPI (Coming Soon)
```bash
pip install zendbx
```

### From Source
```bash
git clone https://github.com/zendbx/cli.git
cd cli
pip install -e .
```

### Requirements
- Python 3.9+
- PostgreSQL client tools (pg_dump, psql)
- PostgreSQL database (local or remote)

## 🎯 Quick Start

### 1. Initialize Configuration
```bash
zendbx init
```

This creates a configuration file with your database connection settings.

### 2. Test Connection
```bash
zendbx connect
```

### 3. Fix Your First SQL Query
```bash
zendbx db fix "SELECT name FORM users"
```

Output:
```
✓ Fix found! (TYPO, confidence: 95%)

Explanation: Fixed keyword typo: 'FORM' → 'FROM'

Changes:
  • 'FORM' → 'FROM'

┌─────────────── SQL Fix Comparison ───────────────┐
│ Before              │ After                      │
├─────────────────────┼────────────────────────────┤
│ SELECT name FORM    │ SELECT name FROM users     │
│ users               │                            │
└─────────────────────┴────────────────────────────┘

✓ Fixed SQL:
SELECT name FROM users
```

## 📖 Commands

### Core Commands

#### `zendbx init`
Initialize ZenDBX configuration
```bash
zendbx init              # Global configuration
zendbx init --local      # Project-specific configuration
zendbx init --force      # Overwrite existing config
```

#### `zendbx connect`
Test database connection
```bash
zendbx connect
```

#### `zendbx status`
Show database status and health
```bash
zendbx status
zendbx status --verbose
```

### Database Commands

#### `zendbx db fix` 🔧 (Signature Feature)
Fix broken SQL queries
```bash
# Basic fix
zendbx db fix "SELECT * FORM users"

# Fix and execute
zendbx db fix "SELECT * FROM user WHERE id == 1" --execute

# Auto-apply fix without confirmation
zendbx db fix "SELECT invalid_col FROM users" --auto

# Provide error message for better fixes
zendbx db fix "SELECT name FROM usr" --error "relation 'usr' does not exist"
```

**Options:**
- `--execute, -e`: Execute the fixed SQL
- `--auto, -a`: Apply fix without confirmation
- `--error`: Provide error message for context

#### `zendbx db analyze` 📊
Analyze database health and performance
```bash
# Full analysis
zendbx db analyze

# Skip slow queries
zendbx db analyze --no-slow-queries

# Only table stats
zendbx db analyze --no-indexes --no-slow-queries
```

**Options:**
- `--tables/--no-tables`: Show table statistics
- `--slow-queries/--no-slow-queries`: Show slow queries
- `--indexes/--no-indexes`: Suggest missing indexes

#### `zendbx db dump` 💾
Create database backup
```bash
# Default backup (compressed, timestamped)
zendbx db dump

# Custom output path
zendbx db dump --output my_backup.sql

# Schema only
zendbx db dump --schema-only

# Uncompressed backup
zendbx db dump --no-compress
```

**Options:**
- `--output, -o`: Output file path
- `--compress/--no-compress`: Compress with gzip
- `--schema-only`: Dump only schema
- `--data-only`: Dump only data

#### `zendbx db restore` ♻️
Restore database from backup
```bash
# Restore with confirmation
zendbx db restore backups/db_20240115_120000.sql.gz

# Force restore (skip confirmation)
zendbx db restore backup.sql --force

# Clean restore (drop existing objects)
zendbx db restore backup.sql --clean
```

**Options:**
- `--force, -f`: Skip confirmation
- `--clean`: Drop existing objects before restore

## ⚙️ Configuration

### Configuration Files

ZenDBX uses YAML configuration files:

- **Global**: `~/.zendbx/config.yaml`
- **Local**: `.zendbx/config.yaml` (project-specific)

### Configuration Structure

```yaml
database:
  host: localhost
  port: 5432
  database: mydb
  user: postgres
  password: secret  # Optional
  ssl_mode: prefer

preferences:
  autofix_mode: interactive  # interactive, auto, suggest
  output_format: rich        # rich, json, plain
  backup_path: ./backups
  log_level: INFO
  show_query_time: true
  max_rows_display: 100

api_endpoint: https://api.zendbx.com  # Optional
api_key: your_api_key                  # Optional
```

### Environment Variables

You can also use environment variables:

```bash
export ZENDBX_DATABASE_URL="postgresql://user:pass@localhost:5432/mydb"
```

## 🎨 Output Modes

### Rich (Default)
Beautiful terminal output with colors, tables, and syntax highlighting.

### JSON
Machine-readable output for scripting:
```bash
zendbx status --output json
```

### Plain
Simple text output for logs:
```bash
zendbx status --output plain
```

## 🔒 Security

- Passwords stored securely in config files
- Environment variable support for CI/CD
- Safety checks for destructive operations
- Confirmation prompts for dangerous commands
- No automatic execution of fixed SQL without explicit flag

## 🚀 Advanced Usage

### Scripting with ZenDBX

```bash
#!/bin/bash

# Daily backup script
zendbx db dump --output "backups/daily_$(date +%Y%m%d).sql.gz"

# Health check
zendbx status || echo "Database health check failed!"

# Auto-fix and execute queries
zendbx db fix "$QUERY" --auto --execute
```

### CI/CD Integration

```yaml
# .github/workflows/db-check.yml
- name: Check Database Health
  run: |
    zendbx connect
    zendbx db analyze
```

## 🛠️ Development

### Setup Development Environment

```bash
# Clone repository
git clone https://github.com/zendbx/cli.git
cd cli

# Install in development mode
pip install -e ".[dev]"

# Run tests
pytest

# Format code
black zendbx/
ruff check zendbx/
```

### Running Tests

```bash
# All tests
pytest

# With coverage
pytest --cov=zendbx

# Specific test
pytest tests/test_sql_fixer.py
```

## 📚 Documentation

- [Quick Start Guide](docs/QUICKSTART.md)
- [Command Reference](docs/COMMANDS.md)
- [Configuration Guide](docs/CONFIGURATION.md)
- [SQL Auto-Fix Guide](docs/AUTOFIX.md)

## 🤝 Contributing

Contributions are welcome! Please read our [Contributing Guide](CONTRIBUTING.md) for details.

## 📄 License

MIT License - see [LICENSE](LICENSE) file for details.

## 🔗 Links

- **Website**: https://zendbx.com
- **Documentation**: https://docs.zendbx.com
- **GitHub**: https://github.com/zendbx/cli
- **Issues**: https://github.com/zendbx/cli/issues

## 💬 Support

- **Discord**: https://discord.gg/zendbx
- **Email**: support@zendbx.com
- **Twitter**: [@zendbx](https://twitter.com/zendbx)

## 🌟 Why ZenDBX?

### vs Supabase CLI
- More focused on SQL quality and fixing
- Better autofix capabilities
- Deeper PostgreSQL analysis

### vs psql
- AI-powered error fixing
- Beautiful output
- Health monitoring
- Backup management

### vs pgAdmin
- Command-line first
- Scriptable and automatable
- Faster for common tasks
- Better for CI/CD

---

**Built with ❤️ by the ZenDBX team**

*Query fails → ZenDBX fixes it*
