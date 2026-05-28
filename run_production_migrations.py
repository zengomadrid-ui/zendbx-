#!/usr/bin/env python3
"""
Run OAuth migrations on production database from local machine.
This script connects to the production database and executes the required SQL migrations.
"""

import os
import sys
import psycopg2
from psycopg2 import sql

# Production database URL
# Replace with your actual production DATABASE_URL from Render
PRODUCTION_DATABASE_URL = os.getenv(
    "PRODUCTION_DATABASE_URL",
    "postgresql://user:password@host:5432/database"
)

def read_sql_file(filepath):
    """Read SQL file content."""
    with open(filepath, 'r', encoding='utf-8') as f:
        return f.read()

def run_migration(conn, migration_name, sql_content):
    """Execute a migration SQL script."""
    print(f"\n{'='*60}")
    print(f"Running migration: {migration_name}")
    print(f"{'='*60}")
    
    try:
        cursor = conn.cursor()
        cursor.execute(sql_content)
        conn.commit()
        cursor.close()
        print(f"✅ Migration '{migration_name}' completed successfully!")
        return True
    except Exception as e:
        conn.rollback()
        print(f"❌ Migration '{migration_name}' failed!")
        print(f"Error: {str(e)}")
        return False

def main():
    """Main function to run all OAuth migrations."""
    
    # Check if DATABASE_URL is provided
    if PRODUCTION_DATABASE_URL == "postgresql://user:password@host:5432/database":
        print("❌ ERROR: Please set PRODUCTION_DATABASE_URL environment variable")
        print("\nUsage:")
        print("  Windows CMD:")
        print('    set PRODUCTION_DATABASE_URL=postgresql://user:pass@host:5432/db')
        print("    python run_production_migrations.py")
        print("\n  Windows PowerShell:")
        print('    $env:PRODUCTION_DATABASE_URL="postgresql://user:pass@host:5432/db"')
        print("    python run_production_migrations.py")
        print("\n  Linux/Mac:")
        print('    export PRODUCTION_DATABASE_URL="postgresql://user:pass@host:5432/db"')
        print("    python run_production_migrations.py")
        sys.exit(1)
    
    print("🚀 ZenDBX Production OAuth Migration Script")
    print(f"📊 Target Database: {PRODUCTION_DATABASE_URL.split('@')[1] if '@' in PRODUCTION_DATABASE_URL else 'Unknown'}")
    
    # Confirm before proceeding
    response = input("\n⚠️  This will modify the PRODUCTION database. Continue? (yes/no): ")
    if response.lower() != 'yes':
        print("❌ Migration cancelled.")
        sys.exit(0)
    
    # Connect to database
    print("\n🔌 Connecting to production database...")
    try:
        conn = psycopg2.connect(PRODUCTION_DATABASE_URL)
        print("✅ Connected successfully!")
    except Exception as e:
        print(f"❌ Failed to connect to database!")
        print(f"Error: {str(e)}")
        sys.exit(1)
    
    # List of migrations to run
    migrations = [
        {
            "name": "OAuth Provider Settings",
            "file": "backend/database/add_oauth_provider_settings.sql"
        },
        {
            "name": "Enhanced OAuth System (PKCE, States, Audit)",
            "file": "backend/database/enhance_oauth_system.sql"
        }
    ]
    
    # Run each migration
    success_count = 0
    failed_count = 0
    
    for migration in migrations:
        try:
            sql_content = read_sql_file(migration["file"])
            if run_migration(conn, migration["name"], sql_content):
                success_count += 1
            else:
                failed_count += 1
        except FileNotFoundError:
            print(f"❌ Migration file not found: {migration['file']}")
            failed_count += 1
        except Exception as e:
            print(f"❌ Unexpected error: {str(e)}")
            failed_count += 1
    
    # Close connection
    conn.close()
    
    # Summary
    print(f"\n{'='*60}")
    print("📊 Migration Summary")
    print(f"{'='*60}")
    print(f"✅ Successful: {success_count}")
    print(f"❌ Failed: {failed_count}")
    print(f"{'='*60}")
    
    if failed_count == 0:
        print("\n🎉 All migrations completed successfully!")
        print("\n📝 Next Steps:")
        print("1. Add production redirect URI to Google Console:")
        print("   https://zendbx-2-zpp9.onrender.com/api/auth/oauth/google/callback")
        print("\n2. Configure OAuth providers in production UI:")
        print("   https://devapp.zendbx.in/dashboard/authentication/providers")
        print("\n3. Test OAuth login on production:")
        print("   https://devapp.zendbx.in/login")
    else:
        print("\n⚠️  Some migrations failed. Please check the errors above.")
        sys.exit(1)

if __name__ == "__main__":
    main()
