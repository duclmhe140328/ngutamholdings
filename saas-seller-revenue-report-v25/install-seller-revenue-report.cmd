@echo off
setlocal
cd /d "%~dp0.."
node "%~dp0patch-seller-revenue-report.cjs"
if errorlevel 1 (
  echo.
  echo [ERROR] Patch failed. Copy the error above and send it to ChatGPT.
  pause
  exit /b 1
)
echo.
echo [DONE] Added seller revenue/report tab.
pause
