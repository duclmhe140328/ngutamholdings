@echo off
setlocal
cd /d "%~dp0"
node patch-files\apply-daily-revenue-patch.cjs
pause
