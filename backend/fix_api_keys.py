"""
Fix API Keys - Regenerate full JWTs for existing keys
This script updates existing anon and service_role keys to include full JWTs in encrypted_key column
"""

import os
import psycopg2
from psycopg2.extras import RealDictCursor
import secrets
import hashlib
import base64

def get_db_connection():
    """Get database connection from environment"""
    database_url = os.getenv('DATABASE_URL')
    
    if not database_url:
        raise ValueError("DATABASE_URL environment variable not set")
    
    return psycopg2.connect(database_url)

def generate_jwt_key():
    """Generate a JWT-like key"""
    # Generate random bytes
    random_bytes = secrets.token_bytes(32)
    # Encode as base64
    encoded = base64.b64encode(random_bytes).decode('utf-8')
    # Create JWT-like format
    jwt_key = f"eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.{encoded}"
    return jwt_key

def hash_key(key):
    """Hash a key using SHA256"""
    return hashlib.sha256(key.encode()).hexdigest()

def get_key_prefix(key):
    """Get truncated prefix of key"""
    return key[:20] + "..."

def fix_api_keys():
    """Fix existing API keys by adding full JWTs to encrypted_key column"""
    
    print("🔧 Starting API Keys Fix...")
    print("=" * 60)
    
    conn = get_db_connection()
    cursor = conn.cursor(cursor_factory=RealDictCursor)
    
    try:
        # Find all anon and service_role keys without encrypted_key
        cursor.execute("""
            SELECT id, key_type, project_id, user_id, name, role, is_active
            FROM api_keys
            WHERE key_type IN ('anon', 'service_role')
            AND (encrypted_key IS NULL OR encrypted_key = '')
        """)
        
        keys_to_fix = cursor.fetchall()
        
        if not keys_to_fix:
            print("✅ No keys need fixing - all keys already have encrypted_key!")
            return
        
        print(f"📋 Found {len(keys_to_fix)} keys to fix\n")
        
        fixed_count = 0
        
        for key in keys_to_fix:
            # Generate new full JWT
            new_jwt = generate_jwt_key()
            new_hash = hash_key(new_jwt)
            new_prefix = get_key_prefix(new_jwt)
            
            # Update the key
            cursor.execute("""
                UPDATE api_keys
                SET 
                    encrypted_key = %s,
                    key_hash = %s,
                    key_prefix = %s
                WHERE id = %s
            """, (new_jwt, new_hash, new_prefix, key["id"]))
            
            print(f"✅ Fixed {key['key_type']} key for project {key['project_id']}")
            print(f"   New key: {new_jwt[:40]}...")
            print()
            
            fixed_count += 1
        
        # Commit changes
        conn.commit()
        
        print("=" * 60)
        print(f"✅ Successfully fixed {fixed_count} API keys!")
        print()
        
        # Verify
        cursor.execute("""
            SELECT COUNT(*) as count
            FROM api_keys
            WHERE key_type IN ('anon', 'service_role')
            AND encrypted_key IS NOT NULL
        """)
        
        result = cursor.fetchone()
        print(f"📊 Total keys with encrypted_key: {result['count']}")
        
    except Exception as e:
        conn.rollback()
        print(f"❌ Error: {e}")
        raise
    finally:
        cursor.close()
        conn.close()

if __name__ == "__main__":
    fix_api_keys()
