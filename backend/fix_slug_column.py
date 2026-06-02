"""
Fix slug column in projects table
Run this once to add the missing slug column
"""
import asyncio
import asyncpg
import os
from dotenv import load_dotenv

load_dotenv()

async def fix_slug_column():
    """Add slug column to projects table"""
    database_url = os.getenv("DATABASE_URL")
    
    if not database_url:
        print("❌ DATABASE_URL not found in environment")
        return
    
    print(f"🔗 Connecting to database...")
    
    try:
        conn = await asyncpg.connect(database_url)
        
        # Check if slug column exists
        result = await conn.fetchval("""
            SELECT COUNT(*)
            FROM information_schema.columns 
            WHERE table_name = 'projects' 
            AND column_name = 'slug'
        """)
        
        if result > 0:
            print("✅ Slug column already exists")
        else:
            print("📝 Adding slug column...")
            await conn.execute("""
                ALTER TABLE projects 
                ADD COLUMN slug VARCHAR(255) UNIQUE
            """)
            print("✅ Slug column added successfully")
        
        # Update existing projects with slugs if they don't have one
        projects = await conn.fetch("""
            SELECT id, name, slug 
            FROM projects 
            WHERE slug IS NULL OR slug = ''
        """)
        
        if projects:
            print(f"📝 Updating {len(projects)} projects with slugs...")
            for project in projects:
                # Generate slug from name and project ID
                import re
                name = project['name'].lower()
                slug = re.sub(r'[^a-z0-9]+', '-', name).strip('-')
                slug = f"{slug}-{str(project['id'])[:8]}"
                
                await conn.execute("""
                    UPDATE projects 
                    SET slug = $1 
                    WHERE id = $2
                """, slug, project['id'])
                print(f"  ✅ Updated project '{project['name']}' with slug '{slug}'")
        else:
            print("✅ All projects already have slugs")
        
        await conn.close()
        print("\n✅ Migration completed successfully!")
        
    except Exception as e:
        print(f"❌ Error: {str(e)}")

if __name__ == "__main__":
    asyncio.run(fix_slug_column())
