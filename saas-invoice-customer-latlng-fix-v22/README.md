# saas-invoice-customer-latlng-fix-v22

Fixes invoice/detail map not showing because backend saves coordinates as `customerLatitude` and `customerLongitude`,
while the previous invoice map reader only searched `lat/lng` or `latitude/longitude`.

Install from project root:

```powershell
Expand-Archive -LiteralPath "$env:USERPROFILE\Downloads\saas-invoice-customer-latlng-fix-v22.zip" -DestinationPath "." -Force
.\saas-invoice-customer-latlng-fix-v22\install-customer-latlng-fix.cmd
```
