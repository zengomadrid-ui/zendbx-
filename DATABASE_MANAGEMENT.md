# Database Management System

A minimal, visual-first database management system integrated into ZenDBX.

## Features

### 1. Tables Management
- Create tables with custom columns
- Define column types (TEXT, INTEGER, SERIAL, BOOLEAN, TIMESTAMP, UUID)
- Set constraints (PRIMARY KEY, UNIQUE, NOT NULL)
- Add/remove columns from existing tables
- Delete tables

**Location:** `/dashboard/database/tables`

**API Endpoints:**
- `GET /api/projects/{project_id}/db/tables` - List all tables
- `GET /api/projects/{project_id}/db/tables/{table_name}` - Get table details
- `POST /api/projects/{project_id}/db/tables` - Create table
- `DELETE /api/projects/{project_id}/db/tables/{table_name}` - Drop table
- `POST /api/projects/{project_id}/db/tables/{table_name}/columns` - Add column
- `DELETE /api/projects/{project_id}/db/tables/{table_name}/columns/{column_name}` - Drop column

### 2. Schema Visualizer
- Visual graph of all tables
- See relationships (foreign keys) between tables
- Click tables to view column details
- Interactive exploration

**Location:** `/dashboard/database/schema`

**API Endpoints:**
- `GET /api/projects/{project_id}/db/schema` - Get full schema
- `GET /api/projects/{project_id}/db/schema/relationships` - Get relationships

### 3. Functions (Stored Procedures)
- Create SQL functions using editor
- View all functions with definitions
- Delete functions
- Support for PL/pgSQL

**Location:** `/dashboard/database/functions`

**API Endpoints:**
- `GET /api/projects/{project_id}/db/functions` - List functions
- `POST /api/projects/{project_id}/db/functions` - Create function
- `DELETE /api/projects/{project_id}/db/functions/{function_name}` - Drop function

### 4. Triggers
- Create triggers on tables
- Select event type (INSERT, UPDATE, DELETE)
- Choose timing (BEFORE, AFTER)
- Link to existing functions
- View and delete triggers

**Location:** `/dashboard/database/triggers`

**API Endpoints:**
- `GET /api/projects/{project_id}/db/triggers` - List triggers
- `POST /api/projects/{project_id}/db/triggers` - Create trigger
- `DELETE /api/projects/{project_id}/db/triggers/{trigger_name}` - Drop trigger

## Architecture

### Backend Structure
```
backend/app/
├── api/
│   ├── db_tables.py       # Table CRUD operations
│   ├── db_functions.py    # Functions management
│   ├── db_triggers.py     # Triggers management
│   └── db_schema.py       # Schema visualization
└── services/
    ├── db_manager.py      # Core DB operations
    └── schema_parser.py   # Parse DB schema
```

### Frontend Structure
```
frontend/app/(dashboard)/dashboard/database/
├── page.tsx               # Main dashboard
├── tables/
│   └── page.tsx          # Tables management
├── schema/
│   └── page.tsx          # Schema visualizer
├── functions/
│   └── page.tsx          # Functions management
└── triggers/
    └── page.tsx          # Triggers management
```

## Core Principle

**User Action → UI Form → API → SQL Generator → PostgreSQL → Schema Refresh → UI Update**

All operations:
1. Convert user input to SQL queries
2. Execute safely in PostgreSQL
3. Refresh schema automatically
4. Update UI instantly

## Usage

### Creating a Table
1. Navigate to `/dashboard/database/tables`
2. Click "Create Table"
3. Enter table name and define columns
4. Set constraints as needed
5. Click "Create"

### Visualizing Schema
1. Navigate to `/dashboard/database/schema`
2. View all tables in graph format
3. Click any table to see details
4. Relationships are shown automatically

### Creating a Function
1. Navigate to `/dashboard/database/functions`
2. Click "Create Function"
3. Write SQL function definition
4. Click "Create"

### Creating a Trigger
1. Navigate to `/dashboard/database/triggers`
2. Click "Create Trigger"
3. Select table, event, timing, and function
4. Click "Create"

## Security

- All endpoints require project authentication
- SQL injection protection via parameterized queries
- Project-level isolation
- User permissions enforced

## Example: Creating an Audit Trigger

1. Create audit table:
```sql
CREATE TABLE audit_log (
  id SERIAL PRIMARY KEY,
  table_name TEXT,
  action TEXT,
  changed_at TIMESTAMP DEFAULT NOW()
);
```

2. Create audit function:
```sql
CREATE OR REPLACE FUNCTION log_changes()
RETURNS TRIGGER AS $$
BEGIN
  INSERT INTO audit_log (table_name, action)
  VALUES (TG_TABLE_NAME, TG_OP);
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;
```

3. Create trigger:
- Table: `users`
- Event: `INSERT`
- Timing: `AFTER`
- Function: `log_changes`

Now every insert to `users` table will be logged automatically!

## Future Enhancements

- Visual drag-and-drop schema builder
- Real-time collaboration
- Migration history
- Query performance insights
- Index management
- View management
