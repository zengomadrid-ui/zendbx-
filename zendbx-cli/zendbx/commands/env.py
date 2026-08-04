"""Environment commands - Pull, Push, Set, Unset"""

import typer
from typing import Optional
from rich.console import Console
from rich.table import Table

from ..core.env_manager import EnvManager
from ..utils.console import print_success, print_error, print_info, confirm

app = typer.Typer(help="🌍 Environment variables")
console = Console()


@app.command(name="pull")
def pull_command(
    overwrite: bool = typer.Option(False, "--overwrite", help="Overwrite local .env"),
):
    """
    📥 Pull environment variables from cloud
    
    Downloads environment variables and saves to .env file.
    
    Examples:
      zendbx env pull
      zendbx env pull --overwrite
    """
    try:
        env_manager = EnvManager()
        
        # Check if .env exists
        if env_manager.local_env_exists() and not overwrite:
            if not confirm(".env file exists. Overwrite?"):
                print_info("Pull cancelled.")
                raise typer.Exit(0)
        
        # Pull variables
        with console.status("[cyan]Pulling environment variables..."):
            variables = env_manager.pull()
        
        # Save to .env
        env_manager.save_to_file(variables)
        
        print_success(f"Pulled {len(variables)} environment variable(s)")
        print_info("Saved to: .env")
        
    except Exception as e:
        print_error(f"Pull failed: {e}")
        raise typer.Exit(1)


@app.command(name="push")
def push_command(
    file: Optional[str] = typer.Option(".env", help="Environment file to push"),
):
    """
    📤 Push environment variables to cloud
    
    Uploads local environment variables to the cloud project.
    
    Examples:
      zendbx env push
      zendbx env push --file .env.production
    """
    try:
        env_manager = EnvManager()
        
        # Load local .env
        with console.status(f"[cyan]Loading {file}..."):
            variables = env_manager.load_from_file(file)
        
        if not variables:
            print_error(f"No variables found in {file}")
            raise typer.Exit(1)
        
        console.print(f"[cyan]Found {len(variables)} variable(s) to push[/cyan]\n")
        
        # Show variables (masked)
        table = Table(show_header=True)
        table.add_column("Key", style="cyan")
        table.add_column("Value", style="dim")
        
        for key, value in variables.items():
            masked_value = value[:8] + "..." if len(value) > 8 else "***"
            table.add_row(key, masked_value)
        
        console.print(table)
        console.print()
        
        # Confirm
        if not confirm("Push these variables?"):
            print_info("Push cancelled.")
            raise typer.Exit(0)
        
        # Push
        with console.status("[cyan]Pushing variables..."):
            env_manager.push(variables)
        
        print_success(f"Pushed {len(variables)} variable(s)")
        
    except Exception as e:
        print_error(f"Push failed: {e}")
        raise typer.Exit(1)


@app.command(name="set")
def set_command(
    key: str = typer.Argument(..., help="Variable name"),
    value: str = typer.Argument(..., help="Variable value"),
    local: bool = typer.Option(False, "--local", help="Set only in local .env"),
):
    """
    ✏️  Set environment variable
    
    Sets a variable in cloud (and optionally local .env).
    
    Examples:
      zendbx env set API_KEY abc123
      zendbx env set DEBUG true --local
    """
    try:
        env_manager = EnvManager()
        
        if local:
            # Set only in local .env
            env_manager.set_local(key, value)
            print_success(f"Set {key} in .env")
        else:
            # Set in cloud
            with console.status(f"[cyan]Setting {key}..."):
                env_manager.set_remote(key, value)
            
            print_success(f"Set {key} in cloud")
            
            # Optionally update local
            if confirm("Also update local .env?", default=True):
                env_manager.set_local(key, value)
        
    except Exception as e:
        print_error(f"Failed to set variable: {e}")
        raise typer.Exit(1)


@app.command(name="unset")
def unset_command(
    key: str = typer.Argument(..., help="Variable name"),
    local: bool = typer.Option(False, "--local", help="Remove only from local .env"),
):
    """
    🗑️  Remove environment variable
    
    Removes a variable from cloud (and optionally local .env).
    
    Examples:
      zendbx env unset OLD_API_KEY
      zendbx env unset DEBUG --local
    """
    try:
        env_manager = EnvManager()
        
        if not confirm(f"Remove {key}?"):
            print_info("Cancelled.")
            raise typer.Exit(0)
        
        if local:
            # Remove only from local .env
            env_manager.unset_local(key)
            print_success(f"Removed {key} from .env")
        else:
            # Remove from cloud
            with console.status(f"[cyan]Removing {key}..."):
                env_manager.unset_remote(key)
            
            print_success(f"Removed {key} from cloud")
            
            # Optionally update local
            if confirm("Also remove from local .env?", default=True):
                env_manager.unset_local(key)
        
    except Exception as e:
        print_error(f"Failed to unset variable: {e}")
        raise typer.Exit(1)


@app.command(name="list")
def list_command(
    show_values: bool = typer.Option(False, "--show-values", help="Show unmasked values"),
):
    """
    📋 List environment variables
    
    Shows all environment variables from cloud.
    
    Examples:
      zendbx env list
      zendbx env list --show-values
    """
    try:
        env_manager = EnvManager()
        
        with console.status("[cyan]Fetching variables..."):
            variables = env_manager.list_remote()
        
        if not variables:
            print_info("No environment variables found")
            raise typer.Exit(0)
        
        table = Table(title=f"Environment Variables ({len(variables)})", show_header=True)
        table.add_column("Key", style="cyan")
        table.add_column("Value", style="white")
        
        for key, value in sorted(variables.items()):
            if show_values:
                table.add_row(key, value)
            else:
                masked = value[:8] + "..." if len(value) > 8 else "***"
                table.add_row(key, masked)
        
        console.print(table)
        
        if not show_values:
            console.print("\n[dim]Use --show-values to see full values[/dim]")
        
    except Exception as e:
        print_error(f"Failed to list variables: {e}")
        raise typer.Exit(1)
