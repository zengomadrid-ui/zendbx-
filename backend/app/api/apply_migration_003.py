"""
EMERGENCY MIGRATION ENDPOINT
Apply migration 003 to create project_db_credentials table

This endpoint is TEMPORARY and should be removed after migration is applied.
Access: Admin only (requires SECRET_KEY as header)
"""
from fastapi import APIRouter, HTTPException, Header, status
from app.core.config import settings
from app.core.database import get_platform_db_pool
import asyncpg

router = APIRouter()

@router.post("/emergency/apply-migration-003", include_in_schema=False)
async def apply_migration_003(
    x_admin_secret: str = Header(None, alias="X-Admin-Secret")
):
    """
    Apply migration 003 to create project_db_credentials table
    
    Security: Requires SECRET_KEY in X-Admin-Secret header
    WARNING: This is a one-time emergency endpoint
    """
    
    # Verify admin access
    if not x_admin_secret or x_admin_secret != settings.SECRET_KEY:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Unauthorized: Invalid admin secret"
        )
    
    results = {
        "status": "starting",
        "steps": [],
        "table_exists_before": False,
        "table_exists_after": False,
        "errors": []
    }
    
    try:
        # Connect directly using DATABASE_URL
        conn = await asyncpg.connect(settings.DATABASE_URL)
        
        try:
            # Check if table already exists
            results["table_exists_before"] = await conn.fetchval("""
                SELECT EXISTS (
                    SELECT 1 FROM information_schema.tables 
                    WHERE table_schema = 'public' 
                    AND table_name = 'project_db_credentials'
                )
            """)
            
            if results["table_exists_before"]:
                results["status"] = "already_applied"
                results["message"] = "Table already exists - migration already applied"
                return results
            
            # Step 1: Create table
            results["steps"].append("Creating table...")
            await conn.execute("""
                CREATE TABLE IF NOT EXISTS project_db_credentials (
                    project_id UUID PRIMARY KEY REFERENCES projects(id) ON DELETE CASCADE,
                    role_name VARCHAR(255) NOT NULL UNIQUE,
                    encrypted_password TEXT NOT NULL,
                    created_at TIMESTAMPTZ DEFAULT NOW(),
                    updated_at TIMESTAMPTZ DEFAULT NOW()
                )
            """)
            results["steps"].append("✅ Table created")
            
            # Step 2: Create index
            results["steps"].append("Creating index...")
            await conn.execute("""
                CREATE INDEX IF NOT EXISTS idx_project_db_credentials_role_name 
                ON project_db_credentials(role_name)
            """)
            results["steps"].append("✅ Index created")
            
            # Step 3: Set permissions
            results["steps"].append("Setting permissions...")
            await conn.execute("REVOKE ALL ON project_db_credentials FROM PUBLIC")
            results["steps"].append("✅ Revoked PUBLIC access")
            
            # Check if zendbx_platform role exists
            platform_exists = await conn.fetchval("""
                SELECT EXISTS (SELECT 1 FROM pg_roles WHERE rolname = 'zendbx_platform')
            """)
            
            if platform_exists:
                await conn.execute("""
                    GRANT SELECT, INSERT, UPDATE, DELETE ON project_db_credentials 
                    TO zendbx_platform
                """)
                results["steps"].append("✅ Granted access to zendbx_platform")
            else:
                results["steps"].append("⚠️ zendbx_platform role not found - using neondb_owner")
            
            # Step 4: Add comment
            results["steps"].append("Adding table comment...")
            await conn.execute("""
                COMMENT ON TABLE project_db_credentials IS 
                'Encrypted database credentials for project-specific PostgreSQL roles. Phase 5.0 security.'
            """)
            results["steps"].append("✅ Comment added")
            
            # Step 5: Create trigger
            results["steps"].append("Creating update trigger...")
            await conn.execute("""
                CREATE OR REPLACE FUNCTION update_project_db_credentials_updated_at()
                RETURNS TRIGGER AS $$
                BEGIN
                    NEW.updated_at = NOW();
                    RETURN NEW;
                END;
                $$ LANGUAGE plpgsql
            """)
            
            await conn.execute("""
                DROP TRIGGER IF EXISTS trigger_update_project_db_credentials_updated_at 
                ON project_db_credentials
            """)
            
            await conn.execute("""
                CREATE TRIGGER trigger_update_project_db_credentials_updated_at
                BEFORE UPDATE ON project_db_credentials
                FOR EACH ROW
                EXECUTE FUNCTION update_project_db_credentials_updated_at()
            """)
            results["steps"].append("✅ Trigger created")
            
            # Verify table was created
            results["table_exists_after"] = await conn.fetchval("""
                SELECT EXISTS (
                    SELECT 1 FROM information_schema.tables 
                    WHERE table_schema = 'public' 
                    AND table_name = 'project_db_credentials'
                )
            """)
            
            # Count projects
            project_count = await conn.fetchval("SELECT COUNT(*) FROM projects")
            results["project_count"] = project_count
            
            if results["table_exists_after"]:
                results["status"] = "success"
                results["message"] = f"Migration 003 applied successfully. {project_count} projects exist."
            else:
                results["status"] = "failed"
                results["message"] = "Table creation failed - verification failed"
                
        finally:
            await conn.close()
            
    except Exception as e:
        results["status"] = "error"
        results["errors"].append(str(e))
        results["message"] = f"Migration failed: {str(e)}"
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=results
        )
    
    return results
