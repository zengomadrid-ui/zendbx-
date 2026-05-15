# Installation Guide

## Prerequisites

### 1. Python 3.9+
```bash
python --version  # Should be 3.9 or higher
```

### 2. PostgreSQL Client Tools
ZenDBX requires `pg_dump` and `psql` for backup/restore operations.

**macOS:**
```bash
brew install postgresql
```

**Ubuntu/Debian:**
```bash
sudo apt-get install postgresql-client
```

**Windows:**
Download from [PostgreSQL official site](https://www.postgresql.org/download/windows/)

### 3. PostgreSQL Database
You need access to a PostgreSQL database (local or remote).

## Installation Methods

### Method 1: From PyPI (Recommended)
```bash
pip install zendbx
```

### Method 2: From Source
```bash
git clone https://github.com/zendbx/cli.git
cd cli
pip install -e .
```

### Method 3: Development Installation
```bash
git clone https://github.com/zendbx/cli.git
cd cli
pip install -e ".[dev]"
```

## Verify Installation

```bash
zendbx --version
```

You should see:
```
ZenDBX CLI v0.1.0
AI-powered PostgreSQL operations tool
```

## Initial Setup

### 1. Initialize Configuration
```bash
zendbx init
```

### 2. Test Connection
```bash
zendbx connect
```

### 3. Check Status
```bash
zendbx status
```

## Troubleshooting

### Command not found
If `zendbx` command is not found, ensure pip's bin directory is in your PATH:

```bash
# Add to ~/.bashrc or ~/.zshrc
export PATH="$HOME/.local/bin:$PATH"
```

### pg_dump not found
Install PostgreSQL client tools (see Prerequisites above).

### Connection refused
- Check PostgreSQL is running
- Verify host and port in configuration
- Check firewall settings

## Upgrading

```bash
pip install --upgrade zendbx
```

## Uninstallation

```bash
pip uninstall zendbx
```

Configuration files in `~/.zendbx/` will remain. Delete manually if needed.
