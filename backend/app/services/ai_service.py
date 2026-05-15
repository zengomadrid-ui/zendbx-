import httpx
from app.core.config import settings
from typing import Dict, List, Any, Optional
import json
import asyncio
import time

class AIService:
    """Service for AI-powered natural language to SQL conversion using Groq"""
    
    def __init__(self):
        self.groq_api_key = settings.GROQ_API_KEY
        self.groq_base_url = "https://api.groq.com/openai/v1"
        
        # Model configuration - Groq's fastest free model
        self.model = "llama-3.1-8b-instant"
        
        # Rate limit tracking
        self.last_request_time = 0
        self.min_request_interval = 1.0  # Minimum 1 second between requests
    
    async def _make_groq_request(
        self,
        messages: List[Dict[str, str]],
        max_tokens: int = 500,
        temperature: float = 0.3,
        max_retries: int = 3
    ) -> Dict[str, Any]:
        """Make a request to Groq API with rate limit handling and retries"""
        
        for attempt in range(max_retries):
            try:
                # Rate limiting - ensure minimum interval between requests
                current_time = time.time()
                time_since_last = current_time - self.last_request_time
                if time_since_last < self.min_request_interval:
                    await asyncio.sleep(self.min_request_interval - time_since_last)
                
                async with httpx.AsyncClient() as client:
                    response = await client.post(
                        f"{self.groq_base_url}/chat/completions",
                        headers={
                            "Authorization": f"Bearer {self.groq_api_key}",
                            "Content-Type": "application/json"
                        },
                        json={
                            "model": self.model,
                            "messages": messages,
                            "temperature": temperature,
                            "max_tokens": max_tokens
                        },
                        timeout=30.0
                    )
                    
                    self.last_request_time = time.time()
                    
                    # Handle rate limit errors
                    if response.status_code == 429:
                        error_data = response.json()
                        error_msg = error_data.get("error", {}).get("message", "")
                        
                        # Extract wait time from error message
                        wait_time = 30  # Default wait time
                        if "Please try again in" in error_msg:
                            try:
                                # Extract seconds from message like "Please try again in 26.2s"
                                wait_str = error_msg.split("Please try again in ")[1].split("s")[0]
                                wait_time = float(wait_str) + 1  # Add 1 second buffer
                            except:
                                pass
                        
                        if attempt < max_retries - 1:
                            print(f"Rate limit hit, waiting {wait_time} seconds before retry {attempt + 1}/{max_retries}")
                            await asyncio.sleep(wait_time)
                            continue
                        else:
                            raise Exception(f"Groq API rate limit exceeded. Please wait {int(wait_time)} seconds and try again. Consider upgrading your Groq plan for higher limits.")
                    
                    response.raise_for_status()
                    return response.json()
                    
            except httpx.HTTPStatusError as e:
                if e.response.status_code == 429:
                    continue  # Already handled above
                elif attempt < max_retries - 1:
                    wait_time = (2 ** attempt)  # Exponential backoff: 1s, 2s, 4s
                    await asyncio.sleep(wait_time)
                    continue
                else:
                    raise Exception(f"Groq API error ({e.response.status_code}): {e.response.text}")
            except Exception as e:
                if attempt < max_retries - 1:
                    wait_time = (2 ** attempt)
                    await asyncio.sleep(wait_time)
                    continue
                else:
                    raise Exception(f"AI service error: {str(e)}")
        
        raise Exception("Max retries exceeded")
    
    async def natural_language_to_sql(
        self,
        question: str,
        table_schemas: List[Dict[str, Any]],
        model: str = "groq"
    ) -> Dict[str, Any]:
        """Convert natural language question to SQL query using Groq"""
        
        # Build context about available tables
        schema_context = self._build_schema_context(table_schemas)
        
        # Create prompt
        prompt = f"""You are a PostgreSQL expert. Convert the following natural language question into a SQL query.

Available Tables and Schemas:
{schema_context}

Question: {question}

Generate a valid PostgreSQL query. Return ONLY the SQL query without any explanation or markdown formatting.
The query should be safe, efficient, and follow PostgreSQL best practices.

SQL Query:"""
        
        try:
            data = await self._make_groq_request(
                messages=[
                    {
                        "role": "system",
                        "content": "You are a PostgreSQL expert that converts natural language to SQL queries. Return only the SQL query without explanations."
                    },
                    {
                        "role": "user",
                        "content": prompt
                    }
                ],
                temperature=0.3,
                max_tokens=500
            )
            
            # Extract SQL from Groq response
            sql = data["choices"][0]["message"]["content"].strip()
            
            # Clean up SQL (remove markdown code blocks if present)
            sql = sql.replace("```sql", "").replace("```", "").strip()
            
            return {
                "sql": sql,
                "confidence": 0.92,  # Groq is very accurate
                "model_used": "llama-3.1-8b-instant"
            }
            
        except Exception as e:
            raise Exception(f"AI service error: {str(e)}")
    
    async def explain_sql(self, sql: str) -> Dict[str, Any]:
        """Explain what a SQL query does in plain English using Groq"""
        
        prompt = f"""Explain the following SQL query in simple, plain English. Break it down step by step.

SQL Query:
{sql}

Provide:
1. A brief summary of what the query does
2. Step-by-step breakdown of each part
3. What data it returns

Format your response as JSON with keys: "summary", "steps" (array of strings), "returns"

Response:"""
        
        try:
            async with httpx.AsyncClient() as client:
                response = await client.post(
                    f"{self.groq_base_url}/chat/completions",
                    headers={
                        "Authorization": f"Bearer {self.groq_api_key}",
                        "Content-Type": "application/json"
                    },
                    json={
                        "model": self.model,
                        "messages": [
                            {
                                "role": "system",
                                "content": "You are a SQL expert that explains queries in simple terms. Return JSON format."
                            },
                            {
                                "role": "user",
                                "content": prompt
                            }
                        ],
                        "temperature": 0.5,
                        "max_tokens": 800
                    },
                    timeout=30.0
                )
                
                response.raise_for_status()
                data = response.json()
                
                content = data["choices"][0]["message"]["content"].strip()
                
                # Try to parse as JSON
                try:
                    # Remove markdown code blocks if present
                    content = content.replace("```json", "").replace("```", "").strip()
                    explanation = json.loads(content)
                except:
                    # Fallback if not JSON
                    explanation = {
                        "summary": content,
                        "steps": [],
                        "returns": "Query results"
                    }
                
                return explanation
                
        except Exception as e:
            raise Exception(f"AI service error: {str(e)}")
    
    async def suggest_queries(
        self,
        table_schemas: List[Dict[str, Any]],
        recent_queries: List[str] = None
    ) -> List[Dict[str, str]]:
        """Suggest useful queries based on table schemas using Groq"""
        
        schema_context = self._build_schema_context(table_schemas)
        recent_context = ""
        
        if recent_queries:
            recent_context = f"\n\nRecent queries:\n" + "\n".join(recent_queries[:5])
        
        prompt = f"""Based on the following database schema, suggest 5 useful SQL queries that would provide valuable insights.

Available Tables:
{schema_context}
{recent_context}

For each suggestion, provide:
1. A natural language description
2. The SQL query

Return as JSON array with objects containing "description" and "sql" keys.

Response:"""
        
        try:
            async with httpx.AsyncClient() as client:
                response = await client.post(
                    f"{self.groq_base_url}/chat/completions",
                    headers={
                        "Authorization": f"Bearer {self.groq_api_key}",
                        "Content-Type": "application/json"
                    },
                    json={
                        "model": self.model,
                        "messages": [
                            {
                                "role": "user",
                                "content": prompt
                            }
                        ],
                        "temperature": 0.7,
                        "max_tokens": 1000
                    },
                    timeout=30.0
                )
                
                response.raise_for_status()
                data = response.json()
                
                content = data["choices"][0]["message"]["content"].strip()
                
                # Try to parse as JSON
                try:
                    content = content.replace("```json", "").replace("```", "").strip()
                    suggestions = json.loads(content)
                    if isinstance(suggestions, list):
                        return suggestions[:5]
                except:
                    pass
                
                return []
                
        except Exception as e:
            raise Exception(f"AI service error: {str(e)}")
    
    async def explain_error(
        self,
        sql: str,
        error_message: str,
        table_schemas: List[Dict[str, Any]] = None
    ) -> Dict[str, Any]:
        """Explain SQL error and suggest fixes using Groq"""
        
        schema_context = ""
        if table_schemas:
            schema_context = f"\n\nAvailable Tables:\n{self._build_schema_context(table_schemas)}"
        
        prompt = f"""A SQL query failed with an error. Explain what went wrong and how to fix it.

SQL Query:
{sql}

Error Message:
{error_message}
{schema_context}

Provide:
1. A simple explanation of what caused the error
2. The specific problem in the query
3. A corrected version of the query
4. Tips to avoid this error in the future

Format your response as JSON with keys: "explanation", "problem", "fixed_sql", "tips" (array of strings)

Response:"""
        
        try:
            async with httpx.AsyncClient() as client:
                response = await client.post(
                    f"{self.groq_base_url}/chat/completions",
                    headers={
                        "Authorization": f"Bearer {self.groq_api_key}",
                        "Content-Type": "application/json"
                    },
                    json={
                        "model": self.model,
                        "messages": [
                            {
                                "role": "system",
                                "content": "You are a SQL expert that helps debug and fix SQL errors. Return JSON format."
                            },
                            {
                                "role": "user",
                                "content": prompt
                            }
                        ],
                        "temperature": 0.3,
                        "max_tokens": 1000
                    },
                    timeout=30.0
                )
                
                response.raise_for_status()
                data = response.json()
                
                content = data["choices"][0]["message"]["content"].strip()
                
                # Try to parse as JSON
                try:
                    content = content.replace("```json", "").replace("```", "").strip()
                    explanation = json.loads(content)
                except:
                    # Fallback if not JSON
                    explanation = {
                        "explanation": content,
                        "problem": "See explanation above",
                        "fixed_sql": sql,
                        "tips": ["Check the error message carefully", "Verify table and column names"]
                    }
                
                return explanation
                
        except Exception as e:
            raise Exception(f"AI service error: {str(e)}")
    
    async def auto_fix_sql_focused(
        self,
        sql: str,
        error_message: str,
        table_schemas: List[Dict[str, Any]]
    ) -> Optional[str]:
        """
        Ultra-focused SQL auto-fix using AI
        Returns ONLY the fixed SQL query with no explanations
        """
        
        schema_context = self._build_schema_context(table_schemas)
        
        # Ultra-minimal prompt for instant fixes
        prompt = f"""Fix this SQL. Return ONLY the corrected query.

SQL: {sql}
Error: {error_message}
Tables: {schema_context}

Fixed:"""
        
        try:
            data = await self._make_groq_request(
                messages=[
                    {
                        "role": "system",
                        "content": "Fix SQL queries. Return only corrected SQL, no explanations."
                    },
                    {
                        "role": "user",
                        "content": prompt
                    }
                ],
                temperature=0.1,
                max_tokens=200
            )
            
            fixed_sql = data["choices"][0]["message"]["content"].strip()
            
            # Clean response
            fixed_sql = fixed_sql.replace("```sql", "").replace("```", "").strip()
            
            # Validate it's different and looks like SQL
            if fixed_sql != sql and len(fixed_sql) > 5:
                return fixed_sql
            
        except Exception:
            pass
        
        return None
    
    def _build_schema_context(self, table_schemas: List[Dict[str, Any]]) -> str:
        """Build a text representation of table schemas for AI context"""
        
        context_parts = []
        
        for table in table_schemas:
            table_name = table.get("table_name", "unknown")
            columns = table.get("columns", [])
            
            col_defs = []
            for col in columns:
                col_name = col.get("name", "")
                col_type = col.get("type", "")
                nullable = "" if col.get("nullable", True) else " NOT NULL"
                pk = " PRIMARY KEY" if col.get("primary_key", False) else ""
                
                col_defs.append(f"  - {col_name} ({col_type}){nullable}{pk}")
            
            table_context = f"Table: {table_name}\n" + "\n".join(col_defs)
            context_parts.append(table_context)
        
        return "\n\n".join(context_parts)

# Singleton instance
ai_service = AIService()
