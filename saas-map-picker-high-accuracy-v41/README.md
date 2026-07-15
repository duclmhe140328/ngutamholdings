# v41 – MapPicker GPS chính xác cao

Patch thay toàn bộ `frontend/src/components/MapPicker.jsx`.

## Sửa gì

- Bật `enableHighAccuracy: true`.
- Không sử dụng vị trí cache cũ (`maximumAge: 0`).
- Dùng `watchPosition` trong tối đa 18 giây thay vì nhận ngay kết quả đầu tiên.
- Chọn kết quả có `coords.accuracy` tốt nhất.
- Tự dùng ngay khi sai số đạt khoảng 60 m trở xuống.
- Không tự lưu kết quả có sai số trên 500 m để tránh ghim cửa hàng lệch xa.
- Hiển thị sai số GPS theo mét/km.
- Cho phép chạm bản đồ để chỉnh thủ công.
- Hoạt động cho CreateShop, Seller/LoyaltyManager và Checkout vì các màn hình đều dùng chung MapPicker.

## Cài

Chạy installer tại thư mục gốc project:

```powershell
node .\saas-map-picker-high-accuracy-v41\install-map-picker-high-accuracy-v41.cjs
```
