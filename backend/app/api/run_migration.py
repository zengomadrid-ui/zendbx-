"""
One-time migration endpoint to add storage columns
Call this once after deployment to update the database schema
"""
from fastapi import APIRouter, Depends, HTTPException
from app.core.database import get_main_db_pool
from app.core.rbac import require_admin
import asyncpg

router = APIRouter()

@router.post("/run-storage-migration")
async def run_storage_migration(
    pool = Depends(get_main_db_pool),
    _current_user: dict = Depends(require_admin),   # ← CRITICAL-2 fix: admin-only
):
    """
    Run the storage migration to add storage_used and max_storage columns
    This should only be called once after deployment
    """
    results = []
    try:
        async with pool.acquire() as conn:
            # Add slug column to projects table
            try:
                await conn.execute("""
                    ALTER TABLE projects 
                    ADD COLUMN IF NOT EXISTS slug VARCHAR(255)
                """)
                results.append("✓ Added slug column to projects")
            except Exception as e:
                results.append(f"⚠ Projects slug: {str(e)}")
            
            # Add storage columns to projects table
            try:
                await conn.execute("""
                    ALTER TABLE projects 
                    ADD COLUMN IF NOT EXISTS storage_used BIGINT DEFAULT 0
                """)
                results.append("✓ Added storage_used to projects")
            except Exception as e:
                results.append(f"⚠ Projects storage_used: {str(e)}")
                
            try:
                await conn.execute("""
                    ALTER TABLE projects 
                    ADD COLUMN IF NOT EXISTS max_storage BIGINT DEFAULT 1073741824
                """)
                results.append("✓ Added max_storage to projects")
            except Exception as e:
                results.append(f"⚠ Projects max_storage: {str(e)}")
            
            # Drop and recreate storage_buckets table with correct schema
            try:
                await conn.execute("DROP TABLE IF EXISTS storage_objects CASCADE")
                await conn.execute("DROP TABLE IF EXISTS storage_buckets CASCADE")
                results.append("✓ Dropped old storage tables")
            except Exception as e:
                results.append(f"⚠ Drop tables: {str(e)}")
            
            # Create storage_buckets table with all columns
            try:
                await conn.execute("""
                    CREATE TABLE storage_buckets (
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
                results.append("✓ Created storage_buckets table")
            except Exception as e:
                results.append(f"✗ Create storage_buckets: {str(e)}")
                raise
            
            # Create storage_objects table
            try:
                await conn.execute("""
                    CREATE TABLE storage_objects (
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
                        deleted_at TIMESTAMP NULL
                    )
                """)
                results.append("✓ Created storage_objects table")
            except Exception as e:
                results.append(f"✗ Create storage_objects: {str(e)}")
                raise
            
            # Create indexes
            try:
                await conn.execute("""
                    CREATE INDEX IF NOT EXISTS idx_storage_buckets_project ON storage_buckets(project_id)
                """)
                await conn.execute("""
                    CREATE INDEX IF NOT EXISTS idx_storage_buckets_deleted ON storage_buckets(deleted_at)
                """)
                await conn.execute("""
                    CREATE INDEX IF NOT EXISTS idx_storage_objects_bucket ON storage_objects(bucket_id)
                """)
                await conn.execute("""
                    CREATE INDEX IF NOT EXISTS idx_storage_objects_project ON storage_objects(project_id)
                """)
                await conn.execute("""
                    CREATE INDEX IF NOT EXISTS idx_storage_objects_deleted ON storage_objects(deleted_at)
                """)
                results.append("✓ Created indexes")
            except Exception as e:
                results.append(f"⚠ Create indexes: {str(e)}")
            
        return {
            "success": True,
            "message": "Storage migration completed successfully",
            "details": results
        }
    except Exception as e:
        return {
            "success": False,
            "message": f"Migration failed: {str(e)}",
            "details": results
        }
