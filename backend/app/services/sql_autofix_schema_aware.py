"""
SQL AutoFix Engine - Database-Aware Schema Repair System

ARCHITECTURE:
1. Load REAL project database schema (tables, columns, types, relationships)
2. Parse SQL to identify references (tables, columns, aliases)
3. Validate SQL against schema
4. Generate schema-aware corrections
5. Execute candidate SQL
6. Verify execution success
7. Return only if execution succeeds

CRITICAL RULE:
The database schema is the ONLY source of truth.
PostgreSQL errors are diagnostic hints.
Success requires actual SQL execution, not just generation.
"""

import re
from typing import Dict, List, Any, Optional, Tuple
from uuid import UUID
import asyncpg
from dataclasses import dataclass


# ============================================
# DATA STRUCTURES
# ============================================

@dataclass
class ColumnInfo:
    """Column metadata from schema"""
    name: str
    type: str
    nullable: bool
    default: Optional[str] = None


@dataclass
class TableInfo:
    """Table metadata from schema"""
    name: str
    columns: List[ColumnInfo]
    primary_keys: List[str]
    foreign_keys: Dict[str, str]  # column -> referenced_table.column


@dataclass
class ProjectSchema:
    """Complete project database schema"""
    tables: Dict[str, TableInfo]
    
    def get_table(self, table_name: str) -> Optional[TableInfo]:
        """Get table by name (case-insensitive)"""
        table_lower = table_name.lower()
        for name, info in self.tables.items():
            if name.lower() == table_lower:
                return info
        return None
    
    def get_column(self, table_name: str, column_name: str) -> Optional[ColumnInfo]:
        """Get column from table (case-insensitive)"""
        table = self.get_table(table_name)
        if not table:
            return None
        column_lower = column_name.lower()
        for col in table.columns:
            if col.name.lower() == column_lower:
                return col
        return None


@dataclass
class SQLReference:
    """A reference to a table or column in SQL"""
    type: str  # 'table' or 'column'
    name: str
    table: Optional[str] = None  # For columns, which table
    alias: Optional[str] = None
    position: int = 0  # Character position in SQL


@dataclass
class ParsedSQL:
    """Parsed SQL structure"""
    original: str
    tables: List[SQLReference]  # Tables referenced
    columns: List[SQLReference]  # Columns referenced
    aliases: Dict[str, str]  # alias -> table_name
    operation: str  # SELECT, INSERT, UPDATE, DELETE, CREATE, etc.


@dataclass
class SchemaValidationError:
    """An error found when validating SQL against schema"""
    type: str  # 'missing_table', 'missing_column', 'type_mismatch'
    reference: SQLReference
    message: str
    suggested_fix: Optional[str] = None


@dataclass
class AutoFixResult:
    """Result of auto-fix attempt"""
    success: bool
    fixed_sql: Optional[str]
    verification_status: str
    iterations: int
    errors: List[str]
    changes: List[str]


# ============================================
# SCHEMA LOADER
# ============================================

