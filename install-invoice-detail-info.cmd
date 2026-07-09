@echo off
setlocal
cd /d "%~dp0"
echo Installing invoice detail info patch v14...
node .\patch-files\apply-invoice-detail-info-patch.cjs
if errorlevel 1 (
  echo Patch failed.
  pause
  exit /b 1
)
echo Done.
pause
