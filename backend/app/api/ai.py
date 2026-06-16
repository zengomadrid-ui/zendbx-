from fastapi import APIRouter, HTTPException, Depends, status
from app.models.schemas import (
    AIQueryRequest, AIQueryResponse,
    AIExplainRequest, AIExplainResponse
)
from app.api.auth import get_current_user
from app.core.database import execute_on_main_db
from app.services.ai_service import ai_service
from app.services.backend_generator import backend_generator
from typing import List, Dict, Any
from uuid import UUID

router = APIRouter()

# ============================================
# HELPER: Verify Project Ownership
# ============================================

async def verify_project_access(project_id: UUID, user_id: UUID) -> dict:
    """Verify user has access to project"""
    result = await execute_on_main_db(
        "SELECT * FROM projects WHERE id = $1 AND user_id = $2",
        project_id,
        user_id
    )
    
    if not result:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Project not found"
        )
    
    return dict(result[0])

# ============================================
# HELPER: Get Table Schemas
# ============================================

async def get_project_table_schemas(project_id: UUID) -> List[Dict[str, Any]]:
    """Get all table schemas for a project"""
    result = await execute_on_main_db(
        """
        SELECT table_name, schema_definition
        FROM user_tables
        WHERE project_id = $1
        """,
        project_id
    )
    
    schemas = []
    for row in result:
        schema_def = row["schema_definition"]
        
        # Handle both string and dict formats
        if isinstance(schema_def, str):
            try:
                import json
                schema_def = json.loads(schema_def)
            except (json.JSONDecodeError, TypeError):
                schema_def = {}
        elif schema_def is None:
            schema_def = {}
        
        schemas.append({
            "table_name": row["table_name"],
            "columns": schema_def.get("columns", []) if isinstance(schema_def, dict) else []
        })
    
    return schemas

# ============================================
# NATURAL LANGUAGE TO SQL
# ============================================

@router.post("/{project_id}/query", response_model=AIQueryResponse)
async def natural_language_query(
    project_id: UUID,
    request: AIQueryRequest,
    current_user: dict = Depends(get_current_user)
):
    """Convert natural language question to SQL query"""
    
    await verify_project_access(project_id, current_user["id"])
    
    # Get table schemas for context
    table_schemas = await get_project_table_schemas(project_id)
    
    if not table_schemas:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="No tables found in project. Create tables first."
        )
    
    try:
        # Call AI service
        result = await ai_service.natural_language_to_sql(
            question=request.question,
            table_schemas=table_schemas,
            model=request.model
        )
        
        # Generate explanation
        explanation_result = await ai_service.explain_sql(result["sql"])
        
        return AIQueryResponse(
            question=request.question,
            sql=result["sql"],
            explanation=explanation_result.get("summary", "SQL query generated successfully"),
            confidence=result.get("confidence", 0.85)
        )
        
    except Exception as e:
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Failed to generate SQL: {str(e)}"
        )

# ============================================
# EXPLAIN SQL QUERY
# ============================================

@router.post("/{project_id}/explain", response_model=AIExplainResponse)
async def explain_query(
    project_id: UUID,
    request: AIExplainRequest,
    current_user: dict = Depends(get_current_user)
):
    """Explain what a SQL query does in plain English"""
    
    await verify_project_access(project_id, current_user["id"])
    
    try:
        result = await ai_service.explain_sql(request.sql)
        
        return AIExplainResponse(
            sql=request.sql,
            explanation=result.get("summary", ""),
            steps=result.get("steps", [])
        )
        
    except Exception as e:
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Failed to explain query: {str(e)}"
        )

# ============================================
# GET QUERY SUGGESTIONS
# ============================================

@router.get("/{project_id}/suggest")
async def get_query_suggestions(
    project_id: UUID,
    current_user: dict = Depends(get_current_user)
):
    """Get AI-generated query suggestions based on table schemas"""
    
    await verify_project_access(project_id, current_user["id"])
    
    # Get table schemas
    table_schemas = await get_project_table_schemas(project_id)
    
    if not table_schemas:
        return {"suggestions": []}
    
    # Get recent queries for context
    recent_result = await execute_on_main_db(
        """
        SELECT sql_query
        FROM query_history
        WHERE project_id = $1 AND user_id = $2 AND status = 'success'
        ORDER BY created_at DESC
        LIMIT 5
        """,
        project_id,
        current_user["id"]
    )
    
    recent_queries = [row["sql_query"] for row in recent_result]
    
    try:
        suggestions = await ai_service.suggest_queries(
            table_schemas=table_schemas,
            recent_queries=recent_queries
        )
        
        return {"suggestions": suggestions}
        
    except Exception as e:
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Failed to generate suggestions: {str(e)}"
        )

# ============================================
# GET DATA INSIGHTS
# ============================================

@router.get("/{project_id}/insights")
async def get_data_insights(
    project_id: UUID,
    table_name: str,
    current_user: dict = Depends(get_current_user)
):
    """Get AI-generated insights about a specific table"""
    
    project = await verify_project_access(project_id, current_user["id"])
    
    # This would analyze the table data and provide insights
    # For now, return a placeholder
    
    return {
        "table": table_name,
        "insights": [
            "This feature is coming soon!",
            "AI will analyze your data and provide insights like:",
            "- Data quality issues",
            "- Interesting patterns",
            "- Suggested optimizations",
            "- Anomaly detection"
        ]
    }

