# Database Explorer Refresh Fix

## Problem
After executing `CREATE TABLE` or other DDL queries in the SQL Runner, the newly created table wasn't appearing in the Database Explorer view.

## Root Cause
The SQLRunnerPanel wasn't triggering a refresh of the DatabaseProvider after executing queries that modify the database schema.

## Solution Implemented

### Auto-Refresh After DDL Queries
Modified `src/webviews/SQLRunnerPanel.ts` to automatically refresh the database explorer after detecting DDL queries:

```typescript
// Refresh database explorer if it's a DDL query
const sqlUpper = sql.trim().toUpperCase();
if (
  sqlUpper.startsWith('CREATE TABLE') ||
  sqlUpper.startsWith('DROP TABLE') ||
  sqlUpper.startsWith('ALTER TABLE') ||
  sqlUpper.includes('CREATE TABLE') ||
  sqlUpper.includes('DROP TABLE')
) {
  Logger.info('DDL query detected, refreshing database explorer');
  vscode.commands.executeCommand('zendbx.refreshDatabase');
}
```

### Manual Refresh Button
The Database Explorer already has a refresh button configured in `package.json`:
- Located in the view title bar (top-right corner)
- Icon: refresh (circular arrow)
- Command: `zendbx.refreshDatabase`

## Usage

### Automatic Refresh
1. Open SQL Runner: `Ctrl+Shift+P` → "ZendBX: Open SQL Runner"
2. Execute a DDL query:
   ```sql
   CREATE TABLE movies (
       id SERIAL PRIMARY KEY,
       title VARCHAR(255) NOT NULL,
       director VARCHAR(255),
       release_year INTEGER
   );
   ```
3. The Database Explorer will automatically refresh
4. The new table appears in the Database Explorer view

### Manual Refresh
1. Click the refresh button (circular arrow icon) in the Database Explorer view title
2. Or use Command Palette: `Ctrl+Shift+P` → "ZendBX: Refresh Database"

## Detected DDL Operations
The following SQL operations trigger automatic refresh:
- `CREATE TABLE`
- `DROP TABLE`
- `ALTER TABLE`

## Testing
1. ✅ Create table → Auto-refresh → Table appears
2. ✅ Drop table → Auto-refresh → Table disappears
3. ✅ Manual refresh button works
4. ✅ Regular SELECT queries don't trigger unnecessary refreshes

## Future Improvements
- Add support for detecting more DDL operations (CREATE INDEX, CREATE VIEW, etc.)
- Add a setting to disable auto-refresh if users prefer manual control
- Show a notification when refresh is triggered
- Add a loading indicator during refresh
