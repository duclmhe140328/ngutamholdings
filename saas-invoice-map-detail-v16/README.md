# SaaS Invoice Map Detail v16

Run from project root:

```powershell
cd "E:\foodhub_v14_5_release\ngutamholdings"
.\install-invoice-map-detail.cmd
```

This patch:
- Adds `OrderFulfillmentPanel.jsx`.
- Patches `SellerDashboard` so clicking an invoice opens full detail.
- Shows pickup time/note for pickup orders.
- Shows address/location/map for delivery orders.
- Does not hardcode localhost.

If map is still missing after this patch, the checkout backend is not saving location/address into the order document. Send the checkout submit code or order creation route.