# ============================================
# EXPLAIN SQL ERROR
# ============================================

@router.post("/{project_id}/explain-error")
async def explain_error(
    project_id: UUID,
    request: dict,
    current_user: dict = Depends(get_current_user)
):
    """Explain SQL error and suggest fixes"""
    
    await verify_project_access(project_id, current_user["id"])
    
    sql = request.get("sql", "")
    error_message = request.get("error", "")
    
    if not sql or not error_message:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Both 'sql' and 'error' fields are required"
        )
    
    # Get table schemas for context
    table_schemas = await get_project_table_schemas(project_id)
    
    try:
        result = await ai_service.explain_error(
            sql=sql,
            error_message=error_message,
            table_schemas=table_schemas
        )
        
        return {
            "sql": sql,
            "error": error_message,
            "explanation": result.get("explanation", ""),
            "problem": result.get("problem", ""),
            "fixed_sql": result.get("fixed_sql", ""),
            "tips": result.get("tips", [])
        }
        
    except Exception as e:
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Failed to explain error: {str(e)}"
        )

# ============================================
# AUTO-FIX SQL QUERY (NEW!)
# ============================================

@router.post("/{project_id}/auto-fix")
async def auto_fix_sql(
    project_id: UUID,
    request: dict,
    current_user: dict = Depends(get_current_user)
):
    """
    🔧 AUTO-FIX SQL QUERY
    
    Automatically fix SQL queries that have errors.
    Acts like an IDE auto-correct engine - instant fixes with no explanations.
    
    Input: { "sql": "SELECT name FROM user WHERE idd = 1;", "error": "relation 'user' does not exist" }
    Output: { "fixed_sql": "SELECT name FROM users WHERE id = 1;" }
    """
    
    await verify_project_access(project_id, current_user["id"])
    
    sql = request.get("sql", "")
    error_message = request.get("error", "")
    
    if not sql:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="'sql' field is required"
        )
    
    if not error_message:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="'error' field is required"
        )
    
    try:
        # Get project schema for context
        from app.api.queries import get_project_schema
        schema = await get_project_schema(project_id)
        
        # Import auto-fix service
        from app.services.sql_autofix_service import sql_autofix
        
        # Attempt auto-fix
        fixed_sql = await sql_autofix.auto_fix_sql(
            sql=sql,
            error_message=error_message,
            schema=schema
        )
        
        if fixed_sql and fixed_sql != sql:
            return {
                "success": True,
                "original_sql": sql,
                "fixed_sql": fixed_sql,
                "message": "SQL auto-fixed successfully"
            }
        else:
            return {
                "success": False,
                "original_sql": sql,
                "fixed_sql": None,
                "message": "Unable to auto-fix this SQL query"
            }
        
    except Exception as e:
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Auto-fix failed: {str(e)}"
        )

# ============================================
# GENERATE COMPLETE BACKEND (NEW!)
# ============================================

@router.post("/{project_id}/generate-backend")
async def generate_backend(
    project_id: UUID,
    request: dict,
    current_user: dict = Depends(get_current_user)
):
    """
    🚀 AI-POWERED BACKEND GENERATOR
    
    Generate a complete backend from natural language description.
    Creates tables, relationships, auth, realtime, and more!
    
    Example descriptions:
    - "Build a chat app backend"
    - "Create a blog platform with posts, comments, and likes"
    - "Build a todo app with projects and tasks"
    - "Create an e-commerce backend with products, orders, and reviews"
    """
    
    await verify_project_access(project_id, current_user["id"])
    
    description = request.get("description", "")
    
    if not description:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="'description' field is required"
        )
    
    if len(description) < 10:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Description is too short. Please provide more details."
        )
    
    try:
        # Generate the backend
        result = await backend_generator.generate_backend(
            project_id=project_id,
            description=description,
            user_id=current_user["id"]
        )
        
        if not result["success"]:
            # Check if tables were actually created despite other failures
            if result.get("tables_created"):
                # Partial success — tables created but some optional features failed
                print(f"⚠️ Partial success: tables created but some optional steps failed")
                print(f"   Tables: {result['tables_created']}")
                print(f"   Errors: {result.get('errors', [])}")
                result["success"] = True  # Treat as success if core tables were created
            else:
                error_msg = result.get("error", "Failed to generate backend")
                print(f"❌ Backend generation failed: {error_msg}")
                raise HTTPException(
                    status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
                    detail=error_msg
                )
        
        return {
            "success": True,
            "description": description,
            "plan": result.get("plan", {}),
            "execution": result.get("execution", {}),
            "summary": result.get("summary", "Backend generated successfully!"),
            "message": "Backend generated successfully! 🎉"
        }
        
    except HTTPException:
        raise
    except Exception as e:
        import traceback
        error_trace = traceback.format_exc()
        print(f"❌ Backend generation error: {str(e)}")
        print(f"❌ Traceback:\n{error_trace}")
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Failed to generate backend: {str(e)}"
        )

