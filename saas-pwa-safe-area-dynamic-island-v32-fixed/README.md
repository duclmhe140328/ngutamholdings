# PWA Safe Area Dynamic Island v32-fixed

Bản này sửa lỗi file .cmd cũ làm PowerShell hiểu nhầm dấu ^.

Cài:

```powershell
cd "E:\foodhub_v14_5_release\ngutamholdings"
Remove-Item .\saas-pwa-safe-area-dynamic-island-v32-fixed -Recurse -Force -ErrorAction SilentlyContinue
Expand-Archive -LiteralPath "$env:USERPROFILE\Downloads\saas-pwa-safe-area-dynamic-island-v32-fixed.zip" -DestinationPath "." -Force
.\saas-pwa-safe-area-dynamic-island-v32-fixed\install-pwa-safe-area.cmd
```
