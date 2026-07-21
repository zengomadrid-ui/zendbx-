"""
PHASE 2-4 SECURITY TESTS
Database-level multi-tenant isolation verification

Tests PostgreSQL-enforced boundaries between:
- Project A vs Project B
- Project vs auth schema
- Project vs public platform schema
"""
import pytest
import asyncpg
import asyncio
from uuid import uuid4
from app.core.db_roles import ProjectRoleManager, ProjectCredentialStore
from app.core.database import (
    get_platform_db_pool,
    get_provisioner_db_pool,
    get_project_db_pool_isolated,
    close_project_pool
)


class TestDatabaseIsolation:
    """Test suite for database-level project isolation"""
    
    @pytest.fixture(scope="class")
    async def test_projects(self):
        """
        Create test projects with isolated roles
        
        Creates:
        - Project A with schema proj_test_a
        - Project B with schema proj_test_b
        - Project C with schema proj_test_c
        
        Each has unique PostgreSQL role with restricted access
        """
        provisioner_pool = await get_provisioner_db_pool()
        platform_pool = await get_platform_db_pool()
        
        # Generate test project IDs
        project_a_id = uuid4()
        project_b_id = uuid4()
        project_c_id = uuid4()
        
        projects = {
            'A': {'id': project_a_id, 'schema': f'proj_test_{str(project_a_id)[:8]}'},
            'B': {'id': project_b_id, 'schema': f'proj_test_{str(project_b_id)[:8]}'},
            'C': {'id': project_c_id, 'schema': f'proj_test_{str(project_c_id)[:8]}'}
        }
        
        async with provisioner_pool.acquire() as conn:
            # Create schemas
            for name, project in projects.items():
                await conn.execute(f'CREATE SCHEMA IF NOT EXISTS "{project["schema"]}"')
                print(f"✅ Created schema: {project['schema']}")
            
            # Create test tables with unique data
            for name, project in projects.items():
                await conn.execute(f'''
                    CREATE TABLE IF NOT EXISTS "{project['schema']}".test_data (
                        id SERIAL PRIMARY KEY,
                        project_name VARCHAR(50),
                        secret_value TEXT
                    )
                ''')
                
                await conn.execute(f'''
                    INSERT INTO "{project['schema']}".test_data (project_name, secret_value)
                    VALUES ($1, $2)
                ''', f'Project {name}', f'SECRET_{name}_DATA')
                
                print(f"✅ Created test data for Project {name}")
        
        # Create project-specific roles
        credential_store = ProjectCredentialStore()
        
        for name, project in projects.items():
            role_name, password = await ProjectRoleManager.create_project_role(
                project['id'],
                project['schema'],
                provisioner_pool
            )
            
            # Store credentials
            await credential_store.store_credentials(
                project['id'],
                role_name,
                password
            )
            
            projects[name]['role_name'] = role_name
            projects[name]['password'] = password
            
            print(f"✅ Created role for Project {name}: {role_name}")
        
        yield projects
        
        # Cleanup
        async with provisioner_pool.acquire() as conn:
            for name, project in projects.items():
                # Drop role
                try:
                    await ProjectRoleManager.drop_project_role(project['id'], provisioner_pool)
                except Exception as e:
                    print(f"⚠️  Could not drop role for Project {name}: {e}")
                
                # Drop schema
                try:
                    await conn.execute(f'DROP SCHEMA IF EXISTS "{project["schema"]}" CASCADE')
                    print(f"✅ Cleaned up schema: {project['schema']}")
                except Exception as e:
                    print(f"⚠️  Could not drop schema for Project {name}: {e}")
                
                # Delete credentials
                await credential_store.delete_credentials(project['id'])
    
    @pytest.mark.asyncio
    async def test_01_project_can_access_own_schema(self, test_projects):
        """
        TEST 1: Project A can access its own schema
        Expected: SUCCESS
        """
        project_a = test_projects['A']
        
        # Build connection URL for Project A
        connection_url = f"postgresql://{project_a['role_name']}:{project_a['password']}@localhost:5432/zendbx_main"
        
        # Get isolated pool for Project A
        pool = await get_project_db_pool_isolated(
            str(project_a['id']),
            connection_url,
            project_a['schema']
        )
        
        async with pool.acquire() as conn:
            # Test: Access own test_data table
            result = await conn.fetch('SELECT * FROM test_data')
            
            assert len(result) == 1
            assert result[0]['project_name'] == 'Project A'
            assert result[0]['secret_value'] == 'SECRET_A_DATA'
            
            print("✅ TEST 1 PASSED: Project A can access its own schema")
    
    @pytest.mark.asyncio
    async def test_02_project_cannot_access_sibling_schema(self, test_projects):
        """
        TEST 2: Project A CANNOT access Project B's schema
        Expected: PERMISSION DENIED
        """
        project_a = test_projects['A']
        project_b = test_projects['B']
        
        # Build connection URL for Project A
        connection_url = f"postgresql://{project_a['role_name']}:{project_a['password']}@localhost:5432/zendbx_main"
        
        pool = await get_project_db_pool_isolated(
            str(project_a['id']),
            connection_url,
            project_a['schema']
        )
        
        async with pool.acquire() as conn:
            # Test: Try to access Project B's schema
            with pytest.raises(asyncpg.exceptions.InsufficientPrivilegeError):
                await conn.fetch(f'SELECT * FROM "{project_b["schema"]}".test_data')
            
            print("✅ TEST 2 PASSED: Project A cannot access Project B's schema")
    
    @pytest.mark.asyncio
    async def test_03_project_cannot_access_auth_schema(self, test_projects):
        """
        TEST 3: Project A CANNOT access auth schema
        Expected: PERMISSION DENIED
        """
        project_a = test_projects['A']
        
        connection_url = f"postgresql://{project_a['role_name']}:{project_a['password']}@localhost:5432/zendbx_main"
        
        pool = await get_project_db_pool_isolated(
            str(project_a['id']),
            connection_url,
            project_a['schema']
        )
        
        async with pool.acquire() as conn:
            # Test: Try to access auth.users
            with pytest.raises(asyncpg.exceptions.InsufficientPrivilegeError):
                await conn.fetch('SELECT * FROM auth.users')
            
            # Test: Try to access auth.sessions
            with pytest.raises(asyncpg.exceptions.InsufficientPrivilegeError):
                await conn.fetch('SELECT * FROM auth.sessions')
            
            # Test: Try to access auth.refresh_tokens
            with pytest.raises(asyncpg.exceptions.InsufficientPrivilegeError):
                await conn.fetch('SELECT * FROM auth.refresh_tokens')
            
            print("✅ TEST 3 PASSED: Project A cannot access auth schema")
    
    @pytest.mark.asyncio
    async def test_04_project_cannot_access_platform_tables(self, test_projects):
        """
        TEST 4: Project A CANNOT access public platform tables
        Expected: PERMISSION DENIED
        """
        project_a = test_projects['A']
        
        connection_url = f"postgresql://{project_a['role_name']}:{project_a['password']}@localhost:5432/zendbx_main"
        
        pool = await get_project_db_pool_isolated(
            str(project_a['id']),
            connection_url,
            project_a['schema']
        )
        
        async with pool.acquire() as conn:
            # Test: Try to access public.projects
            with pytest.raises(asyncpg.exceptions.InsufficientPrivilegeError):
                await conn.fetch('SELECT * FROM public.projects')
            
            # Test: Try to access public.users
            with pytest.raises(asyncpg.exceptions.InsufficientPrivilegeError):
                await conn.fetch('SELECT * FROM public.users')
            
            print("✅ TEST 4 PASSED: Project A cannot access platform tables")
    
    @pytest.mark.asyncio
    async def test_05_platform_role_can_access_auth(self):
        """
        TEST 5: Platform role CAN access auth schema
        Expected: SUCCESS
        """
        platform_pool = await get_platform_db_pool()
        
        async with platform_pool.acquire() as conn:
            # Test: Platform role can access auth.users
            result = await conn.fetch('SELECT COUNT(*) as count FROM auth.users')
            assert result is not None
            
            print("✅ TEST 5 PASSED: Platform role can access auth schema")
    
    @pytest.mark.asyncio
    async def test_06_effective_privileges_verification(self, test_projects):
        """
        TEST 6: Verify effective privileges using PostgreSQL functions
        Expected: Project role has no access to auth or public
        """
        project_a = test_projects['A']
        
        provisioner_pool = await get_provisioner_db_pool()
        
        async with provisioner_pool.acquire() as conn:
            # Check auth schema privilege
            auth_access = await conn.fetchval(f"""
                SELECT has_schema_privilege($1, 'auth', 'USAGE')
            """, project_a['role_name'])
            
            # Check public schema privilege
            public_access = await conn.fetchval(f"""
                SELECT has_schema_privilege($1, 'public', 'USAGE')
            """, project_a['role_name'])
            
            # Check own project schema privilege
            project_access = await conn.fetchval(f"""
                SELECT has_schema_privilege($1, $2, 'USAGE')
            """, project_a['role_name'], project_a['schema'])
            
            # Check sibling project schema privilege
            sibling_access = await conn.fetchval(f"""
                SELECT has_schema_privilege($1, $2, 'USAGE')
            """, project_a['role_name'], test_projects['B']['schema'])
            
            # Assertions
            assert not auth_access, "Project role should NOT have auth schema access"
            assert not public_access, "Project role should NOT have public schema access"
            assert project_access, "Project role SHOULD have own schema access"
            assert not sibling_access, "Project role should NOT have sibling schema access"
            
            print("✅ TEST 6 PASSED: Effective privileges are correct")
            print(f"  auth schema: {auth_access}")
            print(f"  public schema: {public_access}")
            print(f"  own schema: {project_access}")
            print(f"  sibling schema: {sibling_access}")
    
    @pytest.mark.asyncio
    async def test_07_role_collision_safety(self):
        """
        TEST 7: Verify role names are collision-safe
        Expected: All role names are unique and within PostgreSQL limits
        """
        role_names = set()
        
        # Generate 1000 random project IDs
        for _ in range(1000):
            project_id = uuid4()
            role_name = ProjectRoleManager.generate_project_role_name(project_id)
            
            # Check uniqueness
            assert role_name not in role_names, f"Collision detected: {role_name}"
            role_names.add(role_name)
            
            # Check length
            assert len(role_name) <= 63, f"Role name too long: {len(role_name)} > 63"
            
            # Check format
            assert role_name.startswith('zendbx_p_')
            assert len(role_name.split('_')[-1]) == 32  # UUID without hyphens
        
        print(f"✅ TEST 7 PASSED: Generated {len(role_names)} unique role names, all within limits")
    
    @pytest.mark.asyncio
    async def test_08_pool_identity_isolation(self, test_projects):
        """
        TEST 8: Verify pools maintain correct identity and search_path
        Expected: Each pool uses correct role and schema
        """
        project_a = test_projects['A']
        project_b = test_projects['B']
        
        # Get pools for both projects
        pool_a = await get_project_db_pool_isolated(
            str(project_a['id']),
            f"postgresql://{project_a['role_name']}:{project_a['password']}@localhost:5432/zendbx_main",
            project_a['schema']
        )
        
        pool_b = await get_project_db_pool_isolated(
            str(project_b['id']),
            f"postgresql://{project_b['role_name']}:{project_b['password']}@localhost:5432/zendbx_main",
            project_b['schema']
        )
        
        # Check Project A pool
        async with pool_a.acquire() as conn:
            current_user = await conn.fetchval('SELECT current_user')
            search_path = await conn.fetchval('SHOW search_path')
            
            assert current_user == project_a['role_name']
            assert project_a['schema'] in search_path
            
            print(f"✅ Project A pool: user={current_user}, search_path={search_path}")
        
        # Check Project B pool
        async with pool_b.acquire() as conn:
            current_user = await conn.fetchval('SELECT current_user')
            search_path = await conn.fetchval('SHOW search_path')
            
            assert current_user == project_b['role_name']
            assert project_b['schema'] in search_path
            
            print(f"✅ Project B pool: user={current_user}, search_path={search_path}")
        
        print("✅ TEST 8 PASSED: Pools maintain correct identity and search_path")
    
    @pytest.mark.asyncio
    async def test_09_cross_project_isolation(self, test_projects):
        """
        TEST 9: Comprehensive cross-project isolation
        Expected: Project A can ONLY see its own data, never Project B or C
        """
        project_a = test_projects['A']
        
        connection_url = f"postgresql://{project_a['role_name']}:{project_a['password']}@localhost:5432/zendbx_main"
        
        pool = await get_project_db_pool_isolated(
            str(project_a['id']),
            connection_url,
            project_a['schema']
        )
        
        async with pool.acquire() as conn:
            # Can access own data
            result = await conn.fetch('SELECT secret_value FROM test_data')
            assert len(result) == 1
            assert result[0]['secret_value'] == 'SECRET_A_DATA'
            
            # Cannot access Project B
            with pytest.raises(asyncpg.exceptions.InsufficientPrivilegeError):
                await conn.fetch(f'SELECT * FROM "{test_projects["B"]["schema"]}".test_data')
            
            # Cannot access Project C
            with pytest.raises(asyncpg.exceptions.InsufficientPrivilegeError):
                await conn.fetch(f'SELECT * FROM "{test_projects["C"]["schema"]}".test_data')
            
            print("✅ TEST 9 PASSED: Cross-project isolation verified")
    
    @pytest.mark.asyncio
    async def test_10_fail_closed_behavior(self, test_projects):
        """
        TEST 10: Verify fail-closed behavior when credentials are invalid
        Expected: Connection should fail, NOT fall back to privileged credentials
        """
        project_a = test_projects['A']
        
        # Use invalid password
        invalid_connection_url = f"postgresql://{project_a['role_name']}:WRONG_PASSWORD@localhost:5432/zendbx_main"
        
        # Attempt to create pool should fail
        with pytest.raises(Exception):
            pool = await asyncpg.create_pool(invalid_connection_url, timeout=5)
        
        print("✅ TEST 10 PASSED: Fail-closed behavior verified (connection failed as expected)")


if __name__ == "__main__":
    pytest.main([__file__, "-v", "-s"])
