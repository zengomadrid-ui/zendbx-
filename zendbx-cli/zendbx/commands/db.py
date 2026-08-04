"""Database commands - Push, Pull, Fix, Migrate, Seed, Reset, Analyze"""

import typer
from typing import Optional
from pathlib import Path
from rich.console import Console
from rich.table import Table
from rich import box

from ..core.database_manager import DatabaseManager
from ..core.schema_manager import SchemaManager
from ..core.migration_manager import MigrationManager
from ..core.sql_fixer import sql_fixer, FixResult
from ..utils.console import (
    print_success, print_error, print_warning, print_info,
    print_header, print_sql, print_diff, confirm, create_progress,
    print_table, print_status_table
)
from ..config import config_manager

app = typer.Typer(help="🗄️  Database operations")
console = Console()


@app.command(name="push")
def push_command(
    auto_approve: bool = typer.Option(False, "--yes", "-y", help="Skip confirmation"),
    dry_run: bool = typer.Option(False, "--dry-run", help="Show changes without applying"),
):
    """
    📤 Push schema changes to database
    
    Compares local schema with remote and generates migration.
    Shows preview before applying changes.
    
    Examples:
      zendbx db push                # Interactive push
      zendbx db push --yes          # Auto-approve changes
      zendbx db push --dry-run      # Preview only
    """
    print_header("Push Schema Changes")
    
    try:
        schema_manager = SchemaManager()
        
        # Load local schema
        with console.status("[cyan]Loading local schema..."):
            local_schema = schema_manager.load_local_schema()
        
        if not local_schema:
            print_error("No local schema found. Create schema files in ./schema/")
            raise typer.Exit(1)
        
        # Get remote schema
        with console.status("[cyan]Fetching remote schema..."):
            remote_schema = schema_manager.get_remote_schema()
        
        # Generate diff
        with console.status("[cyan]Generating migration..."):
            diff = schema_manager.generate_diff(local_schema, remote_schema)
        
        if not diff.has_changes():
            print_success("Schema is already up to date!")
            raise typer.Exit(0)
        
        # Display changes
        console.print()
        diff.display()
        console.print()
        
        if dry_run:
            print_info("Dry run complete. No changes applied.")
            raise typer.Exit(0)
        
        # Confirm
        if not auto_approve:
            if not confirm("Apply these changes?"):
                print_info("Push cancelled.")
                raise typer.Exit(0)
        
        # Apply changes
        with create_progress() as progress:
            task = progress.add_task("[cyan]Applying changes...", total=100)
            
            schema_manager.apply_diff(diff, progress_callback=lambda p: progress.update(task, completed=p))
        
        print_success("Schema pushed successfully!")
        
    except Exception as e:
        print_error(f"Push failed: {e}")
        raise typer.Exit(1)


@app.command(name="pull")
def pull_command(
    overwrite: bool = typer.Option(False, "--overwrite", help="Overwrite local schema"),
):
    """
    📥 Pull schema from database
    
    Downloads current database schema to local files.
    
    Examples:
      zendbx db pull                # Pull schema
      zendbx db pull --overwrite    # Force overwrite
    """
    print_header("Pull Schema from Database")
    
    try:
        schema_manager = SchemaManager()
        
        # Check if local schema exists
        if schema_manager.local_schema_exists() and not overwrite:
            if not confirm("Local schema exists. Overwrite?"):
                print_info("Pull cancelled.")
                raise typer.Exit(0)
        
        # Pull schema
        with console.status("[cyan]Pulling schema..."):
            schema = schema_manager.pull_schema()
        
        # Save to files
        with console.status("[cyan]Writing schema files..."):
            schema_manager.save_local_schema(schema)
        
        print_success(f"Schema pulled successfully!")
        print_info(f"Tables: {len(schema.tables)}")
        print_info(f"Location: ./schema/")
        
    except Exception as e:
        print_error(f"Pull failed: {e}")
        raise typer.Exit(1)


