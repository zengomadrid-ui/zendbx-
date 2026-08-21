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
        
        print(f"[AUTOFIX] === AUTO_FIX_SQL CALLED - NEW CODE LOADED ===")
        print(f"[AUTOFIX] Error: {error_message[:100]}")
        print(f"[AUTOFIX] Schema tables: {list(schema.get('tables', {}).keys())}")
        
        # Safety checks
        if self._is_destructive_without_where(sql):
            print(f"[AUTOFIX] Rejected: Destructive without WHERE")
            return None
        
        if not error_message or len(error_message.strip()) == 0:
            print(f"[AUTOFIX] Rejected: Empty error message")
            return None
        
        success_indicators = ['successfully', 'completed', 'executed successfully', 'created successfully', 'inserted successfully', 'updated successfully', 'deleted successfully']
        error_lower = error_message.lower()
        matched_indicators = [ind for ind in success_indicators if ind in error_lower]
        if matched_indicators:
            print(f"[AUTOFIX] Rejected: Success indicator in error message")
            print(f"[AUTOFIX]   Error message: {error_message[:200]}")
            print(f"[AUTOFIX]   Matched indicators: {matched_indicators}")
            return None
        
        # Try rule-based fixes first (they preserve formatting better)
        print(f"[AUTOFIX] Attempting rule-based fixes...")
        fixed_sql = await self._try_rule_based_fixes(sql, error_message, schema)
        if fixed_sql and fixed_sql != sql:
            print(f"[AUTOFIX] Rule-based fix succeeded!")
            return fixed_sql
        else:
            print(f"[AUTOFIX] Rule-based fix returned: {fixed_sql is not None}")
        
        # Try AI fix with formatting preservation
        if any(error_keyword in error_message.lower() for error_keyword in [
            'syntax error', 'does not exist', 'missing', 'invalid', 'unexpected',
            'column', 'table', 'relation', 'constraint', 'type'
        ]):
            print(f"[AUTOFIX] Attempting AI fix...")
            try:
                fixed_sql = await self._try_ai_fix_with_formatting(sql, error_message, schema)
                if fixed_sql and fixed_sql != sql:
                    print(f"[AUTOFIX] AI fix succeeded!")
                    return fixed_sql
            except Exception as e:
                print(f"AI fix error: {e}")
        
        print(f"[AUTOFIX] No fix found")
        return None
    
    async def _try_rule_based_fixes(
        self,
        sql: str,
        error_message: str,
        schema: Dict[str, Any]
    ) -> Optional[str]:
        """Rule-based fixes that preserve formatting"""
        
        # FORCE RELOAD TEST
        print(f"[AUTOFIX] Entering rule-based fixes - RELOADED!")
        print(f"[AUTOFIX] Error message: {error_message}")
        
        # Table name fixes (relation does not exist)
        if 'relation' in error_message.lower() and 'does not exist' in error_message.lower():
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
            print(f"[AUTOFIX] Column error detected in rule-based fix")
            print(f"[AUTOFIX] Error message: {error_message}")
            
            # PRIORITY 1: Try to extract suggested column from PostgreSQL HINT
            # HINT:  Perhaps you meant to reference the column "c.created_at".
            hint_pattern = r'HINT:\s*Perhaps you meant to reference the column\s+"?([a-zA-Z0-9_.]+)"?'
            hint_match = re.search(hint_pattern, error_message, re.IGNORECASE)
            
            suggested_col = None
            if hint_match:
                suggested_col_full = hint_match.group(1)  # Could be "c.created_at" or "created_at"
                print(f"[AUTOFIX] PostgreSQL HINT suggests: {suggested_col_full}")
                
                # Extract just the column name (remove table alias if present)
                if '.' in suggested_col_full:
                    suggested_col = suggested_col_full.split('.')[-1]  # Get "created_at" from "c.created_at"
                else:
                    suggested_col = suggested_col_full
                
                print(f"[AUTOFIX] Using PostgreSQL suggestion: {suggested_col}")
            
            # Try to extract column name from error message
            # Patterns: 
            # - column "column_name" does not exist
            # - column c.column_name does not exist (with table alias)
            # - column column_name does not exist (no quotes)
            
            column_pattern = r'column\s+"?([a-zA-Z0-9_.]+)"?\s+does not exist'
            match = re.search(column_pattern, error_message, re.IGNORECASE)
            
            print(f"[AUTOFIX] Pattern match result: {match}")
            if match:
                print(f"[AUTOFIX] Matched groups: {match.groups()}")
            
            if match:
                missing_col_full = match.group(1)  # Could be "c.created_on" or "created_on"
                
                # Extract just the column name (remove table alias if present)
                if '.' in missing_col_full:
                    table_alias = missing_col_full.split('.')[0]  # Get "c" from "c.created_on"
                    missing_col = missing_col_full.split('.')[-1]  # Get "created_on" from "c.created_on"
                else:
                    table_alias = None
                    missing_col = missing_col_full
                
                print(f"[AUTOFIX] Detected missing column: {missing_col}")
                if table_alias:
                    print(f"[AUTOFIX] Table alias: {table_alias}")
                
                # CRITICAL: Identify the actual table for this column
                # Parse SQL to find what table the alias references
                referenced_table = self._find_table_for_alias(sql, table_alias) if table_alias else self._find_primary_table(sql)
                
                if referenced_table:
                    print(f"[AUTOFIX] Referenced table: {referenced_table}")
                    
                    # PRIORITY 1: Use PostgreSQL HINT if available
                    closest = suggested_col
                    
                    # PRIORITY 2: Use table-specific column matching
                    if not closest and referenced_table in schema.get('tables', {}):
                        print(f"[AUTOFIX] Searching columns in table: {referenced_table}")
                        
                        # Get columns ONLY from the referenced table
                        table_columns = []
                        table_info = schema['tables'][referenced_table]
                        for col in table_info.get('columns', []):
                            col_name = col.get('name', '')
                            if col_name:
                                table_columns.append(col_name)
                        
                        print(f"[AUTOFIX] Columns in {referenced_table}: {table_columns}")
                        
                        # Try smart column mapping first (common naming patterns)
                        closest = self._smart_column_match(missing_col, table_columns)
                        
                        # Fallback to fuzzy matching on table-specific columns
                        if not closest:
                            closest = self._find_closest_match(missing_col, table_columns)
                    
                    if closest:
                        print(f"[AUTOFIX] Found match in {referenced_table}: {missing_col} → {closest}")
                        
                        # Replace in SQL, preserving table aliases
                        fixed = sql
                        
                        # Pattern 1: Replace standalone column name
                        fixed = re.sub(
                            rf'\b{re.escape(missing_col)}\b',
                            closest,
                            fixed,
                            flags=re.IGNORECASE
                        )
                        
                        # Pattern 2: Replace with table alias (e.g., c.created_on → c.created_at)
                        if table_alias:
                            fixed = re.sub(
                                rf'\b{re.escape(table_alias)}\.{re.escape(missing_col)}\b',
                                f'{table_alias}.{closest}',
                                fixed,
                                flags=re.IGNORECASE
                            )
                        
                        if fixed != sql:
                            print(f"[AUTOFIX] Rule-based fix generated")
                            return fixed
                        else:
                            print(f"[AUTOFIX] Replacement did not change SQL")
                    else:
                        print(f"[AUTOFIX] No close match found in {referenced_table} for: {missing_col}")
                else:
                    print(f"[AUTOFIX] Could not identify referenced table for column: {missing_col}")
        
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
            from app.core.database import smart_split_sql
            
            schema_context = self._build_schema_context(schema)
            
            # Count original statements for validation
            original_statements = smart_split_sql(sql)
            original_count = len(original_statements)
            
            print(f"[AUTOFIX] Original SQL contains {original_count} statement(s)")
            
            # Enhanced prompt with multi-statement preservation instructions
            prompt = f"""Fix the error in this SQL. CRITICAL: If the input contains multiple SQL statements, you MUST return ALL of them.

REQUIREMENTS:
1. Fix only the statement(s) that contain errors
2. Keep all other statements EXACTLY as-is
3. Preserve all formatting, line breaks, and statement delimiters (semicolons)
4. Return ONLY the SQL (no explanations, no markdown)
5. If the SQL contains {original_count} statement(s), return {original_count} statement(s)

SQL ({original_count} statement(s)):
{sql}

Error: {error_message}

Schema: {schema_context}

Fixed SQL (must contain {original_count} statement(s)):"""
            
            response = await ai_service._make_groq_request(
                messages=[
                    {
                        "role": "system",
                        "content": """You are a SQL error fixer. Rules:
1. Count the input statements
2. Fix ONLY the broken statement(s)
3. Return ALL statements (broken + working)
4. Preserve statement order and formatting
5. No explanations, only SQL
6. If you return fewer statements than the input, YOU FAILED."""
                    },
                    {
                        "role": "user",
                        "content": prompt
                    }
                ],
                temperature=0.0,
                max_tokens=5000  # Increased from 3000 to handle multiple statements
            )
            
            fixed_sql = response["choices"][0]["message"]["content"].strip()
            
            # Remove markdown code blocks if present
            fixed_sql = fixed_sql.replace("```sql", "").replace("```", "").strip()
            
            # CRITICAL: Extract ALL SQL statements, not just the first one
            # Use smart_split_sql to properly parse the AI response
            fixed_sql = self._extract_complete_sql(fixed_sql, original_count)
            
            if not fixed_sql:
                print(f"[AUTOFIX] Failed to extract SQL from AI response")
                return None
            
            # CRITICAL: Validate statement count
            fixed_statements = smart_split_sql(fixed_sql)
            fixed_count = len(fixed_statements)
            
            print(f"[AUTOFIX] Fixed SQL contains {fixed_count} statement(s)")
            
            if fixed_count != original_count:
                print(f"[AUTOFIX] REJECTED: Statement count mismatch")
                print(f"[AUTOFIX]   Original: {original_count} statements")
                print(f"[AUTOFIX]   Fixed: {fixed_count} statements")
                print(f"[AUTOFIX]   This fix would discard {original_count - fixed_count} statement(s)")
                # Reject fixes that don't preserve statement count
                return None
            
            # Validate the fixed SQL
            if (self._is_valid_sql_response(fixed_sql) and 
                fixed_sql != sql and 
                len(fixed_sql) > 20):
                print(f"[AUTOFIX] Fix accepted: {fixed_count} statements preserved")
                return fixed_sql
            else:
                print(f"[AUTOFIX] Fix rejected: validation failed")
                return None
            
        except Exception as e:
            print(f"[AUTOFIX] AI fix error: {e}")
            import traceback
            print(f"[AUTOFIX] Traceback: {traceback.format_exc()}")
        
        return None
    
    def _extract_complete_sql(self, ai_response: str, expected_count: int) -> Optional[str]:
        """
        Extract complete SQL from AI response, preserving ALL statements.
        
        This replaces the naive line-by-line parser that broke on first semicolon.
        """
        from app.core.database import smart_split_sql
        
        if not ai_response:
            return None
        
        # Strategy 1: Try to find SQL boundaries by looking for SQL keywords
        lines = ai_response.split('\n')
        
        # Find first line that starts with a SQL keyword
        first_sql_idx = None
        for idx, line in enumerate(lines):
            line_stripped = line.strip().upper()
            if any(line_stripped.startswith(kw) for kw in ['CREATE', 'SELECT', 'INSERT', 'UPDATE', 'DELETE', 'ALTER', 'DROP', 'WITH', 'BEGIN']):
                first_sql_idx = idx
                break
        
        if first_sql_idx is None:
            # No SQL found
            return None
        
        # Find last line that contains SQL (look for last semicolon or SQL-like content)
        last_sql_idx = None
        for idx in range(len(lines) - 1, first_sql_idx - 1, -1):
            line = lines[idx].strip()
            if ';' in line or any(kw in line.upper() for kw in ['CREATE', 'SELECT', 'INSERT', 'UPDATE', 'DELETE', 'FROM', 'WHERE', 'VALUES']):
                last_sql_idx = idx
                break
        
        if last_sql_idx is None:
            last_sql_idx = first_sql_idx
        
        # Extract SQL lines
        sql_lines = lines[first_sql_idx:last_sql_idx + 1]
        extracted_sql = '\n'.join(sql_lines).strip()
        
        # Verify using smart_split_sql
        try:
            statements = smart_split_sql(extracted_sql)
            if len(statements) > 0:
                print(f"[AUTOFIX] Extracted {len(statements)} statement(s) from AI response")
                # Rejoin statements to preserve formatting
                return extracted_sql
        except Exception as e:
            print(f"[AUTOFIX] Error parsing extracted SQL: {e}")
        
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
    
    def _find_table_for_alias(self, sql: str, alias: str) -> Optional[str]:
        """
        Find the actual table name for a given alias in SQL.
        Example: FROM customers c → returns 'customers' for alias 'c'
        """
        if not alias:
            return None
        
        # Pattern: FROM table_name alias or FROM table_name AS alias
        pattern = rf'FROM\s+([a-zA-Z_][a-zA-Z0-9_]*)\s+(?:AS\s+)?{re.escape(alias)}\b'
        match = re.search(pattern, sql, re.IGNORECASE)
        
        if match:
            table_name = match.group(1)
            print(f"[AUTOFIX] Resolved alias {alias} → table {table_name}")
            return table_name
        
        # Also try JOIN patterns
        pattern = rf'JOIN\s+([a-zA-Z_][a-zA-Z0-9_]*)\s+(?:AS\s+)?{re.escape(alias)}\b'
        match = re.search(pattern, sql, re.IGNORECASE)
        
        if match:
            table_name = match.group(1)
            print(f"[AUTOFIX] Resolved alias {alias} → table {table_name} (from JOIN)")
            return table_name
        
        return None
    
    def _find_primary_table(self, sql: str) -> Optional[str]:
        """
        Find the primary table in a SQL query (first table in FROM clause).
        """
        # Pattern: FROM table_name
        pattern = r'FROM\s+([a-zA-Z_][a-zA-Z0-9_]*)'
        match = re.search(pattern, sql, re.IGNORECASE)
        
        if match:
            table_name = match.group(1)
            print(f"[AUTOFIX] Found primary table: {table_name}")
            return table_name
        
        return None
    
    def _smart_column_match(self, missing_col: str, table_columns: List[str]) -> Optional[str]:
        """
        Intelligent column matching using common naming patterns.
        
        Examples:
        - customer_name → name
        - email_address → email
        - phone_number → phone
        - created_on → created_at
        - order_date → created_at or date
        """
        if not missing_col or not table_columns:
            return None
        
        missing_lower = missing_col.lower()
        
        # Common patterns to try
        patterns = [
            # Remove prefixes like customer_, user_, order_
            (r'^[a-z]+_(.+)$', r'\1'),  # customer_name → name
            # Replace suffixes
            (r'(.+)_on$', r'\1_at'),     # created_on → created_at
            (r'(.+)_date$', r'\1_at'),   # order_date → order_at
            (r'(.+)_address$', r'\1'),   # email_address → email
            (r'(.+)_number$', r'\1'),    # phone_number → phone
        ]
        
        for pattern, replacement in patterns:
            candidate = re.sub(pattern, replacement, missing_lower)
            if candidate != missing_lower:
                # Check if this candidate exists in table columns (case-insensitive)
                for col in table_columns:
                    if col.lower() == candidate:
                        print(f"[AUTOFIX] Smart match: {missing_col} → {col} (pattern: {pattern})")
                        return col
        
        # Try substring matching - if missing_col contains a word that's in table_columns
        # e.g., customer_name contains "name"
        words = re.findall(r'[a-z]+', missing_lower)
        for word in words:
            if len(word) > 2:  # Only consider words longer than 2 chars
                for col in table_columns:
                    if col.lower() == word:
                        print(f"[AUTOFIX] Smart match: {missing_col} → {col} (substring)")
                        return col
        
        return None
    
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
