@echo off
setlocal
node "%~dp0patch-files\apply-invoice-map-inside-modal-patch.cjs"
if errorlevel 1 (
  echo.
  echo Patch failed. Copy the error and send it to ChatGPT.
  exit /b 1
)
echo.
echo Done. Restart frontend: cd frontend && npm run dev
