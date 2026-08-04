"""Main CLI application for ZenDBX v1.0 - Production-Grade Developer Tool"""

import sys
import typer
from typing import Optional
from rich.console import Console

from .version import VERSION
from .utils.console import print_logo, print_error
from .commands import (
    auth,
    init,
    link,
    projects,
    db,
    storage,
    functions,
    generators,
    env,
    secrets,
    monitoring,
    doctor,
    update,
)

# Create main Typer app
app = typer.Typer(
    name="zendbx",
    help="""🚀 ZenDBX - The Fastest Way to Build Applications
    
    Production-grade CLI for PostgreSQL-backed applications.
    Beautiful · Fast · Reliable
    
    Quick Start:
      zendbx login          Authenticate with ZenDBX
      zendbx init           Create a new project
      zendbx db push        Push schema changes
      zendbx db fix         Auto-fix SQL errors
    
    Query fails → ZenDBX fixes it
    """,
    add_completion=True,
    rich_markup_mode="rich",
    no_args_is_help=True,
)

console = Console()


def version_callback(value: bool):
    """Show version and exit"""
    if value:
        print_logo()
        console.print(f"\n[bold cyan]ZenDBX CLI v{VERSION}[/bold cyan]")
        console.print("[dim]Production-Grade PostgreSQL Developer Tool[/dim]")
        console.print(f"\n[dim]Python {sys.version.split()[0]}[/dim]\n")
        raise typer.Exit()


@app.callback()
def main(
    version: Optional[bool] = typer.Option(
        None,
        "--version",
        "-v",
        help="Show version and exit",
        callback=version_callback,
        is_eager=True,
    ),
    verbose: Optional[bool] = typer.Option(
        False,
        "--verbose",
        help="Enable verbose output",
    ),
):
    """
    ZenDBX CLI - Production-grade developer tool for PostgreSQL
    
    Build applications faster with intelligent SQL fixing, schema management,
    and seamless integration with ZenDBX platform.
    """
    if verbose:
        console.print("[dim]Verbose mode enabled[/dim]")


# ============================================================================
# AUTHENTICATION COMMANDS
# ============================================================================
app.add_typer(auth.app, name="login", help="🔐 Login to ZenDBX (browser-based)")
app.add_typer(auth.app, name="auth", help="🔐 Authentication commands")

# ============================================================================
# PROJECT COMMANDS
# ============================================================================
app.command(name="init", help="🎨 Initialize a new ZenDBX project (wizard)")(init.init_command)
app.command(name="link", help="🔗 Link local folder to existing project")(link.link_command)
app.add_typer(projects.app, name="projects", help="📦 Manage projects")

# ============================================================================
# DATABASE COMMANDS
# ============================================================================
app.add_typer(db.app, name="db", help="🗄️  Database operations (push, pull, fix, migrate)")

# ============================================================================
# STORAGE COMMANDS
# ============================================================================
app.add_typer(storage.app, name="storage", help="📁 Storage and file management")

# ============================================================================
# FUNCTIONS COMMANDS
# ============================================================================
app.add_typer(functions.app, name="functions", help="⚡ Serverless functions")

# ============================================================================
# GENERATOR COMMANDS
# ============================================================================
app.add_typer(generators.app, name="gen", help="🔨 Code generators (types, SDK, models)")

# ============================================================================
# ENVIRONMENT COMMANDS
# ============================================================================
app.add_typer(env.app, name="env", help="🌍 Environment variables")

# ============================================================================
# SECRETS COMMANDS
# ============================================================================
app.add_typer(secrets.app, name="secrets", help="🔒 Secrets management")

# ============================================================================
# MONITORING COMMANDS
# ============================================================================
app.add_typer(monitoring.app, name="logs", help="📊 View logs and monitor")

# ============================================================================
# UTILITY COMMANDS
# ============================================================================
app.command(name="doctor", help="🩺 Diagnose system and project health")(doctor.doctor_command)
app.command(name="update", help="⬆️  Update CLI to latest version")(update.update_command)


# ============================================================================
# ERROR HANDLING
# ============================================================================
@app.callback(invoke_without_command=True)
def handle_no_command(ctx: typer.Context):
    """Handle when no command is provided"""
    if ctx.invoked_subcommand is None:
        print_logo()
        console.print("\n[bold yellow]No command specified. Use --help for usage.[/bold yellow]\n")
        console.print("Quick Start:")
        console.print("  [cyan]zendbx login[/cyan]      - Authenticate")
        console.print("  [cyan]zendbx init[/cyan]       - Create project")
        console.print("  [cyan]zendbx db push[/cyan]    - Push changes")
        console.print("  [cyan]zendbx db fix[/cyan]     - Fix SQL errors\n")


if __name__ == "__main__":
    try:
        app()
    except KeyboardInterrupt:
        console.print("\n[yellow]Operation cancelled by user[/yellow]")
        sys.exit(130)
    except Exception as e:
        print_error(f"Unexpected error: {e}")
        if "--verbose" in sys.argv:
            raise
        sys.exit(1)