class SchemaLoader:
    """Load real database schema from project database"""
    
    @staticmethod
    async def load_tables_schema(
        execute_func,  # Function to execute SQL on project DB
        project_id: UUID,
        database_name: str,
        table_names: List[str]
    ) -> ProjectSchema:
        """
        Load schema for specific tables only.
        
        This is more efficient and reliable than loading ALL tables,
        especially when information_schema queries might miss tables
        due to connection/permission issues.
        
        Args:
            execute_func: Function to execute SQL (execute_on_project_db)
            project_id: Project UUID
            database_name: Database name
            table_names: List of table names to load
            
        Returns:
            ProjectSchema with only the specified tables
        """
        print(f"[AUTOFIX] Loading schema for specific tables: {table_names}")
        
        tables = {}
        
        for table_name in table_names:
            try:
                print(f"[AUTOFIX] Loading table: {table_name}")
                
                # Load columns by querying information_schema
                columns_result = await execute_func(
                    project_id,
                    database_name,
                    """
                    SELECT 
                        column_name,
                        data_type,
                        is_nullable,
                        column_default
                    FROM information_schema.columns 
                    WHERE table_schema = 'public'
                      AND table_name = $1
                    ORDER BY ordinal_position
                    """,
                    table_name
                )
                
                print(f"[AUTOFIX]   information_schema query returned: {len(columns_result)} rows")
                
                if not columns_result:
                    # FALLBACK: Query PostgreSQL system catalog directly
                    # This works even when information_schema is not accessible due to RLS/permissions
                    print(f"[AUTOFIX]   Using fallback: pg_attribute system catalog")
                    
                    try:
                        catalog_query = """
                        SELECT 
                            a.attname as column_name,
                            pg_catalog.format_type(a.atttypid, a.atttypmod) as data_type,
                            NOT a.attnotnull as is_nullable
                        FROM pg_catalog.pg_attribute a
                        WHERE a.attrelid = $1::regclass
                          AND a.attnum > 0
                          AND NOT a.attisdropped
                        ORDER BY a.attnum
                        """
                        
                        columns_result = await execute_func(
                            project_id,
                            database_name,
                            catalog_query,
                            table_name
                        )
                        
                        print(f"[AUTOFIX]   pg_attribute returned {len(columns_result)} columns")
                        
                        if not columns_result:
                            print(f"[AUTOFIX]   Table {table_name} not found (no columns in pg_attribute)")
                            continue
                            
                    except Exception as catalog_error:
                        print(f"[AUTOFIX]   pg_attribute query failed: {catalog_error}")
                        continue
                
                columns = [
                    ColumnInfo(
                        name=row["column_name"],
                        type=row.get("data_type", "unknown"),
                        nullable=row.get("is_nullable", True) if isinstance(row.get("is_nullable"), bool) else (row.get("is_nullable") == "YES"),
                        default=row.get("column_default")
                    )
                    for row in columns_result
                ]
                
                print(f"[AUTOFIX]   Columns: {[c.name for c in columns]}")
                
                # Load primary keys
                primary_keys = []
                try:
                    pk_result = await execute_func(
                        project_id,
                        database_name,
                        """
                        SELECT a.attname AS column_name
                        FROM pg_index i
                        JOIN pg_attribute a ON a.attrelid = i.indrelid AND a.attnum = ANY(i.indkey)
                        WHERE i.indrelid = $1::regclass
                          AND i.indisprimary
                        """,
                        table_name
                    )
                    primary_keys = [row["column_name"] for row in pk_result]
                    if primary_keys:
                        print(f"[AUTOFIX]   Primary keys: {primary_keys}")
                except Exception as pk_error:
                    print(f"[AUTOFIX]   Could not load primary keys: {pk_error}")
                
                # Load foreign keys
                foreign_keys = {}
                try:
                    fk_result = await execute_func(
                        project_id,
                        database_name,
                        """
                        SELECT
                            kcu.column_name,
                            ccu.table_name AS foreign_table_name,
                            ccu.column_name AS foreign_column_name
                        FROM information_schema.table_constraints AS tc
                        JOIN information_schema.key_column_usage AS kcu
                            ON tc.constraint_name = kcu.constraint_name
                            AND tc.table_schema = kcu.table_schema
                        JOIN information_schema.constraint_column_usage AS ccu
                            ON ccu.constraint_name = tc.constraint_name
                            AND ccu.table_schema = tc.table_schema
                        WHERE tc.constraint_type = 'FOREIGN KEY'
                            AND tc.table_name = $1
                            AND tc.table_schema = 'public'
                        """,
                        table_name
                    )
                    
                    foreign_keys = {
                        row["column_name"]: f"{row['foreign_table_name']}.{row['foreign_column_name']}"
                        for row in fk_result
                    }
                    
                    if foreign_keys:
                        print(f"[AUTOFIX]   Foreign keys: {foreign_keys}")
                except Exception as fk_error:
                    print(f"[AUTOFIX]   Could not load foreign keys: {fk_error}")
                
                # Create table info
                tables[table_name] = TableInfo(
                    name=table_name,
                    columns=columns,
                    primary_keys=primary_keys,
                    foreign_keys=foreign_keys
                )
                
            except Exception as table_error:
                print(f"[AUTOFIX] ERROR loading table {table_name}: {table_error}")
                continue
        
        schema = ProjectSchema(tables=tables)
        print(f"[AUTOFIX] Schema loaded: {len(schema.tables)} tables")
        
        return schema
    
    @staticmethod
    async def load_project_schema(
        execute_func,  # Function to execute SQL on project DB
        project_id: UUID,
        database_name: str
    ) -> ProjectSchema:
        """
        Load complete project schema from information_schema.
        
        Args:
            execute_func: Function to execute SQL (execute_on_project_db)
            project_id: Project UUID
            database_name: Database name
            
        Returns:
            ProjectSchema with all tables, columns, keys, and relationships
        """
        print(f"[AUTOFIX] === PHASE 1: LOAD REAL DATABASE SCHEMA ===")
        print(f"[AUTOFIX] Project ID: {project_id}")
        print(f"[AUTOFIX] Database: {database_name}")
        
        tables = {}
        
        try:
            # Load all tables
            tables_result = await execute_func(
                project_id,
                database_name,
                """
                SELECT table_name, table_schema
                FROM information_schema.tables 
                WHERE table_schema = 'public'
                  AND table_type = 'BASE TABLE'
                ORDER BY table_name
                """
            )
            
            print(f"[AUTOFIX] Tables discovered: {len(tables_result)}")
            for t in tables_result:
                print(f"[AUTOFIX]   - {t['table_schema']}.{t['table_name']}")
            
            for table_row in tables_result:
                table_name = table_row["table_name"]
                
                # Skip system/meta tables (common patterns)
                skip_patterns = [
                    'auth', 'realtime', 'storage', 'pg_stat', 'pg_',
                    '_prisma', 'spatial_ref_sys', 'geography_columns',
                    'geometry_columns', 'raster_', 'oauth_audit',
                    'audit_log'
                ]
                
                if any(pattern in table_name.lower() for pattern in skip_patterns):
                    print(f"[AUTOFIX] Skipping system table: {table_name}")
                    continue
                
                print(f"[AUTOFIX] Loading schema for table: {table_name}")
                
                try:
                    # Load columns
                    columns_result = await execute_func(
                        project_id,
                        database_name,
                        """
                        SELECT 
                            column_name,
                            data_type,
                            is_nullable,
                            column_default
                        FROM information_schema.columns 
                        WHERE table_schema = 'public'
                          AND table_name = $1
                        ORDER BY ordinal_position
                        """,
                        table_name
                    )
                    
                    columns = [
                        ColumnInfo(
                            name=row["column_name"],
                            type=row["data_type"],
                            nullable=(row["is_nullable"] == "YES"),
                            default=row["column_default"]
                        )
                        for row in columns_result
                    ]
                    
                    print(f"[AUTOFIX]   Columns: {[c.name for c in columns]}")
                    
                    # Load primary keys (wrap in try-except to handle missing tables)
                    primary_keys = []
                    try:
                        pk_result = await execute_func(
                            project_id,
                            database_name,
                            """
                            SELECT a.attname AS column_name
                            FROM pg_index i
                            JOIN pg_attribute a ON a.attrelid = i.indrelid AND a.attnum = ANY(i.indkey)
                            WHERE i.indrelid = $1::regclass
                              AND i.indisprimary
                            """,
                            table_name
                        )
                        primary_keys = [row["column_name"] for row in pk_result]
                        if primary_keys:
                            print(f"[AUTOFIX]   Primary keys: {primary_keys}")
                    except Exception as pk_error:
                        print(f"[AUTOFIX]   Could not load primary keys: {pk_error}")
                    
                    # Load foreign keys
                    foreign_keys = {}
                    try:
                        fk_result = await execute_func(
                            project_id,
                            database_name,
                            """
                            SELECT
                                kcu.column_name,
                                ccu.table_name AS foreign_table_name,
                                ccu.column_name AS foreign_column_name
                            FROM information_schema.table_constraints AS tc
                            JOIN information_schema.key_column_usage AS kcu
                                ON tc.constraint_name = kcu.constraint_name
                                AND tc.table_schema = kcu.table_schema
                            JOIN information_schema.constraint_column_usage AS ccu
                                ON ccu.constraint_name = tc.constraint_name
                                AND ccu.table_schema = tc.table_schema
                            WHERE tc.constraint_type = 'FOREIGN KEY'
                                AND tc.table_name = $1
                                AND tc.table_schema = 'public'
                            """,
                            table_name
                        )
                        
                        foreign_keys = {
                            row["column_name"]: f"{row['foreign_table_name']}.{row['foreign_column_name']}"
                            for row in fk_result
                        }
                        
                        if foreign_keys:
                            print(f"[AUTOFIX]   Foreign keys: {foreign_keys}")
                    except Exception as fk_error:
                        print(f"[AUTOFIX]   Could not load foreign keys: {fk_error}")
                    
                    # Create table info
                    tables[table_name] = TableInfo(
                        name=table_name,
                        columns=columns,
                        primary_keys=primary_keys,
                        foreign_keys=foreign_keys
                    )
                    
                except Exception as table_error:
                    print(f"[AUTOFIX] ERROR loading table {table_name}: {table_error}")
                    # Skip this table and continue with others
                    continue
            
            schema = ProjectSchema(tables=tables)
            print(f"[AUTOFIX] Schema loaded: {len(schema.tables)} tables")
            print(f"[AUTOFIX] === END PHASE 1 ===\n")
            
            return schema
            
        except Exception as e:
            print(f"[AUTOFIX] ERROR loading schema: {e}")
            import traceback
            print(f"[AUTOFIX] Traceback: {traceback.format_exc()}")
            return ProjectSchema(tables={})


