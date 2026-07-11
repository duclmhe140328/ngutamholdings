@echo off
setlocal
cd /d "%~dp0.."
node ".\saas-device-image-upload-cloud-v34-fixed\install-device-image-upload-v34-fixed.cjs"
if errorlevel 1 exit /b 1
endlocal
