from fastapi import APIRouter, HTTPException, Depends, status
from app.models.schemas import (
    ProjectCreate, ProjectUpdate, ProjectResponse,
    ProjectWithStats, MessageResponse, ProjectWithURLs
)
from app.api.auth import get_current_user
from app.core.database import (
    execute_on_main_db, create_project_database, drop_project_database
)
from typing import List
from uuid import UUID
import secrets
import hashlib
import re

router = APIRouter()

# ============================================
# HELPER: Generate Supabase-style API Keys
# ============================================

def generate_supabase_key(key_type: str) -> tuple[str, str, str]:
    """
    Generate Supabase-style API key
    Returns: (full_key, key_hash, key_prefix)
    """
    # Generate JWT-like key (similar to Supabase)
    random_bytes = secrets.token_bytes(32)
    full_key = f"eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.{random_bytes.hex()}"
    
    # Hash for storage
    key_hash = hashlib.sha256(full_key.encode()).hexdigest()
    
    # Prefix for display (shortened to fit VARCHAR(20))
    key_prefix = full_key[:17] + "..."
    
    return full_key, key_hash, key_prefix

# ============================================
# HELPER: Create Default Project Keys
# ============================================

async def create_default_project_keys(project_id: UUID, user_id: UUID, jwt_secret: str, slug: str) -> dict:
    """Create anon and service_role JWT keys for a new project."""
    import jwt as pyjwt
    from datetime import datetime

    def make_key(role: str) -> str:
        payload = {
            "iss": "zendbx",
            "project_id": str(project_id),
            "project_slug": slug,
            "role": role,
            "iat": datetime.utcnow(),
            # No exp — project keys don't expire
        }
        return pyjwt.encode(payload, jwt_secret, algorithm="HS256")

    anon_key = make_key("anon")
    service_key = make_key("service_role")

    anon_hash = hashlib.sha256(anon_key.encode()).hexdigest()
    service_hash = hashlib.sha256(service_key.encode()).hexdigest()

    await execute_on_main_db(
        """
        INSERT INTO api_keys (user_id, project_id, name, key_hash, key_prefix, encrypted_key, role, key_type, is_active)
        VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9)
        """,
        user_id, project_id, "anon (public)", anon_hash, anon_key[:17] + "...", anon_key, "read", "anon", True
    )

    await execute_on_main_db(
        """
        INSERT INTO api_keys (user_id, project_id, name, key_hash, key_prefix, encrypted_key, role, key_type, is_active)
        VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9)
        """,
        user_id, project_id, "service_role (secret)", service_hash, service_key[:17] + "...", service_key, "admin", "service_role", True
    )

    return {"anon_key": anon_key, "service_role_key": service_key}

# ============================================
# HELPER: Generate Project Slug
# ============================================

def generate_slug_from_name(name: str, project_id: UUID) -> str:
    """Generate URL-friendly slug from project name"""
    # Convert to lowercase and replace spaces/special chars with hyphens
    slug = name.lower()
    slug = re.sub(r'[^a-z0-9]+', '-', slug)
    slug = slug.strip('-')
    
    # Add short UUID suffix for uniqueness: "my-todo-app-a18a05a0"
    slug = f"{slug}-{str(project_id)[:8]}"
    
    return slug

# ============================================
# HELPER: Generate Database Name
# ============================================

async def generate_unique_db_name() -> str:
    """Generate unique database name"""
    while True:
        db_name = f"proj_{secrets.token_hex(4)}"
        
        # Check if exists
        result = await execute_on_main_db(
            "SELECT id FROM projects WHERE database_name = $1",
            db_name
        )
        
        if not result:
            return db_name

# ============================================
# LIST PROJECTS
# ============================================

@router.get("", response_model=List[ProjectResponse])
async def list_projects(current_user: dict = Depends(get_current_user)):
    """Get all projects for current user"""
    
    result = await execute_on_main_db(
        """
        SELECT id, user_id, name, slug, description, database_name, status, created_at, updated_at
        FROM projects
        WHERE user_id = $1
        ORDER BY created_at DESC
        """,
        current_user["id"]
    )
    
    return [ProjectResponse(**dict(row)) for row in result]

# ============================================
# CREATE PROJECT
# ============================================

