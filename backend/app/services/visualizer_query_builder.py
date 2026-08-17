"""
Visualizer Query Builder
Generates safe, parameterized SQL queries from visualization configurations
"""
import re
from typing import List, Dict, Any, Tuple
from app.models.visualizer_schemas import (
    VisualizerQueryRequest,
    VisualizerFilter,
    VisualizerMetric,
    VisualizerDimension
)
import logging

logger = logging.getLogger(__name__)

# Safe identifier validation (PostgreSQL limit: 63 chars)
SAFE_IDENTIFIER_RE = re.compile(r'^[a-zA-Z_][a-zA-Z0-9_]{0,62}$')


class VisualizerQueryBuilder:
    """Builds SQL queries from visualization configurations"""
    
    @staticmethod
    def validate_identifier(identifier: str, label: str = "identifier") -> str:
        """
        Validate that identifier is safe for SQL.
        Returns quoted identifier.
        Raises ValueError if invalid.
        """
        if not identifier or not SAFE_IDENTIFIER_RE.match(identifier):
            raise ValueError(
                f"Invalid {label}: '{identifier}'. "
                f"Must match ^[a-zA-Z_][a-zA-Z0-9_]{{0,62}}$"
            )
        return f'"{identifier}"'
    
    @staticmethod
    def build_dimension_expression(dimension: VisualizerDimension) -> Tuple[str, str]:
        """
        Build SQL expression for a dimension.
        
        Returns:
            tuple: (sql_expression, alias)
        """
        safe_column = VisualizerQueryBuilder.validate_identifier(dimension.column, "dimension column")
        
        # Use custom alias or generate from column name
        alias = dimension.alias or dimension.column
        safe_alias = VisualizerQueryBuilder.validate_identifier(alias, "dimension alias")
        
        # Handle time bucketing for timestamp columns
        if dimension.time_bucket:
            bucket_map = {
                "hour": "hour",
                "day": "day",
                "week": "week",
                "month": "month",
                "quarter": "quarter",
                "year": "year"
            }
            bucket = bucket_map.get(dimension.time_bucket)
            if not bucket:
                raise ValueError(f"Invalid time_bucket: {dimension.time_bucket}")
            
            expression = f"DATE_TRUNC('{bucket}', {safe_column})"
            return expression, safe_alias
        
        return safe_column, safe_alias
    
    @staticmethod
    def build_metric_expression(metric: VisualizerMetric) -> Tuple[str, str]:
        """
        Build SQL expression for a metric.
        
        Returns:
            tuple: (sql_expression, alias)
        """
        safe_column = VisualizerQueryBuilder.validate_identifier(metric.column, "metric column")
        
        # Generate alias from column and aggregation
        if metric.alias:
            alias = metric.alias
        else:
            alias = f"{metric.column}_{metric.aggregation}"
        
        safe_alias = VisualizerQueryBuilder.validate_identifier(alias, "metric alias")
        
        # Build aggregation expression
        agg_map = {
            "count": f"COUNT({safe_column})",
            "count_distinct": f"COUNT(DISTINCT {safe_column})",
            "sum": f"SUM({safe_column})",
            "avg": f"AVG({safe_column})",
            "min": f"MIN({safe_column})",
            "max": f"MAX({safe_column})"
        }
        
        expression = agg_map.get(metric.aggregation)
        if not expression:
            raise ValueError(f"Invalid aggregation: {metric.aggregation}")
        
        return expression, safe_alias
    
    @staticmethod
    def build_filter_condition(filter_obj: VisualizerFilter, param_index: int) -> Tuple[str, Any]:
        """
        Build SQL WHERE condition for a filter.
        
        Returns:
            tuple: (sql_condition, parameter_value)
        """
        safe_column = VisualizerQueryBuilder.validate_identifier(filter_obj.column, "filter column")
        
        operator_map = {
            "eq": f"{safe_column} = ${param_index}",
            "ne": f"{safe_column} != ${param_index}",
            "gt": f"{safe_column} > ${param_index}",
            "gte": f"{safe_column} >= ${param_index}",
            "lt": f"{safe_column} < ${param_index}",
            "lte": f"{safe_column} <= ${param_index}",
            "like": f"{safe_column} LIKE ${param_index}",
            "in": f"{safe_column} = ANY(${param_index})",
            "not_in": f"{safe_column} != ALL(${param_index})",
            "is_null": f"{safe_column} IS NULL",
            "is_not_null": f"{safe_column} IS NOT NULL"
        }
        
        condition = operator_map.get(filter_obj.operator)
        if not condition:
            raise ValueError(f"Invalid filter operator: {filter_obj.operator}")
        
        # Handle special operators
        if filter_obj.operator in ["is_null", "is_not_null"]:
            return condition, None
        
        # Handle LIKE operator - add wildcards
        if filter_obj.operator == "like":
            value = f"%{filter_obj.value}%"
        else:
            value = filter_obj.value
        
        return condition, value
    
    @staticmethod
    def build_query(request: VisualizerQueryRequest, project_schema: str) -> Tuple[str, List[Any]]:
        """
        Build complete SQL query from visualization request.
        
        Args:
            request: VisualizerQueryRequest object
            project_schema: Project schema name (e.g., 'proj_60f192dc')
        
        Returns:
            tuple: (sql_query, parameters)
        """
        # Validate table name
        safe_table = VisualizerQueryBuilder.validate_identifier(request.table, "table")
        
        # Build SELECT clause
        select_parts = []
        aliases = []
        
        # Add dimensions
        for dimension in request.dimensions:
            expr, alias = VisualizerQueryBuilder.build_dimension_expression(dimension)
            select_parts.append(f"{expr} AS {alias}")
            aliases.append(alias)
        
        # Add metrics
        metric_aliases = []
        for metric in request.metrics:
            expr, alias = VisualizerQueryBuilder.build_metric_expression(metric)
            select_parts.append(f"{expr} AS {alias}")
            metric_aliases.append(alias)
            aliases.append(alias)
        
        if not select_parts:
            raise ValueError("At least one dimension or metric is required")
        
        select_clause = "SELECT " + ", ".join(select_parts)
        
        # Build FROM clause with schema
        from_clause = f'FROM "{project_schema}".{safe_table}'
        
        # Build WHERE clause
        where_conditions = []
        parameters = []
        param_index = 1
        
        for filter_obj in request.filters:
            condition, value = VisualizerQueryBuilder.build_filter_condition(filter_obj, param_index)
            where_conditions.append(condition)
            
            if value is not None:
                parameters.append(value)
                param_index += 1
        
        where_clause = ""
        if where_conditions:
            where_clause = "WHERE " + " AND ".join(where_conditions)
        
        # Build GROUP BY clause
        group_by_clause = ""
        if request.dimensions and len(request.dimensions) > 0:
            # Group by dimension aliases
            dimension_aliases = [
                VisualizerQueryBuilder.validate_identifier(
                    dim.alias or dim.column, 
                    "dimension alias"
                )
                for dim in request.dimensions
            ]
            if dimension_aliases:
                group_by_clause = "GROUP BY " + ", ".join(dimension_aliases)
        
        # Build ORDER BY clause
        order_by_clause = ""
        if request.sort and request.sort.get("column"):
            sort_column = request.sort["column"]
            sort_direction = request.sort.get("direction", "asc").upper()
            
            # Validate sort direction
            if sort_direction not in ["ASC", "DESC"]:
                sort_direction = "ASC"
            
            # Validate sort column exists in result
            if sort_column not in [dim.alias or dim.column for dim in request.dimensions] + [
                metric.alias or f"{metric.column}_{metric.aggregation}" for metric in request.metrics
            ]:
                raise ValueError(f"Sort column '{sort_column}' not in result set")
            
            safe_sort_column = VisualizerQueryBuilder.validate_identifier(sort_column, "sort column")
            order_by_clause = f"ORDER BY {safe_sort_column} {sort_direction}"
        
        # Build LIMIT clause
        limit_clause = f"LIMIT {request.limit}"
        
        # Assemble final query
        query_parts = [
            select_clause,
            from_clause,
            where_clause,
            group_by_clause,
            order_by_clause,
            limit_clause
        ]
        
        sql_query = "\n".join(part for part in query_parts if part)
        
        logger.info(f"Generated SQL query:\n{sql_query}")
        logger.info(f"Parameters: {parameters}")
        
        return sql_query, parameters
    
    @staticmethod
    def validate_query_safety(sql: str) -> None:
        """
        Validate that generated query is safe.
        Raises ValueError if query contains dangerous patterns.
        """
        # Convert to lowercase for checking
        sql_lower = sql.lower()
        
        # Disallowed keywords/patterns
        dangerous_patterns = [
            "drop ",
            "delete ",
            "truncate ",
            "insert ",
            "update ",
            "alter ",
            "create ",
            "grant ",
            "revoke ",
            ";",  # Multiple statements
            "--",  # SQL comments
            "/*",  # Block comments
            "exec",
            "execute",
            "xp_",  # SQL Server extended procedures
        ]
        
        for pattern in dangerous_patterns:
            if pattern in sql_lower:
                raise ValueError(
                    f"Query contains disallowed pattern: '{pattern}'. "
                    f"Visualizer queries must be read-only SELECT statements."
                )
        
        # Must start with SELECT
        if not sql_lower.strip().startswith("select"):
            raise ValueError("Query must be a SELECT statement")
