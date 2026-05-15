@echo off
echo ========================================
echo Cleaning Up for Production Deployment
echo ========================================
echo.

echo Removing test files...
del /q backend\test_*.py 2>nul
del /q backend\debug_*.py 2>nul
del /q backend\check_*.py 2>nul
del /q backend\fix_*.py 2>nul
del /q backend\regenerate_*.py 2>nul
del /q backend\upgrade_*.py 2>nul

echo Removing debug scripts...
del /q backend\make_pg15_permanent.bat 2>nul
del /q backend\reset_pg17_password.bat 2>nul
del /q backend\restart_postgres.bat 2>nul
del /q backend\switch_to_pg15.bat 2>nul
del /q backend\setup_billing.bat 2>nul

echo Removing draft documentation...
del /q *_SUMMARY.md 2>nul
del /q *_FIX*.md 2>nul
del /q *_COMPLETE.md 2>nul
del /q *_GUIDE.md 2>nul
del /q *_TESTING*.md 2>nul
del /q *_IMPROVEMENTS.md 2>nul
del /q *_TRACKER.md 2>nul
del /q *_STEPS.md 2>nul
del /q *_WORKFLOW.md 2>nul
del /q *_CHECKLIST.md 2>nul
del /q *_TOGGLE*.md 2>nul
del /q *_PLAN.md 2>nul
del /q *_REPORT.md 2>nul
del /q *_REFERENCE.md 2>nul
del /q *_PROPOSAL.md 2>nul
del /q *_AFTER*.md 2>nul
del /q *_LIST.md 2>nul
del /q *_PART2.md 2>nul
del /q QUOTA_SYSTEM_SETUP_GUIDE.md 2>nul
del /q FIX_AUTH_ISSUE.md 2>nul

echo Removing test HTML files...
del /q test_*.html 2>nul

echo Removing query file...
del /q query 2>nul

echo Removing CLI test files...
del /q zendbx-cli\TEST_CLI.md 2>nul
del /q zendbx-cli\COMPLETION_CHECKLIST.md 2>nul
del /q zendbx-cli\PROJECT_SUMMARY.md 2>nul
del /q zendbx-cli\EXAMPLES.md 2>nul
del /q zendbx-cli\INSTALLATION_STEPS.md 2>nul
del /q zendbx-cli\test_installation.bat 2>nul
del /q zendbx-cli\install.bat 2>nul

echo.
echo ========================================
echo Cleanup Complete!
echo ========================================
echo.
echo Removed:
echo - Test files (test_*.py, debug_*.py)
echo - Debug scripts (*.bat in backend)
echo - Draft documentation (*_*.md)
echo - Test HTML files
echo - CLI test files
echo.
echo Keeping:
echo - Production code (app/, database/)
echo - Essential docs (README.md, DEPLOYMENT_SUMMARY.md)
echo - Deployment scripts (deploy.bat, start_all.bat)
echo - Configuration files (.env.example)
echo.
pause
