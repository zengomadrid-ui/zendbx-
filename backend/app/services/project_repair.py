"""
Project Repair and Diagnostic Service

Scans for orphaned or incomplete projects and generates diagnostic reports.
Does NOT automatically repair — only reports issues for manual resolution.

Detects:
- Orphaned project rows (no schema)
- Missing schemas (project row exists but schema missing)
- Missing metadata tables
- Missing API keys
- Missing quota rows
- Incomplete provisioning (partial state)
"""

import asyncpg
import logging
from typing import Dict, List
from uuid import UUID
from dataclasses import dataclass, asdict

logger = logging.getLogger(__name__)


@dataclass
class ProjectIssue:
    """Represents an issue found with a project"""
    project_id: str
    project_name: str
    project_slug: str
    database_name: str
    schema_name: str
    issue_type: str
    description: str
    severity: str  # 'critical', 'warning', 'info'


class ProjectDiagnostic:
    """Diagnostic service for project provisioning issues"""
    
    def __init__(self, database_url: str):
        self.database_url = database_url
    
    async def check_schema_exists(
        self,
        conn: asyncpg.Connection,
        schema_name: str
    ) -> bool:
        """Check if a schema exists"""
        result = await conn.fetchval(
            """
            SELECT EXISTS(
                SELECT 1 FROM information_schema.schemata
                WHERE schema_name = $1
            )
            """,
            schema_name
        )
        return bool(result)
    
    async def check_table_exists(
        self,
        conn: asyncpg.Connection,
        schema_name: str,
        table_name: str
    ) -> bool:
        """Check if a table exists in a schema"""
        result = await conn.fetchval(
            """
            SELECT EXISTS(
                SELECT 1 FROM information_schema.tables
                WHERE table_schema = $1 AND table_name = $2
            )
            """,
            schema_name,
            table_name
        )
        return bool(result)
    
    async def get_api_key_count(
        self,
        conn: asyncpg.Connection,
        project_id: UUID
    ) -> Dict[str, int]:
        """Get count of API keys by type for a project"""
        result = await conn.fetch(
            """
            SELECT key_type, COUNT(*) as count
            FROM api_keys
            WHERE project_id = $1 AND is_active = true
            GROUP BY key_type
            """,
            project_id
        )
        
        return {row['key_type']: row['count'] for row in result}
    
    async def check_quota_exists(
        self,
        conn: asyncpg.Connection,
        project_id: UUID
    ) -> bool:
        """Check if quota row exists for project"""
        result = await conn.fetchval(
            """
            SELECT EXISTS(
                SELECT 1 FROM project_quotas
                WHERE project_id = $1
            )
            """,
            project_id
        )
        return bool(result)
    
    async def scan_project(
        self,
        conn: asyncpg.Connection,
        project: Dict
    ) -> List[ProjectIssue]:
        """
        Scan a single project for issues.
        
        Returns list of issues found (empty if project is healthy)
        """
        issues = []
        project_id = project['id']
        schema_name = project['schema_name'] or project['database_name']
        
        # Check 1: Schema exists
        schema_exists = await self.check_schema_exists(conn, schema_name)
        if not schema_exists:
            issues.append(ProjectIssue(
                project_id=str(project_id),
                project_name=project['name'],
                project_slug=project['slug'] or '',
                database_name=project['database_name'],
                schema_name=schema_name,
                issue_type='missing_schema',
                description=f"Schema '{schema_name}' does not exist",
                severity='critical'
            ))
            # If schema doesn't exist, no point checking tables
            return issues
        
        # Check 2: Metadata table exists
        metadata_exists = await self.check_table_exists(
            conn, schema_name, '_zendbx_metadata'
        )
        if not metadata_exists:
            issues.append(ProjectIssue(
                project_id=str(project_id),
                project_name=project['name'],
                project_slug=project['slug'] or '',
                database_name=project['database_name'],
                schema_name=schema_name,
                issue_type='missing_metadata',
                description=f"Metadata table missing in schema '{schema_name}'",
                severity='critical'
            ))
        
        # Check 3: API keys exist
        key_counts = await self.get_api_key_count(conn, project_id)
        
        if 'anon' not in key_counts or key_counts['anon'] == 0:
            issues.append(ProjectIssue(
                project_id=str(project_id),
                project_name=project['name'],
                project_slug=project['slug'] or '',
                database_name=project['database_name'],
                schema_name=schema_name,
                issue_type='missing_anon_key',
                description="Missing 'anon' API key",
                severity='critical'
            ))
        
        if 'service_role' not in key_counts or key_counts['service_role'] == 0:
            issues.append(ProjectIssue(
                project_id=str(project_id),
                project_name=project['name'],
                project_slug=project['slug'] or '',
                database_name=project['database_name'],
                schema_name=schema_name,
                issue_type='missing_service_role_key',
                description="Missing 'service_role' API key",
                severity='critical'
            ))
        
        # Check 4: Quota row exists
        quota_exists = await self.check_quota_exists(conn, project_id)
        if not quota_exists:
            issues.append(ProjectIssue(
                project_id=str(project_id),
                project_name=project['name'],
                project_slug=project['slug'] or '',
                database_name=project['database_name'],
                schema_name=schema_name,
                issue_type='missing_quota',
                description="Quota tracking row missing",
                severity='warning'
            ))
        
        # Check 5: JWT secret exists
        if not project.get('jwt_secret'):
            issues.append(ProjectIssue(
                project_id=str(project_id),
                project_name=project['name'],
                project_slug=project['slug'] or '',
                database_name=project['database_name'],
                schema_name=schema_name,
                issue_type='missing_jwt_secret',
                description="JWT secret not configured",
                severity='critical'
            ))
        
        # Check 6: Slug exists
        if not project.get('slug') or project['slug'] == '':
            issues.append(ProjectIssue(
                project_id=str(project_id),
                project_name=project['name'],
                project_slug='',
                database_name=project['database_name'],
                schema_name=schema_name,
                issue_type='missing_slug',
                description="Project slug not set",
                severity='warning'
            ))
        
        return issues
    
    async def scan_all_projects(self) -> Dict:
        """
        Scan all projects and generate comprehensive diagnostic report.
        
        Returns:
            Dict with:
                - total_projects: int
                - healthy_projects: int
                - projects_with_issues: int
                - issues: List[ProjectIssue]
                - summary: Dict[str, int] (issue counts by type)
        """
        conn = None
        
        try:
            logger.info("Starting project diagnostic scan")
            conn = await asyncpg.connect(self.database_url)
            
            # Get all projects
            projects = await conn.fetch(
                """
                SELECT id, user_id, name, slug, database_name,
                       schema_name, jwt_secret, status, created_at
                FROM projects
                ORDER BY created_at DESC
                """
            )
            
            total_projects = len(projects)
            all_issues = []
            
            # Scan each project
            for project in projects:
                project_dict = dict(project)
                issues = await self.scan_project(conn, project_dict)
                all_issues.extend(issues)
            
            # Calculate statistics
            projects_with_issues = len(set(issue.project_id for issue in all_issues))
            healthy_projects = total_projects - projects_with_issues
            
            # Group issues by type
            issue_summary = {}
            for issue in all_issues:
                issue_summary[issue.issue_type] = issue_summary.get(issue.issue_type, 0) + 1
            
            # Group issues by severity
            severity_summary = {}
            for issue in all_issues:
                severity_summary[issue.severity] = severity_summary.get(issue.severity, 0) + 1
            
            logger.info(f"Diagnostic scan complete: {total_projects} projects scanned, "
                       f"{projects_with_issues} with issues")
            
            return {
                'total_projects': total_projects,
                'healthy_projects': healthy_projects,
                'projects_with_issues': projects_with_issues,
                'issues': [asdict(issue) for issue in all_issues],
                'issue_summary': issue_summary,
                'severity_summary': severity_summary
            }
            
        except Exception as e:
            logger.error(f"Diagnostic scan failed: {e}")
            raise
            
        finally:
            if conn:
                await conn.close()
    
    async def scan_project_by_id(self, project_id: UUID) -> Dict:
        """
        Scan a specific project by ID.
        
        Returns:
            Dict with:
                - project: project details
                - issues: List[ProjectIssue]
                - status: 'healthy' or 'has_issues'
        """
        conn = None
        
        try:
            logger.info(f"Scanning project: {project_id}")
            conn = await asyncpg.connect(self.database_url)
            
            # Get project
            project = await conn.fetchrow(
                """
                SELECT id, user_id, name, slug, database_name,
                       schema_name, jwt_secret, status, created_at
                FROM projects
                WHERE id = $1
                """,
                project_id
            )
            
            if not project:
                return {
                    'error': 'Project not found',
                    'project_id': str(project_id)
                }
            
            project_dict = dict(project)
            issues = await self.scan_project(conn, project_dict)
            
            return {
                'project': {
                    'id': str(project_dict['id']),
                    'name': project_dict['name'],
                    'slug': project_dict['slug'],
                    'database_name': project_dict['database_name'],
                    'schema_name': project_dict['schema_name'],
                    'status': project_dict['status']
                },
                'issues': [asdict(issue) for issue in issues],
                'status': 'healthy' if len(issues) == 0 else 'has_issues'
            }
            
        except Exception as e:
            logger.error(f"Project scan failed for {project_id}: {e}")
            raise
            
        finally:
            if conn:
                await conn.close()
    
    async def find_orphaned_schemas(self) -> List[str]:
        """
        Find schemas that exist in database but have no corresponding project row.
        
        Returns:
            List of orphaned schema names
        """
        conn = None
        
        try:
            logger.info("Searching for orphaned schemas")
            conn = await asyncpg.connect(self.database_url)
            
            # Get all schemas that look like project schemas
            all_schemas = await conn.fetch(
                """
                SELECT schema_name
                FROM information_schema.schemata
                WHERE schema_name LIKE 'proj_%'
                   OR schema_name ~ '^[a-z0-9]+_[a-f0-9]{8}$'
                """
            )
            
            # Get all registered project schemas
            registered_schemas = await conn.fetch(
                """
                SELECT DISTINCT COALESCE(schema_name, database_name) as schema_name
                FROM projects
                """
            )
            
            registered_set = {row['schema_name'] for row in registered_schemas}
            orphaned = [
                row['schema_name'] for row in all_schemas
                if row['schema_name'] not in registered_set
            ]
            
            logger.info(f"Found {len(orphaned)} orphaned schemas")
            return orphaned
            
        except Exception as e:
            logger.error(f"Orphaned schema search failed: {e}")
            raise
            
        finally:
            if conn:
                await conn.close()


