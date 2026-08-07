"""
Apply migration 008: Add OAuth columns to users table
"""
import asyncio
import asyncpg
import os
from dotenv import load_dotenv

load_dotenv("backend/.env")

async def apply_migration():
    database_url = os.getenv("DATABASE_URL")
    
    if not database_url:
        print("❌ DATABASE_URL not found")
        return
    
    conn = await asyncpg.connect(database_url)
    
    try:
        with open("backend/migrations/008_add_oauth_columns_to_users.sql", "r", encoding="utf-8") as f:
            migration_sql = f.read()
        
        await conn.execute(migration_sql)
        print("✅ Migration 008 applied successfully!")
        
        # Verify columns exist
        oauth_provider_exists = await conn.fetchval("""
            SELECT EXISTS (
                SELECT 1 FROM information_schema.columns 
                WHERE table_name = 'users' AND column_name = 'oauth_provider'
            )
        """)
        
        oauth_user_id_exists = await conn.fetchval("""
            SELECT EXISTS (
                SELECT 1 FROM information_schema.columns 
                WHERE table_name = 'users' AND column_name = 'oauth_user_id'
            )
        """)
        
        if oauth_provider_exists and oauth_user_id_exists:
            print("✅ Verified: oauth_provider and oauth_user_id columns exist")
        else:
            print("❌ Warning: columns not found after migration")
        
    except Exception as e:
        print(f"❌ Error: {e}")
    finally:
        await conn.close()

if __name__ == "__main__":
    asyncio.run(apply_migration())
