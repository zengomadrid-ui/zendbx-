"""Doctor command - System health check and diagnostics"""

import sys
import shutil
import subprocess
from pathlib import Path
from typing import List, Dict, Any
from rich.console import Console
from rich.table import Table
from rich import box

from ..utils.console import print_header, print_success, print_error, print_warning, print_info
from ..config import config_manager


console = Console()


def doctor_command():
    """
    🩺 System health check
    
    Diagnoses system setup and project configuration.
    Provides actionable fixes for common issues.
    
    Checks:
      • Python installation
      • Node.js installation
      • Docker availability
      • Git configuration
      • PostgreSQL client
      • Network connectivity
      • ZenDBX authentication
      • Project configuration
      • Environment variables
      • Database connection
    
    Examples:
      zendbx doctor
    """
    print_header("ZenDBX System Diagnostics")
    
    console.print("[dim]Running comprehensive health check...[/dim]\n")
    
    checks = []
    
    # ========================================================================
    # SYSTEM CHECKS
    # ========================================================================
    
    # Python
    checks.append(_check_python())
    
    # Node.js
    checks.append(_check_node())
    
    # Docker
    checks.append(_check_docker())
    
    # Git
    checks.append(_check_git())
    
    # PostgreSQL client
    checks.append(_check_postgres())
    
    # ========================================================================
    # NETWORK CHECKS
    # ========================================================================
    
    # Internet connectivity
    checks.append(_check_network())
    
    # ZenDBX API
    checks.append(_check_zendbx_api())
    
    # ========================================================================
    # PROJECT CHECKS
    # ========================================================================
    
    # Authentication
    checks.append(_check_authentication())
    
    # Project configuration
    checks.append(_check_project_config())
    
    # Environment variables
    checks.append(_check_environment())
    
    # Database connection
    checks.append(_check_database_connection())
    
    # ========================================================================
    # DISPLAY RESULTS
    # ========================================================================
    
    console.print()
    _display_results(checks)
    
    # Summary
    console.print()
    passed = sum(1 for c in checks if c['status'] == 'pass')
    warnings = sum(1 for c in checks if c['status'] == 'warn')
    failed = sum(1 for c in checks if c['status'] == 'fail')
    
    if failed == 0 and warnings == 0:
        print_success(f"All checks passed! ({passed}/{len(checks)})")
    elif failed == 0:
        print_warning(f"{passed} passed, {warnings} warnings")
    else:
        print_error(f"{failed} checks failed, {warnings} warnings")
    
    # Suggestions
    console.print()
    console.print("[bold]Suggestions:[/bold]")
    
    suggestions = [c for c in checks if c.get('suggestion')]
    if suggestions:
        for check in suggestions:
            console.print(f"\n[yellow]•[/yellow] [bold]{check['name']}:[/bold]")
            console.print(f"  {check['suggestion']}")
    else:
        console.print("  [dim]No suggestions at this time[/dim]")
    
    console.print()
    
    # Exit code
    if failed > 0:
        raise SystemExit(1)


def _check_python() -> Dict[str, Any]:
    """Check Python installation"""
    try:
        version = sys.version.split()[0]
        major, minor = map(int, version.split('.')[:2])
        
        if major >= 3 and minor >= 8:
            return {
                'name': 'Python',
                'status': 'pass',
                'message': f'v{version}',
            }
        else:
            return {
                'name': 'Python',
                'status': 'warn',
                'message': f'v{version} (recommended: 3.8+)',
                'suggestion': 'Upgrade Python to 3.8 or higher'
            }
    except Exception as e:
        return {
            'name': 'Python',
            'status': 'fail',
            'message': 'Not found',
            'suggestion': 'Install Python 3.8 or higher'
        }


def _check_node() -> Dict[str, Any]:
    """Check Node.js installation"""
    try:
        result = subprocess.run(['node', '--version'], capture_output=True, text=True)
        if result.returncode == 0:
            version = result.stdout.strip()
            return {
                'name': 'Node.js',
                'status': 'pass',
                'message': version,
            }
        else:
            raise Exception()
    except:
        return {
            'name': 'Node.js',
            'status': 'warn',
            'message': 'Not found',
            'suggestion': 'Install Node.js for TypeScript features'
        }


def _check_docker() -> Dict[str, Any]:
    """Check Docker availability"""
    try:
        result = subprocess.run(['docker', '--version'], capture_output=True, text=True)
        if result.returncode == 0:
            version = result.stdout.strip()
            return {
                'name': 'Docker',
                'status': 'pass',
                'message': version,
            }
        else:
            raise Exception()
    except:
        return {
            'name': 'Docker',
            'status': 'warn',
            'message': 'Not found',
            'suggestion': 'Install Docker for containerized workflows'
        }


