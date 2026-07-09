@echo off
setlocal
cd /d "%~dp0\.."
node "%~dp0\patch-invoice-shop-bank-qr.js"
if errorlevel 1 (
  echo.
  echo [ERROR] Patch failed.
  pause
  exit /b 1
)
echo.
echo [DONE] Invoice print now includes shop bank QR with exact invoice amount.
pause
