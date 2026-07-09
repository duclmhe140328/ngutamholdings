@echo off
setlocal
cd /d "%~dp0.."
node "%~dp0patch-sepay-va-account-fix.js"
if errorlevel 1 (
  echo.
  echo [FAILED] Patch failed. Copy the error above and send it to ChatGPT.
  exit /b 1
)
echo.
echo [DONE] SePay VA/account matching fixed. Restart backend now.
endlocal
