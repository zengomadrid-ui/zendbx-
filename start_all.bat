@echo off
echo ========================================
echo Starting ZenDBX Services
echo ========================================
echo.

REM Check if Redis is running
redis-cli ping >nul 2>&1
if errorlevel 1 (
    echo Starting Redis...
    start "Redis" redis-server
    timeout /t 2 >nul
)
echo [OK] Redis running

REM Start Backend
echo Starting Backend API...
start "ZenDBX Backend" cmd /k "cd backend && uvicorn app.main:app --reload --host 0.0.0.0 --port 8000"
timeout /t 3 >nul

REM Start Frontend
echo Starting Frontend...
start "ZenDBX Frontend" cmd /k "cd frontend && npm run dev"
timeout /t 3 >nul

REM Start WebSocket Server
echo Starting WebSocket Server...
start "ZenDBX WebSocket" cmd /k "cd websocket-server && node server.js"

echo.
echo ========================================
echo All Services Started!
echo ========================================
echo.
echo Services running:
echo - Backend API: http://localhost:8000
echo - Frontend: http://localhost:3000
echo - WebSocket: ws://localhost:8080
echo - Redis: localhost:6379
echo.
echo Press any key to open the application...
pause >nul

start http://localhost:3000

echo.
echo To stop all services, close all terminal windows
echo or press Ctrl+C in each window
echo.
