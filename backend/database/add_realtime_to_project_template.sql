-- =====================================================
-- ADD REALTIME TO PROJECT DATABASE TEMPLATE
-- =====================================================
-- This script adds realtime triggers to the project
-- database template so all new projects have realtime
-- =====================================================

-- First, ensure the realtime trigger function exists
CREATE OR REPLACE FUNCTION notify_database_change()
RETURNS TRIGGER AS $$
DECLARE
    payload JSON;
    channel_name TEXT;
BEGIN
    channel_name := 'db_changes';
    
    IF (TG_OP = 'DELETE') THEN
        payload := json_build_object(
            'table', TG_TABLE_NAME,
            'schema', TG_TABLE_SCHEMA,
            'operation', TG_OP,
            'old', row_to_json(OLD),
            'new', NULL,
            'timestamp', NOW()
        );
    ELSIF (TG_OP = 'INSERT') THEN
        payload := json_build_object(
            'table', TG_TABLE_NAME,
            'schema', TG_TABLE_SCHEMA,
            'operation', TG_OP,
            'old', NULL,
            'new', row_to_json(NEW),
            'timestamp', NOW()
        );
    ELSIF (TG_OP = 'UPDATE') THEN
        payload := json_build_object(
            'table', TG_TABLE_NAME,
            'schema', TG_TABLE_SCHEMA,
            'operation', TG_OP,
            'old', row_to_json(OLD),
            'new', row_to_json(NEW),
            'timestamp', NOW()
        );
    END IF;
    
    PERFORM pg_notify(channel_name, payload::text);
    
    IF (TG_OP = 'DELETE') THEN
        RETURN OLD;
    ELSE
        RETURN NEW;
    END IF;
END;
$$ LANGUAGE plpgsql;

-- Helper function to add realtime to any table
CREATE OR REPLACE FUNCTION add_realtime_trigger(
    target_schema TEXT,
    target_table TEXT
)
RETURNS TEXT AS $$
DECLARE
    trigger_name TEXT;
BEGIN
    trigger_name := target_table || '_realtime_trigger';
    
    EXECUTE format(
        'DROP TRIGGER IF EXISTS %I ON %I.%I',
        trigger_name,
        target_schema,
        target_table
    );
    
    EXECUTE format(
        'CREATE TRIGGER %I
        AFTER INSERT OR UPDATE OR DELETE ON %I.%I
        FOR EACH ROW
        EXECUTE FUNCTION notify_database_change()',
        trigger_name,
        target_schema,
        target_table
    );
    
    RETURN format('Realtime trigger added to %s.%s', target_schema, target_table);
END;
$$ LANGUAGE plpgsql;

-- Note: Individual tables will have realtime enabled when created
-- or you can manually enable it using: SELECT add_realtime_trigger('public', 'your_table_name');
