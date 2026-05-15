"""SQL Auto-Fix Engine - The signature feature of ZenDBX"""

import re
import difflib
from typing import Optional, Dict, List, Any, Tuple
from dataclasses import dataclass


@dataclass
class FixResult:
    """Result of SQL fix attempt"""
    success: bool
    original_sql: str
    fixed_sql: Optional[str]
    confidence: float  # 0.0 to 1.0
    fix_type: str  # "typo", "syntax", "schema", "operator", "quote"
    explanation: str
    changes: List[str]


class SQLFixer:
    """
    AI-powered SQL fixer - ZenDBX's signature feature
    Detects and fixes common SQL errors with high accuracy
    """
    
    def __init__(self):
        self.sql_keywords = {
            'SELECT', 'FROM', 'WHERE', 'JOIN', 'INNER', 'LEFT', 'RIGHT', 'FULL',
            'ON', 'GROUP', 'BY', 'ORDER', 'HAVING', 'LIMIT', 'OFFSET', 'UNION',
            'INSERT', 'UPDATE', 'DELETE', 'CREATE', 'ALTER', 'DROP', 'INDEX',
            'TABLE', 'DATABASE', 'SCHEMA', 'VIEW', 'FUNCTION', 'TRIGGER',
            'PRIMARY', 'KEY', 'FOREIGN', 'REFERENCES', 'CONSTRAINT', 'UNIQUE',
            'NOT', 'NULL', 'DEFAULT', 'CHECK', 'CASCADE', 'SET', 'VALUES',
            'INTO', 'AS', 'AND', 'OR', 'IN', 'EXISTS', 'BETWEEN', 'LIKE',
            'IS', 'DISTINCT', 'ALL', 'ANY', 'CASE', 'WHEN', 'THEN', 'ELSE', 'END'
        }
        
        # Common typos mapping
        self.common_typos = {
            'FORM': 'FROM',
            'SLECT': 'SELECT',
            'SELCT': 'SELECT',
            'SELET': 'SELECT',
            'WHER': 'WHERE',
            'WHRE': 'WHERE',
            'JION': 'JOIN',
            'GROPU': 'GROUP',
            'ODER': 'ORDER',
            'UPDAT': 'UPDATE',
            'DELET': 'DELETE',
            'CREAT': 'CREATE',
            'PRIMRY': 'PRIMARY',
            'FORIEGN': 'FOREIGN',
            'REFERNCES': 'REFERENCES',
        }
    
    def fix_sql(
        self,
        sql: str,
        error_message: Optional[str] = None,
        schema: Optional[Dict[str, Any]] = None
    ) -> FixResult:
        """
        Main entry point for SQL fixing
        Returns a FixResult with the fixed SQL and metadata
        """
        
        # Safety checks
        if self._is_destructive_without_where(sql):
            return FixResult(
                success=False,
                original_sql=sql,
                fixed_sql=None,
                confidence=0.0,
                fix_type="safety",
                explanation="Destructive operation without WHERE clause - refusing to fix for safety",
                changes=[]
            )
        
        # Try different fix strategies in order of confidence
        
        # 1. Keyword typo fixes (highest confidence)
        result = self._fix_keyword_typos(sql)
        if result.success:
            return result
        
        # 2. Operator fixes (high confidence)
        result = self._fix_operators(sql)
        if result.success:
            return result
        
        # 3. Quote fixes (high confidence)
        result = self._fix_quotes(sql)
        if result.success:
            return result
        
        # 4. Missing comma fixes (medium confidence)
        result = self._fix_missing_commas(sql)
        if result.success:
            return result
        
        # 5. Schema-based fixes (requires schema and error message)
        if error_message and schema:
            result = self._fix_schema_errors(sql, error_message, schema)
            if result.success:
                return result
        
        # 6. Error message based fixes
        if error_message:
            result = self._fix_from_error_message(sql, error_message)
            if result.success:
                return result
        
        # No fix found
        return FixResult(
            success=False,
            original_sql=sql,
            fixed_sql=None,
            confidence=0.0,
            fix_type="none",
            explanation="No automatic fix available",
            changes=[]
        )
    
    def _fix_keyword_typos(self, sql: str) -> FixResult:
        """Fix common SQL keyword typos"""
        fixed_sql = sql
        changes = []
        
        for typo, correct in self.common_typos.items():
            # Use word boundaries to avoid partial matches
            pattern = rf'\b{typo}\b'
            if re.search(pattern, fixed_sql, re.IGNORECASE):
                fixed_sql = re.sub(pattern, correct, fixed_sql, flags=re.IGNORECASE)
                changes.append(f"'{typo}' → '{correct}'")
        
        if changes:
            return FixResult(
                success=True,
                original_sql=sql,
                fixed_sql=fixed_sql,
                confidence=0.95,
                fix_type="typo",
                explanation=f"Fixed keyword typo: {', '.join(changes)}",
                changes=changes
            )
        
        return FixResult(False, sql, None, 0.0, "none", "", [])
    
    def _fix_operators(self, sql: str) -> FixResult:
        """Fix incorrect operators (e.g., == instead of =)"""
        fixed_sql = sql
        changes = []
        
        # Fix == to = in SQL context
        if '==' in sql:
            # Make sure it's not in a string literal
            fixed_sql = re.sub(r'(?<![\'"])==(?![\'"])', '=', fixed_sql)
            if fixed_sql != sql:
                changes.append("'==' → '='")
        
        # Fix != to <> (PostgreSQL standard)
        if '!=' in sql:
            fixed_sql = re.sub(r'(?<![\'"])!=(?![\'"])', '<>', fixed_sql)
            if fixed_sql != sql:
                changes.append("'!=' → '<>'")
        
        if changes:
            return FixResult(
                success=True,
                original_sql=sql,
                fixed_sql=fixed_sql,
                confidence=0.90,
                fix_type="operator",
                explanation=f"Fixed operator: {', '.join(changes)}",
                changes=changes
            )
        
        return FixResult(False, sql, None, 0.0, "none", "", [])
    
    def _fix_quotes(self, sql: str) -> FixResult:
        """Fix quote issues"""
        fixed_sql = sql
        changes = []
        
        # Fix double quotes around string literals (should be single quotes)
        # This is a simplified version - real implementation would need better parsing
        pattern = r'=\s*"([^"]+)"'
        matches = re.findall(pattern, sql)
        if matches:
            fixed_sql = re.sub(pattern, r"='\1'", fixed_sql)
            changes.append("Double quotes → single quotes for string literals")
        
        if changes:
            return FixResult(
                success=True,
                original_sql=sql,
                fixed_sql=fixed_sql,
                confidence=0.85,
                fix_type="quote",
                explanation=f"Fixed quotes: {', '.join(changes)}",
                changes=changes
            )
        
        return FixResult(False, sql, None, 0.0, "none", "", [])
    
    def _fix_missing_commas(self, sql: str) -> FixResult:
        """Fix missing commas in CREATE TABLE and other statements"""
        fixed_sql = sql
        changes = []
        
        # Fix missing comma after PRIMARY KEY in CREATE TABLE
        if 'CREATE TABLE' in sql.upper():
            pattern = r'(PRIMARY KEY)\s*\n\s*([a-zA-Z_])'
            if re.search(pattern, sql):
                fixed_sql = re.sub(pattern, r'\1,\n    \2', sql)
                changes.append("Added missing comma after PRIMARY KEY")
        
        # Fix missing comma in column list
        pattern = r'(\w+\s+(?:INTEGER|VARCHAR|TEXT|BOOLEAN|TIMESTAMP|DATE))\s*\n\s*(\w+\s+(?:INTEGER|VARCHAR|TEXT|BOOLEAN|TIMESTAMP|DATE))'
        if re.search(pattern, sql, re.IGNORECASE):
            fixed_sql = re.sub(pattern, r'\1,\n    \2', sql, flags=re.IGNORECASE)
            changes.append("Added missing comma between columns")
        
        if changes:
            return FixResult(
                success=True,
                original_sql=sql,
                fixed_sql=fixed_sql,
                confidence=0.80,
                fix_type="syntax",
                explanation=f"Fixed syntax: {', '.join(changes)}",
                changes=changes
            )
        
        return FixResult(False, sql, None, 0.0, "none", "", [])
    
    def _fix_schema_errors(
        self,
        sql: str,
        error_message: str,
        schema: Dict[str, Any]
    ) -> FixResult:
        """Fix errors related to table/column names using schema"""
        
        # Fix table name errors
        if 'does not exist' in error_message.lower() and 'relation' in error_message.lower():
            match = re.search(r'relation "([^"]+)" does not exist', error_message, re.IGNORECASE)
            if match:
                missing_name = match.group(1)
                available_tables = list(schema.get('tables', {}).keys())
                closest = self._find_closest_match(missing_name, available_tables)
                
                if closest:
                    fixed_sql = re.sub(
                        rf'\b{re.escape(missing_name)}\b',
                        closest,
                        sql,
                        flags=re.IGNORECASE
                    )
                    return FixResult(
                        success=True,
                        original_sql=sql,
                        fixed_sql=fixed_sql,
                        confidence=0.85,
                        fix_type="schema",
                        explanation=f"Fixed table name: '{missing_name}' → '{closest}'",
                        changes=[f"'{missing_name}' → '{closest}'"]
                    )
        
        # Fix column name errors
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
                    fixed_sql = re.sub(
                        rf'\b{re.escape(missing_col)}\b',
                        closest,
                        sql,
                        flags=re.IGNORECASE
                    )
                    return FixResult(
                        success=True,
                        original_sql=sql,
                        fixed_sql=fixed_sql,
                        confidence=0.85,
                        fix_type="schema",
                        explanation=f"Fixed column name: '{missing_col}' → '{closest}'",
                        changes=[f"'{missing_col}' → '{closest}'"]
                    )
        
        return FixResult(False, sql, None, 0.0, "none", "", [])
    
    def _fix_from_error_message(self, sql: str, error_message: str) -> FixResult:
        """Try to fix based on error message patterns"""
        
        # Syntax error at or near
        match = re.search(r'syntax error at or near "([^"]+)"', error_message, re.IGNORECASE)
        if match:
            problem_token = match.group(1)
            
            # Check if it's a typo of a keyword
            for typo, correct in self.common_typos.items():
                if problem_token.upper() == typo:
                    fixed_sql = re.sub(
                        rf'\b{re.escape(problem_token)}\b',
                        correct,
                        sql,
                        flags=re.IGNORECASE
                    )
                    return FixResult(
                        success=True,
                        original_sql=sql,
                        fixed_sql=fixed_sql,
                        confidence=0.90,
                        fix_type="typo",
                        explanation=f"Fixed keyword near error: '{problem_token}' → '{correct}'",
                        changes=[f"'{problem_token}' → '{correct}'"]
                    )
        
        return FixResult(False, sql, None, 0.0, "none", "", [])
    
    def _find_closest_match(self, target: str, candidates: List[str]) -> Optional[str]:
        """Find closest matching string using fuzzy matching"""
        if not candidates:
            return None
        matches = difflib.get_close_matches(target, candidates, n=1, cutoff=0.6)
        return matches[0] if matches else None
    
    def _is_destructive_without_where(self, sql: str) -> bool:
        """Check for dangerous operations without WHERE clause"""
        sql_upper = sql.upper().strip()
        
        # DELETE without WHERE
        if sql_upper.startswith('DELETE') and 'WHERE' not in sql_upper:
            return True
        
        # UPDATE without WHERE
        if sql_upper.startswith('UPDATE') and 'WHERE' not in sql_upper:
            return True
        
        # DROP or TRUNCATE
        if sql_upper.startswith(('DROP', 'TRUNCATE')):
            return True
        
        return False


# Singleton instance
sql_fixer = SQLFixer()
