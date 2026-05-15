@echo off
echo ========================================
echo ZenDBX Production Deployment Script
echo ========================================
echo.

echo Step 1: Checking Prerequisites...
echo.

REM Check Python
python --version >nul 2>&1
if errorlevel 1 (
    echo ERROR: Python not found!
    echo Please install Python 3.11+
    pause
    exit /b 1
)
echo [OK] Python installed

REM Check Node
node --version >nul 2>&1
if errorlevel 1 (
    echo ERROR: Node.js not found!
    echo Please install Node.js 18+
    pause
    exit /b 1
)
echo [OK] Node.js installed

REM Check PostgreSQL
psql --version >nul 2>&1
if errorlevel 1 (
    echo ERROR: PostgreSQL not found!
    echo Please install PostgreSQL 15+
    pause
    exit /b 1
)
echo [OK] PostgreSQL installed

REM Check Redis
redis-cli ping >nul 2>&1
if errorlevel 1 (
    echo WARNING: Redis not running!
    echo Starting Redis with Docker...
    docker run -d -p 6379:6379 --name zendbx-redis redis:latest
    timeout /t 3 >nul
)
echo [OK] Redis running

echo.
echo Step 2: Installing Backend Dependencies...
cd backend
pip install -r requirements.txt
if errorlevel 1 (
    echo ERROR: Failed to install backend dependencies
    pause
    exit /b 1
)
echo [OK] Backend dependencies installed

echo.
echo Step 3: Installing Frontend Dependencies...
cd ..\frontend
call npm install
if errorlevel 1 (
    echo ERROR: Failed to install frontend dependencies
    pause
    exit /b 1
)
echo [OK] Frontend dependencies installed

echo.
echo Step 4: Database Setup...
cd ..\backend

echo Creating database...
psql -U postgres -c "CREATE DATABASE zendbx_main;" 2>nul
echo Running migrations...
psql -U postgres -d zendbx_main -f database/init_main_database.sql
psql -U postgres -d zendbx_main -f database/add_quotas_and_billing.sql
psql -U postgres -d zendbx_main -f database/add_quota_overrides.sql

echo Seeding data...
python seed_subscription_plans.py

echo [OK] Database setup complete

echo.
echo Step 5: Building Frontend...
cd ..\frontend
call npm run build
if errorlevel 1 (
    echo ERROR: Frontend build failed
    pause
    exit /b 1
)
echo [OK] Frontend built successfully

echo.
echo ========================================
echo Deployment Complete!
echo ========================================
echo.
echo Next steps:
echo 1. Configure backend/.env with production settings
echo 2. Configure frontend/.env.local with production API URL
echo 3. Start services:
echo    - Backend: cd backend ^&^& uvicorn app.main:app --host 0.0.0.0 --port 8000
echo    - Frontend: cd frontend ^&^& npm start
echo    - WebSocket: cd websocket-server ^&^& node server.js
echo.
echo For detailed instructions, see PRODUCTION_DEPLOYMENT_READY.md
echo.
pause
