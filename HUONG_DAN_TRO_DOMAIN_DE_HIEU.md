# Hướng dẫn shop tự trỏ domain riêng

## 1) Nhập domain ở dashboard
Vào:

- `Dashboard shop`
- `Cài đặt`
- `Domain riêng`

Chỉ nhập **hostname** như:

- `shop.tenmien.com`

Không nhập:

- `https://shop.tenmien.com`
- `shop.tenmien.com/shop/slug`
- `https://shop.tenmien.com/dashboard`

## 2) Tạo DNS ở nơi mua domain
Ví dụ muốn dùng `shop.tenmien.com`.

Tạo bản ghi:

- **Type:** `CNAME`
- **Name / Host:** `shop`
- **Target / Value:** `YOUR-PRODUCTION-DOMAIN`  
  Ví dụ: `foodhub.onrender.com`

## 3) Thêm custom domain trên hosting
Trên hosting production (ví dụ Render):

- mở dịch vụ backend/frontend đang chạy chung
- vào phần **Custom Domains**
- thêm `shop.tenmien.com`
- chờ hệ thống cấp SSL/HTTPS

## 4) Sau khi DNS chạy xong
Mở thử:

- `https://shop.tenmien.com` → trang cửa hàng
- `https://shop.tenmien.com/dashboard` → trang quản trị shop

## 5) Nếu chưa vào được
Kiểm tra:

- DNS đã đúng chưa
- đã thêm domain trong hosting chưa
- SSL đã cấp xong chưa
- chờ 5 phút đến vài giờ để DNS cập nhật

## Ghi chú quan trọng
- Chỉ cần cấu hình **một lần**.
- Sau đó hệ thống tự nhận domain đó.
- QR tạo ra sẽ dùng domain công khai nếu shop đã lưu đúng `publicBaseUrl` hoặc domain riêng đang hoạt động.