# ============================================
# SQL PARSER
# ============================================

class SQLParser:
    """Parse SQL to identify tables, columns, and aliases"""
    
    @staticmethod
    def parse_sql(sql: str) -> ParsedSQL:
        """
        Parse SQL to extract tables, columns, aliases, and operation.
        
        Returns:
            ParsedSQL with all references identified
        """
        print(f"[AUTOFIX] === PHASE 2: PARSE SQL ===")
        
        # Determine operation
        sql_upper = sql.upper().strip()
        operation = "UNKNOWN"
        for op in ['SELECT', 'INSERT', 'UPDATE', 'DELETE', 'CREATE', 'ALTER', 'DROP']:
            if sql_upper.startswith(op):
                operation = op
                break
        
        print(f"[AUTOFIX] Operation: {operation}")
        
        # Extract tables and aliases
        tables = []
        aliases = {}
        
        # FROM clause
        from_pattern = r'FROM\s+([a-zA-Z_][a-zA-Z0-9_]*)\s+(?:AS\s+)?([a-zA-Z_][a-zA-Z0-9_]*)?'
        for match in re.finditer(from_pattern, sql, re.IGNORECASE):
            table_name = match.group(1)
            alias = match.group(2)
            
            tables.append(SQLReference(
                type='table',
                name=table_name,
                position=match.start()
            ))
            
            if alias and alias.upper() not in ['WHERE', 'ORDER', 'GROUP', 'LIMIT', 'JOIN']:
                aliases[alias] = table_name
                print(f"[AUTOFIX] Alias: {alias} → {table_name}")
        
        # JOIN clauses
        join_pattern = r'JOIN\s+([a-zA-Z_][a-zA-Z0-9_]*)\s+(?:AS\s+)?([a-zA-Z_][a-zA-Z0-9_]*)?'
        for match in re.finditer(join_pattern, sql, re.IGNORECASE):
            table_name = match.group(1)
            alias = match.group(2)
            
            tables.append(SQLReference(
                type='table',
                name=table_name,
                position=match.start()
            ))
            
            if alias and alias.upper() not in ['ON', 'WHERE', 'ORDER', 'GROUP']:
                aliases[alias] = table_name
                print(f"[AUTOFIX] Alias (JOIN): {alias} → {table_name}")
        
        # Extract columns
        columns = []
        
        # Pattern: alias.column or column
        column_pattern = r'\b([a-zA-Z_][a-zA-Z0-9_]*)\.([a-zA-Z_][a-zA-Z0-9_]*)\b'
        for match in re.finditer(column_pattern, sql):
            prefix = match.group(1)
            column_name = match.group(2)
            
            # Resolve table from alias
            table_name = aliases.get(prefix, prefix)
            
            columns.append(SQLReference(
                type='column',
                name=column_name,
                table=table_name,
                alias=prefix if prefix in aliases else None,
                position=match.start()
            ))
        
        print(f"[AUTOFIX] Tables: {[t.name for t in tables]}")
        print(f"[AUTOFIX] Columns: {[(c.table, c.name) for c in columns]}")
        print(f"[AUTOFIX] === END PHASE 2 ===\n")
        
        return ParsedSQL(
            original=sql,
            tables=tables,
            columns=columns,
            aliases=aliases,
            operation=operation
        )


