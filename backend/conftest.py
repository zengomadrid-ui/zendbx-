"""
Pytest configuration for async tests
"""
import pytest
import asyncio
from app.core import database

@pytest.fixture(scope="function")
def event_loop():
    """
    Create a new event loop for each test function.
    
    This prevents event loop reuse issues with asyncpg pools
    that survive across test boundaries.
    """
    loop = asyncio.new_event_loop()
    asyncio.set_event_loop(loop)
    yield loop
    
    # Clean up any asyncio resources before closing loop
    try:
        loop.run_until_complete(loop.shutdown_asyncgens())
    except:
        pass
    
    loop.close()

@pytest.fixture(scope="function", autouse=True)
async def cleanup_connection_pools():
    """
    Automatically clean up all connection pools after each test.
    
    This ensures pools don't survive across tests and cause
    'Event loop is closed' errors.
    """
    yield  # Run the test
    
    # After test completes, clean up all pools
    try:
        # Close all project pools
        for project_id in list(database.project_pools.keys()):
            await database.close_project_pool(project_id)
        
        # Reset global pool references
        if database.platform_pool:
            await database.platform_pool.close()
            database.platform_pool = None
        
        if database.provisioner_pool:
            await database.provisioner_pool.close()
            database.provisioner_pool = None
            
    except Exception as e:
        # Don't fail tests due to cleanup errors
        print(f"Warning: Pool cleanup error: {e}")
