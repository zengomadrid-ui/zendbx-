"""
Quick script to run storage migration on local database
"""
import psycopg2
from urllib.parse import urlparse

DATABASE_URL = "postgresql://postgres:Pawan@121@localhost:5432/nexora_main"

def run_migration():
    # Parse the database URL
    parsed = urlparse(DATABASE_URL)
    
    # Connect to database
    conn = psycopg2.connect(
        host=parsed.hostname,
        port=parsed.port,
        database=parsed.path[1:],  # Remove leading '/'
        user=parsed.username,
        password=parsed.password
    )
    conn.autocommit = True
    cursor = conn.cursor()
    
    print("🔄 Running storage migration...")
    
    try:
        # Add storage columns to projects table
        print("  - Adding storage columns to projects table...")
        cursor.execute("""
            ALTER TABLE projects 
            ADD COLUMN IF NOT EXISTS storage_used BIGINT DEFAULT 0,
            ADD COLUMN IF NOT EXISTS max_storage BIGINT DEFAULT 1073741824
        """)
        
        # Create storage_buckets table
        print("  - Creating storage_buckets table...")
        cursor.execute("""
            CREATE TABLE IF NOT EXISTS storage_buckets (
                id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
                project_id UUID NOT NULL REFERENCES projects(id) ON DELETE CASCADE,
                name VARCHAR(255) NOT NULL,
                is_public BOOLEAN DEFAULT false,
                created_at TIMESTAMP DEFAULT NOW(),
                updated_at TIMESTAMP DEFAULT NOW(),
                UNIQUE(project_id, name)
            )
        """)
        
        # Create storage_objects table
        print("  - Creating storage_objects table...")
        cursor.execute("""
            CREATE TABLE IF NOT EXISTS storage_objects (
                id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
                bucket_id UUID NOT NULL REFERENCES storage_buckets(id) ON DELETE CASCADE,
                project_id UUID NOT NULL REFERENCES projects(id) ON DELETE CASCADE,
                file_name VARCHAR(500) NOT NULL,
                original_name VARCHAR(500) NOT NULL,
                file_size BIGINT NOT NULL,
                mime_type VARCHAR(255),
                storage_key TEXT NOT NULL,
                download_count INTEGER DEFAULT 0,
                created_at TIMESTAMP DEFAULT NOW(),
                updated_at TIMESTAMP DEFAULT NOW(),
                UNIQUE(bucket_id, file_name)
            )
        """)
        
        # Create indexes
        print("  - Creating indexes...")
        cursor.execute("CREATE INDEX IF NOT EXISTS idx_storage_buckets_project ON storage_buckets(project_id)")
        cursor.execute("CREATE INDEX IF NOT EXISTS idx_storage_objects_bucket ON storage_objects(bucket_id)")
        cursor.execute("CREATE INDEX IF NOT EXISTS idx_storage_objects_project ON storage_objects(project_id)")
        
        print("✅ Migration completed successfully!")
        
    except Exception as e:
        print(f"❌ Migration failed: {e}")
        raise
    finally:
        cursor.close()
        conn.close()

if __name__ == "__main__":
    run_migration()
