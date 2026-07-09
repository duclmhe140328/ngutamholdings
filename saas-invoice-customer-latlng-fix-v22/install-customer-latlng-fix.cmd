@echo off
setlocal
cd /d "%~dp0\.."
node "%~dp0patch-files\apply-customer-latlng-fix.cjs"
if errorlevel 1 (
  echo.
  echo Patch failed. Copy the error above and send it to ChatGPT.
  pause
  exit /b 1
)
echo.
echo Done. Restart frontend and backend if needed.
pause