# ============================================
# SCHEMA VALIDATOR
# ============================================

class SchemaValidator:
    """Validate parsed SQL against database schema"""
    
    @staticmethod
    def validate(parsed: ParsedSQL, schema: ProjectSchema) -> List[SchemaValidationError]:
        """
        Validate SQL against schema.
        
        Returns:
            List of validation errors found
        """
        print(f"[AUTOFIX] === PHASE 3: VALIDATE SQL AGAINST SCHEMA ===")
        
        errors = []
        
        # Validate tables
        for table_ref in parsed.tables:
            table_info = schema.get_table(table_ref.name)
            if not table_info:
                # Table doesn't exist
                # Find closest match
                closest = SchemaValidator._find_closest_table(table_ref.name, schema)
                
                errors.append(SchemaValidationError(
                    type='missing_table',
                    reference=table_ref,
                    message=f"Table '{table_ref.name}' does not exist",
                    suggested_fix=closest
                ))
                print(f"[AUTOFIX] ERROR: Table '{table_ref.name}' not found")
                if closest:
                    print(f"[AUTOFIX]   Suggestion: {closest}")
        
        # Validate columns
        for col_ref in parsed.columns:
            if not col_ref.table:
                continue
            
            table_info = schema.get_table(col_ref.table)
            if not table_info:
                # Table doesn't exist (already reported)
                continue
            
            column_info = schema.get_column(col_ref.table, col_ref.name)
            if not column_info:
                # Column doesn't exist in this table
                # Find closest match IN THIS TABLE ONLY
                closest = SchemaValidator._find_closest_column(
                    col_ref.name,
                    table_info
                )
                
                errors.append(SchemaValidationError(
                    type='missing_column',
                    reference=col_ref,
                    message=f"Column '{col_ref.name}' does not exist in table '{col_ref.table}'",
                    suggested_fix=closest
                ))
                print(f"[AUTOFIX] ERROR: Column '{col_ref.table}.{col_ref.name}' not found")
                if closest:
                    print(f"[AUTOFIX]   Suggestion: {closest}")
        
        print(f"[AUTOFIX] Validation errors: {len(errors)}")
        print(f"[AUTOFIX] === END PHASE 3 ===\n")
        
        return errors
    
    @staticmethod
    def _find_closest_table(target: str, schema: ProjectSchema) -> Optional[str]:
        """Find closest matching table name"""
        import difflib
        table_names = list(schema.tables.keys())
        matches = difflib.get_close_matches(target, table_names, n=1, cutoff=0.6)
        return matches[0] if matches else None
    
    @staticmethod
    def _find_closest_column(target: str, table: TableInfo) -> Optional[str]:
        """Find closest matching column name in specific table"""
        import difflib
        column_names = [c.name for c in table.columns]
        
        # First try smart matching
        smart_match = SchemaValidator._smart_column_match(target, column_names)
        if smart_match:
            return smart_match
        
        # Fallback to fuzzy matching
        matches = difflib.get_close_matches(target, column_names, n=1, cutoff=0.6)
        return matches[0] if matches else None
    
    @staticmethod
    def _smart_column_match(target: str, candidates: List[str]) -> Optional[str]:
        """
        Intelligent column matching using common naming patterns.
        
        Examples:
        - customer_name → name
        - email_address → email
        - phone_number → phone
        - created_on → created_at
        """
        target_lower = target.lower()
        
        # Common transformations
        patterns = [
            (r'^[a-z]+_(.+)$', r'\1'),  # customer_name → name
            (r'(.+)_on$', r'\1_at'),     # created_on → created_at
            (r'(.+)_date$', r'\1_at'),   # order_date → order_at
            (r'(.+)_address$', r'\1'),   # email_address → email
            (r'(.+)_number$', r'\1'),    # phone_number → phone
        ]
        
        for pattern, replacement in patterns:
            candidate = re.sub(pattern, replacement, target_lower)
            if candidate != target_lower:
                for col in candidates:
                    if col.lower() == candidate:
                        return col
        
        # Substring matching
        words = re.findall(r'[a-z]+', target_lower)
        for word in words:
            if len(word) > 2:
                for col in candidates:
                    if col.lower() == word:
                        return col
        
        return None


