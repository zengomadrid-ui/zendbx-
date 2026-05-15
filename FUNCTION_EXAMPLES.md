# Database Functions - Practical Examples

Learn how to create useful PostgreSQL functions with real-world examples.

---

## What are Database Functions?

Database functions are reusable pieces of code that run inside your database. They can:
- Perform calculations
- Query and return data
- Validate data
- Automate tasks
- Be used in triggers

---

## Example 1: Count Records (Simple Query Function)

**Use Case:** Get the total number of users in your database

```sql
CREATE OR REPLACE FUNCTION get_user_count()
RETURNS integer
LANGUAGE plpgsql
AS $$
DECLARE
  user_count integer;
BEGIN
  SELECT COUNT(*) INTO user_count FROM users;
  RETURN user_count;
END;
$$;
```

**How to use:**
```sql
SELECT get_user_count();  -- Returns: 42
```

---

## Example 2: Get User by Email (Query with Parameter)

**Use Case:** Find a user by their email address

```sql
CREATE OR REPLACE FUNCTION get_user_by_email(user_email TEXT)
RETURNS TABLE(id INTEGER, email TEXT, name TEXT, created_at TIMESTAMP)
LANGUAGE plpgsql
AS $$
BEGIN
  RETURN QUERY
  SELECT u.id, u.email, u.name, u.created_at
  FROM users u
  WHERE u.email = user_email;
END;
$$;
```

**How to use:**
```sql
SELECT * FROM get_user_by_email('john@example.com');
```

---

## Example 3: Search Users (Query with LIKE)

**Use Case:** Search users by name (partial match)

```sql
CREATE OR REPLACE FUNCTION search_users(search_term TEXT)
RETURNS TABLE(id INTEGER, email TEXT, name TEXT)
LANGUAGE plpgsql
AS $$
BEGIN
  RETURN QUERY
  SELECT u.id, u.email, u.name
  FROM users u
  WHERE u.name ILIKE '%' || search_term || '%'
  ORDER BY u.name;
END;
$$;
```

**How to use:**
```sql
SELECT * FROM search_users('john');  -- Finds: John, Johnny, Johnson, etc.
```

---

## Example 4: Calculate Statistics (Aggregate Function)

**Use Case:** Get user statistics (total, active, inactive)

```sql
CREATE OR REPLACE FUNCTION get_user_stats()
RETURNS TABLE(
  total_users INTEGER,
  active_users INTEGER,
  inactive_users INTEGER
)
LANGUAGE plpgsql
AS $$
BEGIN
  RETURN QUERY
  SELECT 
    COUNT(*)::INTEGER as total_users,
    COUNT(*) FILTER (WHERE is_active = true)::INTEGER as active_users,
    COUNT(*) FILTER (WHERE is_active = false)::INTEGER as inactive_users
  FROM users;
END;
$$;
```

**How to use:**
```sql
SELECT * FROM get_user_stats();
-- Returns: total_users | active_users | inactive_users
--          100         | 85           | 15
```

---

## Example 5: Auto-Update Timestamp (Trigger Function)

**Use Case:** Automatically update `updated_at` when a record changes

```sql
CREATE OR REPLACE FUNCTION update_timestamp()
RETURNS trigger
LANGUAGE plpgsql
AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$;
```

**How to use:**
Create a trigger:
```sql
CREATE TRIGGER update_users_timestamp
BEFORE UPDATE ON users
FOR EACH ROW
EXECUTE FUNCTION update_timestamp();
```

Now every time you update a user, `updated_at` is automatically set!

---

## Example 6: Validate Email (Validation Function)

**Use Case:** Check if an email is valid before inserting

```sql
CREATE OR REPLACE FUNCTION validate_email()
RETURNS trigger
LANGUAGE plpgsql
AS $$
BEGIN
  IF NEW.email !~ '^[A-Za-z0-9._%+-]+@[A-Za-z0-9.-]+\.[A-Za-z]{2,}$' THEN
    RAISE EXCEPTION 'Invalid email format: %', NEW.email;
  END IF;
  RETURN NEW;
END;
$$;
```

