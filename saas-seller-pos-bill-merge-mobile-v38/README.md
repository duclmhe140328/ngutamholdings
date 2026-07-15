# v38 – Seller POS sửa hóa đơn bàn, gộp order, bỏ bàn ảo 0đ

- Chuyển chức năng thêm/sửa/xóa món và áp voucher sang Seller Dashboard > POS.
- Khi bấm Xác nhận thu tiền hoặc Đóng bàn sẽ mở modal hóa đơn tổng.
- Không còn yêu cầu khách nhập MongoDB Shop ID ở Checkout.
- Tab Đơn hàng trả 1 dòng cho 1 DiningSession, không trả từng QR order riêng.
- POS bỏ mọi phiên chưa có order / tổng 0đ để tránh bàn ảo.
- ProductDetail responsive mobile và ảnh dùng object-fit: contain.

Cài từ thư mục gốc:

```powershell
node .\saas-seller-pos-bill-merge-mobile-v38\install-seller-pos-bill-v38.cjs
```