# ============================================
# SQL CORRECTOR
# ============================================

class SQLCorrector:
    """Generate corrected SQL based on validation errors"""
    
    @staticmethod
    def correct(
        sql: str,
        parsed: ParsedSQL,
        errors: List[SchemaValidationError],
        postgres_hint: Optional[str] = None
    ) -> Optional[str]:
        """
        Generate corrected SQL.
        
        Args:
            sql: Original SQL
            parsed: Parsed SQL structure
            errors: Validation errors
            postgres_hint: PostgreSQL HINT from error message
            
        Returns:
            Corrected SQL or None if no correction possible
        """
        print(f"[AUTOFIX] === PHASE 5: GENERATE CORRECTION ===")
        
        if not errors:
            print(f"[AUTOFIX] No errors to correct")
            return None
        
        # Take first error (iterative approach)
        error = errors[0]
        
        print(f"[AUTOFIX] Correcting: {error.message}")
        
        # Priority 1: Use PostgreSQL HINT if available
        if postgres_hint:
            hint_col = SQLCorrector._extract_hint_column(postgres_hint)
            if hint_col:
                print(f"[AUTOFIX] Using PostgreSQL HINT: {hint_col}")
                return SQLCorrector._apply_correction(sql, error, hint_col, parsed)
        
        # Priority 2: Use suggested fix from validation
        if error.suggested_fix:
            print(f"[AUTOFIX] Using schema suggestion: {error.suggested_fix}")
            return SQLCorrector._apply_correction(sql, error, error.suggested_fix, parsed)
        
        print(f"[AUTOFIX] No correction available")
        return None
    
    @staticmethod
    def _extract_hint_column(hint: str) -> Optional[str]:
        """Extract column name from PostgreSQL HINT"""
        # HINT:  Perhaps you meant to reference the column "c.created_at".
        pattern = r'Perhaps you meant to reference the column\s+"?([a-zA-Z0-9_.]+)"?'
        match = re.search(pattern, hint, re.IGNORECASE)
        if match:
            full_ref = match.group(1)
            # Extract just column name
            if '.' in full_ref:
                return full_ref.split('.')[-1]
            return full_ref
        return None
    
    @staticmethod
    def _apply_correction(
        sql: str,
        error: SchemaValidationError,
        fix: str,
        parsed: ParsedSQL
    ) -> str:
        """Apply correction to SQL"""
        ref = error.reference
        
        if error.type == 'missing_column':
            # Replace column reference
            # Handle both standalone and aliased references
            
            # Pattern 1: alias.column
            if ref.alias:
                pattern = rf'\b{re.escape(ref.alias)}\.{re.escape(ref.name)}\b'
                replacement = f'{ref.alias}.{fix}'
                sql = re.sub(pattern, replacement, sql, flags=re.IGNORECASE)
            
            # Pattern 2: standalone column
            pattern = rf'\b{re.escape(ref.name)}\b'
            sql = re.sub(pattern, fix, sql, flags=re.IGNORECASE)
            
        elif error.type == 'missing_table':
            # Replace table reference
            pattern = rf'\b{re.escape(ref.name)}\b'
            sql = re.sub(pattern, fix, sql, flags=re.IGNORECASE)
        
        return sql


