@echo off
setlocal
cd /d "%~dp0\.."
node "%~dp0\patch-files\apply-platform-marketing-v31.cjs"
if errorlevel 1 (
  echo.
  echo [ERROR] Patch failed. Copy the log above and send it to ChatGPT.
  pause
  exit /b 1
)
echo.
echo [DONE] Installed platform marketing v31.
pause
