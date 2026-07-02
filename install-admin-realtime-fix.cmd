@echo off
setlocal
cd /d "%~dp0"
echo [INFO] Installing admin realtime chat fix v13...
node .\patch-files\apply-admin-realtime-fix.cjs
if errorlevel 1 (
  echo [ERROR] Patch failed.
  exit /b 1
)
echo [DONE] Admin realtime chat fix v13 installed.
echo Restart frontend/backend after this.
endlocal
