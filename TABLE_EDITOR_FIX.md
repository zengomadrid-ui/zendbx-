# Table Editor Fix - Schema Prefix Issue

## Problem
Tables created by AI Builder were not showing in the Table Editor, even though they worked in SQL Editor.

## Root Cause
The `backend_generator.py` service was creating tables **without explicit schema prefixes**. Even though `search_path` was set, PostgreSQL was creating tables in the wrong schema (likely `public` instead of the project schema like `proj_abc123`).

## Solution
Added **explicit schema prefixes** to all table creation and modification operations:

### Changes Made in `backend/app/services/backend_generator.py`:

1. **`_create_table()` method** (line ~454):
   - Changed: `CREATE TABLE IF NOT EXISTS "{table_name}"`
   - To: `CREATE TABLE IF NOT EXISTS "{schema_name}"."{table_name}"`
   - Added `schema_name` parameter to method signature
   - Added logging to confirm table creation

2. **`_create_foreign_keys()` method** (line ~522):
   - Changed: `ALTER TABLE "{table_name}"`
   - To: `ALTER TABLE "{schema_name}"."{table_name}"`
   - Changed: `REFERENCES "{fk['references_table']}"`
   - To: `REFERENCES "{schema_name}"."{fk['references_table']}"`
   - Added logging

3. **`_create_indexes()` method** (line ~545):
   - Changed: `CREATE INDEX ... ON "{table_name}"`
   - To: `CREATE INDEX ... ON "{schema_name}"."{table_name}"`
   - Added schema prefix to index name
   - Added logging

4. **`_enable_auth()` method** (line ~565):
   - Changed: `ALTER TABLE "{table_name}" ENABLE ROW LEVEL SECURITY`
   - To: `ALTER TABLE "{schema_name}"."{table_name}" ENABLE ROW LEVEL SECURITY`
   - Changed: `CREATE POLICY ... ON "{table_name}"`
   - To: `CREATE POLICY ... ON "{schema_name}"."{table_name}"`
   - Added logging

5. **`_enable_realtime()` method** (line ~615):
   - Changed: `CREATE TRIGGER ... ON "{table_name}"`
   - To: `CREATE TRIGGER ... ON "{schema_name}"."{table_name}"`
   - Changed: `EXECUTE FUNCTION notify_database_change()`
   - To: `EXECUTE FUNCTION "{schema_name}".notify_database_change()`
   - Added logging

## Why This Fixes the Issue

### Before:
```sql
-- search_path was set, but table creation was ambiguous
SET search_path TO "proj_abc123", public;
CREATE TABLE IF NOT EXISTS "users" (...);  -- Might go to public schema!
```

### After:
```sql
-- Explicit schema prefix ensures correct placement
SET search_path TO "proj_abc123", public;
CREATE TABLE IF NOT EXISTS "proj_abc123"."users" (...);  -- Always goes to project schema!
```

## Testing
After deploying this fix:
1. Create a new project
2. Use AI Builder to generate a backend (e.g., "Build a todo app")
3. Check Table Editor - tables should now appear
4. SQL Editor should continue to work as before

## Related Files
- `backend/app/services/backend_generator.py` - Main fix
- `backend/app/api/tables.py` - Table listing endpoint (already correct)
- `backend/app/core/database.py` - Database connection and schema handling (already correct)

## Notes
- This is a **permanent fix** that works on all PostgreSQL instances
- No database migrations needed - only affects new tables created after deployment
- Existing tables in wrong schema would need manual migration (but user is starting fresh)
- The `search_path` setting is still used as a fallback, but explicit prefixes are more reliable
