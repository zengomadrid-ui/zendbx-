"""
Database Diagnostic Script
Run this to identify the root cause of project creation failures
"""
import asyncio
import asyncpg
import os
from dotenv import load_dotenv

load_dotenv()

async def diagnose():
    """Diagnose database configuration and permissions"""
    
    database_url = os.getenv('DATABASE_URL')
    if not database_url:
        print("❌ DATABASE_URL not found in environment")
        return
    
    print("=" * 60)
    print("DATABASE DIAGNOSTIC REPORT")
    print("=" * 60)
    
    try:
        # Connect to database
        print("\n1. Testing database connection...")
        conn = await asyncpg.connect(database_url)
        print("✅ Connection successful")
        
        # Check PostgreSQL version
        print("\n2. Checking PostgreSQL version...")
        version = await conn.fetchval("SELECT version()")
        print(f"✅ PostgreSQL version: {version.split(',')[0]}")
        
        # Check current user
        print("\n3. Checking current database user...")
        current_user = await conn.fetchval("SELECT current_user")
        current_db = await conn.fetchval("SELECT current_database()")
        print(f"✅ User: {current_user}")
        print(f"✅ Database: {current_db}")
        
        # Check if user is superuser
        print("\n4. Checking user privileges...")
        is_superuser = await conn.fetchval(
            "SELECT usesuper FROM pg_user WHERE usename = $1", 
            current_user
        )
        print(f"   Superuser: {'✅ Yes' if is_superuser else '⚠️  No'}")
        
        # Check CREATE privilege on database
        has_create = await conn.fetchval(
            "SELECT has_database_privilege($1, $2, 'CREATE')",
            current_user, current_db
        )
        print(f"   CREATE privilege: {'✅ Yes' if has_create else '❌ No - THIS IS THE PROBLEM!'}")
        
        # Check installed extensions
        print("\n5. Checking installed extensions...")
        extensions = await conn.fetch(
            "SELECT extname, extversion FROM pg_extension ORDER BY extname"
        )
        
        required_extensions = ['uuid-ossp', 'pg_stat_statements']
        installed_ext = [ext['extname'] for ext in extensions]
        
        for ext_name in required_extensions:
            if ext_name in installed_ext:
                version = next(e['extversion'] for e in extensions if e['extname'] == ext_name)
                print(f"   ✅ {ext_name} (v{version})")
            else:
                print(f"   ❌ {ext_name} - NOT INSTALLED")
        
        # Try to install missing extensions
        print("\n6. Attempting to install missing extensions...")
        for ext_name in required_extensions:
            if ext_name not in installed_ext:
                try:
                    await conn.execute(f'CREATE EXTENSION IF NOT EXISTS "{ext_name}"')
                    print(f"   ✅ Installed {ext_name}")
                except Exception as e:
                    print(f"   ❌ Failed to install {ext_name}: {e}")
        
        # Test schema creation
        print("\n7. Testing schema creation...")
        test_schema = "test_diagnostic_schema"
        try:
            await conn.execute(f'CREATE SCHEMA IF NOT EXISTS "{test_schema}"')
            print(f"   ✅ Can create schemas")
            
            # Clean up
            await conn.execute(f'DROP SCHEMA IF EXISTS "{test_schema}" CASCADE')
            print(f"   ✅ Can drop schemas")
        except Exception as e:
            print(f"   ❌ Cannot create schemas: {e}")
            print(f"\n   🔧 FIX REQUIRED:")
            print(f"   Run this SQL as database owner:")
            print(f"   GRANT CREATE ON DATABASE {current_db} TO {current_user};")
        
        # Test function creation
        print("\n8. Testing function creation in public schema...")
        try:
            await conn.execute('''
                CREATE OR REPLACE FUNCTION test_func()
                RETURNS TEXT AS $$
                BEGIN
                    RETURN 'test';
                END;
                $$ LANGUAGE plpgsql;
            ''')
            print(f"   ✅ Can create functions")
            
            # Clean up
            await conn.execute('DROP FUNCTION IF EXISTS test_func()')
        except Exception as e:
            print(f"   ❌ Cannot create functions: {e}")
        
        # Check existing project schemas
        print("\n9. Checking existing project schemas...")
        schemas = await conn.fetch(
            """
            SELECT schema_name 
            FROM information_schema.schemata 
            WHERE schema_name LIKE 'proj_%'
            ORDER BY schema_name
            """
        )
        
        if schemas:
            print(f"   Found {len(schemas)} project schema(s):")
            for schema in schemas[:5]:  # Show first 5
                print(f"   - {schema['schema_name']}")
            if len(schemas) > 5:
                print(f"   ... and {len(schemas) - 5} more")
        else:
            print(f"   No project schemas found yet")
        
        await conn.close()
        
        print("\n" + "=" * 60)
        print("DIAGNOSTIC COMPLETE")
        print("=" * 60)
        
        # Summary
        print("\n📋 SUMMARY:")
        if not has_create:
            print("❌ CRITICAL: User lacks CREATE privilege on database")
            print("   This is why project creation fails!")
            print("\n🔧 PERMANENT FIX:")
            print(f"   1. Connect to your Render PostgreSQL dashboard")
            print(f"   2. Run this SQL command:")
            print(f"      GRANT CREATE ON DATABASE {current_db} TO {current_user};")
            print(f"   3. Or contact Render support to grant CREATE privilege")
        else:
            print("✅ All permissions look good!")
            print("   If project creation still fails, check backend logs for specific errors")
        
    except Exception as e:
        print(f"\n❌ Diagnostic failed: {e}")
        import traceback
        print(traceback.format_exc())

if __name__ == "__main__":
    asyncio.run(diagnose())
