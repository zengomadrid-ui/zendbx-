# ZenDBX CLI - Quick Start Guide

Get started with ZenDBX in 5 minutes.

## Installation

```bash
pip install zendbx
```

## Setup

### 1. Initialize Configuration

```bash
zendbx init
```

Follow the prompts to enter your database details.

### 2. Test Connection

```bash
zendbx connect
```

## Your First Fix

```bash
zendbx db fix "SELECT name FORM users"
```

ZenDBX will automatically detect the typo and suggest the fix.

## Common Workflows

### Daily Health Check
```bash
zendbx status
zendbx db analyze
```

### Create Backup
```bash
zendbx db dump
```

### Fix and Execute
```bash
zendbx db fix "SELECT * FROM user WHERE id == 1" --execute
```

## Next Steps

- Read the [Command Reference](COMMANDS.md)
- Learn about [Configuration](CONFIGURATION.md)
- Explore [SQL Auto-Fix](AUTOFIX.md)
