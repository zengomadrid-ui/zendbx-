#!/usr/bin/env python3
"""
Verify OAuth tables exist in production database.
"""

import os
import sys
import psycopg2

PRODUCTION_DATABASE_URL = os.getenv(
    "PRODUCTION_DATABASE_URL",
    "postgresql://user:password@host:5432/database"
)

def main():
    """Check if OAuth tables exist."""
    
    if PRODUCTION_DATABASE_URL == "postgresql://user:password@host:5432/database":
        print("❌ ERROR: Please set PRODUCTION_DATABASE_URL environment variable")
        sys.exit(1)
    
    print("🔍 Verifying OAuth tables in production database...")
    
    try:
        conn = psycopg2.connect(PRODUCTION_DATABASE_URL)
        cursor = conn.cursor()
        
        # Check for OAuth tables
        tables_to_check = [
            'oauth_provider_settings',
            'oauth_connections',
            'oauth_states',
            'oauth_audit_log'
        ]
        
        print("\n📊 Checking tables:")
        all_exist = True
        
        for table in tables_to_check:
            cursor.execute("""
                SELECT EXISTS (
                    SELECT FROM information_schema.tables 
                    WHERE table_schema = 'public' 
                    AND table_name = %s
                );
            """, (table,))
            
            exists = cursor.fetchone()[0]
            status = "✅" if exists else "❌"
            print(f"  {status} {table}")
            
            if not exists:
                all_exist = False
        
        # Check oauth_provider_settings data
        if all_exist:
            cursor.execute("SELECT provider, is_enabled FROM oauth_provider_settings ORDER BY provider;")
            providers = cursor.fetchall()
            
            print("\n🔐 OAuth Providers:")
            for provider, enabled in providers:
                status = "🟢 Enabled" if enabled else "🔴 Disabled"
                print(f"  {provider}: {status}")
        
        cursor.close()
        conn.close()
        
        if all_exist:
            print("\n✅ All OAuth tables exist!")
            print("\n📝 Next steps:")
            print("1. Configure OAuth providers at: https://devapp.zendbx.in/dashboard/authentication/providers")
            print("2. Add redirect URI to Google Console: https://zendbx-2-zpp9.onrender.com/api/auth/oauth/google/callback")
            print("3. Test OAuth login at: https://devapp.zendbx.in/login")
        else:
            print("\n❌ Some tables are missing. Run the migration script first:")
            print("   python run_production_migrations.py")
            sys.exit(1)
            
    except Exception as e:
        print(f"\n❌ Error: {str(e)}")
        sys.exit(1)

if __name__ == "__main__":
    main()
