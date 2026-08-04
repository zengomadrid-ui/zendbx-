"""Secrets commands - Secure secrets management"""

import typer
from rich.console import Console
from rich.table import Table

from ..core.secrets_manager import SecretsManager
from ..utils.console import print_success, print_error, print_info, confirm

app = typer.Typer(help="🔒 Secrets management")
console = Console()


@app.command(name="list")
def list_command():
    """
    📋 List all secrets
    
    Shows secret names (values are never displayed).
    
    Examples:
      zendbx secrets list
    """
    try:
        secrets_manager = SecretsManager()
        
        with console.status("[cyan]Fetching secrets..."):
            secrets = secrets_manager.list_secrets()
        
        if not secrets:
            print_info("No secrets found")
            console.print("\n[dim]Add one with:[/dim] zendbx secrets set KEY value")
            raise typer.Exit(0)
        
        table = Table(title=f"Secrets ({len(secrets)})", show_header=True)
        table.add_column("Name", style="cyan")
        table.add_column("Created", style="dim")
        table.add_column("Updated", style="dim")
        
        for secret in secrets:
            table.add_row(
                secret['name'],
                secret.get('created_at', 'N/A'),
                secret.get('updated_at', 'N/A'),
            )
        
        console.print(table)
        
    except Exception as e:
        print_error(f"Failed to list secrets: {e}")
        raise typer.Exit(1)


@app.command(name="set")
def set_command(
    name: str = typer.Argument(..., help="Secret name"),
    value: str = typer.Argument(..., help="Secret value"),
):
    """
    ✏️  Set a secret
    
    Stores a secret securely in the cloud.
    Secrets are encrypted at rest and in transit.
    
    Examples:
      zendbx secrets set API_KEY sk_live_xxx
      zendbx secrets set DB_PASSWORD super_secret_123
    """
    try:
        secrets_manager = SecretsManager()
        
        with console.status(f"[cyan]Setting secret: {name}..."):
            secrets_manager.set_secret(name, value)
        
        print_success(f"Secret set: {name}")
        console.print("[dim]Value encrypted and stored securely[/dim]")
        
    except Exception as e:
        print_error(f"Failed to set secret: {e}")
        raise typer.Exit(1)


@app.command(name="delete")
def delete_command(
    name: str = typer.Argument(..., help="Secret name"),
    force: bool = typer.Option(False, "--force", "-f", help="Skip confirmation"),
):
    """
    🗑️  Delete a secret
    
    Permanently removes a secret from the cloud.
    
    Examples:
      zendbx secrets delete OLD_API_KEY
      zendbx secrets delete TEMP_TOKEN --force
    """
    if not force:
        if not confirm(f"Delete secret '{name}'?"):
            print_info("Deletion cancelled")
            raise typer.Exit(0)
    
    try:
        secrets_manager = SecretsManager()
        
        with console.status(f"[cyan]Deleting secret: {name}..."):
            secrets_manager.delete_secret(name)
        
        print_success(f"Secret deleted: {name}")
        
    except Exception as e:
        print_error(f"Failed to delete secret: {e}")
        raise typer.Exit(1)


@app.command(name="reveal")
def reveal_command(
    name: str = typer.Argument(..., help="Secret name"),
):
    """
    👁️  Reveal secret value
    
    Displays the decrypted value of a secret.
    USE WITH CAUTION - only use in secure environments.
    
    Examples:
      zendbx secrets reveal API_KEY
    """
    console.print("[yellow]⚠️  This will display the secret in plain text[/yellow]")
    
    if not confirm("Continue?"):
        print_info("Cancelled")
        raise typer.Exit(0)
    
    try:
        secrets_manager = SecretsManager()
        
        with console.status(f"[cyan]Fetching secret: {name}..."):
            value = secrets_manager.get_secret(name)
        
        console.print()
        console.print(f"[bold cyan]{name}:[/bold cyan]")
        console.print(f"[white]{value}[/white]")
        console.print()
        
    except Exception as e:
        print_error(f"Failed to reveal secret: {e}")
        raise typer.Exit(1)
