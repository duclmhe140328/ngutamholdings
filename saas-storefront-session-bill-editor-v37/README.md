# FoodHub v37 — Storefront ảnh đủ tỉ lệ + hóa đơn bàn gộp

## Nội dung

- Banner cửa hàng hiển thị toàn bộ ảnh bằng `contain`, có nền blur lấp khoảng trống.
- Ảnh sản phẩm, giỏ hàng, checkout và trang chi tiết không bị crop.
- Header không lặp lại tên cửa hàng; hero chỉ hiển thị tên một lần.
- Thay thẻ “Miễn phí” bằng số điện thoại.
- Thẻ thứ tư là địa chỉ cửa hàng, bấm để mở Google Maps bằng tọa độ hoặc địa chỉ đã lưu.
- Làm mới toàn bộ trang chi tiết sản phẩm theo kiểu gọn, responsive.
- Tab Đơn hàng gộp mọi lượt gọi của cùng phiên QR bàn thành một hóa đơn tổng.
- POS vẫn giữ các lượt order riêng để bếp và lịch sử hoạt động không bị mất.
- Tại checkout QR bàn, nhập đúng MongoDB `_id` của shop để mở quyền thêm/sửa/xóa món trong 15 phút.
- Khi mở sửa, hệ thống tải hóa đơn hiện tại mới nhất, gộp với món chưa gửi, cho áp mã giảm giá trên toàn bộ hóa đơn rồi tạo một bản hóa đơn thay thế. Các lượt cũ được giữ lại ở trạng thái hủy để đối soát.
- Không cho sửa hóa đơn đã nhận một phần hoặc toàn bộ thanh toán.

## Cài đặt

Chạy tại thư mục gốc dự án:

```powershell
node .\saas-storefront-session-bill-editor-v37\install-storefront-session-v37.cjs
```

Backup tự tạo trong:

```text
patch-backups/storefront-session-v37-<timestamp>
```

## Chạy kiểm tra

```powershell
cd backend
node --check controllers/orderController.js
npm run dev
```

Terminal khác:

```powershell
cd frontend
npm run dev
```
