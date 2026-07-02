@echo off
setlocal
cd /d "%~dp0"
echo [FoodHub Patch v12] Admin chat always visible for new shops
node .\patch-files\apply-admin-chat-always-visible.cjs
if errorlevel 1 (
  echo.
  echo Patch failed. Please send the error above.
  pause
  exit /b 1
)
echo.
echo DONE. Restart frontend/backend if they are running.
pause
