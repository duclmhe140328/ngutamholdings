# V14 — Mã giảm giá, tích xu, vòng quay và phí ship theo bản đồ

## Quy ước xu
- 1 xu = 1 VNĐ.
- 1.000 xu = 1.000 VNĐ.
- Ví xu được tách riêng theo từng shop và theo số điện thoại đã xác thực OTP.

## Seller cấu hình
Vào `Dashboard → Ưu đãi & xu` để:
- bật/tắt ví xu;
- đặt % hoàn xu sau khi đơn được xác nhận đã thanh toán;
- đặt tối đa % giá trị đơn được dùng xu;
- cấu hình các ô thưởng vòng quay hằng ngày;
- tạo mã giảm giá công khai;
- tạo voucher đổi bằng xu;
- xem ví xu khách hàng và lịch sử giao dịch;
- ghim vị trí cửa hàng;
- đặt phí mở đơn, giá ship/km, phí tối thiểu và khoảng cách giao tối đa.

## Luồng khách hàng
1. Khách mở `Ví xu & ưu đãi` trên trang shop.
2. Nhập số điện thoại và xác thực OTP.
3. Xem số dư xu của riêng shop đó.
4. Mỗi ngày quay tối đa một lần.
5. Đổi xu thành voucher hoặc dùng xu trừ trực tiếp ở checkout.
6. Khi đơn được xác nhận `Đã thanh toán`, hệ thống tự cộng xu theo % seller đã đặt.

## OTP local
Trong `backend/.env`:
```env
OTP_DEV_MODE=true
OTP_DEV_CODE=123456
```
Khi chạy local, API trả mã dev để test.

## OTP production
Production phải dùng SMS thật:
```env
OTP_DEV_MODE=false
SMS_OTP_WEBHOOK_URL=https://webhook-cua-ban.example/send-otp
SMS_OTP_WEBHOOK_TOKEN=...
LOYALTY_JWT_SECRET=chuoi-bi-mat-dai
OTP_HASH_SECRET=chuoi-hash-dai
```
Webhook nhận JSON:
```json
{
  "phone": "09xxxxxxxx",
  "code": "123456",
  "message": "Ma OTP FoodHub cua ban la 123456..."
}
```
Webhook cần chuyển nội dung này sang nhà cung cấp SMS của bạn.

## Bản đồ và phí ship
- Seller ghim tọa độ cửa hàng khi tạo shop hoặc trong `Ưu đãi & xu`.
- Khách ghim vị trí nhận hàng hoặc dùng GPS tại checkout.
- Phí ship = phí mở đơn + khoảng cách ước tính × giá/km.
- Kết quả làm tròn lên 1.000đ và không thấp hơn phí tối thiểu.
- `shippingDistanceFactor` mặc định 1.2 để bù chênh lệch giữa đường thẳng và đường đi thực tế.
- Bản đồ dùng Leaflet + OpenStreetMap. Khi lưu lượng lớn, nên đổi sang nhà cung cấp tile/routing có SLA.

## Mã giảm giá
Seller có thể đặt:
- giảm tiền cố định hoặc theo %;
- mức giảm tối đa;
- đơn tối thiểu;
- ngày bắt đầu/kết thúc;
- tổng lượt dùng;
- lượt dùng trên mỗi số điện thoại;
- số xu cần để đổi voucher.

## Chạy
```powershell
npm run setup
npm run dev
```
Production:
```powershell
npm run install:all
npm run build
npm start
```

## Khoảng cách đường bộ tùy chọn
Nếu có dịch vụ routing tương thích OSRM, đặt:
```env
ROUTING_API_URL=https://routing-domain-cua-ban
```
Hệ thống ưu tiên km đường bộ từ API. Nếu API trống hoặc lỗi, hệ thống tự quay về công thức khoảng cách địa lý nhân hệ số seller đã cấu hình.
