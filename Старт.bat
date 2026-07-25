@echo off
:: Set code page to UTF-8 to handle text correctly
chcp 65001 >nul
cd /d "%~dp0"

title Bomberman PvP Server
echo ========================================
echo    Starting Bomberman PvP Server...
echo ========================================
echo.

echo Installing dependencies...
call npm install --silent

echo.
echo Server is running!
echo Open your browser at: http://127.0.0.1:3000
echo.

:: Automatically open the browser
start http://127.0.0.1:3000

echo (You can open another tab for player 2)
echo ========================================

node server.js

pause