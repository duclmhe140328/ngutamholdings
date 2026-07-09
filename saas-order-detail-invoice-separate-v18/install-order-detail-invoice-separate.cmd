@echo off
setlocal
cd /d "%~dp0"
node .\patch-files\apply-order-detail-invoice-separate-patch.cjs
if errorlevel 1 (
  echo.
  echo Patch failed. Please copy the error above and send it to ChatGPT.
  exit /b 1
)
echo.
echo Done. Restart frontend: cd frontend && npm run dev
endlocal
