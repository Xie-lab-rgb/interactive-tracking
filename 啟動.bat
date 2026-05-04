@echo off
chcp 65001 >nul
cd /d "%~dp0"
if not exist "node_modules\.bin\vite.cmd" (
  echo Installing dependencies...
  call npm install
  if errorlevel 1 (
    echo npm install failed. Check that Node.js is installed.
    pause
    exit /b 1
  )
)
echo Starting dev server (browser will open)...
call npm run dev
pause
