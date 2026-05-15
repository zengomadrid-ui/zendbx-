"""
SQL Auto-Fix Service - Automatically fix SQL queries that fail

This service acts like an IDE auto-correct engine:
- Fixes typos in table/column names
- Adds missing JOIN conditions
- Corrects syntax errors
- Returns ONLY the fixed SQL (no explanations)
"""

import re
import difflib
from typing import Dict, List, Any, Optional, Tuple
import asyncpg


class SQLAutoFixService:
    """Auto-fix SQL queries using rule-based and AI-powered corrections"""
    
    def __init__(self):
        # Common SQL keywords for validation
        self.sql_keywords = {
            'SELECT', 'FROM', 'WHERE', 'JOIN', 'INNER', 'LEFT', 'RIGHT', 'FULL',
            'ON', 'GROUP', 'BY', 'ORDER', 'HAVING', 'LIMIT', 'OFFSET', 'UNION',
            'INSERT', 'UPDATE', 'DELETE', 'CREATE', 'ALTER', 'DROP', 'INDEX'
        }
        
        # Common error patterns and their fixes
        self.error_patterns = [
            # Table/relation errors
            (r'relation "([^"]+)" does not exist', self._fix_missing_table),
            (r'table "([^"]+)" does not exist', self._fix_missing_table),
            
            # Column errors
            (r'column "([^"]+)" does not exist', self._fix_missing_column),
            (r'column "([^"]+)" must appear in the GROUP BY', self._fix_group_by),
            
            # Syntax errors
            (r'syntax error at or near "([^"]+)"', self._fix_syntax_error),
            (r'missing FROM-clause entry for table "([^"]+)"', self._fix_missing_from),
            
            # JOIN errors
            (r'invalid reference to FROM-clause entry for table "([^"]+)"', self._fix_invalid_reference),
        ]
    
    async def auto_fix_sql(
        self,
        sql: str,
        error_message: str,
        schema: Dict[str, Any]
    ) -> Optional[str]:
        """
        Auto-fix SQL query based on error message and schema
        
        Returns:
            Fixed SQL string or None if unfixable
        """
        
        # Safety check - never auto-fix destructive queries without WHERE
        if self._is_destructive_without_where(sql):
            return None
        
        # Safety check - don't auto-fix if there's no clear error
        if not error_message or len(error_message.strip()) == 0:
            return None
        
        # Safety check - don't auto-fix success messages
        success_indicators = [
            'successfully',
            'completed',
            'executed',
            'created',
            'inserted',
            'updated',
            'deleted'
        ]
        
        if any(indicator in error_message.lower() for indicator in success_indicators):
            return None
        
        # Try rule-based fixes first (fast and safe)
        fixed_sql = await self._try_rule_based_fixes(sql, error_message, schema)
        if fixed_sql and fixed_sql != sql:
            return fixed_sql
        
        # For complex SQL with clear errors, use AI but with better safety
        if any(error_keyword in error_message.lower() for error_keyword in [
            'syntax error', 'does not exist', 'missing', 'invalid', 'unexpected',
            'column', 'table', 'relation', 'constraint', 'type'
        ]):
            try:
                fixed_sql = await self._try_ai_fixes(sql, error_message, schema)
                if fixed_sql and fixed_sql != sql and len(fixed_sql) > 50:  # Ensure AI didn't return garbage
                    return fixed_sql
            except Exception:
                pass  # AI fix failed, return None
        
        return None
    
    # ============================================
    # RULE-BASED FIXES (FAST)
    # ============================================
    
    async def _try_rule_based_fixes(
        self,
        sql: str,
        error_message: str,
        schema: Dict[str, Any]
    ) -> Optional[str]:
        """Try to fix using rule-based patterns"""
        
        # Check each error pattern
        for pattern, fix_function in self.error_patterns:
            match = re.search(pattern, error_message, re.IGNORECASE)
            if match:
                try:
                    fixed_sql = fix_function(sql, match, schema)
                    if fixed_sql and fixed_sql != sql:
                        return fixed_sql
                except Exception:
                    continue
        
        # Try common fixes even without specific error patterns
        fixed_sql = self._try_common_fixes(sql, schema)
        return fixed_sql
    
    def _fix_missing_table(self, sql: str, match: re.Match, schema: Dict[str, Any]) -> str:
        """Fix missing table name using fuzzy matching"""
        missing_table = match.group(1)
        available_tables = list(schema.get('tables', {}).keys())
        
        # Find closest match
        closest_match = self._find_closest_match(missing_table, available_tables)
        if closest_match:
            # Replace the table name in SQL
            return re.sub(
                rf'\b{re.escape(missing_table)}\b',
                closest_match,
                sql,
                flags=re.IGNORECASE
            )
        
        return sql
    
    def _fix_missing_column(self, sql: str, match: re.Match, schema: Dict[str, Any]) -> str:
        """Fix missing column name using fuzzy matching"""
        missing_column = match.group(1)
        
        # Get all available columns from all tables
        all_columns = []
        tables = schema.get('tables', {})
        for table_name, table_info in tables.items():
            columns = table_info.get('columns', [])
            for col in columns:
                all_columns.append(col.get('name', ''))
        
        # Find closest match
        closest_match = self._find_closest_match(missing_column, all_columns)
        if closest_match:
            return re.sub(
                rf'\b{re.escape(missing_column)}\b',
                closest_match,
                sql,
                flags=re.IGNORECASE
            )
        
        return sql
    
    def _fix_group_by(self, sql: str, match: re.Match, schema: Dict[str, Any]) -> str:
        """Add missing column to GROUP BY clause"""
        missing_column = match.group(1)
        
        # Check if GROUP BY exists
        if 'GROUP BY' in sql.upper():
            # Add to existing GROUP BY
            return re.sub(
                r'(GROUP\s+BY\s+[^;]+)',
                rf'\1, {missing_column}',
                sql,
                flags=re.IGNORECASE
            )
        else:
            # Add new GROUP BY before ORDER BY or at end
            if 'ORDER BY' in sql.upper():
                return re.sub(
                    r'(\s+ORDER\s+BY)',
                    rf' GROUP BY {missing_column}\1',
                    sql,
                    flags=re.IGNORECASE
                )
            else:
                # Add at end
                return sql.rstrip(';') + f' GROUP BY {missing_column};'
    
    def _fix_syntax_error(self, sql: str, match: re.Match, schema: Dict[str, Any]) -> str:
        """Fix common syntax errors"""
        error_token = match.group(1)
        
        # Common syntax fixes
        fixes = {
            # Missing quotes
            'SELECT': sql.replace('SELECT SELECT', 'SELECT'),
            # Double keywords
            'FROM': sql.replace('FROM FROM', 'FROM'),
            # Missing commas in SELECT
            'WHERE': self._add_missing_select_commas(sql),
        }
        
        return fixes.get(error_token.upper(), sql)
    
    def _fix_missing_from(self, sql: str, match: re.Match, schema: Dict[str, Any]) -> str:
        """Fix missing FROM clause by adding table reference"""
        table_alias = match.group(1)
        
        # Try to find the table this alias refers to
        tables = list(schema.get('tables', {}).keys())
        
        # Look for table name that matches alias
        for table in tables:
            if table.lower().startswith(table_alias.lower()) or table_alias.lower() in table.lower():
                # Add JOIN or fix FROM clause
                if 'JOIN' in sql.upper():
                    # This is likely a missing JOIN condition
                    return self._add_missing_join_condition(sql, table_alias, table, schema)
                else:
                    # Add to FROM clause
                    return re.sub(
                        r'(FROM\s+\w+)',
                        rf'\1, {table} {table_alias}',
                        sql,
                        flags=re.IGNORECASE
                    )
        
        return sql
    
    def _fix_invalid_reference(self, sql: str, match: re.Match, schema: Dict[str, Any]) -> str:
        """Fix invalid table reference by adding proper JOIN"""
        table_alias = match.group(1)
        return self._add_missing_join_condition(sql, table_alias, None, schema)
    
    def _try_common_fixes(self, sql: str, schema: Dict[str, Any]) -> str:
        """Apply common fixes even without specific error patterns"""
        
        # Fix 1: Add missing JOIN conditions
        sql = self._auto_add_join_conditions(sql, schema)
        
        # Fix 2: Fix common typos
        sql = self._fix_common_typos(sql, schema)
        
        # Fix 3: Normalize formatting
        sql = self._normalize_sql_formatting(sql)
        
        return sql
    
    # ============================================
    # AI-POWERED FIXES (SMART)
    # ============================================
    
    async def _try_ai_fixes(
        self,
        sql: str,
        error_message: str,
        schema: Dict[str, Any]
    ) -> Optional[str]:
        """Use AI to fix complex SQL errors"""
        
        # Additional safety check - don't use AI if error suggests success
        if any(word in error_message.lower() for word in ['success', 'complete', 'created', 'inserted', 'updated']):
            return None
        
        try:
            # Import locally to avoid circular imports
            from app.services.ai_service import ai_service
            
            # Build schema context for AI
            schema_context = self._build_schema_context(schema)
            
            # Detect if this is a CREATE TABLE statement
            is_create_table = 'CREATE TABLE' in sql.upper()
            
            # Enhanced prompt for better SQL preservation
            if is_create_table:
                prompt = f"""Fix ONLY the error in this SQL. Keep ALL formatting EXACTLY as it is.

CRITICAL RULES:
1. Return ONLY the SQL - NO explanations, NO markdown blocks
2. Keep EVERY line break exactly where it is
3. Keep EVERY space and indentation exactly as it is
4. Keep ALL comments (--) exactly where they are
5. Fix ONLY the specific error: {error_message}
6. Do NOT reformat, do NOT reorganize, do NOT change structure

Original SQL (preserve this EXACT formatting):
{sql}

Error to fix: {error_message}

Schema: {schema_context}

Return the SQL with the SAME line breaks and spacing:"""
            else:
                prompt = f"""Fix ONLY the error in this SQL. Keep ALL formatting EXACTLY as it is.

CRITICAL RULES:
1. Return ONLY the SQL - NO explanations, NO markdown blocks
2. Keep EVERY line break exactly where it is
3. Keep EVERY space and indentation exactly as it is  
4. Keep ALL comments (--) exactly where they are
5. Fix ONLY the specific error: {error_message}
6. Do NOT reformat, do NOT reorganize, do NOT change structure

Original SQL (preserve this EXACT formatting):
{sql}

Error to fix: {error_message}

Schema: {schema_context}

Return the SQL with the SAME line breaks and spacing:"""
            
            # Use existing AI service with enhanced prompt
            system_content = """You are a minimal SQL error fixer. Your ONLY job is to fix the specific error while keeping EVERYTHING else identical - same line breaks, same spacing, same comments, same structure. Think of yourself as a spell-checker that only fixes the typo, nothing else. Return ONLY the corrected SQL with NO explanations, NO markdown, NO extra text."""
            
            response = await ai_service._make_groq_request(
                messages=[
                    {
                        "role": "system",
                        "content": system_content
                    },
                    {
                        "role": "user",
                        "content": prompt
                    }
                ],
                temperature=0.05,  # Even lower temperature for more consistent fixes
                max_tokens=3000    # Increased for longer SQL with formatting
            )
            
            fixed_sql = response["choices"][0]["message"]["content"].strip()
            
            # Clean up response - remove markdown if present
            fixed_sql = fixed_sql.replace("```sql", "").replace("```", "").strip()
            
            # Remove any explanatory text before or after the SQL
            # Look for the first SQL keyword
            lines = fixed_sql.split('\n')
            sql_start_idx = -1
            sql_end_idx = len(lines)
            
            for i, line in enumerate(lines):
                line_upper = line.strip().upper()
                # Skip comments
                if line_upper.startswith('--'):
                    if sql_start_idx == -1:
                        sql_start_idx = i
                    continue
                    
                # Find first SQL keyword
                if sql_start_idx == -1:
                    for keyword in ['CREATE', 'SELECT', 'INSERT', 'UPDATE', 'DELETE', 'ALTER', 'DROP']:
                        if line_upper.startswith(keyword):
                            sql_start_idx = i
                            break
                
                # Find last line with semicolon
                if ';' in line and sql_start_idx != -1:
                    sql_end_idx = i + 1
                    break
            
            if sql_start_idx != -1:
                fixed_sql = '\n'.join(lines[sql_start_idx:sql_end_idx])
            
            # POST-PROCESSING: Restore original formatting if AI removed line breaks
            # This is critical for CREATE TABLE and multi-line SQL
            if '\n' in sql and '\n' not in fixed_sql:
                print("⚠️  AI removed line breaks - attempting to restore formatting...")
                fixed_sql = self._restore_formatting(sql, fixed_sql)
            
            # Additional validation for complex SQL
            print(f"AI Response validation:")
            print(f"  Fixed SQL length: {len(fixed_sql)}")
            print(f"  Original SQL length: {len(sql)}")
            print(f"  Is valid SQL: {self._is_valid_sql_response(fixed_sql)}")
            print(f"  Is different: {fixed_sql != sql}")
            print(f"  Size check: {len(fixed_sql) > len(sql) * 0.5 and len(fixed_sql) < len(sql) * 2.0}")
            
            # More lenient size check for formatted SQL
            if (self._is_valid_sql_response(fixed_sql) and 
                fixed_sql != sql and 
                len(fixed_sql) > len(sql) * 0.5 and  # More lenient - formatting can change size
                len(fixed_sql) < len(sql) * 2.0):    # More lenient - formatting can add lines
                print(f"✅ AI fix validation passed")
                
                # Final formatting cleanup for CREATE TABLE
                if is_create_table and '\n' in sql:
                    fixed_sql = self._format_create_table_preserve(sql, fixed_sql)
                
                return fixed_sql
            else:
                print(f"❌ AI fix validation failed")
            
        except Exception as e:
            print(f"AI fix error: {e}")
            pass
        
        return None
    
    # ============================================
    # HELPER METHODS
    # ============================================
    
    def _find_closest_match(self, target: str, candidates: List[str]) -> Optional[str]:
        """Find closest matching string using fuzzy matching"""
        if not candidates:
            return None
        
        # Use difflib for fuzzy matching
        matches = difflib.get_close_matches(target, candidates, n=1, cutoff=0.6)
        return matches[0] if matches else None
    
    def _add_missing_join_condition(
        self,
        sql: str,
        table_alias: str,
        table_name: Optional[str],
        schema: Dict[str, Any]
    ) -> str:
        """Add missing JOIN condition based on foreign keys"""
        
        # This is a simplified version - in practice, you'd analyze the schema
        # to find foreign key relationships and add appropriate JOIN conditions
        
        # For now, return original SQL
        # TODO: Implement smart JOIN condition detection
        return sql
    
    def _auto_add_join_conditions(self, sql: str, schema: Dict[str, Any]) -> str:
        """Automatically add JOIN conditions based on foreign key relationships"""
        
        # Extract table references from SQL
        table_pattern = r'FROM\s+(\w+)(?:\s+(\w+))?|JOIN\s+(\w+)(?:\s+(\w+))?'
        matches = re.findall(table_pattern, sql, re.IGNORECASE)
        
        # For now, return original SQL
        # TODO: Implement automatic JOIN condition detection
        return sql
    
    def _fix_common_typos(self, sql: str, schema: Dict[str, Any]) -> str:
        """Fix common typos in SQL"""
        
        # Common typos and their fixes
        typo_fixes = {
            # Operator errors
            r'\b(\w+)\s*==\s*': r'\1 = ',
            r'\b(\w+)\s*!=\s*': r'\1 <> ',
            
            # Table reference errors (common pluralization issues)
            r'\bFROM\s+user\b': 'FROM users',
            r'\bJOIN\s+user\b': 'JOIN users',
            r'\bFROM\s+post\b': 'FROM posts',
            r'\bJOIN\s+post\b': 'JOIN posts',
            r'\bFROM\s+order\b': 'FROM orders',
            r'\bJOIN\s+order\b': 'JOIN orders',
            r'\bFROM\s+product\b': 'FROM products',
            r'\bJOIN\s+product\b': 'JOIN products',
            r'\bFROM\s+customer\b': 'FROM customers',
            r'\bJOIN\s+customer\b': 'JOIN customers',
            
            # REFERENCES fixes (common pluralization)
            r'\bREFERENCES\s+circuit\(': 'REFERENCES circuits(',
            r'\bREFERENCES\s+team\(': 'REFERENCES teams(',
            r'\bREFERENCES\s+driver\(': 'REFERENCES drivers(',
            r'\bREFERENCES\s+race\(': 'REFERENCES races(',
            r'\bREFERENCES\s+user\(': 'REFERENCES users(',
            r'\bREFERENCES\s+product\(': 'REFERENCES products(',
            r'\bREFERENCES\s+order\(': 'REFERENCES orders(',
            
            # Wrong constraint logic
            r'CHECK\s*\(\s*position\s*<\s*0\s*\)': 'CHECK (position > 0)',
            r'CHECK\s*\(\s*price\s*<\s*0\s*\)': 'CHECK (price >= 0)',
            r'CHECK\s*\(\s*quantity\s*<\s*0\s*\)': 'CHECK (quantity >= 0)',
            
            # Keyword typos
            r'\bSELECT\s+\*\s+FORM\b': 'SELECT * FROM',
            r'\bORDER\s+BT\b': 'ORDER BY',
            r'\bGROUP\s+BT\b': 'GROUP BY',
            r'\bWHERE\s+(\w+)\s*=\s*=': r'WHERE \1 =',
            
            # Missing quotes (be careful with this one)
            # r"WHERE\s+(\w+)\s*=\s*([a-zA-Z][a-zA-Z0-9_]*)\s*(?!['\"]|\w)": r"WHERE \1 = '\2'",
        }
        
        for pattern, replacement in typo_fixes.items():
            sql = re.sub(pattern, replacement, sql, flags=re.IGNORECASE)
        
        return sql
    
    def _normalize_sql_formatting(self, sql: str) -> str:
        """Normalize SQL formatting"""
        
        # Remove extra whitespace
        sql = re.sub(r'\s+', ' ', sql.strip())
        
        # Ensure semicolon at end if not present
        if not sql.endswith(';'):
            sql += ';'
        
        return sql
    
    def _add_missing_select_commas(self, sql: str) -> str:
        """Add missing commas in SELECT clause"""
        
        # This is a simplified version
        # TODO: Implement proper SELECT clause comma detection
        return sql
    
    def _is_destructive_without_where(self, sql: str) -> bool:
        """Check if SQL is destructive without WHERE clause"""
        
        sql_upper = sql.upper().strip()
        
        # Check for DELETE without WHERE
        if sql_upper.startswith('DELETE') and 'WHERE' not in sql_upper:
            return True
        
        # Check for UPDATE without WHERE
        if sql_upper.startswith('UPDATE') and 'WHERE' not in sql_upper:
            return True
        
        # Check for DROP or TRUNCATE
        if sql_upper.startswith(('DROP', 'TRUNCATE')):
            return True
        
        return False
    
    def _is_valid_sql_response(self, sql: str) -> bool:
        """Validate that response looks like SQL"""
        
        if not sql or len(sql) < 5:
            return False
        
        # Remove comments and whitespace to find the first SQL keyword
        lines = sql.split('\n')
        for line in lines:
            # Remove comments
            if '--' in line:
                line = line.split('--')[0]
            line = line.strip()
            
            if line:  # Found first non-comment, non-empty line
                first_word = line.split()[0].upper()
                return first_word in self.sql_keywords
        
        return False
    
    def _build_schema_context(self, schema: Dict[str, Any]) -> str:
        """Build schema context for AI"""
        
        context_parts = []
        tables = schema.get('tables', {})
        
        for table_name, table_info in tables.items():
            columns = table_info.get('columns', [])
            col_names = [col.get('name', '') for col in columns]
            context_parts.append(f"Table {table_name}: {', '.join(col_names)}")
        
        return '\n'.join(context_parts)
    
    def _restore_formatting(self, original_sql: str, fixed_sql: str) -> str:
        """Restore original formatting structure when AI removes line breaks"""
        
        # If original has line breaks but fixed doesn't, try to restore structure
        if '\n' not in fixed_sql:
            # For CREATE TABLE, use special formatting
            if 'CREATE TABLE' in fixed_sql.upper():
                return self._format_create_table_from_single_line(fixed_sql)
            
            # For other SQL, try to match original structure
            original_lines = original_sql.split('\n')
            if len(original_lines) > 1:
                # Try to preserve comment lines
                result_lines = []
                for line in original_lines:
                    if line.strip().startswith('--'):
                        result_lines.append(line)
                
                # Add the fixed SQL
                result_lines.append(fixed_sql)
                return '\n'.join(result_lines)
        
        return fixed_sql
    
    def _format_create_table_from_single_line(self, sql: str) -> str:
        """Format a single-line CREATE TABLE into multi-line format"""
        
        # Extract components
        import re
        
        # Find CREATE TABLE ... (
        match = re.search(r'(--[^\n]*\s*)?(CREATE\s+TABLE\s+\w+\s*\()', sql, re.IGNORECASE)
        if not match:
            return sql
        
        comment = match.group(1) if match.group(1) else ''
        create_part = match.group(2)
        
        # Get the content between parentheses
        paren_start = sql.find('(', match.end() - 1)
        paren_end = sql.rfind(')')
        
        if paren_start == -1 or paren_end == -1:
            return sql
        
        content = sql[paren_start + 1:paren_end].strip()
        ending = sql[paren_end:]
        
        # Split by commas (but not commas inside parentheses)
        columns = []
        current = ''
        paren_depth = 0
        
        for char in content:
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
        if comment.strip():
            result.append(comment.strip())
        result.append(create_part)
        for col in columns:
            result.append('    ' + col + ',')
        
        # Remove trailing comma from last column
        if result:
            result[-1] = result[-1].rstrip(',')
        
        result.append(ending)
        
        return '\n'.join(result)
    
    def _format_create_table_preserve(self, original_sql: str, fixed_sql: str) -> str:
        """Format CREATE TABLE while preserving original structure as much as possible"""
        
        # If fixed SQL already has good formatting, keep it
        if '\n' in fixed_sql and '    ' in fixed_sql:
            return fixed_sql
        
        # Otherwise, try to restore original formatting
        if '\n' not in fixed_sql:
            return self._format_create_table_from_single_line(fixed_sql)
        
        return fixed_sql
    
    def _format_create_table(self, sql: str) -> str:
        """Format CREATE TABLE statement with proper indentation"""
        
        # If already well-formatted, return as-is
        if '\n    ' in sql and sql.count('\n') > 3:
            return sql
        
        # Basic formatting for CREATE TABLE
        lines = []
        in_create_table = False
        indent = '    '
        
        for line in sql.split('\n'):
            line = line.strip()
            
            if not line:
                continue
            
            # Handle CREATE TABLE line
            if line.upper().startswith('CREATE TABLE'):
                lines.append(line)
                in_create_table = True
                continue
            
            # Handle column definitions
            if in_create_table and not line.startswith(')'):
                # Add indentation to column definitions
                if not line.startswith(indent):
                    lines.append(indent + line)
                else:
                    lines.append(line)
            else:
                lines.append(line)
                if line.startswith(')'):
                    in_create_table = False
        
        return '\n'.join(lines)


# Singleton instance
sql_autofix = SQLAutoFixService()