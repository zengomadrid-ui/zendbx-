"""
Admin API: Fix SQL Editor Privileges
One-time endpoint to grant ALL privileges to all project roles
"""
from fastapi import APIRouter, HTTPException, Header
from app.core.config import settings
from app.core.database import get_main_db_pool
import logging

router = APIRouter()
logger = logging.getLogger(__name__)


@router.post("/admin/fix-all-privileges", include_in_schema=False)
async def fix_all_privileges(
    x_admin_secret: str = Header(None, alias="X-Admin-Secret")
):
    """
    Emergency endpoint to grant ALL privileges to all project roles
    
    Security: Requires SECRET_KEY in X-Admin-Secret header
    Usage: POST to /admin/fix-all-privileges with X-Admin-Secret header
    """
    
    # Verify admin access
    if not x_admin_secret or x_admin_secret != settings.SECRET_KEY:
        raise HTTPException(status_code=403, detail="Unauthorized")
    
    results = {
        "status": "starting",
        "projects": [],
        "fixed": 0,
        "already_ok": 0,
        "failed": 0
    }
    
    try:
        pool = await get_main_db_pool()
        
        async with pool.acquire() as conn:
            # Get all projects with credentials
            projects = await conn.fetch("""
                SELECT 
                    p.id,
                    p.name,
                    p.slug,
                    COALESCE(p.schema_name, p.database_name) as schema,
                    pdc.role_name
                FROM projects p
                JOIN project_db_credentials pdc ON pdc.project_id = p.id
                WHERE COALESCE(p.schema_name, p.database_name) LIKE 'proj_%'
                ORDER BY p.name
            """)
            
            results["total_projects"] = len(projects)
            
            for proj in projects:
                schema = proj['schema']
                role_name = proj['role_name']
                project_name = proj['name']
                
                project_result = {
                    "name": project_name,
                    "schema": schema,
                    "role": role_name,
                    "status": "pending"
                }
                
                try:
                    # Check current privileges
                    has_usage = await conn.fetchval(f"""
                        SELECT has_schema_privilege('{role_name}', '{schema}', 'USAGE')
                    """)
                    
                    has_create = await conn.fetchval(f"""
                        SELECT has_schema_privilege('{role_name}', '{schema}', 'CREATE')
                    """)
                    
                    if has_usage and has_create:
                        project_result["status"] = "already_ok"
                        project_result["message"] = "Already has correct privileges"
                        results["already_ok"] += 1
                        results["projects"].append(project_result)
                        continue
                    
                    # Grant all privileges
                    await conn.execute(f'GRANT USAGE, CREATE ON SCHEMA "{schema}" TO {role_name}')
                    await conn.execute(f'GRANT ALL PRIVILEGES ON ALL TABLES IN SCHEMA "{schema}" TO {role_name}')
                    await conn.execute(f'GRANT ALL PRIVILEGES ON ALL SEQUENCES IN SCHEMA "{schema}" TO {role_name}')
                    await conn.execute(f'GRANT ALL PRIVILEGES ON ALL FUNCTIONS IN SCHEMA "{schema}" TO {role_name}')
                    
                    # Set default privileges for future objects
                    current_user = await conn.fetchval("SELECT current_user")
                    
                    await conn.execute(f"""
                        ALTER DEFAULT PRIVILEGES FOR ROLE {current_user} IN SCHEMA "{schema}"
                        GRANT ALL PRIVILEGES ON TABLES TO {role_name}
                    """)
                    await conn.execute(f"""
                        ALTER DEFAULT PRIVILEGES FOR ROLE {current_user} IN SCHEMA "{schema}"
                        GRANT ALL PRIVILEGES ON SEQUENCES TO {role_name}
                    """)
                    await conn.execute(f"""
                        ALTER DEFAULT PRIVILEGES FOR ROLE {current_user} IN SCHEMA "{schema}"
                        GRANT ALL PRIVILEGES ON FUNCTIONS TO {role_name}
                    """)
                    
                    # Verify
                    has_create_after = await conn.fetchval(f"""
                        SELECT has_schema_privilege('{role_name}', '{schema}', 'CREATE')
                    """)
                    
                    if has_create_after:
                        project_result["status"] = "fixed"
                        project_result["message"] = "Privileges granted successfully"
                        results["fixed"] += 1
                    else:
                        project_result["status"] = "verification_failed"
                        project_result["message"] = "Privileges granted but verification failed"
                        results["failed"] += 1
                    
                except Exception as e:
                    project_result["status"] = "error"
                    project_result["error"] = str(e)
                    results["failed"] += 1
                
                results["projects"].append(project_result)
            
            # Set final status
            if results["failed"] > 0:
                results["status"] = "partial_success"
            else:
                results["status"] = "success"
            
            results["message"] = f"Fixed {results['fixed']}, already OK {results['already_ok']}, failed {results['failed']}"
            
            logger.info(f"Privilege fix completed: {results['message']}")
            
    except Exception as e:
        results["status"] = "error"
        results["message"] = str(e)
        logger.error(f"Privilege fix failed: {e}")
        raise HTTPException(status_code=500, detail=results)
    
    return results
