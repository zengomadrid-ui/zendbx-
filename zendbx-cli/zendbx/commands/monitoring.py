"""Monitoring commands - Logs and metrics"""

import typer
from typing import Optional
from rich.console import Console

from ..core.monitoring_manager import MonitoringManager
from ..utils.console import print_error, print_info

app = typer.Typer(help="📊 Monitoring and logs")
console = Console()


@app.command(name="logs")
def logs_command(
    service: Optional[str] = typer.Option(None, help="Service (api, auth, db, storage)"),
    follow: bool = typer.Option(False, "-f", "--follow", help="Follow logs in real-time"),
    tail: int = typer.Option(100, help="Number of lines to show"),
    level: Optional[str] = typer.Option(None, help="Filter by level (info, warn, error)"),
):
    """
    📜 View application logs
    
    Stream logs from your ZenDBX application.
    
    Examples:
      zendbx logs                      # All logs
      zendbx logs --follow             # Stream logs
      zendbx logs --service api        # API logs only
      zendbx logs --level error        # Errors only
      zendbx logs --tail 50            # Last 50 lines
    """
    try:
        monitoring_manager = MonitoringManager()
        
        if follow:
            console.print("[cyan]Following logs...[/cyan]")
            console.print("[dim]Press Ctrl+C to stop[/dim]\n")
            
            # Stream logs
            monitoring_manager.stream_logs(
                service=service,
                level=level,
            )
        else:
            # Fetch logs
            with console.status("[cyan]Fetching logs..."):
                logs = monitoring_manager.get_logs(
                    service=service,
                    level=level,
                    limit=tail,
                )
            
            if not logs:
                print_info("No logs found")
                raise typer.Exit(0)
            
            # Display logs
            for log in logs:
                timestamp = log.get('timestamp', '')
                level_str = log.get('level', 'INFO')
                service_str = log.get('service', 'app')
                message = log.get('message', '')
                
                # Color by level
                level_style = "white"
                if level_str == "ERROR":
                    level_style = "red"
                elif level_str == "WARN":
                    level_style = "yellow"
                elif level_str == "DEBUG":
                    level_style = "dim"
                
                console.print(
                    f"[dim]{timestamp}[/dim] "
                    f"[cyan]{service_str:8}[/cyan] "
                    f"[{level_style}]{level_str:5}[/{level_style}] "
                    f"{message}"
                )
        
    except KeyboardInterrupt:
        console.print("\n[yellow]Stopped following logs[/yellow]")
    except Exception as e:
        print_error(f"Failed to get logs: {e}")
        raise typer.Exit(1)


@app.command(name="api")
def api_logs_command(
    follow: bool = typer.Option(False, "-f", help="Follow logs"),
    tail: int = typer.Option(100, help="Number of lines"),
):
    """
    🌐 View API request logs
    
    Examples:
      zendbx logs api
      zendbx logs api --follow
    """
    logs_command(service="api", follow=follow, tail=tail)


@app.command(name="auth")
def auth_logs_command(
    follow: bool = typer.Option(False, "-f", help="Follow logs"),
    tail: int = typer.Option(100, help="Number of lines"),
):
    """
    🔐 View authentication logs
    
    Examples:
      zendbx logs auth
      zendbx logs auth --follow
    """
    logs_command(service="auth", follow=follow, tail=tail)


@app.command(name="db")
def db_logs_command(
    follow: bool = typer.Option(False, "-f", help="Follow logs"),
    tail: int = typer.Option(100, help="Number of lines"),
):
    """
    🗄️  View database logs
    
    Examples:
      zendbx logs db
      zendbx logs db --follow
    """
    logs_command(service="db", follow=follow, tail=tail)


@app.command(name="errors")
def errors_command(
    tail: int = typer.Option(50, help="Number of errors to show"),
):
    """
    🚨 View recent errors
    
    Shows only ERROR level logs across all services.
    
    Examples:
      zendbx logs errors
      zendbx logs errors --tail 20
    """
    logs_command(level="error", tail=tail)