async def generate_diagnostic_report(database_url: str) -> str:
    """
    Generate human-readable diagnostic report.
    
    Returns:
        Formatted text report
    """
    diagnostic = ProjectDiagnostic(database_url)
    
    # Scan all projects
    scan_result = await diagnostic.scan_all_projects()
    
    # Find orphaned schemas
    orphaned_schemas = await diagnostic.find_orphaned_schemas()
    
    # Build report
    report_lines = []
    report_lines.append("=" * 80)
    report_lines.append("PROJECT PROVISIONING DIAGNOSTIC REPORT")
    report_lines.append("=" * 80)
    report_lines.append("")
    
    # Summary
    report_lines.append("SUMMARY")
    report_lines.append("-" * 80)
    report_lines.append(f"Total Projects:          {scan_result['total_projects']}")
    report_lines.append(f"Healthy Projects:        {scan_result['healthy_projects']}")
    report_lines.append(f"Projects with Issues:    {scan_result['projects_with_issues']}")
    report_lines.append(f"Orphaned Schemas:        {len(orphaned_schemas)}")
    report_lines.append("")
    
    # Severity breakdown
    if scan_result['severity_summary']:
        report_lines.append("ISSUE SEVERITY BREAKDOWN")
        report_lines.append("-" * 80)
        for severity, count in scan_result['severity_summary'].items():
            report_lines.append(f"  {severity.upper():12} {count:4} issues")
        report_lines.append("")
    
    # Issue type breakdown
    if scan_result['issue_summary']:
        report_lines.append("ISSUE TYPE BREAKDOWN")
        report_lines.append("-" * 80)
        for issue_type, count in sorted(scan_result['issue_summary'].items()):
            report_lines.append(f"  {issue_type:30} {count:4} occurrences")
        report_lines.append("")
    
    # Orphaned schemas
    if orphaned_schemas:
        report_lines.append("ORPHANED SCHEMAS (no project row)")
        report_lines.append("-" * 80)
        for schema in orphaned_schemas:
            report_lines.append(f"  - {schema}")
        report_lines.append("")
    
    # Detailed issues
    if scan_result['issues']:
        report_lines.append("DETAILED ISSUES")
        report_lines.append("-" * 80)
        
        # Group by project
        issues_by_project = {}
        for issue in scan_result['issues']:
            pid = issue['project_id']
            if pid not in issues_by_project:
                issues_by_project[pid] = []
            issues_by_project[pid].append(issue)
        
        for project_id, issues in issues_by_project.items():
            first_issue = issues[0]
            report_lines.append(f"\nProject: {first_issue['project_name']}")
            report_lines.append(f"  ID:     {project_id}")
            report_lines.append(f"  Slug:   {first_issue['project_slug']}")
            report_lines.append(f"  Schema: {first_issue['schema_name']}")
            report_lines.append(f"  Issues: {len(issues)}")
            
            for issue in issues:
                severity_marker = {
                    'critical': '🔴',
                    'warning': '⚠️',
                    'info': 'ℹ️'
                }.get(issue['severity'], '•')
                
                report_lines.append(
                    f"    {severity_marker} [{issue['severity'].upper()}] "
                    f"{issue['issue_type']}: {issue['description']}"
                )
    
    report_lines.append("")
    report_lines.append("=" * 80)
    report_lines.append("END OF REPORT")
    report_lines.append("=" * 80)
    
    return "\n".join(report_lines)
