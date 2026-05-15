"""Test database connection"""

import typer
import asyncio
from typing import Optional

from ..config import config_manager
from ..core.database import DatabaseManager
from ..utils import (
    print_success,
    print_error,
    print_header,
    print_status_table,
    create_progress,
)


def connect_command():
    """
    Test database connection
    
    Verifies that ZenDBX can connect to your PostgreSQL database
    and displays connection information.
    """
    
    print_header("Testing Database Connection")
    
    # Get connection string
    try:
        conn_string = config_manager.get_connection_string()
    except Exception as e:
        print_error(str(e))
        raise typer.Exit(1)
    
    # Test connection
    async def test():
        db = DatabaseManager(conn_string)
        
        with create_progress() as progress:
            task = progress.add_task("Connecting to database...", total=100)
            
            try:
                progress.update(task, advance=30)
                info = await db.test_connection()
                progress.update(task, advance=70)
                
                await db.disconnect()
                return info
                
            except Exception as e:
                print_error(f"Connection failed: {e}")
                raise typer.Exit(1)
    
    # Run async test
    try:
        info = asyncio.run(test())
        
        print_success("Successfully connected to database!")
        print_status_table(info, title="Connection Information")
        
    except KeyboardInterrupt:
        print_error("Connection test cancelled")
        raise typer.Exit(1)
