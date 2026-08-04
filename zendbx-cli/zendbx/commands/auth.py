"""Authentication commands - Login, Logout, Whoami"""

import typer
import webbrowser
import time
from typing import Optional
from rich.console import Console
from rich.table import Table

from ..core.auth import AuthManager
from ..utils.console import print_success, print_error, print_info, print_header

app = typer.Typer(help="🔐 Authentication commands")
console = Console()
auth_manager = AuthManager()


@app.command(name="login")
def login_command(
    browser: bool = typer.Option(True, help="Open browser for authentication"),
    token: Optional[str] = typer.Option(None, help="Provide token directly"),
):
    """
    🔐 Login to ZenDBX
    
    Opens browser for OAuth authentication or accepts token directly.
    Credentials are stored securely in system keyring.
    
    Examples:
      zendbx login                    # Browser login
      zendbx login --token=xxx        # Token login
      zendbx auth login --no-browser  # Manual login
    """
    print_header("ZenDBX Authentication")
    
    if token:
        # Direct token authentication
        try:
            with console.status("[bold cyan]Validating token..."):
                user = auth_manager.login_with_token(token)
            
            print_success(f"Logged in as {user['email']}")
            _display_user_info(user)
            
        except Exception as e:
            print_error(f"Login failed: {e}")
            raise typer.Exit(1)
    
    elif browser:
        # Browser-based OAuth
        try:
            console.print("[cyan]Opening browser for authentication...[/cyan]")
            
            # Generate auth URL
            auth_url, session_id = auth_manager.generate_auth_url()
            
            # Open browser
            webbrowser.open(auth_url)
            console.print(f"\n[dim]If browser doesn't open, visit:[/dim]")
            console.print(f"[blue]{auth_url}[/blue]\n")
            
            # Poll for completion
            with console.status("[bold cyan]Waiting for authentication..."):
                user = auth_manager.poll_for_token(session_id, timeout=300)
            
            print_success(f"Logged in as {user['email']}")
            _display_user_info(user)
            
        except TimeoutError:
            print_error("Authentication timeout. Please try again.")
            raise typer.Exit(1)
        except Exception as e:
            print_error(f"Login failed: {e}")
            raise typer.Exit(1)
    
    else:
        # Manual login
        console.print("[yellow]Manual login not yet implemented[/yellow]")
        console.print("Use: zendbx login (opens browser)")
        console.print("Or:  zendbx login --token=YOUR_TOKEN")
        raise typer.Exit(1)


@app.command(name="logout")
def logout_command(
    all_accounts: bool = typer.Option(False, "--all", help="Logout from all accounts"),
):
    """
    👋 Logout from ZenDBX
    
    Removes stored credentials from system keyring.
    
    Examples:
      zendbx logout       # Logout current account
      zendbx logout --all # Logout all accounts
    """
    try:
        if all_accounts:
            auth_manager.logout_all()
            print_success("Logged out from all accounts")
        else:
            current_user = auth_manager.get_current_user()
            auth_manager.logout()
            print_success(f"Logged out from {current_user.get('email', 'account')}")
            
    except Exception as e:
        print_error(f"Logout failed: {e}")
        raise typer.Exit(1)


@app.command(name="whoami")
def whoami_command():
    """
    👤 Show current user information
    
    Displays currently authenticated user and account details.
    
    Examples:
      zendbx whoami
      zendbx auth whoami
    """
    try:
        user = auth_manager.get_current_user()
        
        if not user:
            print_info("Not logged in. Use 'zendbx login' to authenticate.")
            raise typer.Exit(0)
        
        _display_user_info(user)
        
    except Exception as e:
        print_error(f"Failed to get user info: {e}")
        raise typer.Exit(1)


@app.command(name="accounts")
def accounts_command():
    """
    📋 List all authenticated accounts
    
    Shows all accounts stored in system keyring.
    """
    try:
        accounts = auth_manager.list_accounts()
        
        if not accounts:
            print_info("No authenticated accounts found.")
            console.print("\nUse [cyan]zendbx login[/cyan] to authenticate.")
            raise typer.Exit(0)
        
        table = Table(title="Authenticated Accounts", show_header=True)
        table.add_column("Email", style="cyan")
        table.add_column("Name", style="white")
        table.add_column("Current", style="green")
        
        current_email = auth_manager.get_current_user().get('email')
        
        for account in accounts:
            is_current = "✓" if account['email'] == current_email else ""
            table.add_row(
                account.get('email', 'Unknown'),
                account.get('name', 'N/A'),
                is_current
            )
        
        console.print(table)
        
    except Exception as e:
        print_error(f"Failed to list accounts: {e}")
        raise typer.Exit(1)


@app.command(name="switch")
def switch_command(
    email: str = typer.Argument(..., help="Email of account to switch to"),
):
    """
    🔄 Switch between authenticated accounts
    
    Examples:
      zendbx auth switch user@example.com
    """
    try:
        auth_manager.switch_account(email)
        print_success(f"Switched to account: {email}")
        
    except Exception as e:
        print_error(f"Failed to switch account: {e}")
        raise typer.Exit(1)


def _display_user_info(user: dict):
    """Display user information in a formatted table"""
    table = Table(show_header=False, box=None)
    table.add_column("Field", style="cyan", width=15)
    table.add_column("Value", style="white")
    
    table.add_row("Email", user.get('email', 'N/A'))
    table.add_row("Name", user.get('name', 'N/A'))
    table.add_row("User ID", user.get('id', 'N/A'))
    
    if 'plan' in user:
        table.add_row("Plan", user['plan'])
    
    if 'projects_count' in user:
        table.add_row("Projects", str(user['projects_count']))
    
    console.print()
    console.print(table)
    console.print()