@app.command(name="diff")
def diff_command(
    output: Optional[str] = typer.Option(None, "--output", "-o", help="Output format (text, json, sql)"),
):
    """
    🔍 Show schema differences
    
    Compare local schema with remote database.
    Beautiful colored diff output.
    
    Examples:
      zendbx db diff                # Show diff
      zendbx db diff --output sql   # SQL migration
      zendbx db diff --output json  # JSON format
    """
    print_header("Schema Diff")
    
    try:
        schema_manager = SchemaManager()
        
        # Load schemas
        with console.status("[cyan]Loading schemas..."):
            local_schema = schema_manager.load_local_schema()
            remote_schema = schema_manager.get_remote_schema()
        
        if not local_schema:
            print_error("No local schema found.")
            raise typer.Exit(1)
        
        # Generate diff
        diff = schema_manager.generate_diff(local_schema, remote_schema)
        
        if not diff.has_changes():
            print_success("No differences found!")
            raise typer.Exit(0)
        
        # Display based on format
        if output == "json":
            console.print_json(diff.to_json())
        elif output == "sql":
            print_sql(diff.to_sql(), title="Migration SQL")
        else:
            diff.display()
        
    except Exception as e:
        print_error(f"Diff failed: {e}")
        raise typer.Exit(1)


@app.command(name="fix")
def fix_command(
    sql: Optional[str] = typer.Argument(None, help="SQL query to fix"),
    file: Optional[Path] = typer.Option(None, "--file", "-f", help="Read SQL from file"),
    execute: bool = typer.Option(False, "--execute", "-e", help="Execute fixed SQL"),
):
    """
    🔧 Auto-fix broken SQL queries
    
    ZenDBX's signature feature: Intelligent SQL error detection and fixing.
    
    Detects:
      • Typos in keywords
      • Wrong operators
      • Missing commas/quotes
      • Invalid table/column names
      • JOIN problems
      • GROUP BY/ORDER BY issues
    
    Examples:
      zendbx db fix "SLECT * FORM users"
      zendbx db fix --file query.sql
      zendbx db fix "..." --execute
    """
    print_header("SQL Auto Fix")
    
    # Get SQL input
    if file:
        try:
            sql = file.read_text()
        except Exception as e:
            print_error(f"Failed to read file: {e}")
            raise typer.Exit(1)
    
    if not sql:
        print_error("No SQL provided. Use: zendbx db fix \"SQL\" or --file query.sql")
        raise typer.Exit(1)
    
    try:
        # Get database schema for context
        schema = None
        try:
            db_manager = DatabaseManager(config_manager.get_connection_string())
            with console.status("[dim]Loading schema for context..."):
                schema = db_manager.get_schema_sync()
        except:
            pass  # Schema is optional
        
        # Attempt fix
        with console.status("[cyan]Analyzing SQL..."):
            result: FixResult = sql_fixer.fix_sql(sql, schema=schema)
        
        # Display results
        console.print()
        
        if result.success:
            print_success(f"Fix Found! ({result.fix_type})")
            console.print(f"[dim]Confidence: {result.confidence * 100:.0f}%[/dim]\n")
            
            # Show diff
            print_diff(result.original_sql, result.fixed_sql, "SQL Fix")
            
            console.print()
            console.print(f"[yellow]Explanation:[/yellow] {result.explanation}")
            
            if result.changes:
                console.print("\n[yellow]Changes:[/yellow]")
                for change in result.changes:
                    console.print(f"  • {change}")
            
            # Execute if requested
            if execute:
                console.print()
                if confirm("Execute fixed SQL?"):
                    with console.status("[cyan]Executing..."):
                        db_manager.execute_query_sync(result.fixed_sql)
                    print_success("Query executed successfully!")
            else:
                console.print()
                print_info("Run with --execute to run the fixed query")
        
        else:
            print_warning("No automatic fix available")
            console.print(f"\n[dim]{result.explanation}[/dim]")
            
            # Show original SQL
            console.print()
            print_sql(sql, title="Original SQL")
            
            console.print()
            print_info("Tips:")
            console.print("  • Check for typos in keywords")
            console.print("  • Verify table and column names")
            console.print("  • Ensure correct operators (= not ==)")
            console.print("  • Check for missing commas or quotes")
        
    except Exception as e:
        print_error(f"Fix failed: {e}")
        raise typer.Exit(1)


