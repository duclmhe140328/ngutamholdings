# v29 - Invoice shop bank QR

Adds a shop bank VietQR block to the bottom of printed invoices.

- Uses shop bank fields: bankName/bankCode/bankId, bankAccountNumber, bankAccountName.
- QR amount is exactly invoice total (`totals.total`).
- QR transfer content is `order.paymentReference` or `order.orderCode`.
- Works for A4 and POS 80mm print views.