def _check_git() -> Dict[str, Any]:
    """Check Git installation"""
    try:
        result = subprocess.run(['git', '--version'], capture_output=True, text=True)
        if result.returncode == 0:
            version = result.stdout.strip()
            return {
                'name': 'Git',
                'status': 'pass',
                'message': version,
            }
        else:
            raise Exception()
    except:
        return {
            'name': 'Git',
            'status': 'fail',
            'message': 'Not found',
            'suggestion': 'Install Git: https://git-scm.com/'
        }


def _check_postgres() -> Dict[str, Any]:
    """Check PostgreSQL client"""
    try:
        result = subprocess.run(['psql', '--version'], capture_output=True, text=True)
        if result.returncode == 0:
            version = result.stdout.strip()
            return {
                'name': 'PostgreSQL Client',
                'status': 'pass',
                'message': version,
            }
        else:
            raise Exception()
    except:
        return {
            'name': 'PostgreSQL Client',
            'status': 'warn',
            'message': 'Not found',
            'suggestion': 'Install psql for direct database access'
        }


def _check_network() -> Dict[str, Any]:
    """Check internet connectivity"""
    try:
        import httpx
        response = httpx.get('https://www.google.com', timeout=5)
        if response.status_code == 200:
            return {
                'name': 'Internet',
                'status': 'pass',
                'message': 'Connected',
            }
        else:
            raise Exception()
    except:
        return {
            'name': 'Internet',
            'status': 'fail',
            'message': 'No connection',
            'suggestion': 'Check your internet connection'
        }


def _check_zendbx_api() -> Dict[str, Any]:
    """Check ZenDBX API availability"""
    try:
        import httpx
        import os
        api_url = os.getenv('ZENDBX_API_URL', 'http://localhost:8000')
        response = httpx.get(f'{api_url}/health', timeout=10)
        if response.status_code == 200:
            return {
                'name': 'ZenDBX API',
                'status': 'pass',
                'message': 'Available',
            }
        else:
            raise Exception()
    except:
        return {
            'name': 'ZenDBX API',
            'status': 'warn',
            'message': 'Unavailable',
            'suggestion': 'ZenDBX API may be down. Check status.zendbx.com'
        }


def _check_authentication() -> Dict[str, Any]:
    """Check authentication status"""
    try:
        from ..core.auth import AuthManager
        auth_manager = AuthManager()
        user = auth_manager.get_current_user()
        
        if user:
            return {
                'name': 'Authentication',
                'status': 'pass',
                'message': f"Logged in as {user.get('email', 'user')}",
            }
        else:
            return {
                'name': 'Authentication',
                'status': 'warn',
                'message': 'Not logged in',
                'suggestion': 'Run: zendbx login'
            }
    except:
        return {
            'name': 'Authentication',
            'status': 'warn',
            'message': 'Not logged in',
            'suggestion': 'Run: zendbx login'
        }


def _check_project_config() -> Dict[str, Any]:
    """Check project configuration"""
    zendbx_dir = Path('.zendbx')
    
    if zendbx_dir.exists() and (zendbx_dir / 'config.yaml').exists():
        return {
            'name': 'Project Config',
            'status': 'pass',
            'message': 'Found',
        }
    else:
        return {
            'name': 'Project Config',
            'status': 'warn',
            'message': 'Not found',
            'suggestion': 'Run: zendbx init or zendbx link <project>'
        }


def _check_environment() -> Dict[str, Any]:
    """Check environment variables"""
    env_file = Path('.env')
    
    if env_file.exists():
        return {
            'name': 'Environment',
            'status': 'pass',
            'message': '.env found',
        }
    else:
        return {
            'name': 'Environment',
            'status': 'warn',
            'message': '.env not found',
            'suggestion': 'Run: zendbx env pull'
        }


def _check_database_connection() -> Dict[str, Any]:
    """Check database connectivity"""
    try:
        from ..core.database_manager import DatabaseManager
        
        conn_string = config_manager.get_connection_string()
        db_manager = DatabaseManager(conn_string)
        
        info = db_manager.test_connection_sync()
        
        return {
            'name': 'Database',
            'status': 'pass',
            'message': f"Connected to {info.get('database', 'database')}",
        }
    except:
        return {
            'name': 'Database',
            'status': 'fail',
            'message': 'Connection failed',
            'suggestion': 'Check DATABASE_URL in .env or run: zendbx db status'
        }


def _display_results(checks: List[Dict[str, Any]]):
    """Display check results in a table"""
    table = Table(title="Diagnostic Results", box=box.ROUNDED, show_header=True)
    table.add_column("Check", style="cyan", width=25)
    table.add_column("Status", width=10)
    table.add_column("Details", style="dim")
    
    for check in checks:
        status = check['status']
        
        if status == 'pass':
            status_text = "[green]✓ PASS[/green]"
        elif status == 'warn':
            status_text = "[yellow]⚠ WARN[/yellow]"
        else:
            status_text = "[red]✗ FAIL[/red]"
        
        table.add_row(
            check['name'],
            status_text,
            check['message']
        )
    
    console.print(table)