@app.command(name="migrate")
def migrate_command(
    name: Optional[str] = typer.Option(None, "--name", "-n", help="Migration name"),
    rollback: bool = typer.Option(False, "--rollback", help="Rollback last migration"),
    to: Optional[str] = typer.Option(None, "--to", help="Migrate to specific version"),
):
    """
    🔄 Run database migrations
    
    Applies pending migrations or rolls back changes.
    
    Examples:
      zendbx db migrate                    # Run pending migrations
      zendbx db migrate --rollback         # Rollback last
      zendbx db migrate --to 20240101_init # Migrate to version
    """
    print_header("Database Migrations")
    
    try:
        migration_manager = MigrationManager()
        
        if rollback:
            # Rollback
            with console.status("[cyan]Rolling back..."):
                result = migration_manager.rollback()
            
            print_success(f"Rolled back: {result.name}")
            
        elif to:
            # Migrate to specific version
            with console.status(f"[cyan]Migrating to {to}..."):
                results = migration_manager.migrate_to(to)
            
            for result in results:
                print_success(f"Applied: {result.name}")
            
        else:
            # Run pending migrations
            pending = migration_manager.get_pending_migrations()
            
            if not pending:
                print_success("No pending migrations!")
                raise typer.Exit(0)
            
            console.print(f"[cyan]Found {len(pending)} pending migration(s)[/cyan]\n")
            
            for migration in pending:
                console.print(f"  • {migration.name}")
            
            console.print()
            
            if not confirm("Apply these migrations?"):
                print_info("Migration cancelled.")
                raise typer.Exit(0)
            
            # Apply migrations
            with create_progress() as progress:
                task = progress.add_task("[cyan]Applying migrations...", total=len(pending))
                
                for migration in pending:
                    migration_manager.apply_migration(migration)
                    progress.update(task, advance=1)
            
            print_success(f"Applied {len(pending)} migration(s)")
        
    except Exception as e:
        print_error(f"Migration failed: {e}")
        raise typer.Exit(1)


@app.command(name="seed")
def seed_command(
    file: Optional[Path] = typer.Option(None, "--file", "-f", help="Seed file"),
):
    """
    🌱 Seed database with sample data
    
    Runs seed files to populate database with initial or test data.
    
    Examples:
      zendbx db seed                    # Run default seed
      zendbx db seed --file seed.sql    # Run specific seed file
    """
    print_header("Database Seed")
    
    try:
        db_manager = DatabaseManager(config_manager.get_connection_string())
        
        # Determine seed file
        if not file:
            file = Path("./seeds/seed.sql")
        
        if not file.exists():
            print_error(f"Seed file not found: {file}")
            raise typer.Exit(1)
        
        # Read seed SQL
        seed_sql = file.read_text()
        
        # Execute
        with console.status(f"[cyan]Running seed: {file.name}..."):
            db_manager.execute_script_sync(seed_sql)
        
        print_success(f"Seed completed: {file.name}")
        
    except Exception as e:
        print_error(f"Seed failed: {e}")
        raise typer.Exit(1)