**How to use:**
```sql
CREATE TRIGGER validate_user_email
BEFORE INSERT OR UPDATE ON users
FOR EACH ROW
EXECUTE FUNCTION validate_email();
```

---

## Example 7: Audit Log (Logging Function)

**Use Case:** Log all changes to a table

First, create an audit table:
```sql
CREATE TABLE audit_log (
  id SERIAL PRIMARY KEY,
  table_name TEXT NOT NULL,
  action TEXT NOT NULL,
  user_id INTEGER,
  changed_at TIMESTAMP DEFAULT NOW()
);
```

Then create the function:
```sql
CREATE OR REPLACE FUNCTION log_changes()
RETURNS trigger
LANGUAGE plpgsql
AS $$
BEGIN
  INSERT INTO audit_log (table_name, action, user_id)
  VALUES (TG_TABLE_NAME, TG_OP, NEW.id);
  RETURN NEW;
END;
$$;
```

**How to use:**
```sql
CREATE TRIGGER audit_users
AFTER INSERT OR UPDATE OR DELETE ON users
FOR EACH ROW
EXECUTE FUNCTION log_changes();
```

---

## Example 8: Get Recent Records (Date-based Query)

**Use Case:** Get users created in the last 7 days

```sql
CREATE OR REPLACE FUNCTION get_recent_users(days INTEGER DEFAULT 7)
RETURNS TABLE(id INTEGER, email TEXT, name TEXT, created_at TIMESTAMP)
LANGUAGE plpgsql
AS $$
BEGIN
  RETURN QUERY
  SELECT u.id, u.email, u.name, u.created_at
  FROM users u
  WHERE u.created_at >= NOW() - (days || ' days')::INTERVAL
  ORDER BY u.created_at DESC;
END;
$$;
```

**How to use:**
```sql
SELECT * FROM get_recent_users();      -- Last 7 days (default)
SELECT * FROM get_recent_users(30);    -- Last 30 days
```

---

## Example 9: Calculate Age (Date Calculation)

**Use Case:** Calculate user's age from birth date

```sql
CREATE OR REPLACE FUNCTION calculate_age(birth_date DATE)
RETURNS INTEGER
LANGUAGE plpgsql
AS $$
BEGIN
  RETURN EXTRACT(YEAR FROM AGE(birth_date));
END;
$$;
```

**How to use:**
```sql
SELECT calculate_age('1990-05-15');  -- Returns: 34
```

---

## Example 10: Soft Delete (Update Instead of Delete)

**Use Case:** Mark records as deleted instead of actually deleting them

```sql
CREATE OR REPLACE FUNCTION soft_delete()
RETURNS trigger
LANGUAGE plpgsql
AS $$
BEGIN
  -- Instead of deleting, update deleted_at
  UPDATE users 
  SET deleted_at = NOW() 
  WHERE id = OLD.id;
  
  -- Prevent actual deletion
  RETURN NULL;
END;
$$;
```

**How to use:**
```sql
CREATE TRIGGER soft_delete_users
BEFORE DELETE ON users
FOR EACH ROW
EXECUTE FUNCTION soft_delete();
```

---

## Example 11: Generate Slug (Text Processing)

**Use Case:** Auto-generate URL-friendly slug from title

```sql
CREATE OR REPLACE FUNCTION generate_slug()
RETURNS trigger
LANGUAGE plpgsql
AS $$
BEGIN
  NEW.slug = LOWER(
    REGEXP_REPLACE(
      REGEXP_REPLACE(NEW.title, '[^a-zA-Z0-9\s-]', '', 'g'),
      '\s+', '-', 'g'
    )
  );
  RETURN NEW;
END;
$$;
```

**How to use:**
```sql
CREATE TRIGGER auto_generate_slug
BEFORE INSERT OR UPDATE ON posts
FOR EACH ROW
EXECUTE FUNCTION generate_slug();
```

Now when you insert: `title = "Hello World!"`, it auto-creates: `slug = "hello-world"`

---

## Example 12: Check Duplicate Email (Validation)

**Use Case:** Prevent duplicate emails

