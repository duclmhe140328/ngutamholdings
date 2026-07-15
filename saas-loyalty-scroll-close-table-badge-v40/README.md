# FoodHub patch v40

Sửa giao diện ShopPage:

- `MÃ ĐANG ÁP DỤNG / Ưu đãi công khai` cuộn cùng nội dung Ví xu, không còn cố định dưới đáy.
- Header Ví xu luôn hiển thị và có nút `X` để đóng.
- Chừa khoảng trống cuối vùng cuộn trên mobile để không bị giỏ hàng/chat/nút xu che.
- Dịch badge `Đang gọi món tại` xuống nhẹ trên web và mobile.

## Cài đặt

Chạy từ thư mục gốc project:

```powershell
node .\saas-loyalty-scroll-close-table-badge-v40\install-loyalty-scroll-close-v40.cjs
```

Khởi động lại frontend sau khi cài.
