"""
Fix SQL Editor Privileges - Run Once on Production
Grants ALL privileges to all project roles
"""
import asyncio
import asyncpg
import os

async def main():
    DATABASE_URL = os.getenv('DATABASE_URL')
    
    if not DATABASE_URL:
        print("❌ DATABASE_URL environment variable not set")
        return
    
    print("Connecting to database...")
    conn = await asyncpg.connect(DATABASE_URL)
    
    try:
        projects = await conn.fetch("""
            SELECT 
                p.name,
                COALESCE(p.schema_name, p.database_name) as schema,
                pdc.role_name
            FROM projects p
            JOIN project_db_credentials pdc ON pdc.project_id = p.id
            WHERE COALESCE(p.schema_name, p.database_name) LIKE 'proj_%'
        """)
        
        print(f"Fixing {len(projects)} projects...")
        
        for proj in projects:
            schema = proj['schema']
            role = proj['role_name']
            
            # Grant privileges
            await conn.execute(f'GRANT USAGE, CREATE ON SCHEMA "{schema}" TO {role}')
            await conn.execute(f'GRANT ALL ON ALL TABLES IN SCHEMA "{schema}" TO {role}')
            await conn.execute(f'GRANT ALL ON ALL SEQUENCES IN SCHEMA "{schema}" TO {role}')
            await conn.execute(f'GRANT ALL ON ALL FUNCTIONS IN SCHEMA "{schema}" TO {role}')
            
            # Default privileges
            current_user = await conn.fetchval("SELECT current_user")
            await conn.execute(f'ALTER DEFAULT PRIVILEGES FOR ROLE {current_user} IN SCHEMA "{schema}" GRANT ALL ON TABLES TO {role}')
            await conn.execute(f'ALTER DEFAULT PRIVILEGES FOR ROLE {current_user} IN SCHEMA "{schema}" GRANT ALL ON SEQUENCES TO {role}')
            await conn.execute(f'ALTER DEFAULT PRIVILEGES FOR ROLE {current_user} IN SCHEMA "{schema}" GRANT ALL ON FUNCTIONS TO {role}')
            
            print(f"✅ {proj['name']}")
        
        print(f"\n✅ All {len(projects)} projects fixed!")
        
    finally:
        await conn.close()

if __name__ == "__main__":
    asyncio.run(main())
