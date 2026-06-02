"""
One-time migration endpoint to add storage columns
Call this once after deployment to update the database schema
"""
from fastapi import APIRouter, Depends, HTTPException
from app.core.database import get_main_db_pool
import asyncpg

router = APIRouter()

@router.post("/run-storage-migration")
async def run_storage_migration(pool = Depends(get_main_db_pool)):
    """
    Run the storage migration to add storage_used and max_storage columns
    This should only be called once after deployment
    """
    try:
        async with pool.acquire() as conn:
            # Add storage columns to projects table
            await conn.execute("""
                ALTER TABLE projects 
                ADD COLUMN IF NOT EXISTS storage_used BIGINT DEFAULT 0,
                ADD COLUMN IF NOT EXISTS max_storage BIGINT DEFAULT 1073741824
            """)
            
            # Create storage_buckets table
            await conn.execute("""
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
            await conn.execute("""
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
            await conn.execute("""
                CREATE INDEX IF NOT EXISTS idx_storage_buckets_project ON storage_buckets(project_id)
            """)
            await conn.execute("""
                CREATE INDEX IF NOT EXISTS idx_storage_objects_bucket ON storage_objects(bucket_id)
            """)
            await conn.execute("""
                CREATE INDEX IF NOT EXISTS idx_storage_objects_project ON storage_objects(project_id)
            """)
            
        return {
            "success": True,
            "message": "Storage migration completed successfully"
        }
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Migration failed: {str(e)}")
