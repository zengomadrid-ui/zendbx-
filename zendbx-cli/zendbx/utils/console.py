"""Rich console utilities for beautiful terminal output"""

from typing import Optional, Any
from rich.console import Console
from rich.table import Table
from rich.panel import Panel
from rich.syntax import Syntax
from rich.progress import Progress, SpinnerColumn, TextColumn, BarColumn
from rich.prompt import Confirm, Prompt
from rich import box
from rich.text import Text

# Global console instance
console = Console()
error_console = Console(stderr=True, style="bold red")


def print_success(message: str) -> None:
    """Print success message in green"""
    console.print(f"✓ {message}", style="bold green")


def print_error(message: str) -> None:
    """Print error message in red"""
    error_console.print(f"✗ {message}", style="bold red")


def print_warning(message: str) -> None:
    """Print warning message in yellow"""
    console.print(f"⚠ {message}", style="bold yellow")


def print_info(message: str) -> None:
    """Print info message in blue"""
    console.print(f"ℹ {message}", style="bold blue")


def print_sql(sql: str, title: Optional[str] = None, line_numbers: bool = True) -> None:
    """Print SQL with syntax highlighting"""
    syntax = Syntax(sql, "sql", theme="monokai", line_numbers=line_numbers, word_wrap=True)
    if title:
        console.print(Panel(syntax, title=title, border_style="blue"))
    else:
        console.print(syntax)


def print_diff(before: str, after: str, title: str = "SQL Fix") -> None:
    """Print before/after SQL comparison"""
    table = Table(title=title, box=box.ROUNDED, show_header=True, header_style="bold magenta")
    table.add_column("Before", style="red", width=50)
    table.add_column("After", style="green", width=50)
    
    before_syntax = Syntax(before, "sql", theme="monokai", word_wrap=True)
    after_syntax = Syntax(after, "sql", theme="monokai", word_wrap=True)
    
    table.add_row(before_syntax, after_syntax)
    console.print(table)


def print_table(data: list[dict[str, Any]], title: Optional[str] = None) -> None:
    """Print data as a formatted table"""
    if not data:
        print_warning("No data to display")
        return
    
    table = Table(title=title, box=box.ROUNDED, show_header=True, header_style="bold cyan")
    
    # Add columns from first row
    for key in data[0].keys():
        table.add_column(str(key).replace("_", " ").title(), style="white")
    
    # Add rows
    for row in data:
        table.add_row(*[str(v) for v in row.values()])
    
    console.print(table)


def print_panel(content: str, title: str, style: str = "blue") -> None:
    """Print content in a panel"""
    console.print(Panel(content, title=title, border_style=style))


def confirm(message: str, default: bool = False) -> bool:
    """Ask for confirmation"""
    return Confirm.ask(message, default=default)


def prompt(message: str, default: Optional[str] = None, password: bool = False) -> str:
    """Prompt for user input"""
    return Prompt.ask(message, default=default, password=password)


def create_progress() -> Progress:
    """Create a progress bar"""
    return Progress(
        SpinnerColumn(),
        TextColumn("[progress.description]{task.description}"),
        BarColumn(),
        TextColumn("[progress.percentage]{task.percentage:>3.0f}%"),
        console=console,
    )


def print_header(text: str) -> None:
    """Print a styled header"""
    console.print()
    console.print(f"[bold cyan]{text}[/bold cyan]")
    console.print("─" * len(text), style="cyan")


def print_status_table(data: dict[str, Any], title: str = "Status") -> None:
    """Print status information as a key-value table"""
    table = Table(title=title, box=box.ROUNDED, show_header=False)
    table.add_column("Property", style="cyan", width=30)
    table.add_column("Value", style="white")
    
    for key, value in data.items():
        formatted_key = str(key).replace("_", " ").title()
        formatted_value = str(value)
        
        # Color code based on value
        if isinstance(value, bool):
            formatted_value = "✓ Yes" if value else "✗ No"
            style = "green" if value else "red"
            table.add_row(formatted_key, f"[{style}]{formatted_value}[/{style}]")
        else:
            table.add_row(formatted_key, formatted_value)
    
    console.print(table)


def print_logo() -> None:
    """Print ZenDBX logo"""
    logo = """
    ╔════════════════════════════════════════╗
    ║                                        ║
    ║   ███████╗███████╗███╗   ██╗██████╗    ║
    ║   ╚══███╔╝██╔════╝████╗  ██║██╔══██╗   ║
    ║     ███╔╝ █████╗  ██╔██╗ ██║██║  ██║   ║
    ║    ███╔╝  ██╔══╝  ██║╚██╗██║██║  ██║   ║
    ║   ███████╗███████╗██║ ╚████║██████╔╝   ║
    ║   ╚══════╝╚══════╝╚═╝  ╚═══╝╚═════╝    ║
    ║                                        ║
    ║   ██████╗ ██████╗ ██╗  ██╗             ║
    ║   ██╔══██╗██╔══██╗╚██╗██╔╝             ║
    ║   ██║  ██║██████╔╝ ╚███╔╝              ║
    ║   ██║  ██║██╔══██╗ ██╔██╗              ║
    ║   ██████╔╝██████╔╝██╔╝ ██╗             ║
    ║   ╚═════╝ ╚═════╝ ╚═╝  ╚═╝             ║
    ║                                        ║
    ║   Query fails → ZenDBX fixes it        ║
    ║                                        ║
    ╚════════════════════════════════════════╝
    """
    console.print(logo, style="bold cyan")