@router.post("", response_model=ProjectResponse, status_code=status.HTTP_201_CREATED)
async def create_project(
    project_data: ProjectCreate,
    current_user: dict = Depends(get_current_user)
):
    """Create a new project (creates a new PostgreSQL database)"""
    
    # Check project limit for free tier
    user_plan = current_user.get("plan") or "free"
    if user_plan == "free":
        count_result = await execute_on_main_db(
            "SELECT COUNT(*) as count FROM projects WHERE user_id = $1",
            current_user["id"]
        )
        
        project_count = int(count_result[0]["count"]) if count_result else 0
        FREE_TIER_LIMIT = 5  # Generous free tier
        
        if project_count >= FREE_TIER_LIMIT:
            raise HTTPException(
                status_code=status.HTTP_403_FORBIDDEN,
                detail=f"Free tier limited to {FREE_TIER_LIMIT} projects. Upgrade to Pro for unlimited projects."
            )
    
    # Generate unique database name
    db_name = await generate_unique_db_name()
    
    # Create PostgreSQL database
    success = await create_project_database(db_name)
    
    if not success:
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail="Failed to create project database"
        )
    
    # Store project metadata
    try:
        # Generate JWT secret (32 bytes = 256 bits for HS256)
        jwt_secret = secrets.token_urlsafe(32)
        
        result = await execute_on_main_db(
            """
            INSERT INTO projects (user_id, name, description, database_name, slug, jwt_secret)
            VALUES ($1, $2, $3, $4, $5, $6)
            RETURNING id, user_id, name, slug, description, database_name, status, created_at, updated_at
            """,
            current_user["id"],
            project_data.name,
            project_data.description,
            db_name,
            "",  # Temporary, will be updated below
            jwt_secret
        )
        
        project = dict(result[0])
        project_id = project["id"]
        
        # Generate slug using project_id
        slug = generate_slug_from_name(project_data.name, project_id)
        
        # Update with generated slug
        await execute_on_main_db(
            "UPDATE projects SET slug = $1 WHERE id = $2",
            slug,
            project_id
        )
        
        project["slug"] = slug
        
        # Initialize quota tracking
        await execute_on_main_db(
            """
            INSERT INTO project_quotas (project_id)
            VALUES ($1)
            """,
            project_id
        )
        
        # Generate Supabase-style JWT keys (self-validating, no DB lookup needed)
        import jwt as pyjwt
        from datetime import datetime
        
        now_ts = int(datetime.utcnow().timestamp())
        
        anon_payload = {
            "iss": "zendbx",
            "project_id": str(project_id),
            "project_slug": slug,
            "role": "anon",
            "iat": now_ts,
        }
        service_payload = {
            "iss": "zendbx",
            "project_id": str(project_id),
            "project_slug": slug,
            "role": "service_role",
            "iat": now_ts,
        }
        
        anon_key = pyjwt.encode(anon_payload, jwt_secret, algorithm="HS256")
        service_key = pyjwt.encode(service_payload, jwt_secret, algorithm="HS256")
        
        # Store keys in api_keys table for display in dashboard
        anon_hash = hashlib.sha256(anon_key.encode()).hexdigest()
        service_hash = hashlib.sha256(service_key.encode()).hexdigest()
        
        await execute_on_main_db(
            """
            INSERT INTO api_keys (user_id, project_id, name, key_hash, key_prefix, encrypted_key, role, key_type, is_active)
            VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9)
            """,
            current_user["id"], project_id, "anon (public)",
            anon_hash, anon_key[:17] + "...", anon_key, "read", "anon", True
        )
        await execute_on_main_db(
            """
            INSERT INTO api_keys (user_id, project_id, name, key_hash, key_prefix, encrypted_key, role, key_type, is_active)
            VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9)
            """,
            current_user["id"], project_id, "service_role (secret)",
            service_hash, service_key[:17] + "...", service_key, "admin", "service_role", True
        )
        
        # Add keys to response (only shown once!)
        project["anon_key"] = anon_key
        project["service_role_key"] = service_key
        
        return ProjectResponse(**project)
        
    except Exception as e:
        # Rollback: drop the database if metadata creation failed
        await drop_project_database(db_name)
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Failed to create project: {str(e)}"
        )

# ============================================
# GET PROJECT
# ============================================

