@echo off
setlocal
cd /d "%~dp0\.."
node "%~dp0install-seller-pos-bill-v38.cjs"
if errorlevel 1 (
  echo.
  echo Cai patch that bai.
  pause
  exit /b 1
)
echo.
echo Cai patch v38 thanh cong.
pause