```sql
CREATE OR REPLACE FUNCTION check_duplicate_email()
RETURNS trigger
LANGUAGE plpgsql
AS $$
DECLARE
  email_count INTEGER;
BEGIN
  SELECT COUNT(*) INTO email_count
  FROM users
  WHERE email = NEW.email AND id != COALESCE(NEW.id, 0);
  
  IF email_count > 0 THEN
    RAISE EXCEPTION 'Email already exists: %', NEW.email;
  END IF;
  
  RETURN NEW;
END;
$$;
```

---

## Example 13: Get Top Users (Ranking Query)

**Use Case:** Get users with most posts

```sql
CREATE OR REPLACE FUNCTION get_top_users(limit_count INTEGER DEFAULT 10)
RETURNS TABLE(
  user_id INTEGER,
  user_name TEXT,
  post_count BIGINT
)
LANGUAGE plpgsql
AS $$
BEGIN
  RETURN QUERY
  SELECT 
    u.id as user_id,
    u.name as user_name,
    COUNT(p.id) as post_count
  FROM users u
  LEFT JOIN posts p ON u.id = p.user_id
  GROUP BY u.id, u.name
  ORDER BY post_count DESC
  LIMIT limit_count;
END;
$$;
```

**How to use:**
```sql
SELECT * FROM get_top_users(5);  -- Top 5 users
```

---

## Example 14: JSON Response (API-friendly)

**Use Case:** Return data as JSON for APIs

```sql
CREATE OR REPLACE FUNCTION get_user_json(user_id INTEGER)
RETURNS JSON
LANGUAGE plpgsql
AS $$
DECLARE
  result JSON;
BEGIN
  SELECT json_build_object(
    'id', u.id,
    'email', u.email,
    'name', u.name,
    'created_at', u.created_at,
    'post_count', (SELECT COUNT(*) FROM posts WHERE user_id = u.id)
  ) INTO result
  FROM users u
  WHERE u.id = user_id;
  
  RETURN result;
END;
$$;
```

**How to use:**
```sql
SELECT get_user_json(1);
-- Returns: {"id": 1, "email": "john@example.com", "name": "John", ...}
```

---

## How to Create These in Your App

1. **Go to Database → Functions**
2. **Click "New Function"**
3. **Copy any example above**
4. **Paste into the SQL editor**
5. **Click "Create Function"**

That's it! Your function is now available in your database.

---

## Testing Your Functions

After creating a function, test it in the SQL Editor:

```sql
-- Test a simple function
SELECT get_user_count();

-- Test a function with parameters
SELECT * FROM search_users('john');

-- Test a function that returns a table
SELECT * FROM get_recent_users(7);
```

---

## Common Function Patterns

### Pattern 1: Simple Return Value
```sql
CREATE OR REPLACE FUNCTION function_name()
RETURNS return_type
LANGUAGE plpgsql
AS $$
BEGIN
  RETURN value;
END;
$$;
```

### Pattern 2: Return Table
```sql
CREATE OR REPLACE FUNCTION function_name()
RETURNS TABLE(col1 TYPE, col2 TYPE)
LANGUAGE plpgsql
AS $$
BEGIN
  RETURN QUERY
  SELECT column1, column2 FROM table_name;
END;
$$;
```

### Pattern 3: Trigger Function
```sql
CREATE OR REPLACE FUNCTION function_name()
RETURNS trigger
LANGUAGE plpgsql
AS $$
BEGIN
  -- Use NEW for INSERT/UPDATE
  -- Use OLD for DELETE
  RETURN NEW;  -- or RETURN OLD for DELETE
END;
$$;
```

---

## Tips

1. **Always use `CREATE OR REPLACE`** - This lets you update functions easily
2. **Use meaningful names** - `get_user_count()` is better than `func1()`
3. **Add comments** - Explain what your function does
4. **Test with sample data** - Make sure it works before using in production
5. **Use parameters** - Make functions reusable with different inputs

---

## Next Steps

1. Create a simple counting function
2. Create a search function for your data
3. Create a trigger function for timestamps
4. Combine functions with triggers for automation

Happy coding! 🚀
