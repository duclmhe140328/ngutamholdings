@echo off
setlocal
cd /d "%~dp0\.."
if not exist "frontend\src\components\InvoicePrintModal.jsx" (
  echo [ERROR] Khong tim thay frontend\src\components\InvoicePrintModal.jsx
  exit /b 1
)
if not exist "patch-backups" mkdir "patch-backups"
copy /Y "frontend\src\components\InvoicePrintModal.jsx" "patch-backups\InvoicePrintModal.before-v30.jsx" >nul
copy /Y "%~dp0InvoicePrintModal.jsx" "frontend\src\components\InvoicePrintModal.jsx" >nul
echo [OK] Updated frontend\src\components\InvoicePrintModal.jsx
echo [DONE] Invoice print is compact one-page with small shop QR matching invoice total.
endlocal
