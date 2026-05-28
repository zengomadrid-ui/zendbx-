#!/usr/bin/env python3
"""
Configure OAuth providers in production database.
"""

import os
import sys
import psycopg2

PRODUCTION_DATABASE_URL = os.getenv(
    "PRODUCTION_DATABASE_URL",
    "postgresql://user:password@host:5432/database"
)

def main():
    """Configure OAuth providers."""
    
    if PRODUCTION_DATABASE_URL == "postgresql://user:password@host:5432/database":
        print("❌ ERROR: Please set PRODUCTION_DATABASE_URL environment variable")
        sys.exit(1)
    
    print("🔐 Configuring OAuth Providers in Production")
    print("=" * 60)
    
    # Get OAuth credentials
    print("\n📝 Enter your OAuth credentials:")
    print("\nGoogle OAuth:")
    google_client_id = input("  Client ID (press Enter to skip): ").strip()
    
    if not google_client_id:
        print("\n⚠️  Skipping Google OAuth configuration")
        print("You can configure it later via the UI at:")
        print("https://devapp.zendbx.in/dashboard/authentication/providers")
        return
    
    google_client_secret = input("  Client Secret: ").strip()
    
    if not google_client_secret:
        print("❌ Client Secret is required")
        sys.exit(1)
    
    # Connect to database
    print("\n🔌 Connecting to production database...")
    try:
        conn = psycopg2.connect(PRODUCTION_DATABASE_URL)
        cursor = conn.cursor()
        print("✅ Connected!")
    except Exception as e:
        print(f"❌ Failed to connect: {str(e)}")
        sys.exit(1)
    
    # Update Google OAuth settings
    try:
        print("\n⚙️  Configuring Google OAuth...")
        
        cursor.execute("""
            UPDATE oauth_provider_settings
            SET 
                client_id = %s,
                client_secret = %s,
                is_enabled = true,
                redirect_uri = 'https://zendbx-2-zpp9.onrender.com/api/auth/oauth/google/callback',
                scopes = 'openid email profile',
                updated_at = NOW()
            WHERE provider = 'google'
            RETURNING provider, is_enabled;
        """, (google_client_id, google_client_secret))
        
        result = cursor.fetchone()
        conn.commit()
        
        if result:
            print(f"✅ Google OAuth configured and enabled!")
        else:
            print("❌ Failed to update Google OAuth settings")
            sys.exit(1)
            
    except Exception as e:
        conn.rollback()
        print(f"❌ Error: {str(e)}")
        sys.exit(1)
    
    # Verify configuration
    print("\n📊 Verifying configuration...")
    cursor.execute("""
        SELECT provider, is_enabled, 
               CASE WHEN client_id != '' THEN '✓ Set' ELSE '✗ Not set' END as client_id_status,
               CASE WHEN client_secret != '' THEN '✓ Set' ELSE '✗ Not set' END as client_secret_status
        FROM oauth_provider_settings
        ORDER BY provider;
    """)
    
    providers = cursor.fetchall()
    print("\n🔐 OAuth Providers Status:")
    for provider, enabled, cid_status, csecret_status in providers:
        status = "🟢 Enabled" if enabled else "🔴 Disabled"
        print(f"  {provider}: {status}")
        print(f"    Client ID: {cid_status}")
        print(f"    Client Secret: {csecret_status}")
    
    cursor.close()
    conn.close()
    
    print("\n" + "=" * 60)
    print("✅ Configuration complete!")
    print("\n📝 Next steps:")
    print("1. Verify redirect URI in Google Console:")
    print("   https://zendbx-2-zpp9.onrender.com/api/auth/oauth/google/callback")
    print("\n2. Test OAuth login:")
    print("   https://devapp.zendbx.in/login")
    print("\n3. Click 'Continue with Google' button")

if __name__ == "__main__":
    main()
