SaaS invoice map detail patch v17

Install:
cd "E:\foodhub_v14_5_release\ngutamholdings"
Expand-Archive -LiteralPath "$env:USERPROFILE\Downloads\saas-invoice-map-detail-v17.zip" -DestinationPath "." -Force
.\install-invoice-map-detail.cmd

Fallback:
node .\patch-files\apply-invoice-map-detail-patch.cjs
