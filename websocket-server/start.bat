@echo off
echo ========================================
echo   Zendbx WebSocket Server
echo ========================================
echo.

REM Check if node_modules exists
if not exist "node_modules\" (
    echo Installing dependencies...
    call npm install
    echo.
)

echo Starting WebSocket server...
echo Server will run on http://localhost:8001
echo.
echo Press Ctrl+C to stop the server
echo.

npm run dev
