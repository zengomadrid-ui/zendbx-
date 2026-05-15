"""SQL Auto-Fix Command - ZenDBX's signature feature"""

import typer
import asyncio
from typing import Optional

from ..config import config_manager
from ..core.database import DatabaseManager
from ..core.sql_fixer import sql_fixer
from ..utils import (
    print_success,
    print_error,
    print_warning,
    print_info,
    print_header,
    print_sql,
    print_diff,
    print_panel,
    confirm,
    console,
    create_progress,
)


def fix_command(
    sql: str = typer.Argument(..., help="SQL query to fix"),
    execute: bool = typer.Option(
        False,
        "--execute",
        "-e",
        help="Execute the fixed SQL automatically"
    ),
    auto: bool = typer.Option(
        False,
        "--auto",
        "-a",
        help="Apply fix automatically without confirmation"
    ),
    error: Optional[str] = typer.Option(
        None,
        "--error",
        help="Error message from database (helps improve fix accuracy)"
    ),
):
    """
    🔧 Fix broken SQL queries - ZenDBX's signature feature
    
    Automatically detects and fixes common SQL errors:
    - Keyword typos (FORM → FROM, SLECT → SELECT)
    - Operator mistakes (== → =, != → <>)
    - Quote issues (double quotes → single quotes)
    - Missing commas in CREATE TABLE
    - Schema errors (wrong table/column names)
    
    Examples:
      zendbx db fix "SELECT name FORM users"
      zendbx db fix "SELECT * FROM user WHERE id == 1" --execute
      zendbx db fix "SELECT invalid_col FROM users" --error "column does not exist"
    """
    
    print_header("SQL Auto-Fix")
    
    # Show original SQL
    console.print("\n[bold]Original SQL:[/bold]")
    print_sql(sql, line_numbers=False)
    
    # Get schema if available (for better fixes)
    schema = None
    if error:
        try:
            conn_string = config_manager.get_connection_string()
            
            async def get_schema():
                db = DatabaseManager(conn_string)
                try:
                    schema_data = await db.get_schema()
                    await db.disconnect()
                    return schema_data
                except:
                    return None
            
            schema = asyncio.run(get_schema())
        except:
            pass
    
    # Attempt to fix SQL
    with create_progress() as progress:
        task = progress.add_task("Analyzing SQL...", total=100)
        
        progress.update(task, advance=30, description="Detecting errors...")
        result = sql_fixer.fix_sql(sql, error_message=error, schema=schema)
        
        progress.update(task, advance=70, description="Generating fix...")
    
    # Display results
    console.print()
    
    if not result.success:
        print_warning("No automatic fix available")
        print_info(result.explanation)
        
        if not error:
            console.print("\n[dim]💡 Tip: Provide the error message with --error for better fixes[/dim]")
        
        raise typer.Exit(0)
    
    # Show the fix
    print_success(f"Fix found! ({result.fix_type.upper()}, confidence: {result.confidence:.0%})")
    console.print(f"\n[bold cyan]Explanation:[/bold cyan] {result.explanation}")
    
    if result.changes:
        console.print("\n[bold cyan]Changes:[/bold cyan]")
        for change in result.changes:
            console.print(f"  • {change}")
    
    console.print()
    print_diff(result.original_sql, result.fixed_sql, title="SQL Fix Comparison")
    
    # Ask for confirmation (unless auto mode)
    if not auto:
        console.print()
        if not confirm("Apply this fix?", default=True):
            print_info("Fix not applied")
            raise typer.Exit(0)
    
    # Show fixed SQL
    console.print("\n[bold green]✓ Fixed SQL:[/bold green]")
    print_sql(result.fixed_sql, line_numbers=False)
    
    # Execute if requested
    if execute:
        console.print()
        if not auto and not confirm("Execute the fixed SQL?", default=False):
            print_info("SQL not executed")
            raise typer.Exit(0)
        
        try:
            conn_string = config_manager.get_connection_string()
            
            async def execute_sql():
                db = DatabaseManager(conn_string)
                try:
                    # Determine if it's a query or command
                    sql_upper = result.fixed_sql.strip().upper()
                    if sql_upper.startswith('SELECT'):
                        results = await db.execute_query(result.fixed_sql)
                        await db.disconnect()
                        return ("query", results)
                    else:
                        status = await db.execute_command(result.fixed_sql)
                        await db.disconnect()
                        return ("command", status)
                except Exception as e:
                    await db.disconnect()
                    raise e
            
            exec_type, exec_result = asyncio.run(execute_sql())
            
            print_success("SQL executed successfully!")
            
            if exec_type == "query" and exec_result:
                from ..utils import print_table
                console.print()
                print_table(exec_result, title="Query Results")
            elif exec_type == "command":
                console.print(f"\n[dim]Result: {exec_result}[/dim]")
                
        except Exception as e:
            print_error(f"Execution failed: {e}")
            raise typer.Exit(1)
    else:
        console.print("\n[dim]💡 Tip: Use --execute to run the fixed SQL immediately[/dim]")
    
    # Success summary
    console.print()
    print_panel(
        f"[green]✓[/green] SQL fixed successfully!\n"
        f"[dim]Fix type: {result.fix_type} | Confidence: {result.confidence:.0%}[/dim]",
        title="Success",
        style="green"
    )
