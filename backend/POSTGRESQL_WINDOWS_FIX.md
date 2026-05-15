# PostgreSQL Windows Connection Issues - Permanent Fix

## Problem
Windows + PostgreSQL + asyncpg has known connection stability issues causing:
- "Connection refused" errors
- "Could not fork new process" errors  
- Connection pool exhaustion

## Root Causes
1. **Windows Process Limits**: PostgreSQL on Windows has lower process forking limits
2. **Connection Accumulation**: Idle connections not being cleaned up properly
3. **asyncpg + Windows**: Known compatibility issues with connection pooling

## Permanent Solutions (Choose One)

### Solution 1: Optimize PostgreSQL Configuration (Recommended)

Edit `postgresql.conf` (usually in `C:\Program Files\PostgreSQL\17\data\`):

```conf
# Connection Settings
max_connections = 200              # Increase from default 100
shared_buffers = 256MB             # Increase shared memory
effective_cache_size = 1GB         # Optimize query planning

# Connection Pooling
max_prepared_transactions = 0      # Disable if not needed
idle_in_transaction_session_timeout = 300000  # 5 min timeout

# Performance
work_mem = 4MB                     # Per-operation memory
maintenance_work_mem = 64MB        # Maintenance operations
```

After editing, restart PostgreSQL:
```cmd
net stop postgresql-x64-17
net start postgresql-x64-17
```

### Solution 2: Use Docker (Best for Development)

Create `docker-compose.yml`:
```yaml
version: '3.8'
services:
  postgres:
    image: postgres:17-alpine
    environment:
      POSTGRES_DB: nexora_main
      POSTGRES_USER: postgres
      POSTGRES_PASSWORD: your_password
    ports:
      - "5432:5432"
    volumes:
      - postgres_data:/var/lib/postgresql/data
    command:
      - "postgres"
      - "-c"
      - "max_connections=200"
      - "-c"
      - "shared_buffers=256MB"

volumes:
  postgres_data:
```

Run: `docker-compose up -d`

### Solution 3: Use WSL2 (Best for Production-like Environment)

1. Install WSL2: `wsl --install`
2. Install PostgreSQL in WSL: `sudo apt install postgresql`
3. Update DATABASE_URL to use WSL IP
4. Much better stability than native Windows PostgreSQL

### Solution 4: Connection Pool Optimization (Already Implemented)

The code now includes:
- ✅ Reduced pool sizes (min=1, max=10)
- ✅ Connection recycling (50k queries)
- ✅ Idle connection timeout (5 min)
- ✅ Statement timeout (60 sec)
- ✅ Retry logic with exponential backoff

## Quick Fix (Temporary)

When you see connection errors:

```cmd
net stop postgresql-x64-17
timeout /t 3
net start postgresql-x64-17
```

## Monitoring Connection Health

Check active connections:
```sql
SELECT count(*) FROM pg_stat_activity WHERE datname = 'nexora_main';
```

Check idle connections:
```sql
SELECT count(*) FROM pg_stat_activity 
WHERE datname = 'nexora_main' AND state = 'idle';
```

Kill idle connections:
```sql
SELECT pg_terminate_backend(pid) 
FROM pg_stat_activity 
WHERE datname = 'nexora_main' 
AND state = 'idle' 
AND state_change < NOW() - INTERVAL '5 minutes';
```

## Prevention

1. **Always close connections properly** - The pool handles this automatically
2. **Restart PostgreSQL weekly** - Clears accumulated issues
3. **Monitor connection count** - Alert if > 80% of max_connections
4. **Use Docker/WSL for development** - More stable than native Windows

## Production Deployment

For production, **DO NOT use Windows PostgreSQL**. Use:
- Linux server (Ubuntu/Debian)
- Docker container
- Managed database (AWS RDS, Azure Database, etc.)

Windows PostgreSQL is fine for development but not recommended for production.
