"""
EMERGENCY PROVISIONING ENDPOINT
Provision credentials for all projects missing them

This endpoint is TEMPORARY and should be removed after provisioning is complete.
Access: Admin only (requires SECRET_KEY as header)
"""
from fastapi import APIRouter, HTTPException, Header, status
from app.core.config import settings
from app.core.db_roles import ProjectRoleManager, ProjectCredentialStore
import asyncpg

router = APIRouter()

@router.post("/emergency/provision-all-projects", include_in_schema=False)
async def emergency_provision_all_projects(
    x_admin_secret: str = Header(None, alias="X-Admin-Secret")
):
    """
    Provision isolated roles and credentials for all existing projects
    
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
        "projects": [],
        "provisioned": 0,
        "existed": 0,
        "failed": 0,
        "errors": []
    }
    
    try:
        # Connect as admin
        admin_conn = await asyncpg.connect(settings.DATABASE_URL)
        
        try:
            # Get list of project schemas
            schemas = await admin_conn.fetch("""
                SELECT schema_name 
                FROM information_schema.schemata 
                WHERE schema_name LIKE 'proj_%'
                ORDER BY schema_name
            """)
            
            schema_names = [s['schema_name'] for s in schemas]
            results["schema_count"] = len(schema_names)
            
            # Get projects that match these schemas
            projects = await admin_conn.fetch("""
                SELECT p.id, p.name, p.slug, p.database_name
                FROM projects p
                WHERE p.database_name = ANY($1)
                ORDER BY p.created_at
            """, schema_names)
            
            results["project_count"] = len(projects)
            
            if not projects:
                results["status"] = "no_projects"
                results["message"] = "No projects found to provision"
                return results
            
            # Create pool wrapper for provisioning
            class SimplePoolWrapper:
                def __init__(self, conn):
                    self._conn = conn
                
                def acquire(self):
                    return self
                
                async def __aenter__(self):
                    return self._conn
                
                async def __aexit__(self, *args):
                    pass
            
            provisioner_pool = SimplePoolWrapper(admin_conn)
            credential_store = ProjectCredentialStore()
            
            # Provision each project
            for proj in projects:
                project_id = proj['id']
                schema_name = proj['database_name']
                project_name = proj['name']
                
                project_result = {
                    "project_id": str(project_id),
                    "name": project_name,
                    "schema": schema_name,
                    "status": "pending"
                }
                
                # Generate role name
                role_name = ProjectRoleManager.generate_project_role_name(project_id)
                project_result["role_name"] = role_name
                
                try:
                    # Try to create role
                    role_name, password = await ProjectRoleManager.create_project_role(
                        project_id,
                        schema_name,
                        provisioner_pool
                    )
                    
                    # Store credentials
                    await credential_store.store_credentials(
                        project_id,
                        role_name,
                        password
                    )
                    
                    project_result["status"] = "provisioned"
                    results["provisioned"] += 1
                    
                except Exception as e:
                    error_msg = str(e)
                    
                    if 'already exists' in error_msg.lower():
                        project_result["status"] = "checking_existing"
                        
                        # Check if credentials exist
                        try:
                            creds = await credential_store.get_credentials(project_id)
                            if creds:
                                project_result["status"] = "existed"
                                results["existed"] += 1
                            else:
                                # Reset password for existing role
                                new_password = ProjectRoleManager.generate_secure_password()
                                
                                await admin_conn.execute(f"""
                                    ALTER ROLE {role_name} 
                                    PASSWORD '{new_password.replace("'", "''")}'
                                """)
                                
                                await credential_store.store_credentials(
                                    project_id,
                                    role_name,
                                    new_password
                                )
                                
                                project_result["status"] = "password_reset"
                                results["provisioned"] += 1
                                
                        except Exception as cred_error:
                            project_result["status"] = "failed"
                            project_result["error"] = str(cred_error)
                            results["failed"] += 1
                            results["errors"].append({
                                "project_id": str(project_id),
                                "error": str(cred_error)
                            })
                    else:
                        project_result["status"] = "failed"
                        project_result["error"] = error_msg
                        results["failed"] += 1
                        results["errors"].append({
                            "project_id": str(project_id),
                            "error": error_msg
                        })
                
                results["projects"].append(project_result)
            
        finally:
            await admin_conn.close()
        
        # Set final status
        if results["failed"] > 0:
            results["status"] = "partial_success"
            results["message"] = f"Provisioned {results['provisioned']}, existed {results['existed']}, failed {results['failed']}"
        else:
            results["status"] = "success"
            results["message"] = f"All {results['project_count']} projects provisioned successfully"
        
    except Exception as e:
        results["status"] = "error"
        results["message"] = str(e)
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=results
        )
    
    return results
