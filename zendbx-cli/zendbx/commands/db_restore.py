"""Database restore command"""

import typer
import subprocess
from pathlib import Path
from typing import Optional

from ..config import config_manager
from ..utils import (
    print_success,
    print_error,
    print_warning,
    print_info,
    print_header,
    confirm,
    create_progress,
    console,
)


def restore_command(
    backup_file: str = typer.Argument(..., help="Backup file to restore"),
    force: bool = typer.Option(
        False,
        "--force",
        "-f",
        help="Skip confirmation prompt"
    ),
    clean: bool = typer.Option(
        False,
        "--clean",
        help="Drop existing database objects before restore"
    ),
):
    """
    ♻️  Restore database from backup
    
    Restores a PostgreSQL database from a backup file created with 'zendbx db dump'.
    Supports both compressed (.sql.gz) and plain (.sql) backup files.
    
    ⚠️  WARNING: This will overwrite existing data!
    
    Examples:
      zendbx db restore backups/db_20240115_120000.sql.gz
      zendbx db restore my_backup.sql --force
      zendbx db restore backup.sql --clean
    """
    
    print_header("Database Restore")
    
    # Check if backup file exists
    backup_path = Path(backup_file)
    if not backup_path.exists():
        print_error(f"Backup file not found: {backup_file}")
        raise typer.Exit(1)
    
    # Get config
    try:
        config = config_manager.load_config()
        if not config.database:
            print_error("Database configuration not found. Run 'zendbx init' first.")
            raise typer.Exit(1)
    except Exception as e:
        print_error(str(e))
        raise typer.Exit(1)
    
    # Warning and confirmation
    console.print()
    print_warning("⚠️  WARNING: This will overwrite existing data in the database!")
    console.print(f"\n[bold]Restore details:[/bold]")
    console.print(f"  • Backup file: {backup_path}")
    console.print(f"  • Target database: {config.database.database}")
    console.print(f"  • Host: {config.database.host}:{config.database.port}")
    
    if clean:
        console.print(f"  • Mode: Clean (drop existing objects)")
    
    console.print()
    
    if not force:
        if not confirm("Are you sure you want to proceed?", default=False):
            print_info("Restore cancelled")
            raise typer.Exit(0)
    
    # Determine if file is compressed
    is_compressed = backup_path.suffix == '.gz'
    
    # Build psql command
    cmd = [
        "psql",
        "-h", config.database.host,
        "-p", str(config.database.port),
        "-U", config.database.user,
        "-d", config.database.database,
    ]
    
    if clean:
        cmd.append("--clean")
    
    # Set password environment variable if provided
    env = {}
    if config.database.password:
        env["PGPASSWORD"] = config.database.password.get_secret_value()
    
    # Execute restore
    try:
        with create_progress() as progress:
            task = progress.add_task("Restoring database...", total=100)
            
            progress.update(task, advance=30)
            
            if is_compressed:
                # Decompress and pipe to psql
                gunzip_process = subprocess.Popen(
                    ["gunzip", "-c", str(backup_path)],
                    stdout=subprocess.PIPE,
                    stderr=subprocess.PIPE
                )
                
                psql_process = subprocess.Popen(
                    cmd,
                    stdin=gunzip_process.stdout,
                    stdout=subprocess.PIPE,
                    stderr=subprocess.PIPE,
                    env={**subprocess.os.environ, **env}
                )
                
                gunzip_process.stdout.close()
                _, psql_error = psql_process.communicate()
                
                if psql_process.returncode != 0:
                    error_msg = psql_error.decode() if psql_error else "Unknown error"
                    raise Exception(f"Restore failed: {error_msg}")
            else:
                # Direct restore
                with open(backup_path, 'r') as f:
                    result = subprocess.run(
                        cmd,
                        stdin=f,
                        stdout=subprocess.PIPE,
                        stderr=subprocess.PIPE,
                        env={**subprocess.os.environ, **env}
                    )
                
                if result.returncode != 0:
                    error_msg = result.stderr.decode() if result.stderr else "Unknown error"
                    raise Exception(f"Restore failed: {error_msg}")
            
            progress.update(task, advance=70)
        
        console.print()
        print_success("Database restored successfully!")
        
        console.print(f"\n[bold]Restore summary:[/bold]")
        console.print(f"  • Source: {backup_path}")
        console.print(f"  • Database: {config.database.database}")
        console.print(f"  • Status: Complete")
        
        console.print(f"\n[dim]💡 Tip: Run 'zendbx status' to verify the restore[/dim]")
        
    except FileNotFoundError as e:
        if 'gunzip' in str(e):
            print_error("gunzip not found. Please ensure gzip is installed.")
        elif 'psql' in str(e):
            print_error("psql not found. Please ensure PostgreSQL client tools are installed.")
        else:
            print_error(f"Command not found: {e}")
        raise typer.Exit(1)
    except Exception as e:
        print_error(f"Restore failed: {e}")
        raise typer.Exit(1)
