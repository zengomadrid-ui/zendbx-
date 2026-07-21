"""
SQL Editor Security Regression Tests
Tests that SQL Editor uses restricted project roles and cannot access privileged resources
Created from Phase 5.0 security verification
"""

import pytest
import asyncpg
import inspect
from unittest.mock import patch, MagicMock
from app.core.config import settings
from app.core.database import execute_on_project_db, get_main_db_pool


class TestSQLEditorSecurity:
    """Test SQL Editor security isolation"""
    
    @pytest.mark.asyncio
    async def test_no_privileged_fallback_in_code(self):
        """Verify privileged fallback code paths are permanently removed"""
        source = inspect.getsource(execute_on_project_db)
        
        # Verify no fallback flags exist
        assert 'ALLOW_INSECURE_PROJECT_DB_FALLBACK' not in source, \
            "Privileged fallback flag found in code"
        
        # Verify no main pool fallback
        if 'get_main_db_pool()' in source:
            assert 'fallback' not in source.lower(), \
                "Main pool fallback logic still exists"
    
    @pytest.mark.asyncio
    async def test_sql_editor_uses_restricted_role(self):
        """Verify SQL Editor executes as restricted project role"""
        conn = await asyncpg.connect(settings.DATABASE_URL)
        
        try:
            # Get an active project
            project = await conn.fetchrow("""
                SELECT p.id, p.database_name, pc.role_name
                FROM projects p
                INNER JOIN project_db_credentials pc ON p.id = pc.project_id
                INNER JOIN information_schema.schemata s ON s.schema_name = p.database_name
                LIMIT 1
            """)
            
            if not project:
                pytest.skip("No active projects with credentials")
            
            # Execute query via SQL Editor path
            result = await execute_on_project_db(
                project['id'],
                project['database_name'],
                'SELECT current_user'
            )
            
            current_user = result[0]['current_user']
            
            # Must use restricted project role
            assert current_user == project['role_name'], \
                f"Wrong role: {current_user} != {project['role_name']}"
            
            # Must NOT use privileged roles
            assert current_user not in ['postgres', 'zendbx_platform', 'zendbx_provisioner'], \
                f"CRITICAL: Using privileged role {current_user}"
        
        finally:
            await conn.close()
    
    @pytest.mark.asyncio
    async def test_cannot_access_auth_schema(self):
        """Verify SQL Editor cannot access auth schema"""
        conn = await asyncpg.connect(settings.DATABASE_URL)
        
        try:
            project = await conn.fetchrow("""
                SELECT p.id, p.database_name
                FROM projects p
                INNER JOIN project_db_credentials pc ON p.id = pc.project_id
                LIMIT 1
            """)
            
            if not project:
                pytest.skip("No active projects")
            
            # Try to access auth.users - should fail
            try:
                await execute_on_project_db(
                    project['id'],
                    project['database_name'],
                    'SELECT * FROM auth.users LIMIT 1'
                )
                # If we reach here, access was granted (SECURITY BREACH)
                pytest.fail("SECURITY BREACH: Can access auth.users")
            except Exception as e:
                # Expected - access should be denied
                error_msg = str(e).lower()
                assert 'permission' in error_msg or 'denied' in error_msg or 'does not exist' in error_msg, \
                    f"Expected permission error, got: {e}"
        
        finally:
            await conn.close()
    
    @pytest.mark.asyncio
    async def test_cannot_access_platform_tables(self):
        """Verify SQL Editor cannot access platform tables"""
        conn = await asyncpg.connect(settings.DATABASE_URL)
        
        try:
            project = await conn.fetchrow("""
                SELECT p.id, p.database_name
                FROM projects p
                INNER JOIN project_db_credentials pc ON p.id = pc.project_id
                LIMIT 1
            """)
            
            if not project:
                pytest.skip("No active projects")
            
            # Try to access project_db_credentials - should fail
            try:
                await execute_on_project_db(
                    project['id'],
                    project['database_name'],
                    'SELECT * FROM public.project_db_credentials LIMIT 1'
                )
                # If we reach here, access was granted (SECURITY BREACH)
                pytest.fail("SECURITY BREACH: Can access platform table project_db_credentials")
            except Exception as e:
                # Expected - access should be denied
                error_msg = str(e).lower()
                assert 'permission' in error_msg or 'denied' in error_msg or 'does not exist' in error_msg, \
                    f"Expected permission error, got: {e}"
        
        finally:
            await conn.close()
    
    @pytest.mark.asyncio
    async def test_tenant_isolation(self):
        """Verify projects cannot access each other's data"""
        conn = await asyncpg.connect(settings.DATABASE_URL)
        
        try:
            projects = await conn.fetch("""
                SELECT p.id, p.database_name
                FROM projects p
                INNER JOIN project_db_credentials pc ON p.id = pc.project_id
                INNER JOIN information_schema.schemata s ON s.schema_name = p.database_name
                LIMIT 2
            """)
            
            if len(projects) < 2:
                pytest.skip("Need at least 2 projects")
            
            proj_a = dict(projects[0])
            proj_b = dict(projects[1])
            
            # Create test table in project B
            await execute_on_project_db(
                proj_b['id'],
                proj_b['database_name'],
                'DROP TABLE IF EXISTS isolation_test; CREATE TABLE isolation_test (data TEXT)'
            )
            
            # Try to access project B's table from project A
            with pytest.raises(Exception):
                await execute_on_project_db(
                    proj_a['id'],
                    proj_a['database_name'],
                    f'SELECT * FROM "{proj_b["database_name"]}".isolation_test'
                )
            
            # Cleanup
            await execute_on_project_db(
                proj_b['id'],
                proj_b['database_name'],
                'DROP TABLE IF EXISTS isolation_test'
            )
        
        finally:
            await conn.close()
    
    @pytest.mark.asyncio
    async def test_fail_closed_missing_credential(self):
        """Verify missing credentials cause execution to fail (not fallback)"""
        conn = await asyncpg.connect(settings.DATABASE_URL)
        
        try:
            project = await conn.fetchrow("""
                SELECT p.id, p.database_name, pc.role_name, pc.encrypted_password
                FROM projects p
                INNER JOIN project_db_credentials pc ON p.id = pc.project_id
                LIMIT 1
            """)
            
            if not project:
                pytest.skip("No projects with credentials")
            
            # Backup credential
            await conn.execute(
                "DELETE FROM project_db_credentials WHERE project_id = $1",
                project['id']
            )
            
            # Use mock to verify get_main_db_pool is NEVER called
            with patch('app.core.database.get_main_db_pool') as mock_main_pool:
                mock_main_pool.return_value = MagicMock()
                
                # Must fail (not fallback to privileged role)
                with pytest.raises(Exception) as exc_info:
                    await execute_on_project_db(
                        project['id'],
                        project['database_name'],
                        'SELECT 1'
                    )
                
                error_msg = str(exc_info.value).lower()
                assert 'not found' in error_msg or 'credential' in error_msg, \
                    f"Expected credential error, got: {exc_info.value}"
                
                # CRITICAL: Verify get_main_db_pool was NEVER called
                assert mock_main_pool.call_count == 0, \
                    f"SECURITY BREACH: get_main_db_pool was called {mock_main_pool.call_count} times during credential failure!"
            
            # Restore credential
            await conn.execute("""
                INSERT INTO project_db_credentials (project_id, role_name, encrypted_password)
                VALUES ($1, $2, $3)
            """, project['id'], project['role_name'], project['encrypted_password'])
        
        finally:
            await conn.close()
    
    @pytest.mark.asyncio
    async def test_sql_editor_crud_operations(self):
        """Verify SQL Editor can perform normal CRUD operations"""
        conn = await asyncpg.connect(settings.DATABASE_URL)
        
        try:
            project = await conn.fetchrow("""
                SELECT p.id, p.database_name
                FROM projects p
                INNER JOIN project_db_credentials pc ON p.id = pc.project_id
                LIMIT 1
            """)
            
            if not project:
                pytest.skip("No active projects")
            
            # CREATE
            result = await execute_on_project_db(
                project['id'],
                project['database_name'],
                'DROP TABLE IF EXISTS crud_test; CREATE TABLE crud_test (id INT, name TEXT)'
            )
            
            # INSERT
            await execute_on_project_db(
                project['id'],
                project['database_name'],
                "INSERT INTO crud_test VALUES (1, 'test')"
            )
            
            # SELECT
            result = await execute_on_project_db(
                project['id'],
                project['database_name'],
                'SELECT * FROM crud_test'
            )
            assert len(result) == 1
            
            # UPDATE
            await execute_on_project_db(
                project['id'],
                project['database_name'],
                "UPDATE crud_test SET name = 'updated' WHERE id = 1"
            )
            
            # DELETE
            await execute_on_project_db(
                project['id'],
                project['database_name'],
                'DELETE FROM crud_test WHERE id = 1'
            )
            
            # Verify deletion
            result = await execute_on_project_db(
                project['id'],
                project['database_name'],
                'SELECT * FROM crud_test'
            )
            assert len(result) == 0
            
            # DROP
            await execute_on_project_db(
                project['id'],
                project['database_name'],
                'DROP TABLE crud_test'
            )
        
        except Exception as e:
            # Clean up on failure
            try:
                await execute_on_project_db(
                    project['id'],
                    project['database_name'],
                    'DROP TABLE IF EXISTS crud_test'
                )
            except:
                pass
            raise e
        
        finally:
            await conn.close()
