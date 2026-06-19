# FoodHub Atelier V6

Nền tảng nhiều nhà hàng/cửa hàng dùng chung một hệ thống, gồm storefront, QR gọi món theo bàn, POS, đơn hàng, chat realtime, Telegram, PWA, duyệt shop và domain riêng.

## Những phần đã có

- Giao diện luxury responsive cho desktop, tablet, Android và iPhone từ 320px.
- Header mobile với nút menu nằm sát bên phải.
- Nhà hàng: QR từng bàn, gọi món, POS, giao tận nơi và mang về.
- Cửa hàng: sản phẩm, giỏ hàng, checkout, giao hàng và nhận tại shop.
- Chat khách ↔ shop và shop ↔ admin tổng theo thời gian thực.
- Bong bóng chat phân biệt rõ tin của mình ở bên phải, tin người còn lại ở bên trái.
- Hội thoại được sắp xếp theo `updatedAt`, tin mới đưa box chat lên đầu.
- Phân trang và lọc hội thoại, đơn hàng, sản phẩm, shop và tài khoản.
- Shop mới ở trạng thái `pending`; chỉ xuất hiện công khai sau khi admin duyệt.
- Seller nhập domain riêng trong Dashboard → Cài đặt.
- PWA có manifest, service worker, icon Android/iOS và chế độ standalone.

## Chạy local đơn giản

### 1. Chuẩn bị môi trường

Cần Node.js 20+ và MongoDB local hoặc MongoDB Atlas.

```powershell
copy backend\.env.example backend\.env
npm run setup
npm run create-admin
npm run dev
```

Sau đó mở:

- Website: `http://localhost:5173`
- Backend: `http://localhost:5000`
- Admin: `admin@example.com` / `123456` nếu giữ nguyên `.env`

Lệnh `npm run dev` chạy đồng thời frontend và backend. Nhấn `Ctrl + C` để dừng cả hai.

## Production một service

```bash
npm run setup
npm run build
npm start
```

Backend Express phục vụ luôn `frontend/dist`, API và Socket.IO trên cùng domain. Vì vậy QR, menu, chat, PWA và dashboard không cần cấu hình hai URL riêng.

### Render

Repository đã có `render.yaml`. Chọn **New → Blueprint** và liên kết GitHub repository.

Biến môi trường tối thiểu:

```env
NODE_ENV=production
MONGO_URI=mongodb+srv://...
JWT_SECRET=mot-chuoi-bi-mat-dai
```

Telegram:

```env
TELEGRAM_BOT_TOKEN=
TELEGRAM_CHAT_ID=
```

VNPAY:

```env
VNP_TMN_CODE=
VNP_HASH_SECRET=
VNP_URL=https://sandbox.vnpayment.vn/paymentv2/vpcpay.html
VNP_RETURN_URL=https://domain-production/api/payments/vnpay-return
```

## Duyệt cửa hàng

1. Seller đăng ký và tạo shop.
2. Shop được lưu với `approvalStatus=pending`, `isActive=false`.
3. Admin vào **Admin tổng → Cửa hàng**.
4. Chọn **Duyệt** hoặc **Từ chối** kèm ghi chú.
5. Khi duyệt, shop tự kích hoạt và seller nhận thông báo realtime.

Seller vẫn có thể chuẩn bị sản phẩm, hình ảnh và cấu hình trong thời gian chờ, nhưng khách chưa truy cập được.

## Domain riêng

Seller vào:

`Dashboard → Cài đặt → Domain riêng`

Nhập dạng:

```text
shop.tenmien.com
```

Không nhập `https://` và không nhập đường dẫn.

Code tự nhận hostname và hiển thị storefront tại `/`; dashboard vẫn ở `/dashboard`. Tuy nhiên DNS và HTTPS là phần bắt buộc của internet nên cần làm đúng hai bước duy nhất:

1. Tạo CNAME của domain riêng trỏ tới domain production.
2. Thêm custom domain vào Render/hosting để cấp HTTPS.

Sau đó QR mới sẽ tự dùng dạng:

