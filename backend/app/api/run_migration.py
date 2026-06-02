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
            # Add slug column to projects table
            await conn.execute("""
                ALTER TABLE projects 
                ADD COLUMN IF NOT EXISTS slug VARCHAR(255) UNIQUE
            """)
            
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
                    slug VARCHAR(255) NOT NULL,
                    description TEXT,
                    is_public BOOLEAN DEFAULT false,
                    storage_used BIGINT DEFAULT 0,
                    file_count INTEGER DEFAULT 0,
                    created_by UUID,
                    created_at TIMESTAMP DEFAULT NOW(),
                    updated_at TIMESTAMP DEFAULT NOW(),
                    deleted_at TIMESTAMP NULL,
                    UNIQUE(project_id, slug)
                )
            """)
            
            # Add missing columns to storage_buckets if table already exists
            await conn.execute("""
                ALTER TABLE storage_buckets 
                ADD COLUMN IF NOT EXISTS slug VARCHAR(255),
                ADD COLUMN IF NOT EXISTS description TEXT,
                ADD COLUMN IF NOT EXISTS storage_used BIGINT DEFAULT 0,
                ADD COLUMN IF NOT EXISTS file_count INTEGER DEFAULT 0,
                ADD COLUMN IF NOT EXISTS created_by UUID,
                ADD COLUMN IF NOT EXISTS deleted_at TIMESTAMP NULL
            """)
            
            # Create storage_objects table
            await conn.execute("""
                CREATE TABLE IF NOT EXISTS storage_objects (
                    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
                    bucket_id UUID NOT NULL REFERENCES storage_buckets(id) ON DELETE CASCADE,
                    project_id UUID NOT NULL REFERENCES projects(id) ON DELETE CASCADE,
                    file_name TEXT NOT NULL,
                    original_name TEXT NOT NULL,
                    file_size BIGINT NOT NULL,
                    mime_type VARCHAR(255),
                    storage_key TEXT NOT NULL,
                    version INTEGER DEFAULT 1,
                    uploaded_by UUID,
                    download_count BIGINT DEFAULT 0,
                    last_downloaded_at TIMESTAMP NULL,
                    created_at TIMESTAMP DEFAULT NOW(),
                    updated_at TIMESTAMP DEFAULT NOW(),
                    deleted_at TIMESTAMP NULL,
                    UNIQUE(bucket_id, file_name)
                )
            """)
            
            # Add missing columns to storage_objects if table already exists
            await conn.execute("""
                ALTER TABLE storage_objects 
                ADD COLUMN IF NOT EXISTS version INTEGER DEFAULT 1,
                ADD COLUMN IF NOT EXISTS uploaded_by UUID,
                ADD COLUMN IF NOT EXISTS last_downloaded_at TIMESTAMP NULL,
                ADD COLUMN IF NOT EXISTS deleted_at TIMESTAMP NULL
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
