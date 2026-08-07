"""Apply migration 009: Create oauth_connections table"""
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
        with open("backend/migrations/009_create_oauth_connections_table.sql", "r", encoding="utf-8") as f:
            migration_sql = f.read()
        
        await conn.execute(migration_sql)
        print("✅ Migration 009 applied successfully!")
        
        exists = await conn.fetchval("""
            SELECT EXISTS (
                SELECT 1 FROM information_schema.tables 
                WHERE table_name = 'oauth_connections'
            )
        """)
        
        if exists:
            print("✅ Verified: oauth_connections table exists")
        else:
            print("❌ Warning: table not found after migration")
    except Exception as e:
        print(f"❌ Error: {e}")
    finally:
        await conn.close()

if __name__ == "__main__":
    asyncio.run(apply_migration())
