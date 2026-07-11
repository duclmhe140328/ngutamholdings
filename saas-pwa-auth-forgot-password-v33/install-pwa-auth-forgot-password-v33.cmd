@echo off
setlocal EnableExtensions
cd /d "%~dp0\.."

if not exist "backend\server.js" (
  echo [ERROR] Khong tim thay backend\server.js.
  echo Hay giai nen patch vao thu muc goc project ngutamholdings.
  pause
  exit /b 1
)

node "%~dp0patch-files\apply-pwa-auth-forgot-password-v33.cjs"
if errorlevel 1 (
  echo.
  echo [ERROR] Cai patch that bai. Gui toan bo log tren man hinh cho ChatGPT.
  pause
  exit /b 1
)

echo.
echo [DONE] Da cai PWA + auth multi-device + quen mat khau v33.
echo Chay lai npm run build va restart backend.
pause
endlocal
