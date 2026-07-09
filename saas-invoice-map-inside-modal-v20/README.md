# Invoice map inside modal v20

- Replaces `frontend/src/components/InvoicePrintModal.jsx`.
- Removes the separate `OrderFulfillmentPanel` overlay from the invoice modal.
- Shows checkout pickup/delivery info inside the invoice modal and printed invoice.
- Uses the customer's pinned map coordinates if the order contains fields such as `deliveryLocation`, `shippingLocation`, `customerLocation`, `pinnedLocation`, `location`, `lat/lng`, or `coordinates`.

Run from project root:

```powershell
.\saas-invoice-map-inside-modal-v20\install-invoice-map-inside-modal.cmd
```
