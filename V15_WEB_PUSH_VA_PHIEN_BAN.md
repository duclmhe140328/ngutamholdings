# V15 — Web Push nền và phiên gọi món tại bàn

## 1. Thông báo khi đã đóng PWA

V15 bổ sung Web Push chuẩn VAPID. Socket.IO vẫn dùng khi Dashboard đang mở; Web Push dùng khi PWA ở nền, màn hình khóa hoặc trang không còn kết nối realtime.

### Cài package

```powershell
npm run install:all
```

Package backend mới: `web-push`.

### Tạo VAPID key

```powershell
npm run generate-vapid
```

Kết quả gồm Public Key và Private Key. Đưa vào `backend/.env` hoặc Render Environment:

```env
VAPID_PUBLIC_KEY=...
VAPID_PRIVATE_KEY=...
VAPID_SUBJECT=mailto:admin@ngutamholdings.vn
DINING_SESSION_SECRET=mot-chuoi-bi-mat-rat-dai
```

Không đưa Private Key lên GitHub.

### Bật trên thiết bị

1. Đăng nhập Seller hoặc Admin tổng.
2. Mở Dashboard.
3. Bấm **Bật thông báo nền**.
4. Chấp nhận quyền thông báo.
5. Khi nút đổi thành **Thử Push**, bấm để kiểm tra.

Trên iPhone/iPad cần thêm website vào Màn hình chính và sử dụng phiên bản hệ điều hành hỗ trợ Web Push. Production phải có HTTPS.

### Thông báo nền đang gửi cho

- Seller khi có đơn mới.
- Admin tổng khi có đơn mới.
- Seller khi khách nhắn tin.
- Admin tổng khi shop nhắn tin.
- Seller khi Admin trả lời.
- Seller khi shop được duyệt hoặc bị yêu cầu chỉnh sửa.

## 2. Phiên bàn và nhận diện khách quay lại

Mỗi QR bàn tạo hoặc tiếp tục một `DiningSession` đang mở.

Frontend lưu:

- `ngutam_guest_id`: mã thiết bị/trình duyệt.
- `ngutam_table_session_<shop>_<table>`: token phiên khách tại bàn.

Nếu khách dùng lại cùng thiết bị/trình duyệt, hệ thống tự nhận diện phiên cũ. Nếu đổi thiết bị, khách cần xác thực cùng số điện thoại OTP để liên kết lại với phiên đang mở.

## 3. Gọi thêm khi chưa thanh toán

Ví dụ Bàn 5:

- Lượt 1: cơm và nước.
- Lượt 2: gọi thêm món.
- Lượt 3: tráng miệng.

Backend tạo ba Order riêng để bếp biết món mới, nhưng tất cả có cùng:

- `diningSessionId`
- `billNumber`

POS gộp chúng thành một hóa đơn và tính tổng chung.

## 4. Gọi thêm sau khi đã thanh toán

Khi Seller xác nhận thanh toán:

- Toàn bộ lượt gọi món trong cùng hóa đơn được đánh dấu `paid`.
- Lưu cùng thời gian `paidAt`.
- Hoàn xu từng đơn theo cấu hình.
- `activeBillNumber` tăng thêm 1.

Nếu khách gọi thêm, món mới nằm trong hóa đơn tiếp theo, không sửa hóa đơn đã thanh toán.

Ví dụ:

- Bàn 5 · Hóa đơn 1 · Đã thanh toán.
- Bàn 5 · Hóa đơn 2 · Chưa thanh toán.

## 5. Đóng bàn

Tại `Dashboard → POS / Tính tiền`, khi hóa đơn hiện tại không còn khoản chưa thanh toán, Seller bấm:

**Đóng bàn / kết thúc lượt khách**

Sau đó:

- DiningSession chuyển sang `closed`.
- Token khách cũ không thể ghép vào lượt khách mới.
- Khách tiếp theo quét cùng QR sẽ tạo phiên mới.
- QR vật lý của bàn không cần in lại.

## 6. Model/API mới

Backend:

- `models/DiningSession.js`
- `models/GuestSession.js`
- `models/PushSubscription.js`
- `services/diningSessionService.js`
- `services/pushService.js`
- `controllers/diningSessionController.js`
- `controllers/pushController.js`
- `routes/diningSessionRoutes.js`
- `routes/pushRoutes.js`

Frontend:

- `src/utils/guestSession.js`
- `src/utils/webPush.js`
- `public/sw.js` có sự kiện `push`.

## 7. Biến Render cần thêm

```env
DINING_SESSION_SECRET=...
VAPID_PUBLIC_KEY=...
VAPID_PRIVATE_KEY=...
VAPID_SUBJECT=mailto:admin@ngutamholdings.vn
```

Sau khi cập nhật service worker, trên thiết bị cũ nên đóng hẳn PWA rồi mở lại. Nếu vẫn giữ cache cũ, xóa PWA và cài lại một lần.
