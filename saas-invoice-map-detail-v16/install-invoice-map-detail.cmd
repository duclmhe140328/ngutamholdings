@echo off
setlocal
cd /d "%~dp0"
echo Running invoice map/detail patch v16...
node "%~dp0patch-files\apply-invoice-map-detail-patch.cjs"
if errorlevel 1 (
  echo Patch failed.
  pause
  exit /b 1
)
echo Patch done. Restart frontend/backend if needed.
pause
