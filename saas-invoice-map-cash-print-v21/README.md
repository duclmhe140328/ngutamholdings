# v21 - Invoice pinned map + cash print

- Removes the duplicated fulfillment modal from invoice UI.
- Shows checkout fulfillment info inside InvoicePrintModal.
- Extracts pinned map from many field shapes, including GeoJSON coordinates.
- Allows invoice printing for online cash/COD/pickup cash orders before paid/completed.

Install from project root:

```powershell
cd "E:\foodhub_v14_5_release\ngutamholdings"
Expand-Archive -LiteralPath "$env:USERPROFILE\Downloads\saas-invoice-map-cash-print-v21.zip" -DestinationPath "." -Force
.\saas-invoice-map-cash-print-v21\install-invoice-map-cash-print.cmd
```

Restart frontend:

```powershell
cd frontend
npm run dev
```
