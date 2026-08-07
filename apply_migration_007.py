"""
Apply migration 007: Create oauth_states table
Run this to fix the "relation oauth_states does not exist" error
"""
import asyncio
import asyncpg
import os
from dotenv import load_dotenv

load_dotenv("backend/.env")

async def apply_migration():
    database_url = os.getenv("DATABASE_URL")
    
    if not database_url:
        print("❌ DATABASE_URL not found in backend/.env")
        return
    
    conn = await asyncpg.connect(database_url)
    
    try:
        # Read migration file
        with open("backend/migrations/007_create_oauth_states_table.sql", "r", encoding="utf-8") as f:
            migration_sql = f.read()
        
        # Execute migration
        await conn.execute(migration_sql)
        
        print("✅ Migration 007 applied successfully!")
        print("✅ oauth_states table created")
        
        # Verify table exists
        exists = await conn.fetchval("""
            SELECT EXISTS (
                SELECT FROM information_schema.tables 
                WHERE table_name = 'oauth_states'
            )
        """)
        
        if exists:
            print("✅ Verified: oauth_states table exists")
        else:
            print("❌ Warning: oauth_states table not found after migration")
        
    except Exception as e:
        print(f"❌ Error applying migration: {e}")
    finally:
        await conn.close()

if __name__ == "__main__":
    asyncio.run(apply_migration())
