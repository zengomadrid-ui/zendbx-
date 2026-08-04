"""Generator commands - Types, SDK, Models"""

import typer
from pathlib import Path
from typing import Optional
from rich.console import Console

from ..core.generators import TypeScriptGenerator, SDKGenerator, ModelGenerator
from ..utils.console import print_success, print_error, print_info, print_header

app = typer.Typer(help="🔨 Code generators")
console = Console()


@app.command(name="types")
def types_command(
    output: Path = typer.Option(Path("./types"), "--output", "-o", help="Output directory"),
    language: str = typer.Option("typescript", help="Language (typescript, go, rust)"),
):
    """
    📝 Generate TypeScript types from database schema
    
    Generates type-safe interfaces for your database tables.
    
    Examples:
      zendbx gen types
      zendbx gen types --output ./src/types
      zendbx gen types --language rust
    """
    print_header("Generate Types")
    
    try:
        generator = TypeScriptGenerator()
        
        with console.status("[cyan]Loading schema..."):
            schema = generator.load_schema()
        
        with console.status(f"[cyan]Generating {language} types..."):
            files = generator.generate(schema, language=language, output_dir=output)
        
        print_success(f"Generated {len(files)} type file(s)")
        
        console.print()
        for file in files:
            console.print(f"  [cyan]✓[/cyan] {file}")
        
        console.print()
        print_info(f"Types saved to: {output}")
        
    except Exception as e:
        print_error(f"Generation failed: {e}")
        raise typer.Exit(1)


@app.command(name="sdk")
def sdk_command(
    output: Path = typer.Option(Path("./sdk"), "--output", "-o", help="Output directory"),
    language: str = typer.Option("typescript", help="Language (typescript, python, go)"),
):
    """
    🛠️  Generate SDK/API client
    
    Creates a fully-typed API client for your project.
    
    Examples:
      zendbx gen sdk
      zendbx gen sdk --language python
      zendbx gen sdk --output ./lib/api
    """
    print_header("Generate SDK")
    
    try:
        generator = SDKGenerator()
        
        with console.status("[cyan]Loading project configuration..."):
            config = generator.load_config()
        
        with console.status(f"[cyan]Generating {language} SDK..."):
            files = generator.generate(config, language=language, output_dir=output)
        
        print_success(f"Generated SDK with {len(files)} file(s)")
        
        console.print()
        console.print("[bold]Features included:[/bold]")
        console.print("  • Database operations (CRUD)")
        console.print("  • Authentication helpers")
        console.print("  • Realtime subscriptions")
        console.print("  • Storage management")
        console.print("  • Type-safe queries")
        
        console.print()
        print_info(f"SDK saved to: {output}")
        
        # Show usage example
        console.print()
        console.print("[bold]Usage:[/bold]")
        if language == "typescript":
            console.print("  [dim]import { createClient } from './sdk'[/dim]")
            console.print("  [dim]const client = createClient({ url: '...' })[/dim]")
        elif language == "python":
            console.print("  [dim]from sdk import create_client[/dim]")
            console.print("  [dim]client = create_client(url='...'[/dim]")
        
    except Exception as e:
        print_error(f"Generation failed: {e}")
        raise typer.Exit(1)


@app.command(name="models")
def models_command(
    output: Path = typer.Option(Path("./models"), "--output", "-o", help="Output directory"),
    language: str = typer.Option("typescript", help="Language (typescript, python)"),
):
    """
    🏗️  Generate model classes
    
    Creates ORM-style model classes with validation and helpers.
    
    Examples:
      zendbx gen models
      zendbx gen models --language python
      zendbx gen models --output ./src/models
    """
    print_header("Generate Models")
    
    try:
        generator = ModelGenerator()
        
        with console.status("[cyan]Loading schema..."):
            schema = generator.load_schema()
        
        with console.status(f"[cyan]Generating {language} models..."):
            files = generator.generate(schema, language=language, output_dir=output)
        
        print_success(f"Generated {len(files)} model file(s)")
        
        console.print()
        console.print("[bold]Features included:[/bold]")
        console.print("  • Type-safe properties")
        console.print("  • Validation methods")
        console.print("  • CRUD operations")
        console.print("  • Relationship helpers")
        console.print("  • JSON serialization")
        
        console.print()
        for file in files:
            console.print(f"  [cyan]✓[/cyan] {file}")
        
        console.print()
        print_info(f"Models saved to: {output}")
        
    except Exception as e:
        print_error(f"Generation failed: {e}")
        raise typer.Exit(1)
