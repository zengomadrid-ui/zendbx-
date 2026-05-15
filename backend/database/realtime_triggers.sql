-- =====================================================
-- ZENDBX REALTIME TRIGGER SYSTEM
-- =====================================================
-- This file creates the PostgreSQL trigger infrastructure
-- for real-time database change notifications
-- =====================================================

-- 1. Create the notification function
-- This function is called by triggers and sends notifications via pg_notify
CREATE OR REPLACE FUNCTION notify_database_change()
RETURNS TRIGGER AS $$
DECLARE
    payload JSON;
    channel_name TEXT;
BEGIN
    -- Determine the channel name (can be customized per table)
    channel_name := 'db_changes';
    
    -- Build the payload based on operation type
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
    
    -- Send the notification
    PERFORM pg_notify(channel_name, payload::text);
    
    -- Return appropriate value based on operation
    IF (TG_OP = 'DELETE') THEN
        RETURN OLD;
    ELSE
        RETURN NEW;
    END IF;
END;
$$ LANGUAGE plpgsql;

-- 2. Helper function to add realtime triggers to any table
CREATE OR REPLACE FUNCTION add_realtime_trigger(
    target_schema TEXT,
    target_table TEXT
)
RETURNS TEXT AS $$
DECLARE
    trigger_name TEXT;
BEGIN
    -- Generate trigger name
    trigger_name := target_table || '_realtime_trigger';
    
    -- Drop existing trigger if it exists
    EXECUTE format(
        'DROP TRIGGER IF EXISTS %I ON %I.%I',
        trigger_name,
        target_schema,
        target_table
    );
    
    -- Create the trigger
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

-- 3. Helper function to remove realtime triggers from a table
CREATE OR REPLACE FUNCTION remove_realtime_trigger(
    target_schema TEXT,
    target_table TEXT
)
RETURNS TEXT AS $$
DECLARE
    trigger_name TEXT;
BEGIN
    -- Generate trigger name
    trigger_name := target_table || '_realtime_trigger';
    
    -- Drop the trigger
    EXECUTE format(
        'DROP TRIGGER IF EXISTS %I ON %I.%I',
        trigger_name,
        target_schema,
        target_table
    );
    
    RETURN format('Realtime trigger removed from %s.%s', target_schema, target_table);
END;
$$ LANGUAGE plpgsql;

-- 4. Helper function to list all tables with realtime triggers
CREATE OR REPLACE FUNCTION list_realtime_triggers()
RETURNS TABLE(
    schema_name TEXT,
    table_name TEXT,
    trigger_name TEXT
) AS $$
BEGIN
    RETURN QUERY
    SELECT 
        n.nspname::TEXT as schema_name,
        c.relname::TEXT as table_name,
        t.tgname::TEXT as trigger_name
    FROM pg_trigger t
    JOIN pg_class c ON t.tgrelid = c.oid
    JOIN pg_namespace n ON c.relnamespace = n.oid
    WHERE t.tgname LIKE '%_realtime_trigger'
    AND NOT t.tgisinternal
    ORDER BY n.nspname, c.relname;
END;
$$ LANGUAGE plpgsql;

-- Success message
DO $$
BEGIN
    RAISE NOTICE '✅ Realtime trigger system installed successfully!';
    RAISE NOTICE '📡 Use add_realtime_trigger(schema, table) to enable realtime on any table';
    RAISE NOTICE '🔍 Use list_realtime_triggers() to see all enabled tables';
END $$;
