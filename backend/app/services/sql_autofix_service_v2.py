"""
SQL Auto-Fix Service V2 - Improved formatting preservation
"""

import re
import difflib
from typing import Dict, List, Any, Optional
import asyncpg


class SQLAutoFixServiceV2:
    """Enhanced auto-fix with better formatting preservation"""
    
    def __init__(self):
        self.sql_keywords = {
            'SELECT', 'FROM', 'WHERE', 'JOIN', 'INNER', 'LEFT', 'RIGHT', 'FULL',
            'ON', 'GROUP', 'BY', 'ORDER', 'HAVING', 'LIMIT', 'OFFSET', 'UNION',
            'INSERT', 'UPDATE', 'DELETE', 'CREATE', 'ALTER', 'DROP', 'INDEX'
        }
    
    async def auto_fix_sql(
        self,
        sql: str,
        error_message: str,
        schema: Dict[str, Any]
    ) -> Optional[str]:
        """Auto-fix SQL with proper formatting preservation"""
        
        # Safety checks
        if self._is_destructive_without_where(sql):
            return None
        
        if not error_message or len(error_message.strip()) == 0:
            return None
        
        success_indicators = ['successfully', 'completed', 'executed', 'created', 'inserted', 'updated', 'deleted']
        if any(indicator in error_message.lower() for indicator in success_indicators):
            return None
        
        # Try rule-based fixes first (they preserve formatting better)
        fixed_sql = await self._try_rule_based_fixes(sql, error_message, schema)
        if fixed_sql and fixed_sql != sql:
            return fixed_sql
        
        # Try AI fix with formatting preservation
        if any(error_keyword in error_message.lower() for error_keyword in [
            'syntax error', 'does not exist', 'missing', 'invalid', 'unexpected',
            'column', 'table', 'relation', 'constraint', 'type'
        ]):
            try:
                fixed_sql = await self._try_ai_fix_with_formatting(sql, error_message, schema)
                if fixed_sql and fixed_sql != sql:
                    return fixed_sql
            except Exception as e:
                print(f"AI fix error: {e}")
        
        return None
    
    async def _try_rule_based_fixes(
        self,
        sql: str,
        error_message: str,
        schema: Dict[str, Any]
    ) -> Optional[str]:
        """Rule-based fixes that preserve formatting"""
        
        # Table name fixes
        if 'does not exist' in error_message.lower():
            match = re.search(r'relation "([^"]+)" does not exist', error_message, re.IGNORECASE)
            if match:
                missing_name = match.group(1)
                available_tables = list(schema.get('tables', {}).keys())
                closest = self._find_closest_match(missing_name, available_tables)
                
                if closest:
                    # Replace preserving case and context
                    fixed = re.sub(
                        rf'\b{re.escape(missing_name)}\b',
                        closest,
                        sql,
                        flags=re.IGNORECASE
                    )
                    if fixed != sql:
                        return fixed
        
        # Column name fixes
        if 'column' in error_message.lower() and 'does not exist' in error_message.lower():
            match = re.search(r'column "([^"]+)" does not exist', error_message, re.IGNORECASE)
            if match:
                missing_col = match.group(1)
                all_columns = []
                for table_info in schema.get('tables', {}).values():
                    for col in table_info.get('columns', []):
                        all_columns.append(col.get('name', ''))
                
                closest = self._find_closest_match(missing_col, all_columns)
                if closest:
                    fixed = re.sub(
                        rf'\b{re.escape(missing_col)}\b',
                        closest,
                        sql,
                        flags=re.IGNORECASE
                    )
                    if fixed != sql:
                        return fixed
        
        # Missing comma in CREATE TABLE (common error)
        if 'syntax error' in error_message.lower() and 'CREATE TABLE' in sql.upper():
            # Try to add missing comma after PRIMARY KEY
            fixed = re.sub(
                r'(PRIMARY KEY)\s*\n\s*([a-zA-Z_])',
                r'\1,\n    \2',
                sql
            )
            if fixed != sql:
                return fixed
        
        return None
    
    async def _try_ai_fix_with_formatting(
        self,
        sql: str,
        error_message: str,
        schema: Dict[str, Any]
    ) -> Optional[str]:
        """AI fix with aggressive formatting preservation"""
        
        try:
            from app.services.ai_service import ai_service
            
            schema_context = self._build_schema_context(schema)
            
            # Ultra-simple prompt focused on minimal changes
            prompt = f"""Fix the error in this SQL. Change ONLY what's needed to fix the error. Keep everything else EXACTLY the same.

SQL:
{sql}

Error: {error_message}

Schema: {schema_context}

Return ONLY the fixed SQL (no explanations):"""
            
            response = await ai_service._make_groq_request(
                messages=[
                    {
                        "role": "system",
                        "content": "You fix SQL errors by making the SMALLEST possible change. Keep all formatting, line breaks, spacing, and comments identical. Return ONLY the SQL."
                    },
                    {
                        "role": "user",
                        "content": prompt
                    }
                ],
                temperature=0.0,
                max_tokens=3000
            )
            
            fixed_sql = response["choices"][0]["message"]["content"].strip()
            fixed_sql = fixed_sql.replace("```sql", "").replace("```", "").strip()
            
            # Remove any explanatory text
            lines = fixed_sql.split('\n')
            sql_lines = []
            found_sql = False
            
            for line in lines:
                line_upper = line.strip().upper()
                if not found_sql:
                    if any(line_upper.startswith(kw) for kw in ['CREATE', 'SELECT', 'INSERT', 'UPDATE', 'DELETE', '--']):
                        found_sql = True
                        sql_lines.append(line)
                else:
                    sql_lines.append(line)
                    if ';' in line:
                        break
            
            if sql_lines:
                fixed_sql = '\n'.join(sql_lines)
            
            # CRITICAL: Restore formatting if AI removed line breaks
            if '\n' in sql and '\n' not in fixed_sql:
                print("⚠️  Restoring formatting...")
                fixed_sql = self._restore_original_formatting(sql, fixed_sql)
            
            # Validate
            if (self._is_valid_sql_response(fixed_sql) and 
                fixed_sql != sql and 
                len(fixed_sql) > 20):
                return fixed_sql
            
        except Exception as e:
            print(f"AI fix error: {e}")
        
        return None
    
    def _restore_original_formatting(self, original: str, fixed_single_line: str) -> str:
        """Restore original formatting structure to fixed SQL"""
        
        print(f"Restoring formatting: original has {original.count(chr(10))} lines, fixed has {fixed_single_line.count(chr(10))} lines")
        
        # For CREATE TABLE, use special formatting
        if 'CREATE TABLE' in fixed_single_line.upper():
            return self._format_create_table_like_original(original, fixed_single_line)
        
        # For other SQL, try to preserve structure
        original_lines = original.split('\n')
        
        # Extract comments from original
        comments = [line for line in original_lines if line.strip().startswith('--')]
        
        # Rebuild with comments + fixed SQL
        result = []
        for comment in comments:
            result.append(comment)
        
        # Try to split fixed SQL at similar points as original
        if 'WHERE' in original.upper() and 'WHERE' in fixed_single_line.upper():
            parts = re.split(r'\s+(WHERE)\s+', fixed_single_line, flags=re.IGNORECASE)
            result.append(parts[0])
            if len(parts) > 1:
                result.append(parts[1] + ' ' + parts[2] if len(parts) > 2 else parts[1])
        else:
            result.append(fixed_single_line)
        
        return '\n'.join(result)
    
    def _format_create_table_like_original(self, original: str, fixed: str) -> str:
        """Format CREATE TABLE to match original structure"""
        
        print("Formatting CREATE TABLE...")
        
        # Extract comment if present
        comment_match = re.search(r'^(--[^\n]+)', original)
        comment = comment_match.group(1) if comment_match else ''
        
        # Extract table name and columns from fixed SQL
        table_match = re.search(r'CREATE\s+TABLE\s+(\w+)\s*\((.*)\);?', fixed, re.IGNORECASE | re.DOTALL)
        if not table_match:
            return fixed
        
        table_name = table_match.group(1)
        columns_str = table_match.group(2).strip()
        
        # Split columns (handle nested parentheses)
        columns = []
        current = ''
        paren_depth = 0
        
        for char in columns_str:
            if char == '(':
                paren_depth += 1
                current += char
            elif char == ')':
                paren_depth -= 1
                current += char
            elif char == ',' and paren_depth == 0:
                columns.append(current.strip())
                current = ''
            else:
                current += char
        
        if current.strip():
            columns.append(current.strip())
        
        # Rebuild with formatting
        result = []
        if comment:
            result.append(comment)
        result.append(f'CREATE TABLE {table_name} (')
        for i, col in enumerate(columns):
            if i < len(columns) - 1:
                result.append(f'    {col},')
            else:
                result.append(f'    {col}')
        result.append(');')
        
        formatted = '\n'.join(result)
        print(f"Formatted result has {formatted.count(chr(10))} lines")
        return formatted
    
    def _find_closest_match(self, target: str, candidates: List[str]) -> Optional[str]:
        """Fuzzy match"""
        if not candidates:
            return None
        matches = difflib.get_close_matches(target, candidates, n=1, cutoff=0.6)
        return matches[0] if matches else None
    
    def _is_destructive_without_where(self, sql: str) -> bool:
        """Check for dangerous operations"""
        sql_upper = sql.upper().strip()
        if sql_upper.startswith('DELETE') and 'WHERE' not in sql_upper:
            return True
        if sql_upper.startswith('UPDATE') and 'WHERE' not in sql_upper:
            return True
        if sql_upper.startswith(('DROP', 'TRUNCATE')):
            return True
        return False
    
    def _is_valid_sql_response(self, sql: str) -> bool:
        """Validate SQL"""
        if not sql or len(sql) < 5:
            return False
        lines = sql.split('\n')
        for line in lines:
            if '--' in line:
                line = line.split('--')[0]
            line = line.strip()
            if line:
                first_word = line.split()[0].upper()
                return first_word in self.sql_keywords
        return False
    
    def _build_schema_context(self, schema: Dict[str, Any]) -> str:
        """Build schema context"""
        context_parts = []
        for table_name, table_info in schema.get('tables', {}).items():
            columns = table_info.get('columns', [])
            col_names = [col.get('name', '') for col in columns]
            context_parts.append(f"{table_name}({', '.join(col_names)})")
        return ' | '.join(context_parts)


# Create singleton
sql_autofix_v2 = SQLAutoFixServiceV2()
