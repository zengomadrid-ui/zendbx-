"""Projects commands - List, Create, Delete, Info, Open"""

import typer
import os
from typing import Optional
from rich.console import Console
from rich.table import Table

from ..core.project_manager import ProjectManager
from ..utils.console import (
    print_success, print_error, print_info, print_header,
    confirm, print_status_table
)

app = typer.Typer(help="📦 Project management")
console = Console()


@app.command(name="list")
def list_command(
    output: Optional[str] = typer.Option(None, "--output", "-o", help="Output format (table, json)"),
):
    """
    📋 List all your projects
    
    Shows all projects you have access to.
    
    Examples:
      zendbx projects list
      zendbx projects list --output json
    """
    try:
        project_manager = ProjectManager()
        
        with console.status("[cyan]Fetching projects..."):
            projects = project_manager.list_projects()
        
        if not projects:
            print_info("No projects found.")
            console.print("\n[dim]Create one with:[/dim] zendbx init")
            raise typer.Exit(0)
        
        if output == "json":
            console.print_json(data=projects)
        else:
            table = Table(title=f"Your Projects ({len(projects)})", show_header=True)
            table.add_column("Name", style="cyan", no_wrap=True)
            table.add_column("Slug", style="white")
            table.add_column("Region", style="dim")
            table.add_column("Status", style="green")
            
            for project in projects:
                table.add_row(
                    project['name'],
                    project['slug'],
                    project.get('region', 'N/A'),
                    project.get('status', 'active'),
                )
            
            console.print(table)
        
    except Exception as e:
        print_error(f"Failed to list projects: {e}")
        raise typer.Exit(1)


@app.command(name="create")
def create_command(
    name: str = typer.Argument(..., help="Project name"),
    region: Optional[str] = typer.Option("us-east-1", help="AWS region"),
):
    """
    ✨ Create a new project
    
    Creates a new ZenDBX project in the cloud.
    
    Examples:
      zendbx projects create "My App"
      zendbx projects create "My App" --region eu-west-1
    """
    print_header("Create New Project")
    
    try:
        project_manager = ProjectManager()
        
        # Create project
        with console.status(f"[cyan]Creating project: {name}..."):
            project = project_manager.create_project(name, region=region)
        
        print_success(f"Project created: {project['slug']}")
        
        # Display info
        print_status_table({
            "Name": project['name'],
            "Slug": project['slug'],
            "Region": project.get('region', 'N/A'),
            "Database URL": project.get('database_url', 'N/A'),
        })
        
        console.print()
        console.print("[dim]Next steps:[/dim]")
        console.print(f"  zendbx link {project['slug']}    - Link to this project")
        console.print(f"  zendbx projects info {project['slug']}    - View details")
        
    except Exception as e:
        print_error(f"Failed to create project: {e}")
        raise typer.Exit(1)


@app.command(name="delete")
def delete_command(
    slug: str = typer.Argument(..., help="Project slug"),
    force: bool = typer.Option(False, "--force", help="Skip confirmation"),
):
    """
    🗑️  Delete a project (DESTRUCTIVE)
    
    Permanently deletes a project and all its data.
    This action CANNOT be undone.
    
    Examples:
      zendbx projects delete my-project
      zendbx projects delete my-project --force
    """
    print_header("Delete Project")
    
    console.print(f"[bold red]⚠️  WARNING: This will permanently delete '{slug}'[/bold red]\n")
    console.print("All data, including database, storage, and backups will be lost.\n")
    
    if not force:
        if not confirm("Are you absolutely sure?", default=False):
            print_info("Deletion cancelled.")
            raise typer.Exit(0)
        
        # Double confirmation
        confirm_text = typer.prompt(f"Type the project slug '{slug}' to confirm")
        if confirm_text != slug:
            print_error("Confirmation failed. Deletion cancelled.")
            raise typer.Exit(1)
    
    try:
        project_manager = ProjectManager()
        
        with console.status(f"[cyan]Deleting project: {slug}..."):
            project_manager.delete_project(slug)
        
        print_success(f"Project deleted: {slug}")
        
    except Exception as e:
        print_error(f"Failed to delete project: {e}")
        raise typer.Exit(1)


@app.command(name="info")
def info_command(
    slug: Optional[str] = typer.Argument(None, help="Project slug (or use linked project)"),
):
    """
    ℹ️  Show project details
    
    Displays detailed information about a project.
    
    Examples:
      zendbx projects info           # Use linked project
      zendbx projects info my-project
    """
    try:
        project_manager = ProjectManager()
        
        # Determine project
        if not slug:
            if not project_manager.is_linked():
                print_error("Not linked to a project. Use: zendbx projects info <slug>")
                raise typer.Exit(1)
            slug = project_manager.get_linked_project()['slug']
        
        # Fetch project
        with console.status(f"[cyan]Fetching project: {slug}..."):
            project = project_manager.get_project(slug)
        
        if not project:
            print_error(f"Project not found: {slug}")
            raise typer.Exit(1)
        
        # Display info
        console.print()
        console.print(f"[bold cyan]{project['name']}[/bold cyan]")
        console.print(f"[dim]{project.get('description', 'No description')}[/dim]")
        console.print()
        
        print_status_table({
            "Slug": project['slug'],
            "Region": project.get('region', 'N/A'),
            "Status": project.get('status', 'N/A'),
            "Database": project.get('database_type', 'PostgreSQL'),
            "Created": project.get('created_at', 'N/A'),
            "Tables": project.get('table_count', 'N/A'),
            "Storage Used": project.get('storage_used', 'N/A'),
        })
        
    except Exception as e:
        print_error(f"Failed to get project info: {e}")
        raise typer.Exit(1)


@app.command(name="open")
def open_command(
    slug: Optional[str] = typer.Argument(None, help="Project slug"),
):
    """
    🌐 Open project in browser
    
    Opens the project dashboard in your default browser.
    
    Examples:
      zendbx projects open
      zendbx projects open my-project
    """
    import webbrowser
    
    try:
        project_manager = ProjectManager()
        
        # Determine project
        if not slug:
            if not project_manager.is_linked():
                print_error("Not linked to a project.")
                raise typer.Exit(1)
            slug = project_manager.get_linked_project()['slug']
        
        # Open browser
        app_url = os.getenv('ZENDBX_APP_URL', 'http://localhost:3000')
        url = f"{app_url}/project/{slug}"
        console.print(f"[cyan]Opening: {url}[/cyan]")
        webbrowser.open(url)
        
        print_success("Browser opened")
        
    except Exception as e:
        print_error(f"Failed to open project: {e}")
        raise typer.Exit(1)
