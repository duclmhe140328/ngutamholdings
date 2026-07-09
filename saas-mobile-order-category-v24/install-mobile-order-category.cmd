@echo off
setlocal
set SCRIPT_DIR=%~dp0
set PROJECT_ROOT=%SCRIPT_DIR%\
if exist "%SCRIPT_DIR%frontend\src\pages\ShopPage.jsx" goto found
if exist "%SCRIPT_DIR%..\frontend\src\pages\ShopPage.jsx" set PROJECT_ROOT=%SCRIPT_DIR%..\
:found
cd /d "%PROJECT_ROOT%"
node "%SCRIPT_DIR%patch-files\apply-mobile-order-category-patch.cjs"
if errorlevel 1 (
  echo.
  echo Patch failed. Copy the error and send it to ChatGPT.
  pause
  exit /b 1
)
echo.
echo DONE. Restart frontend: cd frontend ^&^& npm run dev
pause
