"""Main CLI application for ZenDBX"""

import typer
from typing import Optional
from rich.console import Console

from .version import VERSION
from .utils import print_logo, print_error
from .commands import init, connect, db_fix, db_analyze, db_dump, db_restore, status

# Create main Typer app
app = typer.Typer(
    name="zendbx",
    help="🚀 ZenDBX - AI-powered PostgreSQL CLI for developers\n\nQuery fails → ZenDBX fixes it",
    add_completion=True,
    rich_markup_mode="rich",
)

# Create database subcommand group
db_app = typer.Typer(
    name="db",
    help="Database operations (fix, analyze, dump, restore)",
    rich_markup_mode="rich",
)

console = Console()


def version_callback(value: bool):
    """Show version and exit"""
    if value:
        print_logo()
        console.print(f"\n[bold cyan]ZenDBX CLI v{VERSION}[/bold cyan]")
        console.print("[dim]AI-powered PostgreSQL operations tool[/dim]\n")
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
):
    """
    ZenDBX - AI-powered PostgreSQL CLI for developers
    
    Query fails → ZenDBX fixes it
    """
    pass


# Register commands
app.command(name="init", help="Initialize ZenDBX configuration")(init.init_command)
app.command(name="connect", help="Test database connection")(connect.connect_command)
app.command(name="status", help="Show database status and health")(status.status_command)

# Register database subcommands
db_app.command(name="fix", help="🔧 Fix broken SQL queries (signature feature)")(db_fix.fix_command)
db_app.command(name="analyze", help="📊 Analyze database health and performance")(db_analyze.analyze_command)
db_app.command(name="dump", help="💾 Create database backup")(db_dump.dump_command)
db_app.command(name="restore", help="♻️  Restore database from backup")(db_restore.restore_command)

# Add db subcommand group to main app
app.add_typer(db_app, name="db")


if __name__ == "__main__":
    app()
