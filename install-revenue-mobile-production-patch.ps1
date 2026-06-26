# SaaS Revenue Mobile Production Patch Installer v10
$ErrorActionPreference = "Stop"
Set-Location -LiteralPath $PSScriptRoot
Write-Host "SaaS Revenue Mobile Production Patch v10"
node ".\patch-files\apply-revenue-mobile-production-patch.cjs"
Write-Host "DONE. Restart backend/frontend if they are running."
