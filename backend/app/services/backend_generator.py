"""
Backend Generator Service - AI-Powered Full Backend Creation

This service orchestrates the creation of complete backends from natural language descriptions.
It can create tables, set up relationships, configure auth, enable realtime, and more.
"""

import httpx
import json
import re
from typing import Dict, List, Any, Optional
from uuid import UUID
from app.core.config import settings
from app.core.database import get_project_db_pool, execute_on_main_db
import asyncpg


class BackendGeneratorService:
    """AI-powered backend generation service"""
    
    def __init__(self):
        # Use Groq - fast and free
        self.api_key = settings.GROQ_API_KEY
        self.base_url = "https://api.groq.com/openai/v1"
        self.model = "llama-3.1-8b-instant"
    
    # ============================================
    # MAIN GENERATION METHOD
    # ============================================
    
    async def generate_backend(
        self,
        project_id: UUID,
        description: str,
        user_id: UUID
    ) -> Dict[str, Any]:
        """
        Generate a complete backend from natural language description
        
        Args:
            project_id: Target project ID
            description: Natural language description (e.g., "Build a chat app backend")
            user_id: User ID for audit trail
            
        Returns:
            Dictionary with generation results and created resources
        """
        
        try:
            # Step 1: Analyze description and generate backend plan
            print(f"🤖 Generating backend plan for: {description[:50]}...")
            plan = await self._generate_backend_plan(description)
            
            if not plan or "error" in plan:
                error_msg = plan.get("error", "Failed to generate backend plan") if plan else "Failed to generate backend plan"
                print(f"❌ Plan generation failed: {error_msg}")
                return {
                    "success": False,
                    "error": error_msg,
                    "description": description
                }
            
            print(f"✅ Plan generated with {len(plan.get('tables', []))} tables")
            
            # Step 2: Execute the plan
            print(f"🔨 Executing backend plan...")
            execution_result = await self._execute_backend_plan(
                project_id=project_id,
                plan=plan,
                user_id=user_id
            )
            
            print(f"✅ Execution complete. Success: {execution_result['success']}")
            
            # Step 3: Generate summary
            summary = self._generate_summary(plan, execution_result)
            
            return {
                "success": execution_result["success"],
                "description": description,
                "plan": plan,
                "execution": execution_result,
                "summary": summary
            }
            
        except Exception as e:
            import traceback
            error_trace = traceback.format_exc()
            print(f"❌ Backend generation exception: {str(e)}")
            print(f"❌ Traceback:\n{error_trace}")
            return {
                "success": False,
                "error": f"Backend generation failed: {str(e)}",
                "description": description
            }
    
    # ============================================
    # STEP 1: GENERATE BACKEND PLAN
    # ============================================
    
    async def _generate_backend_plan(self, description: str) -> Dict[str, Any]:
        """Use AI to generate a detailed backend implementation plan"""
        
        # Try with detailed prompt first
        result = await self._try_generate_plan(description, detailed=True)
        
        # If that fails, try with simpler prompt
        if result and "error" in result:
            print("Detailed prompt failed, trying simpler prompt...")
            result = await self._try_generate_plan(description, detailed=False)
        
        return result
    
    async def _try_generate_plan(self, description: str, detailed: bool = True) -> Dict[str, Any]:
        """Attempt to generate a plan with AI"""
        
        system_prompt = """You are an expert backend architect for Zendbx, a PostgreSQL-based backend platform.

Your capabilities:
- Create tables with proper data types and constraints
- Set up foreign key relationships between tables
- Enable authentication on tables (RLS policies)
- Enable realtime subscriptions on tables
- Create indexes for performance
- Set up triggers and functions

When given a backend description, generate a detailed implementation plan in JSON format.

CRITICAL RULES FOR JSON OUTPUT:
1. Return ONLY valid JSON - no markdown, no code blocks, no explanations, no extra text
2. Use double quotes for all strings (not single quotes)
3. NO trailing commas in arrays or objects
4. All property names must be in double quotes
5. Boolean values must be lowercase: true or false (not True/False)
6. Null values must be lowercase: null (not None)
7. Do NOT include comments in the JSON
8. Start your response with { and end with }
9. Ensure all brackets and braces are properly closed

IMPORTANT: Your entire response must be valid JSON that can be parsed by JSON.parse()"""

        if detailed:
            user_prompt = f"""Generate a complete backend implementation plan for: "{description}"

Return a JSON object with this structure:
{{
  "backend_type": "chat_app|blog|ecommerce|social_media|todo|custom",
  "tables": [
    {{
      "name": "table_name",
      "description": "What this table stores",
      "columns": [
        {{
          "name": "id",
          "type": "UUID",
          "primary_key": true,
          "default": "gen_random_uuid()",
          "nullable": false
        }},
        {{
          "name": "column_name",
          "type": "TEXT|INTEGER|BOOLEAN|TIMESTAMP|UUID|JSONB",
          "nullable": true,
          "unique": false,
          "default": null
        }}
      ],
      "foreign_keys": [
        {{
          "column": "user_id",
          "references_table": "users",
          "references_column": "id",
          "on_delete": "CASCADE"
        }}
      ],
      "indexes": [
        {{
          "columns": ["column1"],
          "unique": false
        }}
      ],
      "enable_auth": true,
      "enable_realtime": true,
      "rls_policy": "Users can only access their own data"
    }}
  ],
  "relationships": [
    {{
      "from_table": "messages",
      "to_table": "users",
      "type": "many_to_one",
      "description": "Messages belong to users"
    }}
  ],
  "features": {{
    "authentication": true,
    "realtime": true,
    "file_storage": false,
    "search": false
  }},
  "suggested_queries": [
    "Get all messages in a channel"
  ]
}}

Guidelines:
- Always include an "id" column (UUID, primary key, default gen_random_uuid())
- Include "created_at" and "updated_at" timestamps where appropriate
- Use proper PostgreSQL data types
- Set up foreign keys for relationships
- Enable auth on tables that need user-level access control
- Enable realtime on tables that need live updates
- Create indexes on foreign keys and frequently queried columns
- Keep it simple and focused"""
        else:
            # Simpler prompt for retry
            user_prompt = f"""Generate a minimal backend for: "{description}"

Return ONLY this JSON structure (no extra text):
{{
  "backend_type": "custom",
  "tables": [
    {{
      "name": "items",
      "description": "Main items table",
      "columns": [
        {{"name": "id", "type": "UUID", "primary_key": true, "default": "gen_random_uuid()", "nullable": false}},
        {{"name": "name", "type": "TEXT", "nullable": false}},
        {{"name": "created_at", "type": "TIMESTAMP", "default": "NOW()", "nullable": false}}
      ],
      "foreign_keys": [],
      "indexes": [],
      "enable_auth": false,
      "enable_realtime": false,
      "rls_policy": ""
    }}
  ],
  "relationships": [],
  "features": {{"authentication": false, "realtime": false, "file_storage": false, "search": false}},
  "suggested_queries": []
}}

Adapt the table name and columns to match the description. Keep it minimal."""

        try:
            async with httpx.AsyncClient() as client:
                response = await client.post(
                    f"{self.base_url}/chat/completions",
                    headers={
                        "Authorization": f"Bearer {self.api_key}",
                        "Content-Type": "application/json"
                    },
                    json={
                        "model": self.model,
                        "messages": [
                            {"role": "system", "content": system_prompt},
                            {"role": "user", "content": user_prompt}
                        ],
                        "temperature": 0.2,
                        "max_tokens": 2000
                    },
                    timeout=60.0
                )
                
                response.raise_for_status()
                data = response.json()
                
                content = data["choices"][0]["message"]["content"].strip()
                
                # Clean up response - remove markdown code blocks
                content = content.replace("```json", "").replace("```", "").strip()
                
                # Try to extract JSON if there's extra text
                # Look for the first { and last }
                start_idx = content.find('{')
                end_idx = content.rfind('}')
                
                if start_idx != -1 and end_idx != -1:
                    content = content[start_idx:end_idx + 1]
                
                # Try to fix common JSON issues
                import re
                # Remove trailing commas before closing braces/brackets
                content = re.sub(r',(\s*[}\]])', r'\1', content)
                # Fix Python-style booleans
                content = re.sub(r'\bTrue\b', 'true', content)
                content = re.sub(r'\bFalse\b', 'false', content)
                content = re.sub(r'\bNone\b', 'null', content)
                # Remove comments (// or #)
                content = re.sub(r'//.*?$', '', content, flags=re.MULTILINE)
                content = re.sub(r'#.*?$', '', content, flags=re.MULTILINE)
                
                # Parse JSON with multiple attempts
                plan = None
                for attempt in range(3):
                    try:
                        plan = json.loads(content)
                        break
                    except json.JSONDecodeError as e:
                        if attempt == 0:
                            # Try to fix the specific error location
                            # Sometimes there's a trailing comma or quote issue
                            try:
                                # Remove everything after the last valid }
                                content = content[:content.rfind('}')+1]
                                continue
                            except:
                                pass
                        elif attempt == 1:
                            # Try more aggressive cleaning
                            # Remove any text before first { and after last }
                            first_brace = content.find('{')
                            last_brace = content.rfind('}')
                            if first_brace != -1 and last_brace != -1:
                                content = content[first_brace:last_brace+1]
                                continue
                        else:
                            # Last attempt failed
                            print(f"Failed to parse JSON after {attempt+1} attempts. Error: {e}")
                            print(f"Content around error (chars {max(0, e.pos-100)}:{e.pos+100}):")
                            print(content[max(0, e.pos-100):e.pos+100])
                            
                            return {
                                "error": f"AI generated invalid JSON. Please try a simpler description (e.g., 'Build a todo app' or 'Create a blog backend').",
                                "raw_response": content[:500]
                            }
                
                if not plan:
                    return {
                        "error": "Failed to parse AI response. Please try again with a simpler description."
                    }
                
                # Validate plan structure
                if not self._validate_plan(plan):
                    return {"error": "Invalid plan structure generated"}
                
                return plan
                
        except httpx.HTTPStatusError as e:
            error_detail = e.response.text if hasattr(e.response, 'text') else str(e)
            return {"error": f"Groq API error ({e.response.status_code}): {error_detail}"}
        except json.JSONDecodeError as e:
            return {"error": f"Failed to parse AI response as JSON: {str(e)}"}
        except Exception as e:
            return {"error": f"AI service error: {str(e)}"}
    
    def _validate_plan(self, plan: Dict[str, Any]) -> bool:
        """Validate that the plan has required structure"""
        required_keys = ["tables"]
        return all(key in plan for key in required_keys) and len(plan.get("tables", [])) > 0
    
    # ============================================
    # STEP 2: EXECUTE BACKEND PLAN
    # ============================================
    
    async def _execute_backend_plan(
        self,
        project_id: UUID,
        plan: Dict[str, Any],
        user_id: UUID
    ) -> Dict[str, Any]:
        """Execute the backend plan by creating tables, relationships, etc."""
        
        results = {
            "success": True,
            "tables_created": [],
            "relationships_created": [],
            "auth_enabled": [],
            "realtime_enabled": [],
            "indexes_created": [],
            "errors": []
        }
        
        # Get project database name
        try:
            project_result = await execute_on_main_db(
                "SELECT database_name FROM projects WHERE id = $1",
                project_id
            )
            
            if not project_result:
                return {
                    "success": False,
                    "error": "Project not found"
                }
            
            db_name = project_result[0]["database_name"]
            pool = await get_project_db_pool(db_name)
            
        except Exception as e:
            return {
                "success": False,
                "error": f"Failed to connect to project database: {str(e)}"
            }
        
        # Execute plan steps
        try:
            # Step 1: Create all tables
            for table_def in plan.get("tables", []):
                try:
                    await self._create_table(pool, table_def, project_id, user_id, db_name)
                    results["tables_created"].append(table_def["name"])
                except Exception as e:
                    results["errors"].append(f"Failed to create table {table_def['name']}: {str(e)}")
                    results["success"] = False
            
            # Step 2: Create foreign keys (after all tables exist)
            for table_def in plan.get("tables", []):
                if "foreign_keys" in table_def and table_def["foreign_keys"]:
                    try:
                        await self._create_foreign_keys(pool, table_def, db_name)
                        results["relationships_created"].append(table_def["name"])
                    except Exception as e:
                        results["errors"].append(f"Failed to create foreign keys for {table_def['name']}: {str(e)}")
            
            # Step 3: Create indexes
            for table_def in plan.get("tables", []):
                if "indexes" in table_def and table_def["indexes"]:
                    try:
                        await self._create_indexes(pool, table_def, db_name)
                        results["indexes_created"].append(table_def["name"])
                    except Exception as e:
                        results["errors"].append(f"Failed to create indexes for {table_def['name']}: {str(e)}")
            
            # Step 4: Enable RLS/Auth
            for table_def in plan.get("tables", []):
                if table_def.get("enable_auth", False):
                    try:
                        await self._enable_auth(pool, table_def, db_name)
                        results["auth_enabled"].append(table_def["name"])
                    except Exception as e:
                        results["errors"].append(f"Failed to enable auth for {table_def['name']}: {str(e)}")
            
            # Step 5: Enable Realtime
            for table_def in plan.get("tables", []):
                if table_def.get("enable_realtime", False):
                    try:
                        await self._enable_realtime(pool, table_def, db_name)
                        results["realtime_enabled"].append(table_def["name"])
                    except Exception as e:
                        results["errors"].append(f"Failed to enable realtime for {table_def['name']}: {str(e)}")
            
        except Exception as e:
            results["success"] = False
            results["errors"].append(f"Execution error: {str(e)}")
        
        return results
    
    # ============================================
    # TABLE CREATION
    # ============================================
    
    async def _create_table(
        self,
        pool: asyncpg.Pool,
        table_def: Dict[str, Any],
        project_id: UUID,
        user_id: UUID,
        schema_name: str
    ):
        """Create a single table from definition"""
        
        table_name = table_def["name"]
        columns = table_def["columns"]
        
        # Build CREATE TABLE statement
        column_defs = []
        for col in columns:
            col_def = f'"{col["name"]}" {col["type"]}'
            
            if col.get("primary_key"):
                col_def += " PRIMARY KEY"
            
            if not col.get("nullable", True):
                col_def += " NOT NULL"
            
            if col.get("unique"):
                col_def += " UNIQUE"
            
            if "default" in col and col["default"]:
                col_def += f" DEFAULT {col['default']}"
            
            column_defs.append(col_def)
        
        # CRITICAL: Create table with explicit schema prefix to ensure it's in the correct schema
        create_sql = f"""
        CREATE TABLE IF NOT EXISTS "{schema_name}"."{table_name}" (
            {', '.join(column_defs)}
        );
        """
        
        async with pool.acquire() as conn:
            # Set search_path to project schema
            await conn.execute(f'SET search_path TO "{schema_name}", public')
            await conn.execute(create_sql)
            print(f"✅ Created table '{schema_name}'.'{table_name}'")
        
        # Store in user_tables for tracking (with error handling)
        schema_def = {
            "columns": columns,
            "description": table_def.get("description", "")
        }
        
        try:
            await execute_on_main_db(
                """
                INSERT INTO user_tables (project_id, table_name, schema_definition)
                VALUES ($1, $2, $3)
                ON CONFLICT (project_id, table_name) DO UPDATE
                SET schema_definition = $3, updated_at = NOW()
                """,
                project_id,
                table_name,
                json.dumps(schema_def)
            )
            print(f"✅ Tracked table '{table_name}' in user_tables metadata")
        except Exception as e:
            # If user_tables doesn't exist or has different schema, just skip tracking
            print(f"⚠️ Warning: Could not track table in user_tables: {str(e)}")
    
    async def _create_foreign_keys(self, pool: asyncpg.Pool, table_def: Dict[str, Any], schema_name: str):
        """Add foreign key constraints"""
        
        table_name = table_def["name"]
        
        for fk in table_def.get("foreign_keys", []):
            constraint_name = f"fk_{table_name}_{fk['column']}"
            on_delete = fk.get("on_delete", "CASCADE")
            
            # Use explicit schema prefix for both tables
            alter_sql = f"""
            ALTER TABLE "{schema_name}"."{table_name}"
            ADD CONSTRAINT "{constraint_name}"
            FOREIGN KEY ("{fk['column']}")
            REFERENCES "{schema_name}"."{fk['references_table']}" ("{fk['references_column']}")
            ON DELETE {on_delete};
            """
            
            async with pool.acquire() as conn:
                await conn.execute(f'SET search_path TO "{schema_name}", public')
                try:
                    await conn.execute(alter_sql)
                    print(f"✅ Created foreign key on '{schema_name}'.'{table_name}'.'{fk['column']}'")
                except asyncpg.DuplicateObjectError:
                    pass  # Constraint already exists
    
    async def _create_indexes(self, pool: asyncpg.Pool, table_def: Dict[str, Any], schema_name: str):
        """Create indexes on table"""
        
        table_name = table_def["name"]
        
        for idx, index_def in enumerate(table_def.get("indexes", [])):
            columns = index_def["columns"]
            unique = "UNIQUE" if index_def.get("unique", False) else ""
            index_name = f"idx_{table_name}_{'_'.join(columns)}_{idx}"
            
            # Use explicit schema prefix
            create_index_sql = f"""
            CREATE {unique} INDEX IF NOT EXISTS "{schema_name}"."{index_name}"
            ON "{schema_name}"."{table_name}" ({', '.join(f'"{col}"' for col in columns)});
            """
            
            async with pool.acquire() as conn:
                await conn.execute(f'SET search_path TO "{schema_name}", public')
                await conn.execute(create_index_sql)
                print(f"✅ Created index '{schema_name}'.'{index_name}'")
    
    async def _enable_auth(self, pool: asyncpg.Pool, table_def: Dict[str, Any], schema_name: str):
        """Enable RLS and create basic auth policy"""
        
        table_name = table_def["name"]
        rls_policy = table_def.get("rls_policy", "Users can only access their own data")
        
        # Enable RLS with explicit schema prefix
        async with pool.acquire() as conn:
            await conn.execute(f'SET search_path TO "{schema_name}", public')
            await conn.execute(f'ALTER TABLE "{schema_name}"."{table_name}" ENABLE ROW LEVEL SECURITY;')
            
            # Check if table has user_id column
            has_user_id = await conn.fetchval(
                f"""
                SELECT EXISTS (
                    SELECT 1 FROM information_schema.columns 
                    WHERE table_schema = '{schema_name}' AND table_name = $1 AND column_name = 'user_id'
                )
                """,
                table_name
            )
            
            if not has_user_id:
                # Skip policy creation if no user_id column
                print(f"Warning: Table {table_name} has no user_id column, skipping RLS policy")
                return
            
            # Create basic policy based on description
            if "own data" in rls_policy.lower() or "user" in rls_policy.lower():
                # Assume table has user_id column
                policy_sql = f"""
                CREATE POLICY "{table_name}_user_policy" ON "{schema_name}"."{table_name}"
                FOR ALL
                USING (
                    auth.is_service_role() OR 
                    user_id::TEXT = auth.current_user_id()
                );
                """
                try:
                    await conn.execute(policy_sql)
                    print(f"✅ Enabled RLS on '{schema_name}'.'{table_name}'")
                except asyncpg.DuplicateObjectError:
                    pass
                except Exception as e:
                    print(f"Warning: Could not create RLS policy: {str(e)}")
    
    async def _enable_realtime(self, pool: asyncpg.Pool, table_def: Dict[str, Any], schema_name: str):
        """Enable realtime triggers on table"""
        
        table_name = table_def["name"]
        
        async with pool.acquire() as conn:
            await conn.execute(f'SET search_path TO "{schema_name}", public')
            
            # First check if the notify function exists
            check_function = await conn.fetchval(
                f"""
                SELECT EXISTS (
                    SELECT 1 FROM pg_proc p
                    JOIN pg_namespace n ON p.pronamespace = n.oid
                    WHERE n.nspname = '{schema_name}' AND p.proname = 'notify_database_change'
                )
                """
            )
            
            if not check_function:
                # Create the notify function if it doesn't exist
                try:
                    await conn.execute("""
                        CREATE OR REPLACE FUNCTION notify_database_change()
                        RETURNS TRIGGER AS $$
                        BEGIN
                            PERFORM pg_notify(
                                'database_changes',
                                json_build_object(
                                    'table', TG_TABLE_NAME,
                                    'action', TG_OP,
                                    'data', row_to_json(NEW)
                                )::text
                            );
                            RETURN NEW;
                        END;
                        $$ LANGUAGE plpgsql;
                    """)
                except Exception as e:
                    print(f"Warning: Could not create notify function: {str(e)}")
                    return
            
            # Create trigger for realtime notifications with explicit schema prefix
            trigger_sql = f"""
            CREATE TRIGGER "{table_name}_realtime_trigger"
            AFTER INSERT OR UPDATE OR DELETE ON "{schema_name}"."{table_name}"
            FOR EACH ROW
            EXECUTE FUNCTION "{schema_name}".notify_database_change();
            """
            
            try:
                await conn.execute(trigger_sql)
                print(f"✅ Enabled realtime on '{schema_name}'.'{table_name}'")
            except asyncpg.DuplicateObjectError:
                pass  # Trigger already exists
            except Exception as e:
                print(f"Warning: Could not create realtime trigger: {str(e)}")
    
    # ============================================
    # SUMMARY GENERATION
    # ============================================
    
    def _generate_summary(self, plan: Dict[str, Any], execution: Dict[str, Any]) -> str:
        """Generate human-readable summary of what was created"""
        
        summary_parts = []
        
        if execution["tables_created"]:
            summary_parts.append(f"✅ Created {len(execution['tables_created'])} tables: {', '.join(execution['tables_created'])}")
        
        if execution["relationships_created"]:
            summary_parts.append(f"✅ Set up relationships for {len(execution['relationships_created'])} tables")
        
        if execution["auth_enabled"]:
            summary_parts.append(f"✅ Enabled authentication on: {', '.join(execution['auth_enabled'])}")
        
        if execution["realtime_enabled"]:
            summary_parts.append(f"✅ Enabled realtime on: {', '.join(execution['realtime_enabled'])}")
        
        if execution["indexes_created"]:
            summary_parts.append(f"✅ Created indexes for performance")
        
        if execution["errors"]:
            summary_parts.append(f"⚠️ {len(execution['errors'])} warnings/errors occurred")
        
        summary_parts.append(f"\n🎉 Your {plan.get('backend_type', 'custom')} backend is ready!")
        summary_parts.append("📡 REST API endpoints are automatically available")
        
        return "\n".join(summary_parts)


# Singleton instance
backend_generator = BackendGeneratorService()
