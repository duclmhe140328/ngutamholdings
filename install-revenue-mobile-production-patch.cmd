@echo off
setlocal
cd /d "%~dp0"
echo SaaS Revenue Mobile Production Patch v10
node ".\patch-files\apply-revenue-mobile-production-patch.cjs"
if errorlevel 1 (
  echo.
  echo Patch failed.
  pause
  exit /b 1
)
echo.
echo DONE. Restart backend/frontend if they are running.
pause