@router.get("/{project_id}", response_model=ProjectWithStats)
async def get_project(
    project_id: UUID,
    current_user: dict = Depends(get_current_user)
):
    """Get project details with statistics"""
    
    # Get project
    result = await execute_on_main_db(
        """
        SELECT id, user_id, name, slug, description, database_name, status, created_at, updated_at
        FROM projects
        WHERE id = $1 AND user_id = $2
        """,
        project_id,
        current_user["id"]
    )
    
    if not result:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Project not found"
        )
    
    project = dict(result[0])
    
    # Get statistics
    stats_result = await execute_on_main_db(
        """
        SELECT 
            COUNT(DISTINCT ut.id) as table_count,
            COALESCE(SUM(ut.row_count), 0) as total_rows,
            COALESCE(SUM(ut.size_bytes), 0) as total_size_bytes,
            (SELECT COUNT(*) FROM query_history WHERE project_id = $1) as query_count
        FROM user_tables ut
        WHERE ut.project_id = $1
        """,
        project_id
    )
    
    stats = dict(stats_result[0]) if stats_result else {
        "table_count": 0,
        "total_rows": 0,
        "total_size_bytes": 0,
        "query_count": 0
    }
    
    return ProjectWithStats(
        **project,
        stats=stats
    )

# ============================================
# UPDATE PROJECT
# ============================================

@router.put("/{project_id}", response_model=ProjectResponse)
async def update_project(
    project_id: UUID,
    update_data: ProjectUpdate,
    current_user: dict = Depends(get_current_user)
):
    """Update project details"""
    
    # Check ownership
    result = await execute_on_main_db(
        "SELECT id FROM projects WHERE id = $1 AND user_id = $2",
        project_id,
        current_user["id"]
    )
    
    if not result:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Project not found"
        )
    
    # Build update query
    updates = []
    values = []
    param_count = 1
    
    if update_data.name is not None:
        updates.append(f"name = ${param_count}")
        values.append(update_data.name)
        param_count += 1
    
    if update_data.description is not None:
        updates.append(f"description = ${param_count}")
        values.append(update_data.description)
        param_count += 1
    
    if not updates:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="No fields to update"
        )
    
    # Add project_id to values
    values.append(project_id)
    
    # Execute update
    query = f"""
        UPDATE projects 
        SET {', '.join(updates)}, updated_at = NOW()
        WHERE id = ${param_count}
        RETURNING id, user_id, name, slug, description, database_name, status, created_at, updated_at
    """
    
    result = await execute_on_main_db(query, *values)
    
    return ProjectResponse(**dict(result[0]))

# ============================================
# DELETE PROJECT
# ============================================

@router.delete("/{project_id}", response_model=MessageResponse)
async def delete_project(
    project_id: UUID,
    current_user: dict = Depends(get_current_user)
):
    """Delete project and its database"""
    
    # Get project
    result = await execute_on_main_db(
        "SELECT database_name FROM projects WHERE id = $1 AND user_id = $2",
        project_id,
        current_user["id"]
    )
    
    if not result:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Project not found"
        )
    
    db_name = result[0]["database_name"]
    
    # Drop PostgreSQL database
    success = await drop_project_database(db_name)
    
    if not success:
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail="Failed to delete project database"
        )
    
    # Delete project metadata (cascade will delete related records)
    await execute_on_main_db(
        "DELETE FROM projects WHERE id = $1",
        project_id
    )
    
    return MessageResponse(
        message="Project deleted successfully",
        success=True
    )

# ============================================
# GET PROJECT API URLS
# ============================================

@router.get("/{project_id}/api-urls", response_model=ProjectWithURLs)
async def get_project_api_urls(
    project_id: UUID,
    current_user: dict = Depends(get_current_user)
):
    """Get project API URLs for external access"""
    
    # Get project
    result = await execute_on_main_db(
        """
        SELECT id, user_id, name, slug, description, database_name, status, created_at, updated_at
        FROM projects
        WHERE id = $1 AND user_id = $2
        """,
        project_id,
        current_user["id"]
    )
    
    if not result:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Project not found"
        )
    
    project = dict(result[0])
    slug = project["slug"]
    
    # Generate API URLs
    # In production, replace localhost:8000 with your actual domain
    return ProjectWithURLs(
        **project,
        api_url_subdomain=f"http://{slug}.localhost:8000",
        api_url_path=f"http://localhost:8000/p/{slug}"
    )

# ============================================
# GET PROJECT KEYS
# ============================================

