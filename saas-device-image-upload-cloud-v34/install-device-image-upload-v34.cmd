@echo off
setlocal
cd /d "%~dp0.."
node "%~dp0install-device-image-upload-v34.cjs"
if errorlevel 1 (
  echo.
  echo Cai dat that bai. Xem dong ERROR phia tren.
  pause
  exit /b 1
)
echo.
echo Cai dat thanh cong.
pause
