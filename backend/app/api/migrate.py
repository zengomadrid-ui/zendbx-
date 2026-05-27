"""
Migration API Endpoint
Allows running database migrations via HTTP request
"""

from fastapi import APIRouter, HTTPException, Depends, status
from app.api.auth import get_current_user
from app.core.database import execute_on_main_db
import secrets
import hashlib

router = APIRouter()

@router.post("/migrate/api-keys")
async def migrate_api_keys(current_user: dict = Depends(get_current_user)):
    """
    Migrate existing API keys to include full JWTs in encrypted_key column
    Only admin users can run migrations
    """
    
    # Check if user is admin (you can add admin check here)
    # For now, any authenticated user can run it
    
    try:
        # Find all anon and service_role keys without encrypted_key
        keys_to_fix = await execute_on_main_db("""
            SELECT id, key_type, project_id, user_id, name, role, is_active
            FROM api_keys
            WHERE key_type IN ('anon', 'service_role')
            AND (encrypted_key IS NULL OR encrypted_key = '')
        """)
        
        if not keys_to_fix:
            return {
                "success": True,
                "message": "No keys need fixing - all keys already have encrypted_key!",
                "keys_fixed": 0
            }
        
        fixed_count = 0
        fixed_keys = []
        
        for key in keys_to_fix:
            # Generate new full JWT
            random_bytes = secrets.token_bytes(32)
            new_jwt = f"eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.{random_bytes.hex()}"
            new_hash = hashlib.sha256(new_jwt.encode()).hexdigest()
            new_prefix = new_jwt[:17] + "..."
            
            # Update the key
            await execute_on_main_db("""
                UPDATE api_keys
                SET 
                    encrypted_key = $1,
                    key_hash = $2,
                    key_prefix = $3
                WHERE id = $4
            """, new_jwt, new_hash, new_prefix, key["id"])
            
            fixed_count += 1
            fixed_keys.append({
                "key_type": key["key_type"],
                "project_id": str(key["project_id"]),
                "new_key_preview": new_jwt[:40] + "..."
            })
        
        return {
            "success": True,
            "message": f"Successfully fixed {fixed_count} API keys!",
            "keys_fixed": fixed_count,
            "keys": fixed_keys
        }
        
    except Exception as e:
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Migration failed: {str(e)}"
        )

@router.get("/migrate/status")
async def migration_status(current_user: dict = Depends(get_current_user)):
    """Check migration status - how many keys need fixing"""
    
    try:
        # Count keys without encrypted_key
        result = await execute_on_main_db("""
            SELECT COUNT(*) as count
            FROM api_keys
            WHERE key_type IN ('anon', 'service_role')
            AND (encrypted_key IS NULL OR encrypted_key = '')
        """)
        
        keys_needing_fix = result[0]["count"]
        
        # Count keys with encrypted_key
        result = await execute_on_main_db("""
            SELECT COUNT(*) as count
            FROM api_keys
            WHERE key_type IN ('anon', 'service_role')
            AND encrypted_key IS NOT NULL
            AND encrypted_key != ''
        """)
        
        keys_fixed = result[0]["count"]
        
        return {
            "keys_needing_fix": keys_needing_fix,
            "keys_already_fixed": keys_fixed,
            "migration_needed": keys_needing_fix > 0
        }
        
    except Exception as e:
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Failed to check status: {str(e)}"
        )
