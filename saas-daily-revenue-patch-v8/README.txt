SaaS Daily Revenue Patch v8

Run from project root after extracting zip:

Option 1:
  .\install-daily-revenue-patch.cmd

Option 2:
  powershell -ExecutionPolicy Bypass -File .\install-daily-revenue-patch.ps1

Option 3:
  node .\patch-files\apply-daily-revenue-patch.cjs

After patch:
  Restart backend
  Open: http://localhost:5000/api/revenue/health
  Open: http://localhost:5000/admin-revenue.html

This version targets root server.js + public folder.
It injects route BEFORE app.use('/api' 404 handler.
