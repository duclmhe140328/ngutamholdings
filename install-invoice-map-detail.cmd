@echo off
setlocal
cd /d "%~dp0"
node .\patch-files\apply-invoice-map-detail-patch.cjs
if errorlevel 1 (
  echo.
  echo Patch failed. Send the error log to ChatGPT.
  pause
  exit /b 1
)
echo.
echo DONE. Restart frontend/backend, then open seller invoices.
pause
