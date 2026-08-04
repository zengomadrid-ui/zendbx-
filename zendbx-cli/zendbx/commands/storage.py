"""Storage commands - List, Upload, Download, Delete, Buckets"""

import typer
from pathlib import Path
from typing import Optional
from rich.console import Console
from rich.table import Table

from ..core.storage_manager import StorageManager
from ..utils.console import (
    print_success, print_error, print_info, print_header,
    confirm, create_progress
)

app = typer.Typer(help="📁 Storage management")
console = Console()


@app.command(name="list")
def list_command(
    bucket: str = typer.Argument(..., help="Bucket name"),
    prefix: Optional[str] = typer.Option(None, "--prefix", help="Filter by prefix"),
):
    """
    📋 List files in storage bucket
    
    Examples:
      zendbx storage list my-bucket
      zendbx storage list my-bucket --prefix images/
    """
    try:
        storage_manager = StorageManager()
        
        with console.status(f"[cyan]Listing files in {bucket}..."):
            files = storage_manager.list_files(bucket, prefix=prefix)
        
        if not files:
            print_info("No files found")
            raise typer.Exit(0)
        
        table = Table(title=f"Files in '{bucket}'", show_header=True)
        table.add_column("Name", style="cyan")
        table.add_column("Size", style="white")
        table.add_column("Modified", style="dim")
        
        for file in files:
            table.add_row(
                file['name'],
                file.get('size', 'N/A'),
                file.get('modified', 'N/A'),
            )
        
        console.print(table)
        console.print(f"\n[dim]Total: {len(files)} file(s)[/dim]")
        
    except Exception as e:
        print_error(f"Failed to list files: {e}")
        raise typer.Exit(1)


@app.command(name="upload")
def upload_command(
    file: Path = typer.Argument(..., help="File to upload", exists=True),
    bucket: str = typer.Argument(..., help="Bucket name"),
    path: Optional[str] = typer.Option(None, "--path", help="Destination path in bucket"),
):
    """
    ⬆️  Upload file to storage
    
    Examples:
      zendbx storage upload image.jpg my-bucket
      zendbx storage upload doc.pdf my-bucket --path docs/doc.pdf
    """
    print_header("Upload File")
    
    try:
        storage_manager = StorageManager()
        
        # Determine destination path
        dest_path = path or file.name
        
        # Upload with progress
        with create_progress() as progress:
            task = progress.add_task(f"[cyan]Uploading {file.name}...", total=100)
            
            storage_manager.upload_file(
                file,
                bucket,
                dest_path,
                progress_callback=lambda p: progress.update(task, completed=p)
            )
        
        print_success(f"Uploaded: {dest_path}")
        
        # Get URL
        url = storage_manager.get_public_url(bucket, dest_path)
        if url:
            console.print(f"\n[cyan]URL:[/cyan] {url}")
        
    except Exception as e:
        print_error(f"Upload failed: {e}")
        raise typer.Exit(1)


@app.command(name="download")
def download_command(
    path: str = typer.Argument(..., help="File path in bucket"),
    bucket: str = typer.Argument(..., help="Bucket name"),
    output: Optional[Path] = typer.Option(None, "--output", "-o", help="Local output path"),
):
    """
    ⬇️  Download file from storage
    
    Examples:
      zendbx storage download image.jpg my-bucket
      zendbx storage download doc.pdf my-bucket --output local.pdf
    """
    print_header("Download File")
    
    try:
        storage_manager = StorageManager()
        
        # Determine output path
        output_path = output or Path(path).name
        
        # Download with progress
        with create_progress() as progress:
            task = progress.add_task(f"[cyan]Downloading {path}...", total=100)
            
            storage_manager.download_file(
                bucket,
                path,
                output_path,
                progress_callback=lambda p: progress.update(task, completed=p)
            )
        
        print_success(f"Downloaded: {output_path}")
        
    except Exception as e:
        print_error(f"Download failed: {e}")
        raise typer.Exit(1)


@app.command(name="delete")
def delete_command(
    path: str = typer.Argument(..., help="File path to delete"),
    bucket: str = typer.Argument(..., help="Bucket name"),
    force: bool = typer.Option(False, "--force", "-f", help="Skip confirmation"),
):
    """
    🗑️  Delete file from storage
    
    Examples:
      zendbx storage delete image.jpg my-bucket
      zendbx storage delete old/* my-bucket --force
    """
    if not force:
        if not confirm(f"Delete '{path}' from bucket '{bucket}'?"):
            print_info("Deletion cancelled")
            raise typer.Exit(0)
    
    try:
        storage_manager = StorageManager()
        
        with console.status(f"[cyan]Deleting {path}..."):
            storage_manager.delete_file(bucket, path)
        
        print_success(f"Deleted: {path}")
        
    except Exception as e:
        print_error(f"Delete failed: {e}")
        raise typer.Exit(1)


@app.command(name="buckets")
def buckets_command():
    """
    🪣 List storage buckets
    
    Shows all available storage buckets.
    
    Examples:
      zendbx storage buckets
    """
    try:
        storage_manager = StorageManager()
        
        with console.status("[cyan]Fetching buckets..."):
            buckets = storage_manager.list_buckets()
        
        if not buckets:
            print_info("No buckets found")
            console.print("\n[dim]Create one in the dashboard[/dim]")
            raise typer.Exit(0)
        
        table = Table(title="Storage Buckets", show_header=True)
        table.add_column("Name", style="cyan")
        table.add_column("Files", style="white")
        table.add_column("Size", style="dim")
        table.add_column("Public", style="green")
        
        for bucket in buckets:
            table.add_row(
                bucket['name'],
                str(bucket.get('file_count', 'N/A')),
                bucket.get('size', 'N/A'),
                "Yes" if bucket.get('public') else "No",
            )
        
        console.print(table)
        
    except Exception as e:
        print_error(f"Failed to list buckets: {e}")
        raise typer.Exit(1)
