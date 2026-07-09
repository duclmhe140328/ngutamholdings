# v25 - Seller revenue/report tab

Adds a new dashboard tab for each shop:

- Completed paid revenue
- Outstanding/unfinished orders
- Unpaid order count
- Paid but not completed order count
- Full order list with filters
- Quick invoice open button

Install from project root:

```powershell
cd "E:\foodhub_v14_5_release\ngutamholdings"
Expand-Archive -LiteralPath "$env:USERPROFILE\Downloads\saas-seller-revenue-report-v25.zip" -DestinationPath "." -Force
.\saas-seller-revenue-report-v25\install-seller-revenue-report.cmd
```

Then restart frontend.
