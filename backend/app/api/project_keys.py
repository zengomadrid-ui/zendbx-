from fastapi import APIRouter, HTTPException, Depends, status
from app.api.auth import get_current_user
from uuid import UUID
import psycopg2

router = APIRouter()

@router.get("/projects/{project_id}/keys-new", response_model=dict)
async def get_project_keys_new(
    project_id: UUID,
    current_user: dict = Depends(get_current_user)
):
    """Get project API keys with FULL keys visible - NEW ENDPOINT"""
    
    try:
        conn = psycopg2.connect(
            host="localhost",
            port=5432,
            database="nexora_main",
            user="postgres",
            password="Pawan@121"
        )
        cursor = conn.cursor()
        
        # Verify ownership
        cursor.execute(
            "SELECT id FROM projects WHERE id = %s AND user_id = %s",
            (str(project_id), str(current_user["id"]))
        )
        
        if not cursor.fetchone():
            cursor.close()
            conn.close()
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND,
                detail="Project not found"
            )
        
        # Get keys with full encrypted_key
        cursor.execute(
            """
            SELECT id, name, key_prefix, encrypted_key, key_type, role, is_active, created_at
            FROM api_keys
            WHERE project_id = %s AND key_type IN ('anon', 'service_role')
            ORDER BY key_type
            """,
            (str(project_id),)
        )
        
        rows = cursor.fetchall()
        cursor.close()
        conn.close()
        
        keys = {}
        for row in rows:
            # Use encrypted_key if available, otherwise fall back to key_prefix
            full_key = row[3] if row[3] else row[2]
            
            key_data = {
                "id": str(row[0]),
                "name": row[1],
                "key_prefix": full_key,  # Full JWT or truncated prefix
                "role": row[5],
                "is_active": row[6],
                "created_at": row[7].isoformat()
            }
            
            key_type = row[4]
            
            if key_type == "anon":
                keys["anon"] = key_data
            elif key_type == "service_role":
                keys["service_role"] = key_data
        
        return {
            "project_id": str(project_id),
            "keys": keys,
            "version": "BRAND_NEW_FILE_V1"
        }
        
    except Exception as e:
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Failed to fetch keys: {str(e)}"
        )