@app.command(name="reset")
def reset_command(
    force: bool = typer.Option(False, "--force", help="Skip confirmation"),
):
    """
    ⚠️  Reset database (DESTRUCTIVE)
    
    Drops all tables, runs migrations, and seeds data.
    CANNOT BE UNDONE - requires confirmation.
    
    Examples:
      zendbx db reset         # Interactive reset
      zendbx db reset --force # Skip confirmation
    """
    print_header("Database Reset")
    
    console.print("[bold red]⚠️  WARNING: This will DELETE ALL DATA[/bold red]\n")
    console.print("This operation will:")
    console.print("  1. Drop all tables")
    console.print("  2. Run migrations")
    console.print("  3. Run seeds\n")
    
    if not force:
        if not confirm("Are you absolutely sure?", default=False):
            print_info("Reset cancelled.")
            raise typer.Exit(0)
        
        # Double confirmation
        confirm_text = typer.prompt("Type 'RESET' to confirm")
        if confirm_text != "RESET":
            print_error("Confirmation failed. Reset cancelled.")
            raise typer.Exit(1)
    
    try:
        db_manager = DatabaseManager(config_manager.get_connection_string())
        migration_manager = MigrationManager()
        
        # Drop all tables
        with console.status("[cyan]Dropping tables..."):
            db_manager.drop_all_tables_sync()
        
        # Run migrations
        with console.status("[cyan]Running migrations..."):
            migration_manager.migrate_all()
        
        # Run seeds
        with console.status("[cyan]Seeding database..."):
            seed_file = Path("./seeds/seed.sql")
            if seed_file.exists():
                seed_sql = seed_file.read_text()
                db_manager.execute_script_sync(seed_sql)
        
        print_success("Database reset complete!")
        
    except Exception as e:
        print_error(f"Reset failed: {e}")
        raise typer.Exit(1)


@app.command(name="analyze")
def analyze_command(
    detailed: bool = typer.Option(False, "--detailed", "-d", help="Show detailed analysis"),
):
    """
    📊 Analyze database performance
    
    Comprehensive health check with actionable recommendations:
      • Performance metrics
      • Slow queries
      • Missing indexes
      • Table bloat
      • Connection stats
    
    Examples:
      zendbx db analyze             # Quick analysis
      zendbx db analyze --detailed  # Full report
    """
    print_header("Database Analysis")
    
    try:
        db_manager = DatabaseManager(config_manager.get_connection_string())
        
        # Health overview
        with console.status("[cyan]Analyzing database health..."):
            health = db_manager.analyze_health_sync()
        
        print_status_table(health, "Database Health")
        
        # Table stats
        console.print()
        with console.status("[cyan]Analyzing tables..."):
            table_stats = db_manager.get_table_stats_sync()
        
        if table_stats:
            print_table(table_stats[:10], "Top Tables by Size")
        
        # Slow queries
        if detailed:
            console.print()
            with console.status("[cyan]Finding slow queries..."):
                slow_queries = db_manager.get_slow_queries_sync(limit=5)
            
            if slow_queries:
                print_table(slow_queries, "Slow Queries")
            else:
                print_info("No slow queries found (pg_stat_statements not enabled)")
        
        # Missing indexes
        console.print()
        with console.status("[cyan]Checking for missing indexes..."):
            missing_indexes = db_manager.get_missing_indexes_sync()
        
        if missing_indexes:
            console.print()
            print_warning(f"Found {len(missing_indexes)} table(s) that might need indexes")
            print_table(missing_indexes[:5], "Tables with High Sequential Scans")
            console.print()
            print_info("Consider adding indexes to frequently queried columns")
        else:
            print_success("No obvious missing indexes detected")
        
        console.print()
        print_success("Analysis complete!")
        
    except Exception as e:
        print_error(f"Analysis failed: {e}")
        raise typer.Exit(1)


@app.command(name="status")
def status_command():
    """
    📈 Show database connection status
    
    Quick check of database connectivity and basic info.
    
    Examples:
      zendbx db status
    """
    try:
        db_manager = DatabaseManager(config_manager.get_connection_string())
        
        with console.status("[cyan]Testing connection..."):
            info = db_manager.test_connection_sync()
        
        print_success("Connected to database")
        print_status_table(info, "Connection Info")
        
    except Exception as e:
        print_error(f"Connection failed: {e}")
        raise typer.Exit(1)
