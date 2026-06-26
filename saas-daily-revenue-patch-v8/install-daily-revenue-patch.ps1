# SaaS Daily Revenue Patch Installer v8 - ASCII only
$ErrorActionPreference = "Stop"
$root = Split-Path -Parent $MyInvocation.MyCommand.Path
Set-Location $root
node .\patch-files\apply-daily-revenue-patch.cjs
