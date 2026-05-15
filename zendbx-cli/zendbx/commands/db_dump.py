"""Database backup command"""

import typer
import asyncio
import subprocess
from pathlib import Path
from datetime import datetime
from typing import Optional

from ..config import config_manager
from ..utils import (
    print_success,
    print_error,
    print_info,
    print_header,
    create_progress,
    console,
)


def dump_command(
    output: Optional[str] = typer.Option(
        None,
        "--output",
        "-o",
        help="Output file path (default: backups/db_TIMESTAMP.sql)"
    ),
    compress: bool = typer.Option(
        True,
        "--compress/--no-compress",
        help="Compress backup with gzip"
    ),
    schema_only: bool = typer.Option(
        False,
        "--schema-only",
        help="Dump only schema (no data)"
    ),
    data_only: bool = typer.Option(
        False,
        "--data-only",
        help="Dump only data (no schema)"
    ),
):
    """
    💾 Create database backup
    
    Creates a PostgreSQL backup using pg_dump.
    Backups are compressed by default and stored in the configured backup directory.
    
    Examples:
      zendbx db dump
      zendbx db dump --output my_backup.sql
      zendbx db dump --schema-only
      zendbx db dump --no-compress
    """
    
    print_header("Database Backup")
    
    # Get config
    try:
        config = config_manager.load_config()
        if not config.database:
            print_error("Database configuration not found. Run 'zendbx init' first.")
            raise typer.Exit(1)
    except Exception as e:
        print_error(str(e))
        raise typer.Exit(1)
    
    # Determine output path
    if output:
        output_path = Path(output)
    else:
        timestamp = datetime.now().strftime("%Y%m%d_%H%M%S")
        backup_dir = config.preferences.backup_path
        backup_dir.mkdir(parents=True, exist_ok=True)
        
        filename = f"db_{timestamp}.sql"
        if compress:
            filename += ".gz"
        
        output_path = backup_dir / filename
    
    # Ensure output directory exists
    output_path.parent.mkdir(parents=True, exist_ok=True)
    
    print_info(f"Backup destination: {output_path}")
    
    # Build pg_dump command
    cmd = [
        "pg_dump",
        "-h", config.database.host,
        "-p", str(config.database.port),
        "-U", config.database.user,
        "-d", config.database.database,
        "-F", "p",  # Plain text format
    ]
    
    if schema_only:
        cmd.append("--schema-only")
    elif data_only:
        cmd.append("--data-only")
    
    # Set password environment variable if provided
    env = {}
    if config.database.password:
        env["PGPASSWORD"] = config.database.password.get_secret_value()
    
    # Execute backup
    try:
        with create_progress() as progress:
            task = progress.add_task("Creating backup...", total=100)
            
            progress.update(task, advance=30)
            
            # Run pg_dump
            if compress:
                # Pipe through gzip
                dump_process = subprocess.Popen(
                    cmd,
                    stdout=subprocess.PIPE,
                    stderr=subprocess.PIPE,
                    env={**subprocess.os.environ, **env}
                )
                
                with open(output_path, 'wb') as f:
                    gzip_process = subprocess.Popen(
                        ["gzip"],
                        stdin=dump_process.stdout,
                        stdout=f,
                        stderr=subprocess.PIPE
                    )
                    dump_process.stdout.close()
                    gzip_process.communicate()
                
                dump_process.wait()
                
                if dump_process.returncode != 0:
                    error = dump_process.stderr.read().decode()
                    raise Exception(f"pg_dump failed: {error}")
            else:
                # Direct output
                with open(output_path, 'w') as f:
                    result = subprocess.run(
                        cmd,
                        stdout=f,
                        stderr=subprocess.PIPE,
                        env={**subprocess.os.environ, **env},
                        text=True
                    )
                
                if result.returncode != 0:
                    raise Exception(f"pg_dump failed: {result.stderr}")
            
            progress.update(task, advance=70)
        
        # Get file size
        file_size = output_path.stat().st_size
        size_mb = file_size / (1024 * 1024)
        
        console.print()
        print_success(f"Backup created successfully!")
        console.print(f"\n[bold]Backup details:[/bold]")
        console.print(f"  • Location: {output_path}")
        console.print(f"  • Size: {size_mb:.2f} MB")
        console.print(f"  • Compressed: {'Yes' if compress else 'No'}")
        
        if schema_only:
            console.print(f"  • Type: Schema only")
        elif data_only:
            console.print(f"  • Type: Data only")
        else:
            console.print(f"  • Type: Full backup")
        
        console.print(f"\n[dim]💡 Restore with: zendbx db restore {output_path}[/dim]")
        
    except FileNotFoundError:
        print_error(
            "pg_dump not found. Please ensure PostgreSQL client tools are installed and in PATH."
        )
        raise typer.Exit(1)
    except Exception as e:
        print_error(f"Backup failed: {e}")
        if output_path.exists():
            output_path.unlink()  # Clean up partial backup
        raise typer.Exit(1)
