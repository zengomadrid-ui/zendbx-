"""Link command - Link local folder to existing ZenDBX project"""

import typer
import os
from pathlib import Path
from rich.console import Console

from ..core.project_manager import ProjectManager
from ..utils.console import print_success, print_error, print_info, print_header, confirm
from ..config import config_manager

console = Console()


def link_command(
    project_slug: str = typer.Argument(..., help="Project slug to link to"),
    remote: str = typer.Option(
        os.getenv('ZENDBX_API_URL', 'http://localhost:8000'),
        help="API endpoint"
    ),
):
    """
    🔗 Link local folder to existing ZenDBX project
    
    Links current directory to a remote project, pulling
    configuration and setting up local environment.
    
    Examples:
      zendbx link my-project
      zendbx link my-project --remote https://custom.api.com
    """
    print_header("Link to Existing Project")
    
    try:
        project_manager = ProjectManager()
        
        # Check if already linked
        if project_manager.is_linked():
            existing = project_manager.get_linked_project()
            console.print(f"[yellow]Already linked to: {existing['slug']}[/yellow]")
            
            if not confirm("Overwrite existing link?"):
                print_info("Link cancelled.")
                raise typer.Exit(0)
        
        # Fetch project info
        with console.status(f"[cyan]Fetching project: {project_slug}..."):
            project = project_manager.get_project(project_slug, remote)
        
        if not project:
            print_error(f"Project not found: {project_slug}")
            raise typer.Exit(1)
        
        # Display project info
        console.print()
        console.print(f"[bold cyan]{project['name']}[/bold cyan]")
        console.print(f"[dim]{project.get('description', 'No description')}[/dim]")
        console.print()
        console.print(f"Region: {project.get('region', 'N/A')}")
        console.print(f"Database: {project.get('database_type', 'PostgreSQL')}")
        console.print()
        
        # Confirm
        if not confirm("Link to this project?"):
            print_info("Link cancelled.")
            raise typer.Exit(0)
        
        # Create .zendbx folder
        zendbx_dir = Path(".zendbx")
        zendbx_dir.mkdir(exist_ok=True)
        
        # Save project config
        project_manager.save_link(project, remote)
        
        # Pull environment
        with console.status("[cyan]Pulling environment..."):
            env_vars = project_manager.pull_environment(project['id'])
            project_manager.save_env(env_vars)
        
        # Pull schema
        if confirm("Pull database schema?", default=True):
            with console.status("[cyan]Pulling schema..."):
                schema = project_manager.pull_schema(project['id'])
                project_manager.save_schema(schema)
        
        print_success(f"Linked to project: {project_slug}")
        print_info("Configuration saved to .zendbx/")
        print_info("Environment saved to .env")
        
        console.print()
        console.print("[dim]Next steps:[/dim]")
        console.print("  zendbx db status    - Test connection")
        console.print("  zendbx db analyze   - Analyze database")
        
    except Exception as e:
        print_error(f"Link failed: {e}")
        raise typer.Exit(1)