# ============================================
# SQL EXECUTOR
# ============================================

class SQLExecutor:
    """Execute SQL and verify success"""
    
    @staticmethod
    async def execute_and_verify(
        sql: str,
        execute_func,
        project_id: UUID,
        database_name: str
    ) -> Tuple[bool, Optional[List], Optional[str]]:
        """
        Execute SQL and verify success.
        
        Returns:
            (success, result, error_message)
        """
        print(f"[AUTOFIX] === PHASE 6: EXECUTE CANDIDATE ===")
        print(f"[AUTOFIX] SQL: {sql[:200]}...")
        
        try:
            result = await execute_func(project_id, database_name, sql)
            
            # Process result
            if isinstance(result, dict):
                rows = result.get('result', [])
            else:
                rows = result
            
            print(f"[AUTOFIX] Execution SUCCESS")
            print(f"[AUTOFIX] Rows returned: {len(rows) if rows else 0}")
            print(f"[AUTOFIX] === END PHASE 6 ===\n")
            
            return (True, rows, None)
            
        except Exception as e:
            error_msg = str(e)
            print(f"[AUTOFIX] Execution FAILED: {error_msg[:200]}")
            print(f"[AUTOFIX] === END PHASE 6 ===\n")
            
            return (False, None, error_msg)


# ============================================
# MAIN AUTO-FIX ENGINE
# ============================================