@router.get("/{project_id}/keys", response_model=dict)
async def get_project_keys(
    project_id: UUID,
    current_user: dict = Depends(get_current_user),
    reveal: bool = True  # Default to True to always return full keys
):
    """Get project API keys (anon and service_role) - returns FULL keys by default for production use"""
    
    # Verify ownership
    result = await execute_on_main_db(
        "SELECT id FROM projects WHERE id = $1 AND user_id = $2",
        project_id,
        current_user["id"]
    )
    
    if not result:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Project not found"
        )
    
    # Get keys
    keys_result = await execute_on_main_db(
        """
        SELECT id, name, key_prefix, encrypted_key, key_type, role, is_active, created_at
        FROM api_keys
        WHERE project_id = $1 AND key_type IN ('anon', 'service_role')
        ORDER BY key_type
        """,
        project_id
    )
    
    keys = {}
    for key in keys_result:
        # ALWAYS return the complete encrypted_key - this is the working credential
        full_working_key = key["encrypted_key"] if key["encrypted_key"] else key["key_prefix"]
        
        key_data = {
            "id": str(key["id"]),
            "name": key["name"],
            "key_prefix": key["key_prefix"],  # Keep for display purposes
            "full_key": full_working_key,  # ALWAYS the complete working key
            "encrypted_key": key["encrypted_key"],  # ALWAYS include the full encrypted key
            "role": key["role"],
            "is_active": key["is_active"],
            "created_at": key["created_at"].isoformat()
        }
        
        if key["key_type"] == "anon":
            keys["anon"] = key_data
        elif key["key_type"] == "service_role":
            keys["service_role"] = key_data
    
    return {
        "project_id": str(project_id),
        "keys": keys
    }

# ============================================
# REGENERATE PROJECT KEYS
# ============================================

@router.post("/{project_id}/regenerate-keys", response_model=dict)
async def regenerate_project_keys(
    project_id: UUID,
    current_user: dict = Depends(get_current_user)
):
    """
    Regenerate anon and service_role JWT keys for a project.
    Deletes existing anon/service_role keys and creates fresh ones
    signed with the project's jwt_secret.
    """
    import jwt as pyjwt
    from datetime import datetime

    # Verify ownership and fetch jwt_secret + slug
    result = await execute_on_main_db(
        "SELECT id, slug, jwt_secret FROM projects WHERE id = $1 AND user_id = $2",
        project_id,
        current_user["id"]
    )

    if not result:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Project not found"
        )

    project = dict(result[0])
    jwt_secret = project.get("jwt_secret")
    slug = project.get("slug", "")

    if not jwt_secret:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Project has no JWT secret — cannot regenerate keys. Please contact support."
        )

    now_ts = int(datetime.utcnow().timestamp())

    anon_key = pyjwt.encode(
        {"iss": "zendbx", "project_id": str(project_id), "project_slug": slug, "role": "anon", "iat": now_ts},
        jwt_secret,
        algorithm="HS256"
    )
    service_key = pyjwt.encode(
        {"iss": "zendbx", "project_id": str(project_id), "project_slug": slug, "role": "service_role", "iat": now_ts},
        jwt_secret,
        algorithm="HS256"
    )

    anon_hash    = hashlib.sha256(anon_key.encode()).hexdigest()
    service_hash = hashlib.sha256(service_key.encode()).hexdigest()

    # Delete old anon / service_role keys for this project
    await execute_on_main_db(
        "DELETE FROM api_keys WHERE project_id = $1 AND key_type IN ('anon', 'service_role')",
        project_id
    )

    # Insert fresh keys
    await execute_on_main_db(
        """
        INSERT INTO api_keys (user_id, project_id, name, key_hash, key_prefix, encrypted_key, role, key_type, is_active)
        VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9)
        """,
        current_user["id"], project_id, "anon (public)",
        anon_hash, anon_key[:20] + "...", anon_key, "read", "anon", True
    )
    await execute_on_main_db(
        """
        INSERT INTO api_keys (user_id, project_id, name, key_hash, key_prefix, encrypted_key, role, key_type, is_active)
        VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9)
        """,
        current_user["id"], project_id, "service_role (secret)",
        service_hash, service_key[:20] + "...", service_key, "admin", "service_role", True
    )

    return {
        "project_id": str(project_id),
        "anon_key": anon_key,
        "service_role_key": service_key,
        "message": "Keys regenerated successfully"
    }
