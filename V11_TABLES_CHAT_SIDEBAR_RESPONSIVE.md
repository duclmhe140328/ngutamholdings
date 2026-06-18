# FoodHub Atelier V11

## 1. Thêm bàn sau khi đăng ký

Chỉ áp dụng khi shop có:

- `businessType = restaurant`
- `serviceModes` chứa `dine_in`

Vào:

`Dashboard shop → Bàn & QR`

Nhập số bàn muốn thêm và bấm **Thêm bàn**.

Hệ thống sẽ:

1. Nối tiếp số bàn hiện tại.
2. Tạo token QR riêng cho từng bàn.
3. Cập nhật tổng số bàn của shop.
4. Hiển thị QR mới ngay trong danh sách.
5. Phân trang 12 bàn/trang.

Shop bán hàng giao ship thông thường sẽ không thấy chức năng này.

## 2. Chat trên điện thoại

- Chọn một hội thoại để mở màn hình chat.
- Nút **← Danh sách** luôn nằm trên header cuộc trò chuyện.
- Bấm nút này để quay lại và chọn tài khoản khác.
- Áp dụng cho Seller và Admin tổng.

## 3. Sidebar quản trị

Desktop:

- Sidebar chỉ cao bằng nội dung của nó.
- Sidebar sticky trong viewport.
- Không còn cột tối kéo dài tạo khoảng trống.

Tablet/mobile:

- Sidebar chuyển thành thanh tác vụ ngang sticky.
- Có thể vuốt ngang để chọn mục quản trị.

## 4. Responsive

Đã bổ sung responsive cho:

- Dashboard Seller/Admin.
- Bàn & QR.
- POS và đơn hàng.
- Sản phẩm.
- Chat.
- Form cài đặt.
- Checkout và chi tiết sản phẩm.
- Mobile từ 320px và tablet dọc/ngang.

## 5. Chạy local

```powershell
npm run setup
npm run dev
```

Mở `http://localhost:5173`.

## 6. Production

```bash
npm run install:all
npm run build
npm start
```

PWA cache version: `foodhub-pwa-v11-tables-chat-mobile`.
