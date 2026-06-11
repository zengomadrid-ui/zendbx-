"""
Row Level Security (RLS) Enforcer

Provides utilities to enforce RLS policies in API endpoints.
Wraps database queries with RLS context setting.

Key Features:
- Automatic RLS context injection
- Service role bypass support
- Query wrapping with user context
- Error handling for RLS violations
"""
import asyncpg
from typing import Any, List, Optional
from fastapi import Request, HTTPException
import logging

from ..middleware.rls_context import set_rls_context, clear_rls_context

logger = logging.getLogger(__name__)


class RLSEnforcer:
    """
    Enforces Row Level Security on database queries
    
    Usage:
        enforcer = RLSEnforcer(request)
        result = await enforcer.execute(pool, query, *params)
    """
    
    def __init__(self, request: Request):
        self.request = request
        self.user_id = getattr(request.state, 'rls_user_id', None)
        self.role = getattr(request.state, 'rls_role', 'anon')
        self.project_id = getattr(request.state, 'rls_project_id', None)
        # Schema for search_path — critical for correct data isolation
        self.schema = getattr(request.state, 'project_schema', None)
    
    @property
    def is_service_role(self) -> bool:
        """Check if current request has service_role privileges"""
        return self.role == "service_role"
    
    @property
    def is_authenticated(self) -> bool:
        """Check if user is authenticated"""
        return self.role in ["authenticated", "service_role"] and self.user_id is not None
    
    async def _prepare_conn(self, conn, bypass_rls: bool = False):
        """Set search_path and RLS context on a connection."""
        if self.schema:
            await conn.execute(f'SET search_path TO "{self.schema}", public')
        if not (bypass_rls and self.is_service_role):
            await set_rls_context(conn, self.user_id, self.role)
        else:
            logger.info("Bypassing RLS with service_role")

    async def execute(
        self,
        pool: asyncpg.Pool,
        query: str,
        *params,
        bypass_rls: bool = False
    ) -> List[asyncpg.Record]:
        """
        Execute query with RLS context
        
        Args:
            pool: Database connection pool
            query: SQL query to execute
            *params: Query parameters
            bypass_rls: If True and service_role, bypass RLS
        
        Returns:
            Query results
        
        Raises:
            HTTPException: If RLS blocks access
        """
        async with pool.acquire() as conn:
            try:
                # Set search_path and RLS context
                await self._prepare_conn(conn, bypass_rls)
                result = await conn.fetch(query, *params)
                return result
                
            except asyncpg.exceptions.InsufficientPrivilegeError as e:
                logger.warning(f"RLS blocked query: {str(e)}")
                raise HTTPException(
                    status_code=403,
                    detail="Access denied by row level security policy"
                )
            except asyncpg.exceptions.PostgresError as e:
                logger.error(
                    f"PostgreSQL error in execute(): "
                    f"sqlstate={getattr(e, 'sqlstate', None)} "
                    f"message={str(e)} "
                    f"detail={getattr(e, 'detail', None)} "
                    f"hint={getattr(e, 'hint', None)} "
                    f"constraint={getattr(e, 'constraint_name', None)} "
                    f"column={getattr(e, 'column_name', None)}"
                )
                raise HTTPException(
                    status_code=500,
                    detail={
                        "message": str(e),
                        "sqlstate": getattr(e, "sqlstate", None),
                        "detail": getattr(e, "detail", None),
                        "hint": getattr(e, "hint", None),
                        "constraint": getattr(e, "constraint_name", None),
                        "column": getattr(e, "column_name", None),
                    },
                )
            finally:
                # Always clear context
                await clear_rls_context(conn)
    
    async def execute_one(
        self,
        pool: asyncpg.Pool,
        query: str,
        *params,
        bypass_rls: bool = False
    ) -> Optional[asyncpg.Record]:
        """
        Execute query and return single row
        
        Args:
            pool: Database connection pool
            query: SQL query to execute
            *params: Query parameters
            bypass_rls: If True and service_role, bypass RLS
        
        Returns:
            Single row or None
        """
        async with pool.acquire() as conn:
            try:
                # Set search_path and RLS context
                await self._prepare_conn(conn, bypass_rls)
                result = await conn.fetchrow(query, *params)
                return result
                
            except asyncpg.exceptions.InsufficientPrivilegeError as e:
                logger.warning(f"RLS blocked query: {str(e)}")
                raise HTTPException(
                    status_code=403,
                    detail="Access denied by row level security policy"
                )
            except asyncpg.exceptions.PostgresError as e:
                logger.error(
                    f"PostgreSQL error in execute_one(): "
                    f"sqlstate={getattr(e, 'sqlstate', None)} "
                    f"message={str(e)} "
                    f"detail={getattr(e, 'detail', None)} "
                    f"hint={getattr(e, 'hint', None)} "
                    f"constraint={getattr(e, 'constraint_name', None)} "
                    f"column={getattr(e, 'column_name', None)}"
                )
                raise HTTPException(
                    status_code=500,
                    detail={
                        "message": str(e),
                        "sqlstate": getattr(e, "sqlstate", None),
                        "detail": getattr(e, "detail", None),
                        "hint": getattr(e, "hint", None),
                        "constraint": getattr(e, "constraint_name", None),
                        "column": getattr(e, "column_name", None),
                    },
                )
            finally:
                await clear_rls_context(conn)
    
    async def execute_command(
        self,
        pool: asyncpg.Pool,
        query: str,
        *params,
        bypass_rls: bool = False
    ) -> str:
        """
        Execute command (INSERT, UPDATE, DELETE) with RLS
        
        Args:
            pool: Database connection pool
            query: SQL command to execute
            *params: Query parameters
            bypass_rls: If True and service_role, bypass RLS
        
        Returns:
            Command status string
        """
        async with pool.acquire() as conn:
            try:
                # Set search_path and RLS context
                await self._prepare_conn(conn, bypass_rls)
                result = await conn.execute(query, *params)
                return result
                
            except asyncpg.exceptions.InsufficientPrivilegeError as e:
                logger.warning(f"RLS blocked command: {str(e)}")
                raise HTTPException(
                    status_code=403,
                    detail="Access denied by row level security policy"
                )
            except asyncpg.exceptions.PostgresError as e:
                logger.error(
                    f"PostgreSQL error in execute_command(): "
                    f"sqlstate={getattr(e, 'sqlstate', None)} "
                    f"message={str(e)} "
                    f"detail={getattr(e, 'detail', None)} "
                    f"hint={getattr(e, 'hint', None)} "
                    f"constraint={getattr(e, 'constraint_name', None)} "
                    f"column={getattr(e, 'column_name', None)}"
                )
                raise HTTPException(
                    status_code=500,
                    detail={
                        "message": str(e),
                        "sqlstate": getattr(e, "sqlstate", None),
                        "detail": getattr(e, "detail", None),
                        "hint": getattr(e, "hint", None),
                        "constraint": getattr(e, "constraint_name", None),
                        "column": getattr(e, "column_name", None),
                    },
                )
            finally:
                await clear_rls_context(conn)
    
    def require_authenticated(self):
        """Require user to be authenticated"""
        if not self.is_authenticated:
            raise HTTPException(
                status_code=401,
                detail="Authentication required"
            )
    
    def require_service_role(self):
        """Require service_role privileges"""
        if not self.is_service_role:
            raise HTTPException(
                status_code=403,
                detail="Service role required for this operation"
            )


def get_rls_enforcer(request: Request) -> RLSEnforcer:
    """
    Dependency to get RLS enforcer from request
    
    Usage:
        @router.get("/data")
        async def get_data(
            request: Request,
            enforcer: RLSEnforcer = Depends(get_rls_enforcer)
        ):
            result = await enforcer.execute(pool, "SELECT * FROM my_table")
            return result
    """
    return RLSEnforcer(request)
