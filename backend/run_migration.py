"""
Simple migration runner for Neon database
Usage: python run_migration.py backend/database/add_auth_audit_log.sql
"""
import asyncpg
import asyncio
import os
import sys
from pathlib import Path

async def run_migration(sql_file: str):
    """Run a SQL migration file against the database"""
    # Get DATABASE_URL from environment
    database_url = os.getenv("DATABASE_URL")
    
    if not database_url:
        print("❌ ERROR: DATABASE_URL not found in environment variables")
        print("Make sure your .env file is loaded or set DATABASE_URL")
        return False
    
    # Read SQL file
    sql_path = Path(sql_file)
    if not sql_path.exists():
        print(f"❌ ERROR: SQL file not found: {sql_file}")
        return False
    
    print(f"📄 Reading SQL file: {sql_file}")
    sql_content = sql_path.read_text()
    
    print(f"🔗 Connecting to database...")
    try:
        # Connect to database
        conn = await asyncpg.connect(database_url)
        
        print(f"✅ Connected to database")
        print(f"🚀 Running migration...")
        
        # Execute SQL
        await conn.execute(sql_content)
        
        print(f"✅ Migration completed successfully!")
        
        # Close connection
        await conn.close()
        return True
        
    except Exception as e:
        print(f"❌ ERROR: Migration failed")
        print(f"   {type(e).__name__}: {str(e)}")
        return False

if __name__ == "__main__":
    if len(sys.argv) < 2:
        print("Usage: python run_migration.py <sql_file>")
        print("Example: python run_migration.py backend/database/add_auth_audit_log.sql")
        sys.exit(1)
    
    sql_file = sys.argv[1]
    success = asyncio.run(run_migration(sql_file))
    sys.exit(0 if success else 1)
