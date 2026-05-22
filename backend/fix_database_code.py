"""
Automatically fix the database.py file to use gen_random_uuid() fallback
Run this script to patch the create_project_database function
"""

import re

def fix_database_file():
    file_path = "app/core/database.py"
    
    print("Reading database.py...")
    with open(file_path, 'r', encoding='utf-8') as f:
        content = f.read()
    
    # Find and replace the create_project_database function
    new_function = '''async def create_project_database(database_name: str) -> bool:
    """
    Create a new project schema (not a separate database)
    Uses PostgreSQL schemas for multi-tenancy instead of separate databases
    This works on managed PostgreSQL services like Render
    """
    try:
        print(f"🔧 Creating project schema: {database_name}")
        pool = await get_main_db_pool()
        async with pool.acquire() as conn:
            # Step 1: Create schema
            await conn.execute(f'CREATE SCHEMA IF NOT EXISTS "{database_name}"')
            print(f"✅ Schema created: {database_name}")
            
            # Step 2: Check if uuid-ossp extension is available
            uuid_extension_available = False
            try:
                # Try to enable uuid-ossp
                await conn.execute('CREATE EXTENSION IF NOT EXISTS "uuid-ossp"')
                uuid_extension_available = True
                print(f"✅ uuid-ossp extension enabled")
            except Exception as e:
                # Check if extension already exists
                ext_exists = await conn.fetchval(
                    "SELECT EXISTS(SELECT 1 FROM pg_extension WHERE extname = 'uuid-ossp')"
                )
                if ext_exists:
                    uuid_extension_available = True
                    print(f"✅ uuid-ossp extension already available")
                else:
                    print(f"⚠️  uuid-ossp not available, will use gen_random_uuid() instead")
            
            # Step 3: Try to enable pg_stat_statements (optional)
            try:
                await conn.execute('CREATE EXTENSION IF NOT EXISTS "pg_stat_statements"')
            except:
                pass  # Optional extension
            
            # Step 4: Create helper function in the schema
            await conn.execute(f\'\'\'
                CREATE OR REPLACE FUNCTION "{database_name}".update_updated_at_column()
                RETURNS TRIGGER AS $$
                BEGIN
                    NEW.updated_at = NOW();
                    RETURN NEW;
                END;
                $$ LANGUAGE plpgsql;
            \'\'\')
            print(f"✅ Helper function created in schema: {database_name}")
            
            # Step 5: Create metadata table with appropriate UUID function
            if uuid_extension_available:
                # Use uuid-ossp extension
                uuid_default = "uuid_generate_v4()"
            else:
                # Use built-in gen_random_uuid() (PostgreSQL 13+)
                uuid_default = "gen_random_uuid()"
            
            await conn.execute(f\'\'\'
                CREATE TABLE "{database_name}"._zendbx_metadata (
                    id UUID PRIMARY KEY DEFAULT {uuid_default},
                    table_name VARCHAR(255) UNIQUE NOT NULL,
                    created_by VARCHAR(255),
                    created_at TIMESTAMPTZ DEFAULT NOW(),
                    updated_at TIMESTAMPTZ DEFAULT NOW()
                )
            \'\'\')
            print(f"✅ Metadata table created in schema: {database_name}")
            
        print(f"🎉 Project schema fully initialized: {database_name}")
        return True
        
    except Exception as e:
        print(f"❌ Error creating project schema {database_name}: {e}")
        import traceback
        print(f"❌ Traceback: {traceback.format_exc()}")
        
        # Provide helpful error messages
        error_str = str(e).lower()
        if 'uuid' in error_str or 'gen_random_uuid' in error_str:
            print(f"\\n💡 PERMANENT FIX - Enable uuid-ossp extension:")
            print(f"   1. Go to Render Dashboard > Your Database > Shell")
            print(f"   2. Run: CREATE EXTENSION IF NOT EXISTS \\"uuid-ossp\\";")
            print(f"   3. Then try creating project again")
        elif 'permission denied' in error_str:
            print(f"💡 Fix: Grant CREATE privilege to your database user")
        
        return False'''
    
    # Find the function using regex
    pattern = r'async def create_project_database\(database_name: str\) -> bool:.*?(?=\nasync def |$)'
    
    if re.search(pattern, content, re.DOTALL):
        content = re.sub(pattern, new_function, content, flags=re.DOTALL)
        print("✅ Found and replaced create_project_database function")
    else:
        print("❌ Could not find create_project_database function")
        return False
    
    # Write back
    print("Writing updated database.py...")
    with open(file_path, 'w', encoding='utf-8') as f:
        f.write(content)
    
    print("✅ database.py has been updated!")
    print("\nNext steps:")
    print("1. Restart your backend server")
    print("2. Try creating a project")
    print("3. If it still fails, run the SQL in ENABLE_UUID_EXTENSION.sql")
    
    return True

if __name__ == "__main__":
    try:
        fix_database_file()
    except Exception as e:
        print(f"❌ Error: {e}")
        import traceback
        traceback.print_exc()
