"""Update command - Self-update CLI"""

import sys
import subprocess
from rich.console import Console

from ..version import VERSION
from ..utils.console import print_success, print_error, print_info, print_header, confirm


console = Console()


def update_command():
    """
    ⬆️  Update CLI to latest version
    
    Checks for updates and installs the latest version.
    
    Examples:
      zendbx update
    """
    print_header("Check for Updates")
    
    try:
        # Check current version
        console.print(f"[dim]Current version: {VERSION}[/dim]\n")
        
        # Check latest version from PyPI
        with console.status("[cyan]Checking for updates..."):
            import httpx
            response = httpx.get('https://pypi.org/pypi/zendbx/json', timeout=10)
            
            if response.status_code != 200:
                print_error("Failed to check for updates")
                raise SystemExit(1)
            
            data = response.json()
            latest_version = data['info']['version']
        
        console.print(f"[cyan]Latest version: {latest_version}[/cyan]\n")
        
        # Compare versions
        if latest_version == VERSION:
            print_success("You're running the latest version!")
            raise SystemExit(0)
        
        # Confirm update
        console.print("[yellow]New version available![/yellow]\n")
        console.print("[bold]What's New:[/bold]")
        
        # Show release notes (if available)
        releases = data.get('releases', {}).get(latest_version, [])
        if releases and releases[0].get('comment_text'):
            console.print(releases[0]['comment_text'])
        else:
            console.print("[dim]See: https://github.com/zendbx/zendbx-cli/releases[/dim]")
        
        console.print()
        
        if not confirm(f"Update to v{latest_version}?"):
            print_info("Update cancelled")
            raise SystemExit(0)
        
        # Perform update
        console.print()
        with console.status("[cyan]Updating CLI..."):
            result = subprocess.run(
                [sys.executable, '-m', 'pip', 'install', '--upgrade', 'zendbx'],
                capture_output=True,
                text=True
            )
        
        if result.returncode == 0:
            print_success(f"Updated to v{latest_version}!")
            console.print("\n[dim]Restart your terminal for changes to take effect[/dim]")
        else:
            print_error("Update failed")
            console.print(f"\n[dim]{result.stderr}[/dim]")
            raise SystemExit(1)
    
    except KeyboardInterrupt:
        console.print("\n[yellow]Update cancelled[/yellow]")
        raise SystemExit(130)
    except Exception as e:
        print_error(f"Update failed: {e}")
        raise SystemExit(1)
