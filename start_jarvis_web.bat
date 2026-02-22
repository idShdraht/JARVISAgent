@echo off
title JARVIS Web Portal
chcp 65001 > nul
color 0B
echo.
echo   ╔══════════════════════════════════════════════╗
echo   ║   J.A.R.V.I.S — Web Setup Portal             ║
echo   ║   Developed by Balaraman                     ║
echo   ╚══════════════════════════════════════════════╝
echo.

cd /d "%~dp0web"

:: Check Node.js
where node >nul 2>&1
if errorlevel 1 (
  echo   [!] Node.js not found. Installing via winget...
  winget install -e --id OpenJS.NodeJS.LTS --silent
  echo   [*] Please re-run this script after Node.js installs.
  pause
  exit /b 1
)

:: Install deps if needed
if not exist "node_modules" (
  echo   [*] Installing dependencies...
  call npm install --no-fund --no-audit
)

:: Copy env if not present
if not exist ".env" (
  copy ".env.example" ".env" >nul
  echo   [!] .env created from template. Please open .env and fill in your
  echo       GOOGLE_CLIENT_ID and GOOGLE_CLIENT_SECRET before logging in.
  echo.
)

echo   [*] Starting JARVIS Web Portal on http://localhost:3000
echo.
start "" http://localhost:3000
node server.js
pause