```text
https://shop.tenmien.com/table/MA_BAN
```

Không cần sửa source hoặc thêm biến môi trường cho từng shop.

## PWA

- Android/Chrome: nút **Cài ứng dụng** hoặc menu trình duyệt → Cài đặt.
- iPhone/iPad: mở Safari → Chia sẻ → Thêm vào Màn hình chính.
- Service worker không cache `/api` và `/socket.io`, tránh dữ liệu realtime bị cũ.

Sau khi cập nhật production, nên đóng/mở lại PWA hoặc xóa cache một lần để nhận service worker mới.

## Lưu ý package-lock

Bản bàn giao không chứa `package-lock.json` nội bộ. `.npmrc` đã trỏ về:

```text
https://registry.npmjs.org/
```

Vì vậy máy Windows có thể chạy `npm run setup` mà không gọi registry nội bộ.

## V13 — In hóa đơn / phiếu tính tiền có VAT

Seller có thêm mục `In hóa đơn`, hỗ trợ A4/PDF và máy in POS 80mm. Xem hướng dẫn chi tiết tại `V13_IN_HOA_DON_VAT.md`.

Lưu ý: mẫu in nội bộ không tự thay thế hóa đơn điện tử hợp pháp. Việc phát hành HĐĐT cần tích hợp nhà cung cấp hóa đơn điện tử/cơ quan thuế.

## V14: Loyalty, voucher, vòng quay và bản đồ ship
Xem tài liệu `V14_LOYALTY_COUPON_SPIN_MAP_SHIPPING.md`.

Tính năng mới:
- mã giảm giá;
- hoàn xu theo % riêng từng shop;
- 1 xu = 1 VNĐ;
- vòng quay hằng ngày theo số điện thoại đã xác thực OTP;
- đổi xu thành voucher hoặc trừ trực tiếp đơn hàng;
- ghim vị trí shop và khách trên bản đồ;
- seller đặt giá ship/km, phí tối thiểu và khoảng cách giao tối đa.

## Cập nhật V14.1 – vòng quay xu
Đã sửa lỗi bánh xe giao diện và phần thưởng backend chọn độc lập. Kim quay giờ dừng đúng ô server đã chọn, số dư ví được cập nhật ngay và đồng bộ lại từ database sau animation. Xem `V14_1_FIX_QUAY_XU.md`.

## Bản V14.2 - sửa vòng quay chính xác

- Seller cấu hình đúng 8 ô riêng biệt tại `Dashboard → Ưu đãi & xu`.
- Kim dừng giữa ô, không dừng ở ranh giới.
- Backend trả đúng số ô và giá trị xu của ô trúng.
- Kết quả và số dư được tải lại từ database sau khi quay.
- PWA cache: `foodhub-pwa-v14-2-exact-spin-slots`.

## V14.5 — sửa vòng quay chính xác
Kim, ô được làm sáng và số xu backend cộng giờ dùng chung một `rewardIndex`. Chi tiết xem `V14_5_FIX_KIM_VA_O_TRUNG.md`.

## V15: Web Push nền và phiên bàn

Xem hướng dẫn chi tiết tại `V15_WEB_PUSH_VA_PHIEN_BAN.md`.

Các biến production mới:

```env
DINING_SESSION_SECRET=...
VAPID_PUBLIC_KEY=...
VAPID_PRIVATE_KEY=...
VAPID_SUBJECT=mailto:admin@ngutamholdings.vn
```

## Cập nhật V16

Bản V16 sử dụng mô hình **một phiên bàn = một hóa đơn tổng**. Nhiều lượt gọi món, nhiều tên khách và nhiều lần thanh toán đều được gộp trong cùng phiên. Khi nhân viên xác nhận đã thu đủ tiền và đóng bàn, hệ thống chốt hóa đơn tổng, cộng xu theo số điện thoại (nếu có) và mở mẫu in hóa đơn.

Xem chi tiết tại `V16_HOA_DON_TONG_PHIEN_BAN_TICH_XU.md`.
