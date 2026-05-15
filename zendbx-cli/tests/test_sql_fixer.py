"""Tests for SQL fixer"""

import pytest
from zendbx.core.sql_fixer import SQLFixer, FixResult


class TestSQLFixer:
    """Test SQL auto-fix functionality"""
    
    def setup_method(self):
        """Setup test fixtures"""
        self.fixer = SQLFixer()
    
    def test_keyword_typo_form_to_from(self):
        """Test fixing FORM → FROM typo"""
        sql = "SELECT name FORM users"
        result = self.fixer.fix_sql(sql)
        
        assert result.success
        assert result.fixed_sql == "SELECT name FROM users"
        assert result.fix_type == "typo"
        assert result.confidence >= 0.9
    
    def test_keyword_typo_slect_to_select(self):
        """Test fixing SLECT → SELECT typo"""
        sql = "SLECT * FROM users"
        result = self.fixer.fix_sql(sql)
        
        assert result.success
        assert result.fixed_sql == "SELECT * FROM users"
        assert result.fix_type == "typo"
    
    def test_operator_double_equals(self):
        """Test fixing == → = operator"""
        sql = "SELECT * FROM users WHERE id == 1"
        result = self.fixer.fix_sql(sql)
        
        assert result.success
        assert result.fixed_sql == "SELECT * FROM users WHERE id = 1"
        assert result.fix_type == "operator"
    
    def test_operator_not_equals(self):
        """Test fixing != → <> operator"""
        sql = "SELECT * FROM users WHERE status != 'active'"
        result = self.fixer.fix_sql(sql)
        
        assert result.success
        assert result.fixed_sql == "SELECT * FROM users WHERE status <> 'active'"
        assert result.fix_type == "operator"
    
    def test_no_fix_needed(self):
        """Test valid SQL returns no fix"""
        sql = "SELECT * FROM users WHERE id = 1"
        result = self.fixer.fix_sql(sql)
        
        assert not result.success
        assert result.fixed_sql is None
    
    def test_destructive_without_where(self):
        """Test safety check for DELETE without WHERE"""
        sql = "DELETE FROM users"
        result = self.fixer.fix_sql(sql)
        
        assert not result.success
        assert result.fix_type == "safety"
        assert "destructive" in result.explanation.lower()
    
    def test_update_without_where(self):
        """Test safety check for UPDATE without WHERE"""
        sql = "UPDATE users SET status = 'inactive'"
        result = self.fixer.fix_sql(sql)
        
        assert not result.success
        assert result.fix_type == "safety"
    
    def test_schema_error_table_name(self):
        """Test fixing table name with schema"""
        sql = "SELECT * FROM usr"
        error = 'relation "usr" does not exist'
        schema = {
            "tables": {
                "users": {"columns": []},
                "posts": {"columns": []},
            }
        }
        
        result = self.fixer.fix_sql(sql, error_message=error, schema=schema)
        
        assert result.success
        assert "users" in result.fixed_sql
        assert result.fix_type == "schema"
    
    def test_schema_error_column_name(self):
        """Test fixing column name with schema"""
        sql = "SELECT nam FROM users"
        error = 'column "nam" does not exist'
        schema = {
            "tables": {
                "users": {
                    "columns": [
                        {"name": "id"},
                        {"name": "name"},
                        {"name": "email"},
                    ]
                }
            }
        }
        
        result = self.fixer.fix_sql(sql, error_message=error, schema=schema)
        
        assert result.success
        assert "name" in result.fixed_sql
        assert result.fix_type == "schema"
    
    def test_multiple_typos(self):
        """Test fixing multiple typos in one query"""
        sql = "SLECT name FORM users WHER id == 1"
        result = self.fixer.fix_sql(sql)
        
        # Should fix at least one typo
        assert result.success
        assert result.fixed_sql != sql
    
    def test_case_insensitive_fix(self):
        """Test case-insensitive keyword fixing"""
        sql = "select name form users"
        result = self.fixer.fix_sql(sql)
        
        assert result.success
        assert "FROM" in result.fixed_sql or "from" in result.fixed_sql
