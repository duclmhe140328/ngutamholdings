@echo off
setlocal
cd /d "%~dp0\.."
node "%~dp0\patch-files\apply-invoice-map-cash-print-patch.cjs"
if errorlevel 1 (
  echo.
  echo Patch failed. Copy the error and send it to ChatGPT.
  pause
  exit /b 1
)
echo.
echo Done. Restart frontend: cd frontend ^&^& npm run dev
pause
