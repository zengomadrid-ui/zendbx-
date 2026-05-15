"""Status command - show database health and connection status"""

import typer
import asyncio

from ..config import config_manager
from ..core.database import DatabaseManager
from ..utils import (
    print_success,
    print_error,
    print_header,
    print_status_table,
    create_progress,
    console,
)


def status_command(
    verbose: bool = typer.Option(
        False,
        "--verbose",
        "-v",
        help="Show detailed information"
    ),
):
    """
    Show database status and health
    
    Displays a quick overview of database connection status,
    health metrics, and configuration.
    
    Examples:
      zendbx status
      zendbx status --verbose
    """
    
    print_header("ZenDBX Status")
    
    # Check configuration
    console.print("\n[bold cyan]Configuration[/bold cyan]")
    
    try:
        config = config_manager.load_config()
        
        if config.database:
            config_info = {
                "config_file": str(config_manager.get_config_path()),
                "database": config.database.database,
                "host": config.database.host,
                "port": config.database.port,
                "user": config.database.user,
                "autofix_mode": config.preferences.autofix_mode,
                "backup_path": str(config.preferences.backup_path),
            }
            
            print_status_table(config_info, title="Configuration")
        else:
            console.print("[yellow]⚠ No database configuration found[/yellow]")
            console.print("[dim]Run 'zendbx init' to configure[/dim]")
            raise typer.Exit(0)
            
    except Exception as e:
        print_error(f"Failed to load configuration: {e}")
        raise typer.Exit(1)
    
    # Test connection and get health
    console.print()
    
    try:
        conn_string = config_manager.get_connection_string()
        
        async def get_status():
            db = DatabaseManager(conn_string)
            
            with create_progress() as progress:
                task = progress.add_task("Checking database status...", total=100)
                
                try:
                    # Test connection
                    progress.update(task, advance=40, description="Testing connection...")
                    conn_info = await db.test_connection()
                    
                    # Get health metrics
                    progress.update(task, advance=30, description="Analyzing health...")
                    health_info = await db.analyze_database_health()
                    
                    # Get table count and stats
                    progress.update(task, advance=30, description="Getting statistics...")
                    
                    await db.disconnect()
                    
                    return {
                        "connection": conn_info,
                        "health": health_info,
                    }
                    
                except Exception as e:
                    await db.disconnect()
                    raise e
        
        status_data = asyncio.run(get_status())
        
        # Display connection status
        console.print()
        print_success("Database connection: OK")
        
        connection_display = {
            "status": "Connected",
            "database": status_data["connection"]["database"],
            "user": status_data["connection"]["user"],
        }
        
        if verbose:
            connection_display["version"] = status_data["connection"]["version"]
        
        print_status_table(connection_display, title="Connection Status")
        
        # Display health metrics
        console.print()
        print_status_table(status_data["health"], title="Database Health")
        
        # Health assessment
        console.print()
        console.print("[bold cyan]Health Assessment[/bold cyan]")
        
        # Check cache hit ratio
        cache_ratio_str = status_data["health"]["cache_hit_ratio"]
        if cache_ratio_str != "N/A":
            cache_ratio = float(cache_ratio_str.rstrip('%'))
            if cache_ratio >= 95:
                console.print("  • Cache performance: [green]Excellent[/green]")
            elif cache_ratio >= 90:
                console.print("  • Cache performance: [green]Good[/green]")
            elif cache_ratio >= 80:
                console.print("  • Cache performance: [yellow]Fair[/yellow]")
            else:
                console.print("  • Cache performance: [red]Poor[/red]")
                console.print("    [dim]Consider increasing shared_buffers[/dim]")
        
        # Check connections
        conn_count = status_data["health"]["active_connections"]
        if conn_count < 10:
            console.print("  • Connection usage: [green]Low[/green]")
        elif conn_count < 50:
            console.print("  • Connection usage: [green]Normal[/green]")
        elif conn_count < 100:
            console.print("  • Connection usage: [yellow]High[/yellow]")
        else:
            console.print("  • Connection usage: [red]Very High[/red]")
            console.print("    [dim]Monitor for connection leaks[/dim]")
        
        # Overall status
        console.print()
        console.print("[bold green]✓ System Status: Healthy[/bold green]")
        
        # Quick tips
        console.print()
        console.print("[dim]Quick commands:[/dim]")
        console.print("  • Fix SQL: [cyan]zendbx db fix 'SELECT * FORM users'[/cyan]")
        console.print("  • Analyze: [cyan]zendbx db analyze[/cyan]")
        console.print("  • Backup: [cyan]zendbx db dump[/cyan]")
        
    except Exception as e:
        console.print()
        print_error(f"Database connection failed: {e}")
        console.print("\n[dim]Troubleshooting:[/dim]")
        console.print("  1. Check database is running")
        console.print("  2. Verify connection settings: [cyan]zendbx init[/cyan]")
        console.print("  3. Test connection: [cyan]zendbx connect[/cyan]")
        raise typer.Exit(1)
