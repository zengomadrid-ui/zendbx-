"""Database analysis command"""

import typer
import asyncio

from ..config import config_manager
from ..core.database import DatabaseManager
from ..utils import (
    print_success,
    print_error,
    print_warning,
    print_header,
    print_table,
    print_status_table,
    create_progress,
    console,
)


def analyze_command(
    tables: bool = typer.Option(
        True,
        "--tables/--no-tables",
        help="Show table statistics"
    ),
    slow_queries: bool = typer.Option(
        True,
        "--slow-queries/--no-slow-queries",
        help="Show slow queries (requires pg_stat_statements)"
    ),
    indexes: bool = typer.Option(
        True,
        "--indexes/--no-indexes",
        help="Suggest missing indexes"
    ),
):
    """
    📊 Analyze database health and performance
    
    Provides comprehensive database analysis including:
    - Overall database health metrics
    - Table statistics and sizes
    - Slow query detection
    - Missing index suggestions
    - Dead tuple analysis
    
    Examples:
      zendbx db analyze
      zendbx db analyze --no-slow-queries
      zendbx db analyze --tables --indexes
    """
    
    print_header("Database Health Analysis")
    
    # Get connection
    try:
        conn_string = config_manager.get_connection_string()
    except Exception as e:
        print_error(str(e))
        raise typer.Exit(1)
    
    async def analyze():
        db = DatabaseManager(conn_string)
        results = {}
        
        with create_progress() as progress:
            task = progress.add_task("Analyzing database...", total=100)
            
            try:
                # Overall health
                progress.update(task, advance=20, description="Checking database health...")
                results['health'] = await db.analyze_database_health()
                
                # Table stats
                if tables:
                    progress.update(task, advance=20, description="Analyzing tables...")
                    results['tables'] = await db.get_table_stats()
                
                # Slow queries
                if slow_queries:
                    progress.update(task, advance=20, description="Finding slow queries...")
                    results['slow_queries'] = await db.get_slow_queries()
                
                # Missing indexes
                if indexes:
                    progress.update(task, advance=20, description="Checking for missing indexes...")
                    results['missing_indexes'] = await db.get_missing_indexes()
                
                progress.update(task, advance=20, description="Complete!")
                
                await db.disconnect()
                return results
                
            except Exception as e:
                await db.disconnect()
                raise e
    
    # Run analysis
    try:
        results = asyncio.run(analyze())
        
        # Display results
        console.print()
        print_success("Analysis complete!")
        
        # Overall health
        console.print()
        print_status_table(results['health'], title="Database Health")
        
        # Table statistics
        if tables and results.get('tables'):
            console.print()
            print_table(results['tables'], title="Table Statistics")
            
            # Check for tables with high dead rows
            high_dead_rows = [
                t for t in results['tables']
                if t.get('dead_rows', 0) > 1000
            ]
            if high_dead_rows:
                console.print()
                print_warning(
                    f"Found {len(high_dead_rows)} table(s) with high dead row count. "
                    "Consider running VACUUM."
                )
        
        # Slow queries
        if slow_queries and results.get('slow_queries'):
            console.print()
            if results['slow_queries']:
                print_table(results['slow_queries'], title="Slow Queries")
                console.print("\n[dim]💡 Tip: Consider optimizing these queries or adding indexes[/dim]")
            else:
                console.print("[dim]No slow query data available (pg_stat_statements not enabled)[/dim]")
        
        # Missing indexes
        if indexes and results.get('missing_indexes'):
            console.print()
            if results['missing_indexes']:
                print_table(results['missing_indexes'], title="Tables That May Need Indexes")
                console.print(
                    "\n[dim]💡 Tip: Tables with high sequential scans may benefit from indexes[/dim]"
                )
            else:
                console.print("[green]✓ No obvious missing indexes detected[/green]")
        
        # Summary
        console.print()
        console.print("[bold cyan]Analysis Summary:[/bold cyan]")
        console.print(f"  • Database size: {results['health']['database_size']}")
        console.print(f"  • Tables analyzed: {results['health']['table_count']}")
        console.print(f"  • Cache hit ratio: {results['health']['cache_hit_ratio']}")
        
        if results['health']['cache_hit_ratio'] != "N/A":
            ratio = float(results['health']['cache_hit_ratio'].rstrip('%'))
            if ratio < 90:
                console.print("\n[yellow]⚠ Cache hit ratio is below 90%. Consider increasing shared_buffers.[/yellow]")
        
    except Exception as e:
        print_error(f"Analysis failed: {e}")
        raise typer.Exit(1)
