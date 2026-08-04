"""Functions commands - Serverless functions management"""

import typer
from pathlib import Path
from typing import Optional
from rich.console import Console

from ..core.functions_manager import FunctionsManager
from ..utils.console import (
    print_success, print_error, print_info, print_header,
    confirm, create_progress
)

app = typer.Typer(help="⚡ Serverless functions")
console = Console()


@app.command(name="new")
def new_command(
    name: str = typer.Argument(..., help="Function name"),
    template: str = typer.Option("typescript", help="Template (typescript, python, go)"),
):
    """
    ✨ Create a new function
    
    Generates boilerplate for a new serverless function.
    
    Examples:
      zendbx functions new my-function
      zendbx functions new auth-check --template python
    """
    print_header("Create New Function")
    
    try:
        functions_manager = FunctionsManager()
        
        # Create function
        with console.status(f"[cyan]Creating function: {name}..."):
            path = functions_manager.create_function(name, template=template)
        
        print_success(f"Function created: {name}")
        console.print(f"\n[dim]Location:[/dim] {path}")
        
        console.print()
        console.print("[dim]Next steps:[/dim]")
        console.print(f"  cd {path}")
        console.print(f"  zendbx functions serve    - Test locally")
        console.print(f"  zendbx functions deploy   - Deploy to cloud")
        
    except Exception as e:
        print_error(f"Failed to create function: {e}")
        raise typer.Exit(1)


@app.command(name="deploy")
def deploy_command(
    name: Optional[str] = typer.Argument(None, help="Function name (or all)"),
    build: bool = typer.Option(True, help="Build before deploying"),
):
    """
    🚀 Deploy functions to cloud
    
    Builds and deploys functions to ZenDBX platform.
    
    Examples:
      zendbx functions deploy              # Deploy all
      zendbx functions deploy my-function  # Deploy one
      zendbx functions deploy --no-build   # Skip build
    """
    print_header("Deploy Functions")
    
    try:
        functions_manager = FunctionsManager()
        
        # Get functions to deploy
        if name:
            functions = [name]
        else:
            functions = functions_manager.list_local_functions()
        
        if not functions:
            print_info("No functions found to deploy")
            raise typer.Exit(0)
        
        console.print(f"[cyan]Deploying {len(functions)} function(s)...[/cyan]\n")
        
        # Deploy each function
        with create_progress() as progress:
            task = progress.add_task("[cyan]Deploying...", total=len(functions))
            
            for func in functions:
                if build:
                    functions_manager.build_function(func)
                
                functions_manager.deploy_function(func)
                progress.update(task, advance=1)
        
        print_success(f"Deployed {len(functions)} function(s)")
        
    except Exception as e:
        print_error(f"Deployment failed: {e}")
        raise typer.Exit(1)


@app.command(name="serve")
def serve_command(
    port: int = typer.Option(9000, help="Port to serve on"),
    watch: bool = typer.Option(True, help="Watch for changes"),
):
    """
    🔧 Serve functions locally
    
    Starts local development server for testing functions.
    
    Examples:
      zendbx functions serve              # Serve on port 9000
      zendbx functions serve --port 3000  # Custom port
      zendbx functions serve --no-watch   # No auto-reload
    """
    print_header("Local Function Server")
    
    try:
        functions_manager = FunctionsManager()
        
        console.print(f"[cyan]Starting server on port {port}...[/cyan]")
        console.print(f"[dim]Watch mode: {'enabled' if watch else 'disabled'}[/dim]\n")
        
        # This runs indefinitely
        functions_manager.serve(port=port, watch=watch)
        
    except KeyboardInterrupt:
        console.print("\n[yellow]Server stopped[/yellow]")
    except Exception as e:
        print_error(f"Server failed: {e}")
        raise typer.Exit(1)


@app.command(name="logs")
def logs_command(
    name: str = typer.Argument(..., help="Function name"),
    follow: bool = typer.Option(False, "-f", "--follow", help="Follow logs in real-time"),
    tail: int = typer.Option(100, help="Number of lines to show"),
):
    """
    📜 View function logs
    
    Display logs from deployed functions.
    
    Examples:
      zendbx functions logs my-function
      zendbx functions logs my-function --follow
      zendbx functions logs my-function --tail 50
    """
    try:
        functions_manager = FunctionsManager()
        
        if follow:
            console.print(f"[cyan]Following logs for: {name}[/cyan]")
            console.print("[dim]Press Ctrl+C to stop[/dim]\n")
            
            # Stream logs
            functions_manager.stream_logs(name)
        else:
            # Fetch logs
            with console.status(f"[cyan]Fetching logs for: {name}..."):
                logs = functions_manager.get_logs(name, limit=tail)
            
            for log in logs:
                timestamp = log.get('timestamp', '')
                level = log.get('level', 'INFO')
                message = log.get('message', '')
                
                style = "white"
                if level == "ERROR":
                    style = "red"
                elif level == "WARN":
                    style = "yellow"
                
                console.print(f"[dim]{timestamp}[/dim] [{style}]{level}[/{style}] {message}")
        
    except KeyboardInterrupt:
        console.print("\n[yellow]Stopped following logs[/yellow]")
    except Exception as e:
        print_error(f"Failed to get logs: {e}")
        raise typer.Exit(1)