class SQLAutoFixEngine:
    """Database-aware SQL repair engine"""
    
    def __init__(self):
        self.schema_loader = SchemaLoader()
        self.parser = SQLParser()
        self.validator = SchemaValidator()
        self.corrector = SQLCorrector()
        self.executor = SQLExecutor()
    
    async def auto_fix(
        self,
        sql: str,
        error_message: str,
        execute_func,
        project_id: UUID,
        database_name: str,
        max_iterations: int = 5
    ) -> AutoFixResult:
        """
        Auto-fix SQL using database schema.
        
        Args:
            sql: Original SQL
            error_message: PostgreSQL error message
            execute_func: Function to execute SQL
            project_id: Project UUID
            database_name: Database name
            max_iterations: Maximum fix iterations
            
        Returns:
            AutoFixResult with success status and fixed SQL
        """
        print(f"\n{'='*80}")
        print(f"SQL AUTOFIX ENGINE - DATABASE-AWARE REPAIR")
        print(f"{'='*80}\n")
        
        errors = []
        changes = []
        
        # Safety checks
        if self._is_destructive_without_where(sql):
            print(f"[AUTOFIX] REJECTED: Destructive operation without WHERE")
            return AutoFixResult(
                success=False,
                fixed_sql=None,
                verification_status='REJECTED_UNSAFE',
                iterations=0,
                errors=['Destructive operation without WHERE clause'],
                changes=[]
            )
        
        if self._is_success_message(error_message):
            print(f"[AUTOFIX] REJECTED: Success message in error")
            return AutoFixResult(
                success=False,
                fixed_sql=None,
                verification_status='NO_ERROR',
                iterations=0,
                errors=[],
                changes=[]
            )
        
        # PHASE 1: Parse SQL FIRST to identify tables
        print(f"[AUTOFIX] === PHASE 1: PARSE SQL TO IDENTIFY TABLES ===")
        parsed = self.parser.parse_sql(sql)
        
        if not parsed.tables:
            print(f"[AUTOFIX] ERROR: No tables found in SQL")
            return AutoFixResult(
                success=False,
                fixed_sql=None,
                verification_status='NO_TABLES_FOUND',
                iterations=0,
                errors=['Could not identify tables in SQL'],
                changes=[]
            )
        
        print(f"[AUTOFIX] Tables referenced: {[t.name for t in parsed.tables]}")
        print(f"[AUTOFIX] === END PHASE 1 ===\n")
        
        # PHASE 2: Load schema ONLY for referenced tables
        print(f"[AUTOFIX] === PHASE 2: LOAD SCHEMA FOR REFERENCED TABLES ===")
        schema = await self.schema_loader.load_tables_schema(
            execute_func,
            project_id,
            database_name,
            [t.name for t in parsed.tables]
        )
        
        if not schema.tables:
            print(f"[AUTOFIX] ERROR: No schema loaded for referenced tables")
            return AutoFixResult(
                success=False,
                fixed_sql=None,
                verification_status='SCHEMA_LOAD_FAILED',
                iterations=0,
                errors=['Failed to load database schema for referenced tables'],
                changes=[]
            )
        
        print(f"[AUTOFIX] Schema loaded: {len(schema.tables)} tables")
        print(f"[AUTOFIX] === END PHASE 2 ===\n")
        
        # Iterative repair loop
        current_sql = sql
        current_error = error_message
        
        for iteration in range(1, max_iterations + 1):
            print(f"\n{'='*80}")
            print(f"ITERATION {iteration}/{max_iterations}")
            print(f"{'='*80}\n")
            
            # PHASE 2: Parse SQL
            parsed = self.parser.parse_sql(current_sql)
            
            # PHASE 3: Validate against schema
            validation_errors = self.validator.validate(parsed, schema)
            
            if not validation_errors:
                print(f"[AUTOFIX] No schema validation errors found")
                
                # Check if this is a different type of error
                if 'syntax error' in current_error.lower():
                    print(f"[AUTOFIX] Syntax error - cannot fix")
                    errors.append(f"Syntax error: {current_error}")
                    break
                
                # Schema is valid, error might be elsewhere
                print(f"[AUTOFIX] SQL is schema-valid but execution failed")
                errors.append(current_error)
                break
            
            # PHASE 4: Extract PostgreSQL HINT
            postgres_hint = self._extract_hint(current_error)
            
            # PHASE 5: Generate correction
            corrected_sql = self.corrector.correct(
                current_sql,
                parsed,
                validation_errors,
                postgres_hint
            )
            
            if not corrected_sql or corrected_sql == current_sql:
                print(f"[AUTOFIX] No correction generated")
                errors.append(f"Cannot generate correction for: {current_error}")
                break
            
            print(f"[AUTOFIX] Correction generated")
            changes.append(f"Iteration {iteration}: {validation_errors[0].message}")
            
            # PHASE 6: Execute and verify
            success, result, exec_error = await self.executor.execute_and_verify(
                corrected_sql,
                execute_func,
                project_id,
                database_name
            )
            
            if success:
                # PHASE 7: SUCCESS
                print(f"\n{'='*80}")
                print(f"SUCCESS: SQL FIXED AND VERIFIED")
                print(f"{'='*80}\n")
                
                return AutoFixResult(
                    success=True,
                    fixed_sql=corrected_sql,
                    verification_status='FIXED_AND_VERIFIED',
                    iterations=iteration,
                    errors=[],
                    changes=changes
                )
            
            # Execution failed - check if fixable
            if not self._is_fixable_error(exec_error):
                print(f"[AUTOFIX] Error not fixable: {exec_error}")
                errors.append(exec_error)
                break
            
            # Continue to next iteration
            current_sql = corrected_sql
            current_error = exec_error
        
        # All iterations failed
        print(f"\n{'='*80}")
        print(f"FAILED: Could not fix SQL after {max_iterations} iterations")
        print(f"{'='*80}\n")
        
        return AutoFixResult(
            success=False,
            fixed_sql=None,
            verification_status='FIX_FAILED',
            iterations=max_iterations,
            errors=errors,
            changes=changes
        )
    
    def _extract_hint(self, error_message: str) -> Optional[str]:
        """Extract HINT from PostgreSQL error"""
        # Extract everything after "HINT:"
        pattern = r'HINT:(.+?)(?:\n[A-Z]+:|$)'
        match = re.search(pattern, error_message, re.DOTALL)
        if match:
            return match.group(1).strip()
        return None
    
    def _is_fixable_error(self, error_message: str) -> bool:
        """Check if error is fixable"""
        if not error_message:
            return False
        
        error_lower = error_message.lower()
        
        fixable_patterns = [
            'column', 'does not exist',
            'relation', 'does not exist',
            'table', 'does not exist'
        ]
        
        return any(pattern in error_lower for pattern in fixable_patterns)
    
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
    
    def _is_success_message(self, message: str) -> bool:
        """Check if message indicates success"""
        if not message:
            return False
        success_indicators = [
            'successfully', 'completed', 'executed successfully',
            'created successfully', 'inserted successfully'
        ]
        return any(ind in message.lower() for ind in success_indicators)


# ============================================
# SINGLETON
# ============================================

sql_autofix_engine = SQLAutoFixEngine()
