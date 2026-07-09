@echo off
setlocal EnableExtensions
cd /d "%~dp0\.."

if not exist "frontend\src" (
  echo [ERROR] Khong tim thay thu muc frontend\src. Hay giai nen patch vao thu muc goc project ngutamholdings roi chay lai.
  pause
  exit /b 1
)

powershell -NoProfile -ExecutionPolicy Bypass -File "%~dp0install-pwa-safe-area.ps1"
if errorlevel 1 (
  echo [ERROR] Cai patch that bai.
  pause
  exit /b 1
)

echo [DONE] PWA safe area Dynamic Island fix v32-fixed installed.
endlocal
