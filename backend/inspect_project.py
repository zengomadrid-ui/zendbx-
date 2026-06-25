"""
Task 1: Inspect specific project to verify current state
"""
import asyncio
import asyncpg
from uuid import UUID

DATABASE_URL = "postgresql://neondb_owner:npg_SWLUIq9vjxg6@ep-snowy-fog-a-2dadb8c5.us-east-1.aws.neon.tech/neondb?sslmode=require"
PROJECT_ID = "844ea26d-246b-4b02-9bd6-16d2114a7543"

async def inspect_project():
    print("=" * 80)
    print("TASK 1: INSPECT PROJECT")
    print("=" * 80)
    
    conn = await asyncpg.connect(DATABASE_URL)
    
    try:
        # Get project details
        print(f"\n📊 Inspecting project: {PROJECT_ID}")
        print("-" * 80)
        
        project = await conn.fetchrow("""
            SELECT id, name, slug, legacy_slug, created_at
            FROM projects
            WHERE id = $1
        """, UUID(PROJECT_ID))
        
        if not project:
            print("❌ Project not found!")
            return
        
        print(f"\n✅ PROJECT FOUND:")
        print(f"   ID:          {project['id']}")
        print(f"   Name:        {project['name']}")
        print(f"   Slug:        {project['slug']}")
        print(f"   Legacy Slug: {project['legacy_slug']}")
        print(f"   Created:     {project['created_at']}")
        
        # Check if slug contains UUID fragment
        if '-s-project-' in project['slug']:
            print(f"\n⚠️  ISSUE DETECTED:")
            print(f"   Current slug contains UUID fragment: {project['slug']}")
            print(f"   Expected clean slug: zendbx-commits")
            print(f"   Legacy_slug is: {project['legacy_slug']}")
        else:
            print(f"\n✅ Slug is clean (no UUID fragment)")
        
        # Check all projects to understand migration state
        print("\n" + "=" * 80)
        print("CHECKING ALL PROJECTS")
        print("=" * 80)
        
        all_projects = await conn.fetch("""
            SELECT id, name, slug, legacy_slug
            FROM projects
            ORDER BY created_at DESC
        """)
        
        legacy_count = 0
        clean_count = 0
        
        print(f"\nTotal projects: {len(all_projects)}")
        print("\nProject inventory:")
        for p in all_projects:
            has_uuid = '-s-project-' in p['slug'] if p['slug'] else False
            status = "LEGACY" if has_uuid else "CLEAN"
            
            if has_uuid:
                legacy_count += 1
            else:
                clean_count += 1
            
            print(f"   [{status}] {p['name'][:30]:30} | slug: {p['slug'][:45]:45} | legacy: {str(p['legacy_slug'])[:20] if p['legacy_slug'] else 'NULL'}")
        
        print(f"\n📊 Summary:")
        print(f"   Clean slugs:  {clean_count}")
        print(f"   Legacy slugs: {legacy_count}")
        
        if legacy_count > 0:
            print(f"\n⚠️  {legacy_count} projects need migration!")
        
    finally:
        await conn.close()

if __name__ == "__main__":
    asyncio.run(inspect_project())
