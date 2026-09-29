@echo off
set PATH=C:\Users\Dev13\nodejs\node-v22.16.0-win-x64;%PATH%
cd /d D:\RTX\rtx5-broker-admin-ui
call npm run build
if errorlevel 1 (
    echo Build failed
    pause
    exit /b 1
)
echo Starting server on port 3001...
set PORT=3001
node server.js
