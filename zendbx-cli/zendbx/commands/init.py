"""Initialize ZenDBX configuration"""

import typer
from typing import Optional
from pathlib import Path

from ..config import config_manager
from ..models.config import ZenDBXConfig, DatabaseConfig, PreferencesConfig
from ..utils import (
    print_success,
    print_error,
    print_info,
    print_header,
    prompt,
    confirm,
    console,
)


def init_command(
    local: bool = typer.Option(
        False,
        "--local",
        "-l",
        help="Create local project configuration instead of global"
    ),
    force: bool = typer.Option(
        False,
        "--force",
        "-f",
        help="Overwrite existing configuration"
    ),
):
    """
    Initialize ZenDBX configuration
    
    Creates a configuration file with database connection settings.
    Use --local to create project-specific configuration.
    """
    
    print_header("ZenDBX Configuration Setup")
    
    # Check if config already exists
    config_path = config_manager.local_config_path if local else config_manager.global_config_path
    
    if config_path.exists() and not force:
        print_error(f"Configuration already exists at: {config_path}")
        print_info("Use --force to overwrite existing configuration")
        raise typer.Exit(1)
    
    # Ensure directories exist
    config_manager.ensure_directories()
    
    # Interactive configuration
    console.print("\n[bold cyan]Database Configuration[/bold cyan]")
    console.print("[dim]Enter your PostgreSQL connection details[/dim]\n")
    
    host = prompt("Database host", default="localhost")
    port = prompt("Database port", default="5432")
    database = prompt("Database name")
    user = prompt("Database user", default="postgres")
    password = prompt("Database password (optional, press Enter to skip)", default="", password=True)
    
    # Create database config
    db_config = DatabaseConfig(
        host=host,
        port=int(port),
        database=database,
        user=user,
        password=password if password else None,
    )
    
    # Preferences
    console.print("\n[bold cyan]Preferences[/bold cyan]")
    console.print("[dim]Configure ZenDBX behavior[/dim]\n")
    
    autofix_mode = prompt(
        "SQL autofix mode (interactive/auto/suggest)",
        default="interactive"
    )
    
    backup_path = prompt(
        "Default backup directory",
        default="./backups"
    )
    
    preferences = PreferencesConfig(
        autofix_mode=autofix_mode,
        backup_path=Path(backup_path),
    )
    
    # Create full config
    config = ZenDBXConfig(
        database=db_config,
        preferences=preferences,
    )
    
    # Save configuration
    try:
        config_manager.save_config(config, use_local=local)
        print_success(f"Configuration saved to: {config_path}")
        
        console.print("\n[bold green]✓ Setup complete![/bold green]")
        console.print("\n[dim]Next steps:[/dim]")
        console.print("  1. Test connection: [cyan]zendbx connect[/cyan]")
        console.print("  2. Check status: [cyan]zendbx status[/cyan]")
        console.print("  3. Fix SQL: [cyan]zendbx db fix 'SELECT * FORM users'[/cyan]")
        
    except Exception as e:
        print_error(f"Failed to save configuration: {e}")
        raise typer.Exit(1)
