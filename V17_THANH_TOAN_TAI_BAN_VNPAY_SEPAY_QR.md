# V17 — Quy tắc thanh toán nhà hàng, VNPAY và chuyển khoản QR SePay

## 1. Đơn gọi món tại bàn

Khi khách quét QR bàn, checkout chỉ hiển thị:

- **Tiền mặt**: nhân viên thu tiền tại bàn/quầy và xác nhận sau.
- **Gửi món, thanh toán sau**: bỏ qua bước thanh toán, đơn vào POS ngay.

Backend cũng kiểm tra lại nên khách không thể sửa request để dùng VNPAY hoặc chuyển khoản QR cho đơn `dine_in`.

## 2. Đơn giao hàng, gửi hàng hoặc khách đến lấy

Các phương thức hiển thị đúng theo cấu hình Seller:

- Tiền mặt
- Chuyển khoản QR
- VNPAY

## 3. Chuyển khoản QR

Seller nhập trong Dashboard:

- Ngân hàng/mã ngân hàng, ví dụ `MBBank`, `VCB`, `970422`
- Số tài khoản
- Tên chủ tài khoản
- Bật SePay nếu muốn tự động xác nhận
- API Key webhook SePay

Mỗi đơn chuyển khoản có nội dung riêng bằng mã đơn, ví dụ `FH20260619ABC123`. Hệ thống tạo ảnh QR với số tiền và nội dung này.

## 4. Cấu hình webhook SePay

URL production:

```text
https://TEN-DOMAIN/api/payments/sepay-webhook
```

Trong SePay:

1. Vào **Webhooks → Thêm webhook**.
2. Sự kiện: **Có tiền vào**.
3. Chọn đúng tài khoản ngân hàng của shop.
4. URL webhook là URL phía trên.
5. Bảo mật: **API Key**.
6. API Key phải giống giá trị Seller nhập trong Dashboard, hoặc biến chung `SEPAY_WEBHOOK_API_KEY` trên Render.

Webhook phải trả HTTP 200 và `{ "success": true }`; source đã xử lý sẵn.

## 5. Biến môi trường

```env
SEPAY_WEBHOOK_API_KEY=
```

Biến này là API key chung toàn hệ thống. Nếu mỗi shop dùng tài khoản SePay riêng thì có thể nhập API key riêng trong Dashboard.

VNPAY:

```env
VNP_TMN_CODE=
VNP_HASH_SECRET=
VNP_URL=https://sandbox.vnpayment.vn/paymentv2/vpcpay.html
VNP_RETURN_URL=https://TEN-DOMAIN/api/payments/vnpay-return
CLIENT_URL=https://TEN-DOMAIN
```

## 6. Trạng thái tự động

### VNPAY thành công

- `paymentStatus = paid`
- Ghi `paidAt`
- Lưu mã giao dịch và ngân hàng
- Seller nhận Socket.IO, Web Push và Telegram
- Khách được cộng xu nếu số điện thoại hợp lệ

### SePay nhận đủ tiền

- `paymentStatus = paid`
- `bankReceivedAmount = tổng tiền đã nhận`
- Ghi thời gian thanh toán, gateway và mã tham chiếu
- Seller thấy rõ đã nhận bao nhiêu tiền
- Seller nhận Socket.IO, Web Push và Telegram

### SePay nhận thiếu tiền

- `paymentStatus = partial`
- Seller thấy số tiền đã nhận và số còn thiếu

## 7. Chống cộng trùng

Mỗi giao dịch webhook SePay được lưu theo `id` duy nhất. Nếu SePay retry cùng giao dịch, hệ thống trả thành công nhưng không cộng tiền lần hai.

## 8. Test webhook local

Dùng ngrok trỏ vào cổng đang phục vụ backend hoặc deploy lên Render, sau đó dùng tính năng gửi thử webhook trong SePay. Với API Key, header phải có dạng:

```text
Authorization: Apikey API_KEY_CUA_BAN
```
